-- M02 – Familjegrupper (tenancy). Grupper är helt isolerade: en medlem i grupp A
-- kan aldrig läsa grupp B:s data. Hård gräns = varje domäntabell har
-- group_id NOT NULL och varje policy är "is_approved() AND grupp-check".
--
-- Roller per grupp (group_members.role, enum group_role från M01):
--   admin     – ändrar allt i gruppen, hanterar medlemmar/personer
--   medlem    – skapar + ändrar egna
--   begransad – endast läsa
-- Global is_super_admin() kortsluter varje gate-funktion.

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Stockholm',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_role not null default 'medlem',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists idx_group_members_user on public.group_members (user_id);
create index if not exists idx_group_members_group on public.group_members (group_id);

-- Personer = alla som kan stå som ansvariga på en händelse: vuxna (ofta med konto)
-- OCH barn (oftast utan konto). linked_user_id kopplar en person till ett konto.
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  kind text not null default 'child' check (kind in ('adult', 'child')),
  linked_user_id uuid references auth.users(id) on delete set null,
  color text,
  icon_key text,
  birthdate date,
  contact_email text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_people_group on public.people (group_id);
create index if not exists idx_people_linked_user on public.people (linked_user_id);

-- Vilka vuxna (personer) som får ett barns påminnelser.
create table if not exists public.people_parents (
  person_id uuid not null references public.people(id) on delete cascade,
  parent_person_id uuid not null references public.people(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (person_id, parent_person_id),
  check (person_id <> parent_person_id)
);

-- ---------------------------------------------------------------------------
-- Gate-funktioner (privat schema, security definer → kringgår RLS)
-- ---------------------------------------------------------------------------
create or replace function private.is_group_member(gid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select private.is_super_admin(uid)
      or exists (select 1 from public.group_members m where m.group_id = gid and m.user_id = uid);
$$;

create or replace function private.is_group_writer(gid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select private.is_super_admin(uid)
      or exists (select 1 from public.group_members m
                 where m.group_id = gid and m.user_id = uid and m.role in ('admin', 'medlem'));
$$;

create or replace function private.is_group_admin(gid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select private.is_super_admin(uid)
      or exists (select 1 from public.group_members m
                 where m.group_id = gid and m.user_id = uid and m.role = 'admin');
$$;

create or replace function private.shares_any_group(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members x
    join public.group_members y on y.group_id = x.group_id
    where x.user_id = a and y.user_id = b
  );
$$;

revoke all on function private.is_group_member(uuid, uuid) from public, anon;
revoke all on function private.is_group_writer(uuid, uuid) from public, anon;
revoke all on function private.is_group_admin(uuid, uuid) from public, anon;
revoke all on function private.shares_any_group(uuid, uuid) from public, anon;
grant execute on function private.is_group_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_group_writer(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_group_admin(uuid, uuid) to authenticated, service_role;
grant execute on function private.shares_any_group(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_groups_created_by on public.groups;
create trigger trg_groups_created_by before insert on public.groups
  for each row execute function public.set_created_by();
drop trigger if exists trg_groups_updated on public.groups;
create trigger trg_groups_updated before update on public.groups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_people_created_by on public.people;
create trigger trg_people_created_by before insert on public.people
  for each row execute function public.set_created_by();
drop trigger if exists trg_people_updated on public.people;
create trigger trg_people_updated before update on public.people
  for each row execute function public.set_updated_at();

-- En grupp får aldrig bli utan admin.
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_group uuid := coalesce(old.group_id, new.group_id);
  v_admins int;
begin
  if tg_op = 'UPDATE' and old.role = 'admin' and new.role = 'admin' then
    return new;
  end if;
  if old.role <> 'admin' then
    return coalesce(new, old);
  end if;
  -- Hela gruppen raderas (FK-cascade) → ingen poäng att skydda admin.
  if not exists (select 1 from public.groups where id = v_group) then
    return old;
  end if;
  select count(*) into v_admins
  from public.group_members where group_id = v_group and role = 'admin';
  if v_admins <= 1 then
    raise exception 'Gruppen måste ha minst en admin';
  end if;
  return coalesce(new, old);
end; $$;
revoke all on function public.protect_last_admin() from public, anon, authenticated;
drop trigger if exists trg_group_members_protect_last_admin on public.group_members;
create trigger trg_group_members_protect_last_admin
  before update or delete on public.group_members
  for each row execute function public.protect_last_admin();

-- people_parents.group_id härleds från person_id och måste stämma för båda parterna.
create or replace function public.people_parents_denorm_group()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_child_group uuid;
  v_parent_group uuid;
begin
  select group_id into v_child_group from public.people where id = new.person_id;
  select group_id into v_parent_group from public.people where id = new.parent_person_id;
  if v_child_group is null or v_child_group <> v_parent_group then
    raise exception 'Barn och förälder måste tillhöra samma grupp';
  end if;
  new.group_id := v_child_group;
  return new;
end; $$;
revoke all on function public.people_parents_denorm_group() from public, anon, authenticated;
drop trigger if exists trg_people_parents_denorm on public.people_parents;
create trigger trg_people_parents_denorm
  before insert or update on public.people_parents
  for each row execute function public.people_parents_denorm_group();

-- Audit
drop trigger if exists trg_audit_groups on public.groups;
create trigger trg_audit_groups after insert or update or delete on public.groups
  for each row execute function public.audit_trigger();
drop trigger if exists trg_audit_group_members on public.group_members;
create trigger trg_audit_group_members after insert or update or delete on public.group_members
  for each row execute function public.audit_trigger();
drop trigger if exists trg_audit_people on public.people;
create trigger trg_audit_people after insert or update or delete on public.people
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.people enable row level security;
alter table public.people_parents enable row level security;

-- groups: medlemmar ser sin grupp; bara superadmin skapar/raderar; admin får byta namn/tz.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(id));
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert to authenticated
  with check (private.is_super_admin(auth.uid()));
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (private.is_super_admin(auth.uid()) or private.is_group_admin(id))
  with check (private.is_super_admin(auth.uid()) or private.is_group_admin(id));
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated
  using (private.is_super_admin(auth.uid()));

-- group_members: medlemmar ser gruppens medlemslista; admin/superadmin ändrar.
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));
drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members for insert to authenticated
  with check (private.is_super_admin(auth.uid()) or private.is_group_admin(group_id));
drop policy if exists group_members_update on public.group_members;
create policy group_members_update on public.group_members for update to authenticated
  using (private.is_super_admin(auth.uid()) or private.is_group_admin(group_id))
  with check (private.is_super_admin(auth.uid()) or private.is_group_admin(group_id));
drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete to authenticated
  using (private.is_super_admin(auth.uid()) or private.is_group_admin(group_id));

-- people: medlemmar ser; endast gruppadmin hanterar (bekräftat beslut).
drop policy if exists people_select on public.people;
create policy people_select on public.people for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));
drop policy if exists people_insert on public.people;
create policy people_insert on public.people for insert to authenticated
  with check (private.is_group_admin(group_id));
drop policy if exists people_update on public.people;
create policy people_update on public.people for update to authenticated
  using (private.is_group_admin(group_id)) with check (private.is_group_admin(group_id));
drop policy if exists people_delete on public.people;
create policy people_delete on public.people for delete to authenticated
  using (private.is_group_admin(group_id));

drop policy if exists people_parents_select on public.people_parents;
create policy people_parents_select on public.people_parents for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));
drop policy if exists people_parents_write on public.people_parents;
create policy people_parents_write on public.people_parents for all to authenticated
  using (private.is_group_admin(group_id)) with check (private.is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- Vidga profiles-select: se även gruppkollegors profiler (för namn/avatar).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or private.is_super_admin(auth.uid())
    or private.shares_any_group(auth.uid(), id)
  );
