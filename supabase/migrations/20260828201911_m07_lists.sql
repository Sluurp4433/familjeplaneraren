-- M07 – Delade listor (inköp / att-göra) med realtid.

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  kind text not null default 'shopping' check (kind in ('shopping', 'todo')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lists_group on public.lists (group_id);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  text text not null,
  checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid references auth.users(id) on delete set null,
  note text,
  position double precision not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_list_items_list on public.list_items (list_id, position);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_lists_created_by on public.lists;
create trigger trg_lists_created_by before insert on public.lists
  for each row execute function public.set_created_by();
drop trigger if exists trg_lists_updated on public.lists;
create trigger trg_lists_updated before update on public.lists
  for each row execute function public.set_updated_at();

-- list_items.group_id härleds från listan; sätt checked_at/checked_by automatiskt.
create or replace function public.list_items_prepare()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    select group_id into new.group_id from public.lists where id = new.list_id;
    if new.group_id is null then raise exception 'Listan finns inte'; end if;
  end if;
  if new.checked and (tg_op = 'INSERT' or not old.checked) then
    new.checked_at := now();
    new.checked_by := auth.uid();
  elsif not new.checked then
    new.checked_at := null;
    new.checked_by := null;
  end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.list_items_prepare() from public, anon, authenticated;
drop trigger if exists trg_list_items_created_by on public.list_items;
create trigger trg_list_items_created_by before insert on public.list_items
  for each row execute function public.set_created_by();
drop trigger if exists trg_list_items_prepare on public.list_items;
create trigger trg_list_items_prepare before insert or update on public.list_items
  for each row execute function public.list_items_prepare();

drop trigger if exists trg_audit_lists on public.lists;
create trigger trg_audit_lists after insert or update or delete on public.lists
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));

drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists for insert to authenticated
  with check (private.is_approved(auth.uid()) and private.is_group_writer(group_id)
              and created_by = auth.uid());

drop policy if exists lists_update on public.lists;
create policy lists_update on public.lists for update to authenticated
  using (private.is_approved(auth.uid())
         and (private.is_group_admin(group_id)
              or (private.is_group_writer(group_id) and created_by = auth.uid())))
  with check (private.is_approved(auth.uid())
              and (private.is_group_admin(group_id)
                   or (private.is_group_writer(group_id) and created_by = auth.uid())));

drop policy if exists lists_delete on public.lists;
create policy lists_delete on public.lists for delete to authenticated
  using (private.is_approved(auth.uid())
         and (private.is_group_admin(group_id)
              or (private.is_group_writer(group_id) and created_by = auth.uid())));

drop policy if exists list_items_select on public.list_items;
create policy list_items_select on public.list_items for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));

drop policy if exists list_items_insert on public.list_items;
create policy list_items_insert on public.list_items for insert to authenticated
  with check (private.is_approved(auth.uid()) and private.is_group_writer(group_id)
              and created_by = auth.uid());

-- Vilken skrivare som helst får bocka av / ändra vilken rad som helst – poängen med en delad lista.
drop policy if exists list_items_update on public.list_items;
create policy list_items_update on public.list_items for update to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_writer(group_id))
  with check (private.is_approved(auth.uid()) and private.is_group_writer(group_id));

drop policy if exists list_items_delete on public.list_items;
create policy list_items_delete on public.list_items for delete to authenticated
  using (private.is_approved(auth.uid())
         and (private.is_group_admin(group_id) or private.is_group_writer(group_id)));

-- ---------------------------------------------------------------------------
-- Realtid
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_items;
