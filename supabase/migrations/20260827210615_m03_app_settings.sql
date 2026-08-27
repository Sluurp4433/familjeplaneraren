-- M03 – Singleton-inställningar (redigeringsfönster, materialiserings-horisont,
-- påminnelse-lookback, digest-schema, GDPR-retention).

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  edit_window_hours integer not null default 24,
  materialize_horizon_months integer not null default 12,
  reminder_lookback_minutes integer not null default 30,
  digest_enabled boolean not null default true,
  digest_weekday integer not null default 1 check (digest_weekday between 0 and 6),
  digest_hour integer not null default 17 check (digest_hour between 0 and 23),
  retention_months integer not null default 24,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- "Författare får ändra egen post inom N timmar" – speglas klientsidan i canEditOwn().
-- Privat schema: används bara i RLS-policies, aldrig via API.
create or replace function private.within_edit_window(created timestamptz)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select created > now() - make_interval(hours => (select edit_window_hours from public.app_settings where id = 1));
$$;
revoke all on function private.within_edit_window(timestamptz) from public, anon;
grant execute on function private.within_edit_window(timestamptz) to authenticated, service_role;

drop trigger if exists trg_app_settings_updated on public.app_settings;
create trigger trg_app_settings_updated
  before update on public.app_settings for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings for select to authenticated
  using (private.is_approved(auth.uid()));

drop policy if exists settings_update on public.app_settings;
create policy settings_update on public.app_settings for update to authenticated
  using (private.is_super_admin(auth.uid()))
  with check (private.is_super_admin(auth.uid()));
