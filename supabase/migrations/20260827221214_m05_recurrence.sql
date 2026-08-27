-- M05 – Återkommande händelser.
--
-- Modell: event_series (liten RRULE-delmängd) → materialiseras till konkreta
-- events-rader via trigger + daglig pg_cron, ut till app_settings.materialize_
-- horizon_months. Instansundantag = events-rad med overridden=true (redigerad)
-- eller status='cancelled' (borttagen enskild). Materialiseraren rör aldrig
-- sådana rader.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------
create table if not exists public.event_series (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  location text,
  notes text,
  all_day boolean not null default false,
  start_time time,                       -- null ⇒ heldag
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  icon_key text,
  is_private boolean not null default false,
  freq text not null check (freq in ('weekly', 'monthly')),
  interval integer not null default 1 check (interval >= 1),
  byweekday integer[],                    -- 0=mån .. 6=sön (weekly)
  bymonthday integer,                     -- 1..31 (monthly)
  dtstart date not null,
  until date,
  count integer,
  pickup_person_id uuid references public.people(id) on delete set null,
  dropoff_person_id uuid references public.people(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_series_end check (until is null or count is null)
);
create index if not exists idx_event_series_group on public.event_series (group_id);

create table if not exists public.event_series_assignees (
  series_id uuid not null references public.event_series(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (series_id, person_id)
);

-- Nu finns event_series → koppla på FK:n från events.series_id.
alter table public.events drop constraint if exists events_series_id_fkey;
alter table public.events add constraint events_series_id_fkey
  foreign key (series_id) references public.event_series(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Trigger-hjälpare
-- ---------------------------------------------------------------------------
drop trigger if exists trg_event_series_created_by on public.event_series;
create trigger trg_event_series_created_by before insert on public.event_series
  for each row execute function public.set_created_by();
drop trigger if exists trg_event_series_updated on public.event_series;
create trigger trg_event_series_updated before update on public.event_series
  for each row execute function public.set_updated_at();

create or replace function public.event_series_assignees_denorm_group()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_series_group uuid; v_person_group uuid;
begin
  select group_id into v_series_group from public.event_series where id = new.series_id;
  select group_id into v_person_group from public.people where id = new.person_id;
  if v_series_group is null or v_person_group is distinct from v_series_group then
    raise exception 'Personen måste tillhöra samma familj som serien';
  end if;
  new.group_id := v_series_group;
  return new;
end; $$;
revoke all on function public.event_series_assignees_denorm_group() from public, anon, authenticated;
drop trigger if exists trg_event_series_assignees_denorm on public.event_series_assignees;
create trigger trg_event_series_assignees_denorm before insert or update on public.event_series_assignees
  for each row execute function public.event_series_assignees_denorm_group();

drop trigger if exists trg_audit_event_series on public.event_series;
create trigger trg_audit_event_series after insert or update or delete on public.event_series
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- Kandidatdatum för en serie fram till horisonten
-- ---------------------------------------------------------------------------
create or replace function private.series_candidate_dates(s public.event_series, horizon date)
returns setof date language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  d date;
  limit_date date := least(coalesce(s.until, horizon), horizon);
  n integer := 0;
  cap integer := coalesce(s.count, 100000);
  wds integer[] := coalesce(nullif(s.byweekday, '{}'), array[ (extract(isodow from s.dtstart)::int - 1) ]);
  mday integer := coalesce(s.bymonthday, extract(day from s.dtstart)::int);
  start_week date := date_trunc('week', s.dtstart)::date;
  m date;
begin
  if s.freq = 'weekly' then
    d := s.dtstart;
    while d <= limit_date and n < cap loop
      if (floor((date_trunc('week', d)::date - start_week) / 7)::int % s.interval) = 0
         and ((extract(isodow from d)::int - 1) = any (wds)) then
        return next d;
        n := n + 1;
      end if;
      d := d + 1;
    end loop;
  else -- monthly
    m := date_trunc('month', s.dtstart)::date;
    while m <= limit_date and n < cap loop
      d := m + (mday - 1);
      if extract(month from d) = extract(month from m)  -- hoppa ogiltiga (t.ex. 31 feb)
         and d >= s.dtstart and d <= limit_date then
        return next d;
        n := n + 1;
      end if;
      m := (m + interval '1 month' * s.interval)::date;
    end loop;
  end if;
end; $$;
revoke all on function private.series_candidate_dates(public.event_series, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Materialisera en serie: infoga saknade, uppdatera icke-överridna,
-- ta bort framtida icke-överridna som inte längre är kandidater.
-- ---------------------------------------------------------------------------
create or replace function public.materialize_series(p_series uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s public.event_series;
  tz text;
  horizon date;
  d date;
  s_at timestamptz;
  e_at timestamptz;
  ev_id uuid;
  made integer := 0;
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

    select id into ev_id from public.events
      where series_id = p_series and occurrence_date = d;

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
      made := made + 1;
    else
      -- uppdatera bara rader som användaren inte rört
      update public.events set
        title = s.title, starts_at = s_at, ends_at = e_at, all_day = s.all_day,
        location = s.location, notes = s.notes, icon_key = s.icon_key, is_private = s.is_private,
        pickup_person_id = s.pickup_person_id, dropoff_person_id = s.dropoff_person_id
      where id = ev_id and overridden = false and status = 'active';
      if found then
        delete from public.event_assignees where event_id = ev_id;
        insert into public.event_assignees (event_id, person_id, group_id)
          select ev_id, person_id, s.group_id from public.event_series_assignees where series_id = p_series;
      end if;
    end if;
  end loop;

  -- rensa framtida icke-överridna rader som inte längre är kandidater
  delete from public.events e
  where e.series_id = p_series
    and e.overridden = false
    and e.occurrence_date > current_date
    and not exists (
      select 1 from private.series_candidate_dates(s, horizon) c where c = e.occurrence_date
    );

  return made;
end; $$;
-- Anropas bara av triggern (som definer) och cron – aldrig direkt via API.
revoke all on function public.materialize_series(uuid) from public, anon, authenticated;
grant execute on function public.materialize_series(uuid) to service_role;

create or replace function public.materialize_all_series()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare r uuid;
begin
  for r in select id from public.event_series loop
    perform public.materialize_series(r);
  end loop;
end; $$;
revoke all on function public.materialize_all_series() from public, anon, authenticated;

-- Materialisera direkt när en serie skapas/ändras.
create or replace function public.trg_materialize_series()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public.materialize_series(new.id);
  return new;
end; $$;
revoke all on function public.trg_materialize_series() from public, anon, authenticated;
drop trigger if exists trg_event_series_materialize on public.event_series;
create trigger trg_event_series_materialize after insert or update on public.event_series
  for each row execute function public.trg_materialize_series();

-- Ansvariga läggs till efter att serien skapats (FK) → re-materialisera då.
create or replace function public.trg_materialize_series_from_assignee()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public.materialize_series(coalesce(new.series_id, old.series_id));
  return coalesce(new, old);
end; $$;
revoke all on function public.trg_materialize_series_from_assignee() from public, anon, authenticated;
drop trigger if exists trg_series_assignee_materialize on public.event_series_assignees;
create trigger trg_series_assignee_materialize after insert or delete on public.event_series_assignees
  for each row execute function public.trg_materialize_series_from_assignee();

-- Och en gång per natt (rullande horisont).
select cron.schedule('materialize-series', '20 3 * * *', $$select public.materialize_all_series();$$);

-- ---------------------------------------------------------------------------
-- "Denna och kommande" – dela serien vid ett givet datum.
-- OBS: security definer + RPC-anropbar med avsiktlig egen behörighetskoll
-- inuti (is_group_admin/writer + författare). Security advisor flaggar 0029
-- för detta – accepterat, samma mönster som N-BV:s gdpr_purge.
-- ---------------------------------------------------------------------------
create or replace function public.series_split(p_from_event uuid, patch jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  ev public.events;
  s public.event_series;
  new_series uuid;
  cut date;
begin
  select * into ev from public.events where id = p_from_event;
  if ev.series_id is null then raise exception 'Händelsen tillhör ingen serie'; end if;
  select * into s from public.event_series where id = ev.series_id;

  if not (private.is_group_admin(s.group_id)
          or (private.is_group_writer(s.group_id) and s.created_by = auth.uid())) then
    raise exception 'Behörighet saknas';
  end if;

  cut := ev.occurrence_date;

  -- kapa gamla serien dagen innare
  update public.event_series set until = cut - 1, count = null where id = s.id;
  delete from public.events
    where series_id = s.id and occurrence_date >= cut and overridden = false;

  -- klona serien med patch, från och med cut
  insert into public.event_series (group_id, title, location, notes, all_day, start_time,
    duration_minutes, icon_key, is_private, freq, interval, byweekday, bymonthday,
    dtstart, until, count, pickup_person_id, dropoff_person_id, created_by)
  values (
    s.group_id,
    coalesce(patch->>'title', s.title),
    coalesce(patch->>'location', s.location),
    coalesce(patch->>'notes', s.notes),
    coalesce((patch->>'all_day')::boolean, s.all_day),
    coalesce((patch->>'start_time')::time, s.start_time),
    coalesce((patch->>'duration_minutes')::int, s.duration_minutes),
    coalesce(patch->>'icon_key', s.icon_key),
    coalesce((patch->>'is_private')::boolean, s.is_private),
    coalesce(patch->>'freq', s.freq),
    coalesce((patch->>'interval')::int, s.interval),
    coalesce((select array_agg(value::int) from jsonb_array_elements_text(patch->'byweekday')), s.byweekday),
    coalesce((patch->>'bymonthday')::int, s.bymonthday),
    cut,
    (patch->>'until')::date,
    (patch->>'count')::int,
    coalesce((patch->>'pickup_person_id')::uuid, s.pickup_person_id),
    coalesce((patch->>'dropoff_person_id')::uuid, s.dropoff_person_id),
    s.created_by
  )
  returning id into new_series;

  -- kopiera ansvariga (patch kan ange nya via assignee_ids)
  if patch ? 'assignee_ids' then
    insert into public.event_series_assignees (series_id, person_id, group_id)
      select new_series, value::uuid, s.group_id from jsonb_array_elements_text(patch->'assignee_ids');
  else
    insert into public.event_series_assignees (series_id, person_id, group_id)
      select new_series, person_id, s.group_id from public.event_series_assignees where series_id = s.id;
  end if;

  return new_series;
end; $$;
revoke all on function public.series_split(uuid, jsonb) from public, anon;
grant execute on function public.series_split(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS – event_series & event_series_assignees (samma quad som events)
-- ---------------------------------------------------------------------------
alter table public.event_series enable row level security;
alter table public.event_series_assignees enable row level security;

drop policy if exists event_series_select on public.event_series;
create policy event_series_select on public.event_series for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));

drop policy if exists event_series_insert on public.event_series;
create policy event_series_insert on public.event_series for insert to authenticated
  with check (private.is_approved(auth.uid()) and private.is_group_writer(group_id)
              and created_by = auth.uid());

drop policy if exists event_series_update on public.event_series;
create policy event_series_update on public.event_series for update to authenticated
  using (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or (private.is_group_writer(group_id) and created_by = auth.uid()
             and private.within_edit_window(created_at)))
  )
  with check (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or (private.is_group_writer(group_id) and created_by = auth.uid()))
  );

drop policy if exists event_series_delete on public.event_series;
create policy event_series_delete on public.event_series for delete to authenticated
  using (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or (private.is_group_writer(group_id) and created_by = auth.uid()))
  );

drop policy if exists event_series_assignees_select on public.event_series_assignees;
create policy event_series_assignees_select on public.event_series_assignees for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));

drop policy if exists event_series_assignees_write on public.event_series_assignees;
create policy event_series_assignees_write on public.event_series_assignees for all to authenticated
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
