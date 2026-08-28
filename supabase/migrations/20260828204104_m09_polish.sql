-- M09 – Polish: GDPR-städning, auditrensning, veckans-schema-digest.
--
-- purge_audit_logs / gdpr_purge är security definer + RPC-anropbara med egen
-- superadmin-koll inuti (samma mönster som series_split / add_meal_to_list).
-- Security advisor 0029 flaggar dessa – accepterat och avsiktligt.

-- ---------------------------------------------------------------------------
-- Auditrensning – enda sanktionerade sättet att ta bort ur audit_logs.
-- ---------------------------------------------------------------------------
create or replace function public.purge_audit_logs(older_than_days integer default 365)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  if not private.is_super_admin(auth.uid()) then
    raise exception 'Endast superadmin';
  end if;
  set local session_replication_role = 'replica';   -- kringgår guard-triggern
  delete from public.audit_logs where created_at < now() - make_interval(days => older_than_days);
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.purge_audit_logs(integer) from public, anon;
grant execute on function public.purge_audit_logs(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- GDPR-retention – tar bort gamla händelser/loggar enligt app_settings.
-- dry_run = true returnerar bara antal.
-- ---------------------------------------------------------------------------
create or replace function public.gdpr_purge(dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_months integer;
  v_cutoff timestamptz;
  v_events integer;
  v_audit integer;
  v_rlog integer;
begin
  if not private.is_super_admin(auth.uid()) then
    raise exception 'Endast superadmin';
  end if;
  select retention_months into v_months from public.app_settings where id = 1;
  v_cutoff := now() - make_interval(months => coalesce(v_months, 24));

  select count(*) into v_events from public.events
    where ends_at < v_cutoff and (series_id is null or overridden);
  select count(*) into v_audit from public.audit_logs where created_at < v_cutoff;
  select count(*) into v_rlog from public.reminder_log where fire_at < v_cutoff;

  if not dry_run then
    delete from public.events where ends_at < v_cutoff and (series_id is null or overridden);
    set local session_replication_role = 'replica';
    delete from public.audit_logs where created_at < v_cutoff;
    set local session_replication_role = 'origin';
    delete from public.reminder_log where fire_at < v_cutoff;
  end if;

  return jsonb_build_object(
    'dry_run', dry_run, 'cutoff', v_cutoff,
    'events', v_events, 'audit_logs', v_audit, 'reminder_log', v_rlog);
end; $$;
revoke all on function public.gdpr_purge(boolean) from public, anon;
grant execute on function public.gdpr_purge(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Veckans schema – digest per familj.
-- ---------------------------------------------------------------------------
create table if not exists public.digest_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  period_start date not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error text,
  unique (group_id, period_start)
);

alter table public.digest_log enable row level security;
drop policy if exists digest_log_select on public.digest_log;
create policy digest_log_select on public.digest_log for select to authenticated
  using (private.is_super_admin(auth.uid()));

create or replace function public.dispatch_weekly_digest()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s public.app_settings;
  v_now timestamptz := now() at time zone 'Europe/Stockholm';
  v_url text;
  v_secret text;
  v_claimed integer := 0;
begin
  select * into s from public.app_settings where id = 1;
  if not s.digest_enabled then return; end if;
  -- kör bara på rätt veckodag + timme (Europe/Stockholm)
  if (extract(isodow from v_now)::int % 7) <> s.digest_weekday then return; end if;
  if extract(hour from v_now)::int <> s.digest_hour then return; end if;

  insert into public.digest_log (group_id, period_start)
  select g.id, current_date from public.groups g
  on conflict (group_id, period_start) do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then return; end if;

  select value into v_url from private.app_config where key = 'digest_url';
  select value into v_secret from private.app_config where key = 'cron_secret';
  if v_url is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', coalesce(v_secret, '')),
    body := '{}'::jsonb);
end; $$;
revoke all on function public.dispatch_weekly_digest() from public, anon, authenticated;

select cron.schedule('weekly-digest', '5 * * * *', $$select public.dispatch_weekly_digest();$$);
