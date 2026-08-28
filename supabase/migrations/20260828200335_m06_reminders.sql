-- M06 – Påminnelser via e-post.
--
-- Varje händelse (och serie) kan ha N påminnelser: ett tidsavstånd (X min innan,
-- "kvällen innan kl HH:MM", "morgonen kl HH:MM", eller exakt tidpunkt), ett
-- meddelande och en "ta med"-lista. En trigger räknar ut fire_at (väggklocka i
-- gruppens tidszon). pg_cron var 10:e min hittar förfallna, claim:ar dem
-- idempotent i reminder_log och postar till edge-funktionen send-reminders som
-- skickar via Resend.

create extension if not exists pg_net with schema extensions;

-- Server-sidig konfig (funktions-URL + delad hemlighet). Läses bara av
-- security-definer-funktioner; ingen RLS-åtkomst alls.
create table if not exists private.app_config (
  key text primary key,
  value text not null
);
revoke all on table private.app_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------
create table if not exists public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  offset_kind text not null check (offset_kind in
    ('minutes_before', 'evening_before', 'morning_of', 'custom_datetime')),
  offset_minutes integer,
  at_time time,
  fire_at timestamptz,
  message text,
  bring_list text[] not null default '{}',
  recipient_mode text not null default 'assignees'
    check (recipient_mode in ('assignees', 'group_adults', 'custom')),
  custom_emails text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_event_reminders_event on public.event_reminders (event_id);
create index if not exists idx_event_reminders_fire_at on public.event_reminders (fire_at);

create table if not exists public.event_series_reminders (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.event_series(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  offset_kind text not null check (offset_kind in
    ('minutes_before', 'evening_before', 'morning_of')),
  offset_minutes integer,
  at_time time,
  message text,
  bring_list text[] not null default '{}',
  recipient_mode text not null default 'assignees'
    check (recipient_mode in ('assignees', 'group_adults', 'custom')),
  custom_emails text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_event_series_reminders_series on public.event_series_reminders (series_id);

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.event_reminders(id) on delete cascade,
  fire_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  error text,
  unique (reminder_id, fire_at)
);
create index if not exists idx_reminder_log_status on public.reminder_log (status, fire_at);

-- ---------------------------------------------------------------------------
-- fire_at-beräkning
-- ---------------------------------------------------------------------------
create or replace function private.reminder_fire_at(
  p_kind text, p_offset_minutes integer, p_at_time time, p_custom timestamptz,
  p_starts_at timestamptz, p_tz text
) returns timestamptz language sql immutable set search_path = public, pg_temp
as $$
  select case p_kind
    when 'minutes_before' then p_starts_at - make_interval(mins => coalesce(p_offset_minutes, 0))
    when 'morning_of' then
      (((p_starts_at at time zone p_tz)::date + coalesce(p_at_time, time '07:00'))::timestamp) at time zone p_tz
    when 'evening_before' then
      ((((p_starts_at at time zone p_tz)::date - 1) + coalesce(p_at_time, time '18:00'))::timestamp) at time zone p_tz
    when 'custom_datetime' then p_custom
  end;
$$;
revoke all on function private.reminder_fire_at(text, integer, time, timestamptz, timestamptz, text) from public, anon, authenticated;

create or replace function public.event_reminders_set_fire_at()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_starts timestamptz; v_tz text;
begin
  select e.starts_at, g.timezone into v_starts, v_tz
  from public.events e join public.groups g on g.id = e.group_id
  where e.id = new.event_id;
  if new.offset_kind = 'custom_datetime' then
    new.fire_at := new.fire_at;  -- sätts direkt av klienten
  else
    new.fire_at := private.reminder_fire_at(
      new.offset_kind, new.offset_minutes, new.at_time, null, v_starts, coalesce(v_tz, 'Europe/Stockholm'));
  end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.event_reminders_set_fire_at() from public, anon, authenticated;
drop trigger if exists trg_event_reminders_fire_at on public.event_reminders;
create trigger trg_event_reminders_fire_at before insert or update on public.event_reminders
  for each row execute function public.event_reminders_set_fire_at();

-- Räkna om påminnelser när en händelses tid ändras.
create or replace function public.events_recompute_reminders()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    update public.event_reminders set updated_at = now() where event_id = new.id;
  end if;
  return new;
end; $$;
revoke all on function public.events_recompute_reminders() from public, anon, authenticated;
drop trigger if exists trg_events_recompute_reminders on public.events;
create trigger trg_events_recompute_reminders after update on public.events
  for each row execute function public.events_recompute_reminders();

drop trigger if exists trg_audit_event_reminders on public.event_reminders;
create trigger trg_audit_event_reminders after insert or update or delete on public.event_reminders
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- Utöka materialiseraren: kopiera serie-påminnelser till nya förekomster.
-- ---------------------------------------------------------------------------
create or replace function public.materialize_series(p_series uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s public.event_series;
  tz text; horizon date; d date;
  s_at timestamptz; e_at timestamptz; ev_id uuid; made integer := 0;
begin
  select * into s from public.event_series where id = p_series;
  if not found then return 0; end if;
  select timezone into tz from public.groups where id = s.group_id;
  tz := coalesce(tz, 'Europe/Stockholm');
  horizon := (current_date + make_interval(months =>
    (select materialize_horizon_months from public.app_settings where id = 1)))::date;

  for d in select * from private.series_candidate_dates(s, horizon) loop
    if s.all_day then
      s_at := (d::timestamp) at time zone tz;
      e_at := ((d + 1)::timestamp) at time zone tz;
    else
      s_at := ((d + coalesce(s.start_time, time '00:00'))::timestamp) at time zone tz;
      e_at := s_at + make_interval(mins => s.duration_minutes);
    end if;

    select id into ev_id from public.events where series_id = p_series and occurrence_date = d;

    if ev_id is null then
      insert into public.events (group_id, series_id, occurrence_date, title, starts_at, ends_at,
        all_day, location, notes, icon_key, is_private, pickup_person_id, dropoff_person_id,
        status, overridden, created_by)
      values (s.group_id, p_series, d, s.title, s_at, e_at,
        s.all_day, s.location, s.notes, s.icon_key, s.is_private, s.pickup_person_id, s.dropoff_person_id,
        'active', false, s.created_by)
      returning id into ev_id;
      insert into public.event_assignees (event_id, person_id, group_id)
        select ev_id, person_id, s.group_id from public.event_series_assignees where series_id = p_series;
      insert into public.event_reminders (event_id, group_id, offset_kind, offset_minutes, at_time,
        message, bring_list, recipient_mode, custom_emails, created_by)
        select ev_id, s.group_id, offset_kind, offset_minutes, at_time,
               message, bring_list, recipient_mode, custom_emails, s.created_by
        from public.event_series_reminders where series_id = p_series;
      made := made + 1;
    else
      update public.events set
        title = s.title, starts_at = s_at, ends_at = e_at, all_day = s.all_day,
        location = s.location, notes = s.notes, icon_key = s.icon_key, is_private = s.is_private,
        pickup_person_id = s.pickup_person_id, dropoff_person_id = s.dropoff_person_id
      where id = ev_id and overridden = false and status = 'active';
      if found then
        delete from public.event_assignees where event_id = ev_id;
        insert into public.event_assignees (event_id, person_id, group_id)
          select ev_id, person_id, s.group_id from public.event_series_assignees where series_id = p_series;
        delete from public.event_reminders where event_id = ev_id;
        insert into public.event_reminders (event_id, group_id, offset_kind, offset_minutes, at_time,
          message, bring_list, recipient_mode, custom_emails, created_by)
          select ev_id, s.group_id, offset_kind, offset_minutes, at_time,
                 message, bring_list, recipient_mode, custom_emails, s.created_by
          from public.event_series_reminders where series_id = p_series;
      end if;
    end if;
  end loop;

  delete from public.events e
  where e.series_id = p_series and e.overridden = false and e.occurrence_date > current_date
    and not exists (select 1 from private.series_candidate_dates(s, horizon) c where c = e.occurrence_date);

  return made;
end; $$;
revoke all on function public.materialize_series(uuid) from public, anon, authenticated;
grant execute on function public.materialize_series(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Claim + dispatch
-- ---------------------------------------------------------------------------
create or replace function public.claim_due_reminders()
returns setof public.reminder_log language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_lookback integer;
begin
  select reminder_lookback_minutes into v_lookback from public.app_settings where id = 1;

  return query
  insert into public.reminder_log (reminder_id, fire_at, status, attempts, claimed_at)
  select r.id, r.fire_at, 'pending', 1, now()
  from public.event_reminders r
  join public.events e on e.id = r.event_id and e.status = 'active'
  where r.fire_at is not null
    and r.fire_at <= now()
    and r.fire_at > now() - make_interval(mins => coalesce(v_lookback, 30) + 1440)
  on conflict (reminder_id, fire_at) do nothing
  returning *;

  -- försök om misslyckade (max 5)
  update public.reminder_log
  set status = 'pending', attempts = attempts + 1, claimed_at = now()
  where status = 'failed' and attempts < 5;
end; $$;
revoke all on function public.claim_due_reminders() from public, anon, authenticated;

create or replace function public.dispatch_due_reminders()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_n integer; v_url text; v_secret text;
begin
  select count(*) into v_n from public.claim_due_reminders();
  if v_n = 0 then return; end if;
  select value into v_url from private.app_config where key = 'reminders_url';
  select value into v_secret from private.app_config where key = 'cron_secret';
  if v_url is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', coalesce(v_secret, '')),
    body := '{}'::jsonb
  );
end; $$;
revoke all on function public.dispatch_due_reminders() from public, anon, authenticated;

select cron.schedule('dispatch-reminders', '*/10 * * * *', $$select public.dispatch_due_reminders();$$);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.event_reminders enable row level security;
alter table public.event_series_reminders enable row level security;
alter table public.reminder_log enable row level security;

drop policy if exists event_reminders_select on public.event_reminders;
create policy event_reminders_select on public.event_reminders for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));

drop policy if exists event_reminders_write on public.event_reminders;
create policy event_reminders_write on public.event_reminders for all to authenticated
  using (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or exists (select 1 from public.events e
                    where e.id = event_id and e.created_by = auth.uid()
                      and private.is_group_writer(e.group_id)))
  )
  with check (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or exists (select 1 from public.events e
                    where e.id = event_id and e.created_by = auth.uid()
                      and private.is_group_writer(e.group_id)))
  );

drop policy if exists event_series_reminders_select on public.event_series_reminders;
create policy event_series_reminders_select on public.event_series_reminders for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));

drop policy if exists event_series_reminders_write on public.event_series_reminders;
create policy event_series_reminders_write on public.event_series_reminders for all to authenticated
  using (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or exists (select 1 from public.event_series s
                    where s.id = series_id and s.created_by = auth.uid()
                      and private.is_group_writer(s.group_id)))
  )
  with check (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or exists (select 1 from public.event_series s
                    where s.id = series_id and s.created_by = auth.uid()
                      and private.is_group_writer(s.group_id)))
  );

-- reminder_log: bara superadmin läser, ingen klient skriver.
drop policy if exists reminder_log_select on public.reminder_log;
create policy reminder_log_select on public.reminder_log for select to authenticated
  using (private.is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Serie-påminnelser triggar re-materialisering (FK-ordning som assignees).
-- ---------------------------------------------------------------------------
create or replace function public.trg_materialize_from_series_reminder()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public.materialize_series(coalesce(new.series_id, old.series_id));
  return coalesce(new, old);
end; $$;
revoke all on function public.trg_materialize_from_series_reminder() from public, anon, authenticated;
drop trigger if exists trg_series_reminder_materialize on public.event_series_reminders;
create trigger trg_series_reminder_materialize after insert or delete on public.event_series_reminders
  for each row execute function public.trg_materialize_from_series_reminder();

drop trigger if exists trg_audit_event_series_reminders on public.event_series_reminders;
create trigger trg_audit_event_series_reminders after insert or update or delete on public.event_series_reminders
  for each row execute function public.audit_trigger();
