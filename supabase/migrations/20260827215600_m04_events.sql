-- M04 – Händelser (kalendern). I M2 hanteras endast fristående händelser.
-- M3 lägger till event_series (återkommande) + FK från events.series_id och
-- materialisering. Kolumnerna series_id/occurrence_date/overridden finns redan
-- nu så M3 inte behöver ändra tabellen.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  series_id uuid,                       -- FK läggs till i M3
  occurrence_date date,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  notes text,
  icon_key text,
  is_private boolean not null default false,
  pickup_person_id uuid references public.people(id) on delete set null,
  dropoff_person_id uuid references public.people(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  overridden boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at >= starts_at)
);
create index if not exists idx_events_group_start on public.events (group_id, starts_at);
create index if not exists idx_events_group_status_start on public.events (group_id, status, starts_at);
create index if not exists idx_events_series on public.events (series_id);

create table if not exists public.event_assignees (
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (event_id, person_id)
);
create index if not exists idx_event_assignees_person on public.event_assignees (person_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_events_created_by on public.events;
create trigger trg_events_created_by before insert on public.events
  for each row execute function public.set_created_by();
drop trigger if exists trg_events_updated on public.events;
create trigger trg_events_updated before update on public.events
  for each row execute function public.set_updated_at();

-- pickup/dropoff-personer måste tillhöra händelsens grupp.
create or replace function public.events_validate_people()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.pickup_person_id is not null
     and not exists (select 1 from public.people p where p.id = new.pickup_person_id and p.group_id = new.group_id) then
    raise exception 'Hämtningsansvarig måste tillhöra samma familj';
  end if;
  if new.dropoff_person_id is not null
     and not exists (select 1 from public.people p where p.id = new.dropoff_person_id and p.group_id = new.group_id) then
    raise exception 'Lämningsansvarig måste tillhöra samma familj';
  end if;
  return new;
end; $$;
revoke all on function public.events_validate_people() from public, anon, authenticated;
drop trigger if exists trg_events_validate_people on public.events;
create trigger trg_events_validate_people before insert or update on public.events
  for each row execute function public.events_validate_people();

-- event_assignees.group_id härleds från händelsen; personen måste vara i samma grupp.
create or replace function public.event_assignees_denorm_group()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_event_group uuid;
  v_person_group uuid;
begin
  select group_id into v_event_group from public.events where id = new.event_id;
  select group_id into v_person_group from public.people where id = new.person_id;
  if v_event_group is null then
    raise exception 'Händelsen finns inte';
  end if;
  if v_person_group is distinct from v_event_group then
    raise exception 'Personen måste tillhöra samma familj som händelsen';
  end if;
  new.group_id := v_event_group;
  return new;
end; $$;
revoke all on function public.event_assignees_denorm_group() from public, anon, authenticated;
drop trigger if exists trg_event_assignees_denorm on public.event_assignees;
create trigger trg_event_assignees_denorm before insert or update on public.event_assignees
  for each row execute function public.event_assignees_denorm_group();

drop trigger if exists trg_audit_events on public.events;
create trigger trg_audit_events after insert or update or delete on public.events
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- RLS – fyra nivåer (G = events.group_id)
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_assignees enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (
    private.is_approved(auth.uid())
    and private.is_group_member(group_id)
    and (
      not is_private
      or created_by = auth.uid()
      or private.is_group_admin(group_id)
      or exists (
        select 1 from public.event_assignees a
        join public.people p on p.id = a.person_id
        where a.event_id = events.id and p.linked_user_id = auth.uid()
      )
    )
  );

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (
    private.is_approved(auth.uid())
    and private.is_group_writer(group_id)
    and created_by = auth.uid()
  );

drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (
    private.is_approved(auth.uid())
    and (
      private.is_group_admin(group_id)
      or (private.is_group_writer(group_id) and created_by = auth.uid()
          and private.within_edit_window(created_at))
    )
  )
  with check (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or (private.is_group_writer(group_id) and created_by = auth.uid()))
  );

drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (
    private.is_approved(auth.uid())
    and (private.is_group_admin(group_id)
         or (private.is_group_writer(group_id) and created_by = auth.uid()))
  );

drop policy if exists event_assignees_select on public.event_assignees;
create policy event_assignees_select on public.event_assignees for select to authenticated
  using (private.is_approved(auth.uid()) and private.is_group_member(group_id));

drop policy if exists event_assignees_insert on public.event_assignees;
create policy event_assignees_insert on public.event_assignees for insert to authenticated
  with check (
    private.is_approved(auth.uid())
    and (
      private.is_group_admin(group_id)
      or exists (
        select 1 from public.events e
        where e.id = event_id and e.created_by = auth.uid()
          and private.is_group_writer(e.group_id)
      )
    )
  );

drop policy if exists event_assignees_delete on public.event_assignees;
create policy event_assignees_delete on public.event_assignees for delete to authenticated
  using (
    private.is_approved(auth.uid())
    and (
      private.is_group_admin(group_id)
      or exists (
        select 1 from public.events e
        where e.id = event_id and e.created_by = auth.uid()
          and private.is_group_writer(e.group_id)
      )
    )
  );
