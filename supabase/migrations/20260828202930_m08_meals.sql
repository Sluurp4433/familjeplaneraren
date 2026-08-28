-- M08 – Matsedel: sparade rätter med ingredienser + veckoplan, och
-- "lägg alla ingredienser i inköpslistan".

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_meals_group on public.meals (group_id);

create table if not exists public.meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  text text not null,
  quantity text,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_meal_ingredients_meal on public.meal_ingredients (meal_id, position);

create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  date date not null,
  slot text not null default 'dinner' check (slot in ('breakfast', 'lunch', 'dinner')),
  meal_id uuid references public.meals(id) on delete set null,
  freetext text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, date, slot)
);
create index if not exists idx_meal_plan_group_date on public.meal_plan (group_id, date);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_meals_created_by on public.meals;
create trigger trg_meals_created_by before insert on public.meals
  for each row execute function public.set_created_by();
drop trigger if exists trg_meals_updated on public.meals;
create trigger trg_meals_updated before update on public.meals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_meal_plan_created_by on public.meal_plan;
create trigger trg_meal_plan_created_by before insert on public.meal_plan
  for each row execute function public.set_created_by();
drop trigger if exists trg_meal_plan_updated on public.meal_plan;
create trigger trg_meal_plan_updated before update on public.meal_plan
  for each row execute function public.set_updated_at();

create or replace function public.meal_ingredients_denorm_group()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  select group_id into new.group_id from public.meals where id = new.meal_id;
  if new.group_id is null then raise exception 'Rätten finns inte'; end if;
  return new;
end; $$;
revoke all on function public.meal_ingredients_denorm_group() from public, anon, authenticated;
drop trigger if exists trg_meal_ingredients_denorm on public.meal_ingredients;
create trigger trg_meal_ingredients_denorm before insert or update on public.meal_ingredients
  for each row execute function public.meal_ingredients_denorm_group();

drop trigger if exists trg_audit_meal_plan on public.meal_plan;
create trigger trg_audit_meal_plan after insert or update or delete on public.meal_plan
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- "Lägg rättens ingredienser i en inköpslista"
-- security definer + RPC med egen behörighetskoll (is_group_writer + samma
-- familj). Advisor 0029 flaggar detta – accepterat, samma mönster som series_split.
-- ---------------------------------------------------------------------------
create or replace function public.add_meal_to_list(p_meal uuid, p_list uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_meal_group uuid;
  v_list_group uuid;
  v_added integer := 0;
begin
  select group_id into v_meal_group from public.meals where id = p_meal;
  select group_id into v_list_group from public.lists where id = p_list;
  if v_meal_group is null or v_list_group is null or v_meal_group <> v_list_group then
    raise exception 'Rätt och lista måste tillhöra samma familj';
  end if;
  if not private.is_group_writer(v_meal_group) then
    raise exception 'Behörighet saknas';
  end if;

  insert into public.list_items (list_id, text, created_by)
  select p_list,
         case when i.quantity is not null and i.quantity <> ''
              then i.quantity || ' ' || i.text else i.text end,
         auth.uid()
  from public.meal_ingredients i
  where i.meal_id = p_meal
    and not exists (
      select 1 from public.list_items li
      where li.list_id = p_list and li.checked = false
        and lower(li.text) = lower(
          case when i.quantity is not null and i.quantity <> ''
               then i.quantity || ' ' || i.text else i.text end)
    );
  get diagnostics v_added = row_count;
  return v_added;
end; $$;
revoke all on function public.add_meal_to_list(uuid, uuid) from public, anon;
grant execute on function public.add_meal_to_list(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.meals enable row level security;
alter table public.meal_ingredients enable row level security;
alter table public.meal_plan enable row level security;

-- meals + meal_plan: läs = medlem, skriv = admin eller skrivare (egen post).
drop policy if exists meals_select on public.meals;
create policy meals_select on public.meals for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));
drop policy if exists meals_insert on public.meals;
create policy meals_insert on public.meals for insert to authenticated
  with check (private.is_approved(auth.uid()) and private.is_group_writer(group_id)
              and created_by = auth.uid());
drop policy if exists meals_update on public.meals;
create policy meals_update on public.meals for update to authenticated
  using (private.is_approved(auth.uid())
         and (private.is_group_admin(group_id)
              or (private.is_group_writer(group_id) and created_by = auth.uid())))
  with check (private.is_approved(auth.uid())
              and (private.is_group_admin(group_id)
                   or (private.is_group_writer(group_id) and created_by = auth.uid())));
drop policy if exists meals_delete on public.meals;
create policy meals_delete on public.meals for delete to authenticated
  using (private.is_approved(auth.uid())
         and (private.is_group_admin(group_id)
              or (private.is_group_writer(group_id) and created_by = auth.uid())));

-- meal_ingredients: läs = medlem; skriv = den som får ändra rätten.
drop policy if exists meal_ingredients_select on public.meal_ingredients;
create policy meal_ingredients_select on public.meal_ingredients for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));
drop policy if exists meal_ingredients_write on public.meal_ingredients;
create policy meal_ingredients_write on public.meal_ingredients for all to authenticated
  using (
    private.is_approved(auth.uid())
    and exists (select 1 from public.meals m where m.id = meal_id
                and (private.is_group_admin(m.group_id)
                     or (private.is_group_writer(m.group_id) and m.created_by = auth.uid())))
  )
  with check (
    private.is_approved(auth.uid())
    and exists (select 1 from public.meals m where m.id = meal_id
                and (private.is_group_admin(m.group_id)
                     or (private.is_group_writer(m.group_id) and m.created_by = auth.uid())))
  );

-- meal_plan: vilken skrivare som helst planerar (delad veckmeny).
drop policy if exists meal_plan_select on public.meal_plan;
create policy meal_plan_select on public.meal_plan for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));
drop policy if exists meal_plan_write on public.meal_plan;
create policy meal_plan_write on public.meal_plan for all to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_writer(group_id))
  with check (private.is_approved(auth.uid()) and private.is_group_writer(group_id));
