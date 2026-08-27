-- M01 – Extensions, privat schema för gate-funktioner, profiler, auditlogg.
--
-- Gate-funktionerna ligger i schemat `private` (inte exponerat av PostgREST) så
-- de aldrig kan anropas via /rest/v1/rpc, men fortfarande kan användas i
-- RLS-policies. security definer → kringgår RLS, ingen rekursion (samma idé som
-- N-BV:s is_admin(), men utan att ligga i det publika API-schemat).

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

-- Roll per familjegrupp (används i M02). admin > medlem > begransad.
do $$ begin
  create type public.group_role as enum ('admin', 'medlem', 'begransad');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles: en rad per inloggad person. approved = global åtkomstspärr
-- (nyregistrerad ser ingenting förrän superadmin godkänt).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  approved boolean not null default false,
  is_super_admin boolean not null default false,
  notify_email boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_logs: append-only. Endast trigger skriver; DELETE/TRUNCATE blockeras.
-- group_id finns redan nu så M09 bara behöver koppla fler triggers.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  group_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_group on public.audit_logs (group_id);

-- ---------------------------------------------------------------------------
-- Globala gate-funktioner (privat schema, security definer → kringgår RLS).
-- ---------------------------------------------------------------------------
create or replace function private.is_super_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles p where p.id = uid and p.is_super_admin); $$;

create or replace function private.is_approved(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles p where p.id = uid and (p.approved or p.is_super_admin)); $$;

-- ---------------------------------------------------------------------------
-- Delade trigger-hjälpare.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'updated_by' then new.updated_by := auth.uid(); end if;
  return new;
end; $$;

create or replace function public.set_created_by()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end; $$;

-- Skydda privilegie-kolumner. Endast superadmin (via egen JWT) eller
-- service_role (edge functions: godkännande, bootstrap) får ändra dem.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_is_service boolean := coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role', false);
begin
  if not v_is_service and not private.is_super_admin(auth.uid()) then
    new.is_super_admin := old.is_super_admin;
    new.approved := old.approved;
    new.id := old.id;
  end if;
  return new;
end; $$;

-- Skapa profil automatiskt vid ny auth-användare. Läser ENDAST name från
-- metadata – privilegier sätts aldrig av användaren själv.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Generisk auditlogg-trigger.
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_record_id text;
  v_details jsonb;
  v_group_id uuid;
  v_row jsonb;
begin
  if (tg_op = 'DELETE') then
    v_record_id := old.id::text;
    v_details := jsonb_build_object('old', to_jsonb(old));
    v_row := to_jsonb(old);
  elsif (tg_op = 'UPDATE') then
    v_record_id := new.id::text;
    v_details := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
    v_row := to_jsonb(new);
  else
    v_record_id := new.id::text;
    v_details := jsonb_build_object('new', to_jsonb(new));
    v_row := to_jsonb(new);
  end if;
  if v_row ? 'group_id' then
    v_group_id := (v_row->>'group_id')::uuid;
  end if;
  insert into public.audit_logs (user_id, action, table_name, record_id, group_id, details)
  values (auth.uid(), tg_op, tg_table_name, v_record_id, v_group_id, v_details);
  if (tg_op = 'DELETE') then return old; end if;
  return new;
end; $$;

-- audit_logs får inte tömmas – bara purge_audit_logs() (läggs till i M09).
create or replace function public.guard_audit_logs()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  raise exception 'audit_logs är append-only';
end; $$;
drop trigger if exists trg_audit_logs_no_delete on public.audit_logs;
create trigger trg_audit_logs_no_delete
  before delete or truncate on public.audit_logs
  for each statement execute function public.guard_audit_logs();

-- Triggers på profiles.
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect
  before update on public.profiles for each row execute function public.protect_profile_privileges();
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: se/ändra egen rad; superadmin ser/ändrar alla. (M02 vidgar select
-- till gruppkollegor via private.shares_any_group().)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_super_admin(auth.uid()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or private.is_super_admin(auth.uid()))
  with check (id = auth.uid() or private.is_super_admin(auth.uid()));

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (private.is_super_admin(auth.uid()));

-- audit_logs: endast superadmin läser. Ingen klient skriver (trigger gör det).
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (private.is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Trigger-funktioner aldrig anropbara via API.
revoke all on function public.audit_trigger() from public, anon, authenticated;
revoke all on function public.guard_audit_logs() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_privileges() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_created_by() from public, anon, authenticated;

-- Gate-funktioner: authenticated behöver EXECUTE för att RLS-policyn ska kunna
-- utvärderas, men de ligger i `private` och exponeras därför inte av PostgREST.
revoke all on function private.is_super_admin(uuid) from public, anon;
revoke all on function private.is_approved(uuid) from public, anon;
grant execute on function private.is_super_admin(uuid) to authenticated, service_role;
grant execute on function private.is_approved(uuid) to authenticated, service_role;
