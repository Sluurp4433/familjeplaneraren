# Familjeplaneraren — implementationsplan

## Context

Alexander vill bygga en familjeplanerare (hemsida/app) som ersätter länkade Google-kalendrar
för sin egen familj, och som är uppskalningsbar så att t.ex. broderns familj kan ha en helt
separat grupp. Behovet: en Google-kalender-liknande delad kalender med **väldigt tydligt "vem
gör vad"**, aktivitetssymboler som hjälper barn (fotboll, ballerina …), återkommande händelser,
delade inköps-/att-göra-listor, veckomeny, och **proaktiva påminnelsemejl** ("Glöm inte
plasttunnan ikväll", "Imorgon har Emilia dansträning 18:00 i stan, ta med …").

Nytt fristående projekt, byggt på **exakt samma tekniska/säkerhetsmässiga grund som N-BV**
(`C:\Users\hacom\Documents\Claude`): statisk Vite/React/TS-SPA på GitHub Pages, HashRouter,
pratar direkt med Supabase med enbart anon-nyckeln, **all behörighet i Postgres RLS** – aldrig i
frontend. Migrationer är append-only; efter varje schemaändring körs Supabase security advisor
och `src/types/database.types.ts` regenereras.

### Bekräftade beslut

| Fråga | Val |
|---|---|
| Tenancy | Flera familjegrupper, helt isolerade. Ett konto kan vara med i flera och växla. |
| Registrering | Öppen självregistrering, men **noll åtkomst (inte ens läsa) förrän superadmin godkänt**. |
| Gruppskapande | Endast superadmin (Alexander) skapar och bemannar grupper. |
| Roller per grupp | `admin` (flera tillåtna) → ändra allt i gruppen · `medlem` → skapa + ändra egna · `begransad` → endast läsa (t.ex. yngre barn). Global `is_super_admin` = allt överallt. |
| Påminnelser v1 | E-post. Ingen push/SMS. |
| Mejlavsändare | Ingen egen domän ännu → starta med Resends sandbox-avsändare (`onboarding@resend.dev`), verifiera domän senare. |
| Google Kalender | Ingen koppling i v1 (ren ersättning). Datamodellen håller dörren öppen för `.ics`-export senare. |
| Fiffiga funktioner v1 | Återkommande händelser · inköps-/att-göra-listor (realtid) · vem hämtar/lämnar · veckomeny som fyller på inköpslista. |
| GitHub-repo | Publikt (Pages gratis; ingen familjedata i koden). |
| Projektmapp | `C:\Users\hacom\Documents\Familjeplaneraren` (separat mapp, eget git-repo, egen Supabase). |
| Hantera personer/barn | Endast gruppadmin. Medlem väljer bland befintliga personer. |

---

## Körsätt — budgetmedvetet, ett litet steg i taget

Alexander gör löpande småfixar i N-BV och vill inte att detta projekt äter upp planens kvot
(står på 43 % just nu). Därför:

- **Ett avgränsat steg per session.** Aldrig påbörja en ny milstolpe i samma session som ett stort steg
  precis avslutats. Efter varje steg: stanna, rapportera, låt Alexander bestämma om/när nästa körs.
- **Första steget (billigt och inneslutet):** skapa Supabase-projektet + GitHub-repot `familjeplaneraren`
  (publikt) + hela scaffolden (configar, `deploy.yml`, tom mappstruktur, `main.tsx`/`App.tsx`-skelett) +
  första commit + verifiera att `npm run build` är grön och att Pages deployar. Ingen domänlogik.
- **Därefter M0 → M7 som separata sessioner**, en milstolpe åt gången enligt §11. M2 (kalender), M3
  (återkommande) och M4 (påminnelser) är de tyngsta — kör dem när det finns gott om marginal.
- Om kvoten närmar sig en nivå där N-BV-underhåll riskeras: pausa detta projekt helt tills nästa period.

## Grundprinciper (ärvda från N-BV)

- Statisk SPA + databas-enforcad behörighet. Frontend-gates är endast UX.
- Enhetliga RLS-policy-quads (select/insert/update/delete) drivna av `security definer`-gate-funktioner,
  precis som N-BV:s `is_admin()` / `is_active_member()` / `within_edit_window()`.
- Varje funktion: `stable security definer set search_path = public, pg_temp`, `revoke ... from anon`,
  explicit `grant execute ... to authenticated` för RPC:er frontend anropar.
- RLS på **varje** tabell. Vyer `with (security_invoker = on)`.
- Migrationsnamn `YYYYMMDDHHmmss_snake_case.sql`, körs i filnamnsordning. Aldrig ändra en befintlig migration.
- Svensk UI, `date-fns` + `sv`-locale, `weekStartsOn: 1`.

---

## 1. Repo-bootstrap

**Plats:** `C:\Users\hacom\Documents\Familjeplaneraren` (syskonmapp till N-BV, ej nästlad).
`git init` → scaffold-commit → nytt **publikt** GitHub-repo `familjeplaneraren` → nytt Supabase-projekt.

**Beroenden – spegla N-BV exakt, inga nya runtime-beroenden:**
- Runtime: `@hookform/resolvers ^3.9`, `@supabase/supabase-js ^2.45`, `@tanstack/react-query ^5.56`,
  `date-fns ^3.6`, `react ^18.3`, `react-dom ^18.3`, `react-hook-form ^7.53`, `zod ^3.23`.
- Dev: `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `autoprefixer`, `postcss`,
  `tailwindcss ^3.4`, `typescript ^5.6`, `vite ^5.4`.
- Scripts identiska: `dev` · `build` (`tsc -b && vite build`) · `preview` · `lint` (`tsc -b --noEmit`).
- Återkommande händelser: handrullad SQL + liten klienthelper (**ingen `rrule`-dep**).
- Aktivitetsikoner: vendored inline-SVG (**ingen icon-npm-dep**), `LICENSES.md` för källset (Lucide ISC / Tabler MIT).
- Realtid: inbyggt i `supabase-js`.

**Konfigfiler – kopiera från N-BV:**
- `vite.config.ts` identisk (`base: './'`, `@vitejs/plugin-react`).
- `tsconfig.json` / `tsconfig.node.json` identiska (strict, `noUnusedLocals`, `noUnusedParameters`).
- `tailwind.config.js` – samma form; byt `brand`/`accent` mot varmare familjepalett + lägg till `person`-färgskala.
- `postcss.config.js` identisk.
- `index.html` – `lang="sv"`, `<title>Familjeplaneraren</title>`, behåll `<meta name="robots" content="noindex, nofollow">`.
- `public/robots.txt` – blockera all crawling (som N-BV).
- `.gitignore` identisk (ignorerar `.env`, `.env.*` utom `.env.example`, `dist`, `node_modules`, `supabase/.temp`, `.claude/settings.local.json`).
- `.env.example` – `VITE_SUPABASE_URL=` / `VITE_SUPABASE_ANON_KEY=`.
- `.claude/launch.json` – en config `familjeplaneraren-dev`, `npm run dev`, port 5173.
- `.github/workflows/deploy.yml` – **identisk** med N-BV: push till `main` → `npm ci` → `npm run build`
  med `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` från GitHub Actions **Variables** (ej Secrets) →
  `upload-pages-artifact@v3` → `deploy-pages@v4`. Migrationer + edge functions pushas manuellt.
- `CLAUDE.md` + `README.md` – anpassa N-BV:s: beskriv tenancy, rollmodell, påminnelse-pipeline,
  migrationsworkflow (add migration → apply → `get_advisors` → regenerera `database.types.ts`),
  Supabase Auth URL-config (Site URL + `http://localhost:5173/` redirect för HashRouter).

**Edge Function-hemligheter** (Supabase Function secrets, aldrig i repo): `SUPABASE_SERVICE_ROLE_KEY`
(finns automatiskt), `RESEND_API_KEY`, `CRON_SECRET`.

**Mappstruktur:**
```
src/
  main.tsx        QueryClientProvider > HashRouter > AuthProvider > ActiveGroupProvider > ToastProvider > App
  App.tsx
  auth/AuthProvider.tsx            session/user/profile/isApproved/isSuperAdmin
  group/ActiveGroupProvider.tsx    groups[], activeGroup, setActiveGroup, myRole, isGroupAdmin, isGroupWriter
  components/
    ProtectedRoute.tsx  Layout.tsx  GroupSwitcher.tsx  PendingApproval.tsx  NoGroups.tsx
    ui.tsx  Modal.tsx  Toast.tsx  inputs.tsx                (portas från N-BV)
    MonthGrid.tsx  WeekView.tsx  EventChip.tsx  EventForm.tsx
    PersonFilter.tsx  PersonPicker.tsx  ActivityIcon.tsx  IconPicker.tsx
    RecurrenceEditor.tsx  RecurrenceScopeDialog.tsx  ReminderEditor.tsx
    ListView.tsx  ListItemRow.tsx  MealPlanner.tsx  MealForm.tsx
  lib/
    supabase.ts  hooks.ts  events.ts  series.ts  recurrence.ts  people.ts
    lists.ts  meals.ts  reminders.ts  activityIcons.tsx  format.ts
  pages/
    PublicHome.tsx  Register.tsx  ForgotPassword.tsx  ResetPassword.tsx
    PendingApproval.tsx  NoGroups.tsx  Calendar.tsx  EventDetail.tsx
    Lists.tsx  ListDetail.tsx  Meals.tsx  Profile.tsx  SuperAdmin.tsx  GroupAdmin.tsx
  types/database.types.ts
supabase/
  migrations/*.sql
  seed.sql
  functions/
    _shared/cors.ts
    bootstrap-super-admin/index.ts  admin-create-user/index.ts
    send-reminders/index.ts  send-digest/index.ts
```

**Providers (`main.tsx`):** som N-BV plus `ActiveGroupProvider` nästlad inuti `AuthProvider`
(behöver session), utanför de routade sidorna. QueryClient-defaults identiska
(`retry: 1`, `refetchOnWindowFocus: false`, `staleTime: 30_000`).

---

## 2. Postgres-schema — ordnade migrationer

Tidsstämplar är platshållare; tilldela riktiga ordnade värden vid skrivning.

### M01 `..._extensions_profiles.sql`
- `create extension if not exists pg_trgm with schema extensions;`
- Enum `group_role as enum ('admin','medlem','begransad')`.
- `profiles`: `id uuid PK → auth.users(id) on delete cascade`, `name`, `email`,
  `approved boolean not null default false` (GLOBAL gate), `is_super_admin boolean not null default false`,
  `notify_email boolean not null default true`, `created_at`/`updated_at`.
- Delade helpers från N-BV: `set_updated_at()`, `set_created_by()`.
- `handle_new_user()` trigger på `auth.users` insert → `profiles`-rad med `approved=false`,
  `is_super_admin=false`, name/email från `raw_user_meta_data`.
- `protect_profile_privileges()` trigger: om `not is_super_admin(auth.uid())` tvinga
  `new.approved := old.approved`, `new.is_super_admin := old.is_super_admin`, `new.id := old.id`.
- Globala gate-funktioner (`stable security definer set search_path = public, pg_temp`, `revoke from anon`):
  - `is_super_admin(uid uuid default auth.uid())`
  - `is_approved(uid uuid default auth.uid())` → `approved OR is_super_admin`

### M02 `..._groups_members_people.sql`
- `groups`: `id`, `name not null`, `timezone text not null default 'Europe/Stockholm'`, `created_by`, `created_at`.
- `group_members`: `group_id → groups on delete cascade`, `user_id → auth.users on delete cascade`,
  `role group_role not null default 'medlem'`, `unique(group_id, user_id)`.
- `people` (vuxna **och** barn utan konto – varje händelseansvarig är en `people`-rad):
  `id`, `group_id not null → groups on delete cascade`, `name not null`,
  `kind text not null default 'child' check (kind in ('adult','child'))`,
  `linked_user_id uuid null → auth.users on delete set null`, `color text`, `icon_key text`,
  `birthdate date null`, `contact_email text null`, timestamps.
- `people_parents` (vilka vuxna får ett barns påminnelser): `person_id → people on delete cascade`,
  `parent_person_id → people on delete cascade`, `group_id` (trigger-fylld), `primary key (person_id, parent_person_id)`.
- Per-grupp gate-funktioner (`stable security definer set search_path=public,pg_temp`, `revoke from anon`):
  - `is_group_member(gid, uid default auth.uid())` → super-admin **eller** `group_members`-rad (valfri roll)
  - `is_group_writer(gid, uid default auth.uid())` → super-admin **eller** roll ∈ (`admin`,`medlem`)
  - `is_group_admin(gid, uid default auth.uid())` → super-admin **eller** roll = `admin`
  - `shares_any_group(a uuid, b uuid)` → delar minst en grupp
- RLS (`to authenticated`):
  - `groups`: select `is_group_member(id)`; insert `is_super_admin()`; update `is_super_admin() or is_group_admin(id)`; delete `is_super_admin()`.
  - `group_members`: select `is_group_member(group_id)`; insert/update/delete `is_super_admin() or is_group_admin(group_id)`.
    `protect_last_admin()`-trigger: en grupp kan aldrig förlora sin sista admin.
  - `people`: select `is_group_member(group_id)`; insert/update/delete `is_group_admin(group_id)` (**endast admin**, bekräftat beslut).
  - `people_parents`: select `is_group_member(group_id)`; write `is_group_admin(group_id)`.
  - **`profiles` RLS** (läggs här när `shares_any_group` finns): select
    `id = auth.uid() or is_super_admin() or shares_any_group(auth.uid(), id)`; update `id = auth.uid() or is_super_admin()`;
    delete `is_super_admin()`.

**Ingen rekursion:** policies på `group_members` *anropar* bara `security definer`-gate-funktionerna,
som läser `group_members` med RLS förbikopplad – samma mekanik som N-BV:s `is_admin()` läser `profiles`.

### M03 `..._app_settings.sql`
- Singleton `app_settings` (`id int PK default 1 check (id=1)`): `edit_window_hours int default 24`,
  `materialize_horizon_months int default 12`, `reminder_lookback_minutes int default 30`,
  `digest_enabled boolean default true`, `digest_weekday int default 1`, `digest_hour int default 17`,
  `updated_at`, `updated_by`. Seed `insert (id) values (1) on conflict do nothing`.
- `within_edit_window(created timestamptz)` – verbatim från N-BV.
- RLS: select `is_approved()`; update `is_super_admin()`.

### M04 `..._events_core.sql`
- `event_series` (recurrence-mall): `group_id not null → groups on delete cascade`, `title`/`location`/`notes`,
  `all_day boolean default false`, `start_time time null`, `duration_minutes int null`, `icon_key text null`,
  `is_private boolean default false`, `freq text check (freq in ('weekly','monthly'))`,
  `interval int default 1 check (interval>=1)`, `byweekday int[] null` (0=mån..6=sön), `bymonthday int null`,
  `dtstart date not null`, `until date null`, `count int null`,
  `pickup_person_id`/`dropoff_person_id uuid null → people(id)`, `created_by`, timestamps.
  `check (until is null or count is null)`.
- `events` (både fristående händelser **och** materialiserade förekomster):
  `group_id not null → groups on delete cascade`, `series_id uuid null → event_series on delete cascade`,
  `occurrence_date date null`, `title text not null`,
  `starts_at timestamptz not null`, `ends_at timestamptz not null check (ends_at >= starts_at)`,
  `all_day boolean default false`, `location`/`notes`, `icon_key text null`, `is_private boolean default false`,
  `pickup_person_id`/`dropoff_person_id uuid null → people(id) on delete set null`,
  `status text default 'active' check (status in ('active','cancelled'))` (tombstone),
  `overridden boolean default false` (instans redigerad – rematerialisering hoppar över), `created_by`, timestamps.
  Partial `unique (series_id, occurrence_date) where series_id is not null`.
  Index: `(group_id, starts_at)`, `(series_id)`, `(group_id, status, starts_at)`.
- `event_assignees`: `event_id → events on delete cascade`, `person_id → people on delete cascade`,
  `group_id not null` (denormaliserad), `primary key (event_id, person_id)`.
- `event_series_assignees`: `series_id`, `person_id`, `group_id`, `primary key (series_id, person_id)`.
- Triggers: `set_created_by`/`set_updated_at`; `events_denorm_group()` (tvinga `group_id` = serie-gruppens,
  avvisa cross-group); `assignee_denorm_group()` (fyll `group_id`; **avvisa om personens `group_id` skiljer sig** –
  försvar på djupet utöver RLS); `audit_trigger` (M09).
- **RLS – 4-nivåers policy-quad** (`G = events.group_id`):
  - **select**: `is_approved() and is_group_member(G) and (not is_private or created_by = auth.uid()
    or is_group_admin(G) or exists (select 1 from event_assignees a join people p on p.id=a.person_id
    where a.event_id = events.id and p.linked_user_id = auth.uid()))`
  - **insert**: `is_approved() and is_group_writer(G) and created_by = auth.uid()` (`begransad` blockad)
  - **update**: `is_approved() and (is_group_admin(G) or (is_group_writer(G) and created_by = auth.uid()
    and within_edit_window(created_at)))`; `with check` utan fönstret.
  - **delete**: `is_approved() and (is_group_admin(G) or (is_group_writer(G) and created_by = auth.uid()))`
  - `event_series` – samma quad på `event_series.group_id`.
  - `event_assignees`/`event_series_assignees`: select `is_approved() and is_group_member(group_id)`;
    insert/delete `is_approved() and (is_group_admin(group_id) or exists(select 1 from events e
    where e.id = event_id and e.created_by = auth.uid() and is_group_writer(group_id)))`; ingen update.

**Effektiva behörigheter:**

| Åtgärd | superuser | admin (grupp) | medlem (grupp) | begränsad (grupp) | icke-medlem |
|---|---|---|---|---|---|
| Se gruppens kalender/listor/meny | ✓ alla grupper | ✓ | ✓ | ✓ | ✗ |
| Se annan grupps data | ✓ | ✗ | ✗ | ✗ | ✗ |
| Skapa händelse/listrad/måltid | ✓ | ✓ | ✓ | ✗ | ✗ |
| Ändra/radera egna | ✓ | ✓ | ✓ (inom fönster) | ✗ | ✗ |
| Ändra/radera vem som helsts i gruppen | ✓ | ✓ | ✗ | ✗ | ✗ |
| Hantera personer/medlemmar | ✓ | ✓ | ✗ | ✗ | ✗ |
| Godkänna användare / skapa grupper | ✓ | ✗ | ✗ | ✗ | ✗ |

### M05 `..._recurrence.sql`
- `create extension if not exists pg_cron;`
- `series_candidate_dates(s event_series, horizon date) returns setof date` – plpgsql-generator:
  weekly går `dtstart` i `interval`-veckosteg och emitterar veckodagar ∈ `byweekday`
  (default = veckodag för `dtstart`); monthly går månader i `interval`-steg och emitterar `bymonthday`
  (default = dag-i-månad för `dtstart`), hoppar ogiltiga datum; stoppar vid `least(until, horizon)` eller efter `count`.
- `materialize_series(p_series uuid) returns int` (`security definer`): horisont =
  `current_date + materialize_horizon_months`; för varje kandidatdatum utan `events`-rad:
  insert med `starts_at`/`ends_at` beräknade **i gruppens tidszon** (`(date + start_time) at time zone group.tz`),
  kopiera `all_day`/`icon_key`/`is_private`/pickup/dropoff/`created_by = series.created_by`,
  kopiera `event_series_assignees` → `event_assignees`. Rör aldrig `overridden=true` eller `status='cancelled'`.
  Tar bort framtida icke-överridna `active`-rader vars datum inte längre är kandidat (hanterar förkortad `until`).
- `materialize_all_series()` – loopar alla serier;
  `cron.schedule('materialize-series','17 3 * * *', $$select public.materialize_all_series();$$)`.
  Även `after insert/update`-trigger på `event_series` anropar `materialize_series(new.id)`.
- **Scope-medvetna redigerings-RPC:er** (`security definer`, återkolla `is_group_writer`/author internt;
  `grant execute to authenticated`, `revoke from anon`):
  - `event_update_single(p_event uuid, patch jsonb)` – redigerar en rad, `overridden=true` ("denna händelse").
  - `event_cancel_single(p_event uuid)` – `status='cancelled'` ("ta bort denna").
  - `series_split(p_from_event uuid, patch jsonb)` – "denna och kommande": kapa gammal serie
    (`until = occurrence_date - 1`), radera dess framtida icke-överridna rader, klona serie med `patch` +
    `dtstart = occurrence_date`, materialisera.
  - `series_update_all(p_series uuid, patch jsonb)` – "hela serien": patcha serie, radera framtida
    icke-överridna rader, rematerialisera; överridna rader bevaras.
  - `series_delete(p_series uuid)` – cascade.

### M06 `..._reminders.sql`
- `create extension if not exists pg_net;`
- `event_reminders` (kopplad till konkret `events`-rad): `event_id not null → events on delete cascade`,
  `group_id not null` (denormaliserad),
  `offset_kind text check in ('minutes_before','evening_before','morning_of','custom_datetime')`,
  `offset_minutes int null`, `at_time time null`, `fire_at timestamptz null` (trigger-beräknad),
  `message text null`, `bring_list text[] not null default '{}'`,
  `recipient_mode text default 'assignees' check in ('assignees','group_adults','custom')`,
  `custom_emails text[] default '{}'`, `created_by`, timestamps.
- `event_series_reminders` – mall på serien; materialisering kopierar dem till `event_reminders` per förekomst.
- `reminder_fire_at(r, e, tz)` helper: `minutes_before` → `starts_at - offset`;
  `evening_before` → `((starts_at at tz)::date - 1) + at_time` re-lokaliserat; `morning_of` → samma dag;
  `custom_datetime` → `r.fire_at`. `before insert/update`-trigger skriver `fire_at`; trigger på `events`
  räknar om barn när `starts_at` ändras.
- `reminder_log` (**idempotens**): `reminder_id not null → event_reminders on delete cascade`,
  `fire_at timestamptz not null`, `status text default 'pending' check in ('pending','sent','failed')`,
  `attempts int default 0`, `claimed_at`, `sent_at`, `error text`, `unique (reminder_id, fire_at)`.
- `claim_due_reminders()` (`security definer`) – förekomster är materialiserade så **ingen RRULE-expansion**:
  ```sql
  with due as (
    select r.id as reminder_id, r.fire_at
    from event_reminders r
    join events e on e.id = r.event_id and e.status = 'active'
    where r.fire_at <= now()
      and r.fire_at >  now() - make_interval(mins =>
            (select reminder_lookback_minutes from app_settings where id=1) + 1440)
  )
  insert into reminder_log (reminder_id, fire_at, status, attempts, claimed_at)
  select reminder_id, fire_at, 'pending', 1, now() from due
  on conflict (reminder_id, fire_at) do nothing
  returning *;
  ```
  `on conflict do nothing` = atomisk claim; överlappande cron-körningar kan inte dubbel-inserta.
  Andra sats: återkräv `failed` med `attempts < 5`.
- `dispatch_due_reminders()` (`security definer`, cron): claim, sedan om rader claimades
  `net.http_post` till `send-reminders`-edge-funktionens URL med `x-cron-secret`-header.
  `cron.schedule('dispatch-reminders','*/10 * * * *', ...)`.
- Funktions-URL + cron-secret: `private`-schema-tabell `private.app_config(key text pk, value text)`
  läsbar endast av definer-funktioner, seedad via migration Alexander redigerar lokalt.
- RLS: `event_reminders`/`event_series_reminders` – select `is_approved() and is_group_member(group_id)`;
  write `is_approved() and (is_group_admin(group_id) or (is_group_writer(group_id) and exists(select 1
  from events e where e.id = event_id and e.created_by = auth.uid())))`.
  `reminder_log` – select `is_super_admin()`; **inga klient-write-policies** (endast definer-fns skriver – N-BV `shift_history`-mönstret).

### M07 `..._lists.sql`
- `lists`: `group_id not null → groups on delete cascade`, `title not null`,
  `kind text default 'shopping' check in ('shopping','todo')`, `created_by`, timestamps.
- `list_items`: `list_id not null → lists on delete cascade`, `group_id not null` (denormaliserad, trigger),
  `text not null`, `checked boolean default false`, `checked_at`, `checked_by`,
  `position double precision default 0`, `note text`, `created_by`, timestamps.
- RLS: `lists` – select `is_group_member(group_id)`; insert `is_group_writer(group_id) and created_by = auth.uid()`;
  update/delete `is_group_admin(group_id) or (is_group_writer and created_by = auth.uid())`.
  `list_items` – select `is_group_member`; insert `is_group_writer and created_by = auth.uid()`;
  **update `is_group_writer(group_id)`** (vilken skrivare som helst bockar/omordnar vilken rad som helst –
  poängen med en delad lista); delete `is_group_admin or (is_group_writer and created_by = auth.uid())`.
- Realtid: `alter publication supabase_realtime add table public.list_items, public.lists;`

### M08 `..._meals.sql`
- `meals` (återanvändbar rätt per grupp): `group_id`, `name not null`, `notes`, `created_by`, timestamps.
- `meal_ingredients`: `meal_id → meals on delete cascade`, `group_id`, `text not null`, `quantity text null`, `position`.
- `meal_plan` (en slot per datum): `group_id`, `date not null`, `slot text default 'dinner'`,
  `meal_id uuid null → meals on delete set null`, `freetext text null`, `created_by`, timestamps,
  `unique (group_id, date, slot)`.
- `add_meal_to_list(p_meal uuid, p_list uuid) returns int` (`security definer`, återkollar `is_group_writer`
  för båda + att de delar grupp): en `list_items`-rad per ingrediens, dedup mot befintliga obockade rader på text.
- RLS: samma form som lists.

### M09 `..._audit.sql`
- `audit_logs` (append-only, från N-BV) + `group_id`-kolumn. `audit_trigger()` fångar `group_id` när den finns.
  `guard_audit_logs()` + `before delete/truncate`-triggers + admin-gated `purge_audit_logs(older_than_days)` –
  verbatim från N-BV. Kopplas till: `events`, `event_series`, `group_members`, `people`, `groups`, `profiles`, `lists`, `meal_plan`.
- RLS: select `is_super_admin() or (group_id is not null and is_group_admin(group_id))`.

### M10 `..._digest.sql`
- `digest_log`: `group_id`, `period_start date`, `sent_at`, `status`, `unique (group_id, period_start)`.
- `dispatch_weekly_digest()` (`security definer`, timvis cron, fyrar bara på konfigurerad veckodag/timme):
  per grupp `net.http_post` till `send-digest` med `x-cron-secret`; claim via `digest_log` insert `on conflict do nothing`.

### M11 `..._grants_hardening.sql`
- `revoke all on function ... from anon` för varje funktion som inte behövs innan inloggning.
  `grant execute` till `authenticated` för RPC:er frontend anropar. Kör security advisor, lös varje varning.

---

## 3. RLS-strategi — hur de två gatarna komponerar & varför isolering håller

Varje domän-policy är **`is_approved() AND <grupp-scope-check på radens group_id>`** (plus author/privat-förfining):

1. **Global godkännande-gate** – `is_approved(auth.uid())` är `false` för nyregistrerad. `false AND x = false`,
   så en väntande användares select/insert/update/delete på **varje** domäntabell ger tomt. Det enda de kan läsa
   är sin egen `profiles`-rad (policy `id = auth.uid() or …`, medvetet oberoende av `is_approved`) – krävs för väntesidan.
2. **Per-grupp membership-gate** – `is_group_member` / `is_group_writer` / `is_group_admin` returnerar `false`
   om inte anroparen har en `group_members`-rad för **exakt den `group_id`** (eller är super-admin).

Eftersom checken alltid går mot **radens egen `group_id`** (som är `not null` på varje domäntabell och
trigger-validerad mot förälder: event↔series, assignee↔event, item↔list) **kan ingen query returnera en rad
från en grupp anroparen inte tillhör**. Cross-group `insert` blockeras av `with check` + denormaliseringstriggern.
Detta är den hårda gränsen Alexander kräver.

**Rekursion:** gate-funktionerna är `SECURITY DEFINER` → läsningar inuti dem förbikopplar RLS. Policyn
*anropar* bara funktionen. Join/barn-tabeller bär denormaliserad `group_id` → platt `is_group_member(group_id)`
istället för `exists (select … from parent)`.

**Rollnivåerna på ett ställe:** `is_group_member` = läsa · `is_group_writer` (admin|medlem) = skapa + ändra egna ·
`is_group_admin` (admin) = ändra allt + hantera personer/medlemmar/påminnelser · `begransad` = member true,
writer false = skrivskyddad · `is_super_admin()` kortsluter varje funktion till `true`.

---

## 4. Återkommande händelser (konkret modell)

**Vald modell: serie-rad + materialiserade förekomst-rader + tombstone/override-flaggor.**

- `event_series` lagrar en liten RRULE-delmängd (`freq` weekly|monthly, `interval`, `byweekday[]` eller
  `bymonthday`, `dtstart`, `until` **eller** `count`) – medvetet smalare än RFC 5545, täcker exakt
  "varje vecka / var N:e vecka / månadsvis, med slutdatum eller antal".
- Daglig `pg_cron` + `after insert/update`-trigger expanderar varje serie till konkreta `events`-rader
  ut till rullande **12-månadershorisont**.
- **Läsningar förblir triviala**: kalender och påminnelse-finder träffar en `events`-tabell med
  `(group_id, starts_at)` range-scan – identiskt med N-BV:s `['shifts', from, to]`. Inget klient-RRULE-bibliotek.
- **Redigeringssemantik** (via M05 RPC:er + `RecurrenceScopeDialog`):
  - "Denna händelse" → `event_update_single`, `overridden=true`.
  - "Denna och kommande" → `series_split`.
  - "Hela serien" → `series_update_all` (överridna rader bevaras – explicita per-instans-ändringar vinner).
  - Radera "denna" → `event_cancel_single`; radera serie → `series_delete`.
- **Undantag** = `events`-rader med `overridden=true` eller `status='cancelled'`. Ingen separat undantagstabell.
- `recurrence.ts` återskapar `series_candidate_dates` i TypeScript **enbart** för "nästa förekomster: …"-preview
  i `RecurrenceEditor` – används aldrig för data.
- Framtida iCal-export: `events` är konkreta UTC-intervall (ett `VEVENT` styck).

---

## 5. Påminnelse-pipeline (konkret)

```
pg_cron var 10:e min
  └─ dispatch_due_reminders()                          [SECURITY DEFINER]
       ├─ claim_due_reminders(): INSERT ... ON CONFLICT (reminder_id, fire_at) DO NOTHING
       │     → atomisk claim till reminder_log(status='pending')        [idempotent]
       ├─ återkräv reminder_log WHERE status='failed' AND attempts < 5
       └─ OM rader claimades: net.http_post(<send-reminders URL>,
              headers {x-cron-secret}, body {})
                 └─ Edge Function send-reminders                        [service role]
                      ├─ verifiera x-cron-secret
                      ├─ SELECT pending reminder_log JOIN event_reminders JOIN events
                      │        JOIN groups(tz) JOIN event_assignees JOIN people
                      ├─ lös mottagare:
                      │     'assignees'    → assignee-personer m. linked_user_id & notify_email,
                      │                      ANNARS den personens people_parents länkade vuxna
                      │     'group_adults' → alla vuxna m. konto & notify_email i gruppen
                      │     'custom'       → custom_emails[]
                      ├─ komponera svenskt mejl (subject = händelsetitel; body = message + tid
                      │     + plats + "Ta med: " + bring_list)
                      ├─ POST https://api.resend.com/emails  (RESEND_API_KEY)
                      └─ UPDATE reminder_log SET status='sent', sent_at=now()
                            (fel: status='failed', attempts++, error=...)
```

- **Idempotens**: `reminder_log unique (reminder_id, fire_at)` + claim-before-send ⇒ varje påminnelse skickas
  **högst en gång** även med överlappande cron eller långsam funktion. Hårt fel → `failed`, återkrävs upp till
  5 försök, sedan övergiven (synlig för super-admin).
- **Ingen recurrence-expansion i "due"-queryn** – förekomster är materialiserade rader med egen
  `event_reminders` som bär förberäknad `fire_at`.
- **Tidszon**: `fire_at` beräknad från `groups.timezone` (default `Europe/Stockholm`) → "kvällen innan 18:00" /
  "morgonen 07:00" är väggklocka lokalt; DST via `at time zone`.
- **Avsändare (v1)**: Resends sandbox `onboarding@resend.dev` (ingen domän ännu). Verifiera egen domän i Resend
  senare (DKIM/SPF DNS) och byt `from` – ingen kodändring, bara en Function-secret.
- **Digest**: `dispatch_weekly_digest()` (timvis cron) → `send-digest` bygger "Veckans schema" (nästa 7 dagar
  grupperat per dag) per grupp; `digest_log unique (group_id, period_start)` för idempotens.

---

## 6. Edge Functions

| Funktion | Auth-modell | Syfte |
|---|---|---|
| `bootstrap-super-admin` | service role; **självinaktiverande** (409 om någon `profiles.is_super_admin` finns) | Skapa första kontot: `auth.admin.createUser({email_confirm:true})`, sedan `update profiles set is_super_admin=true, approved=true`. Speglar N-BV `bootstrap-admin`. |
| `admin-create-user` | dubbel klient: caller-JWT `rpc('is_super_admin')` **eller** `rpc('is_group_admin',{gid})`, sedan service role | Provisionera en vuxen med temp-lösenord (`generatePassword()`), `email_confirm:true`, valfritt `approved=true` + `group_members`-rad + länkad `people`-rad. Returnerar temp-lösenordet en gång. Speglar N-BV `admin-create-user`. |
| `send-reminders` | service role; `x-cron-secret`-header | Skicka förfallna påminnelsemejl via Resend, skriv `reminder_log`-status. Ej användar-anropbar. |
| `send-digest` | service role; `x-cron-secret` | Bygg & skicka "Veckans schema" per grupp. |

**Behövs inte som edge functions:** `approve-user` (super-admin gör bara `update profiles set approved=true`,
tillåtet av profiles-policyn – lägg till en funktion bara för ett "du är godkänd"-mejl); `create-group`
(super-admin `insert into groups` tillåtet av RLS; provisionering via `security definer`-RPC
`admin_provision_group(name, timezone)` från SuperAdmin-sidan).

`_shared/cors.ts` kopieras från N-BV (`cors`, `json()`, `generatePassword()`) + `requireCronSecret(req)` +
`resendSend(to, subject, html)`.

---

## 7. Frontend-struktur

### Routing (`App.tsx`)
```
/                     PublicHome (login)                [publik]
/registrera           Register                          [publik]
/glomt-losenord       ForgotPassword                    [publik]
/aterstall-losenord   ResetPassword                     [publik]
── ProtectedRoute (session krävs) ──
/vantar               PendingApproval   (approved=false)
/valj-familj          NoGroups          (approved, 0 medlemskap)
── Layout (approved + ≥1 grupp) ──
/kalender             Calendar          (månad/vecka-toggle)
/kalender/handelse/:id EventDetail
/listor               Lists
/listor/:id           ListDetail
/matsedel             Meals
/profil               Profile
/admin                SuperAdmin        (endast is_super_admin)
/familj               GroupAdmin        (is_group_admin av aktiv grupp)
*                     → /kalender
```

### `AuthProvider` (utöka N-BV:s)
Exponera `session`, `user`, `profile`, `loading`, `isApproved` (`profile?.approved || profile?.is_super_admin`),
`isSuperAdmin`, `refreshProfile`, `signIn`, `signUp`, `signOut`, `requestPasswordReset`, `updatePassword`.
`signUp` → `supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: <hash-URL> } })`.

### `ActiveGroupProvider` (ny)
- När `isApproved`: query `group_members` join `groups` för `auth.uid()` → `groups: { id, name, role }[]`.
- `activeGroupId` i `localStorage` (`fp.activeGroup`); default = första gruppen; valideras mot listan.
- Exponerar `groups`, `activeGroup`, `setActiveGroup(id)`, `myRole` (`'admin'|'medlem'|'begransad'|'super'`),
  `isGroupAdmin`, `isGroupWriter`.
- **Alla React Query-nycklar namespacade per grupp**: `['events', activeGroupId, fromISO, toISO]`,
  `['people', activeGroupId]`, `['lists', activeGroupId]`. `setActiveGroup` → `queryClient.removeQueries()`
  för grupp-scopade nycklar (bälte + hängslen; RLS förhindrar redan cross-group-läsning).

### Gates i `ProtectedRoute`
1. `loading` → spinner. 2. `!session` → `<Navigate to="/">`. 3. `session && !isApproved` → `<PendingApproval />`
("Ditt konto väntar på godkännande. Du får ett mejl när det är klart." + logga ut); polla `refreshProfile()`
var ~30 s. 4. `isApproved && groups.length === 0` → `<NoGroups />`. 5. annars rendera children.

### Group switcher
Dropdown i `Layout`-headern (bara om `groups.length > 1`), gruppnamn + rollbadge; val anropar `setActiveGroup`.

### Kalender (anpassa från N-BV `Calendar.tsx` / `WeekView.tsx`)
- Behåll grid-matten exakt: `startOfWeek(startOfMonth(cursor), {weekStartsOn:1})` … `eachDayOfInterval` → 6×7;
  desktop 7-kol grid, mobil kompakt **prick-grid + vald-dag-lista** (prickar färgade per tilldelad person).
- `useEventsInRange(groupId, fromISO, toISO)` speglar `useShiftsInRange`:
  `.from('events').select('*, event_assignees(person_id)').eq('group_id', groupId).gte('starts_at', from)
  .lt('starts_at', to).eq('status','active').order('starts_at')`, platta nested join → `assigneeIds: string[]`.
- `PersonFilter`: checkbox per `people`-rad (default alla på); filtrera förekomster klient-sidan på
  `assigneeIds ∩ selected`; spara per grupp i `localStorage`.
- `EventChip`: `<ActivityIcon iconKey={e.icon_key}/>` + titel + färgade assignee-prickar.
  Pickup/dropoff som ↑/↓-badges på `EventDetail`.
- `EventForm` (från `ShiftForm.tsx` + `Modal` + `react-hook-form` + `zod`): titel, heldag-toggle,
  start/slut (`datetime-local`), plats, anteckningar, `PersonPicker` (assignees), pickup `<select>`,
  dropoff `<select>`, `IconPicker`, "Privat"-checkbox, `RecurrenceEditor` (kollapsad), `ReminderEditor`
  (N offset-regler + meddelande + "ta med"-chips). Submit: fristående → `insert into events`;
  återkommande → `insert into event_series` (+ assignees + reminder-mallar), trigger materialiserar.
  Redigera en serieförekomst → `RecurrenceScopeDialog` → matchande RPC.
- `canEditOwn()` klient-helper (portad från N-BV `hooks.ts`) speglar update-policyn för knappsynlighet:
  `isGroupAdmin || (isGroupWriter && created_by === user.id && withinWindow)`. `begransad` → all
  create/edit/delete-UI dold.

### Aktivitetsikon-bibliotek
- `src/lib/activityIcons.tsx` exporterar
  `ACTIVITY_ICONS: Record<string, { label: string; Svg: (p:{className?:string}) => JSX.Element }>` –
  ~30 handvendorerade inline-SVG:er (`fotboll`, `dans`, `simning`, `ishockey`, `ridning`, `musik`, `teater`,
  `scouterna`, `kalas`, `läkare`, `tandläkare`, `skola`, `utflykt`, `träning`, `möte`, `resa`, `födelsedag`,
  `sopor-plast`, `sopor-rest`, …). Källa: kopiera paths från MIT/ISC-set (Lucide ISC, Tabler MIT) eller
  rita enkla; **vendored, ingen npm-dep**; `LICENSES.md`.
- Lagras som `icon_key text` på `events`/`event_series` (nullable). `<ActivityIcon>` mappar key → komponent,
  faller tillbaka på generisk glyf. `IconPicker` = sökbar grid i händelseformuläret. Barn känner igen händelser
  på ikon + personfärg innan de kan läsa.

### Listor (realtid)
- `useListItems(listId)` – initial React Query-fetch, sedan
  `supabase.channel('list:'+listId).on('postgres_changes', { event:'*', schema:'public', table:'list_items',
  filter:'list_id=eq.'+listId }, handler)` som uppdaterar query-cachen; unsubscribe on unmount.
  Checkbox togglar `update list_items set checked`, optimistiskt. Reconnect på `CHANNEL_ERROR`.
  `begransad` → kontroller disabled. Fallback om realtid strular: `refetchInterval: 15_000`.

### Måltider
- `MealPlanner`: 7-dagars grid, varje slot väljer sparad `meal` eller fritext. Måltidsdetalj: ingredienslista;
  knapp "Lägg alla i inköpslista" → `add_meal_to_list`-RPC (välj mållista) → toast med antal.

---

## 8. Super-admin-panel (`SuperAdmin.tsx`)

Flikad (speglar N-BV `Admin.tsx`), synlig endast när `isSuperAdmin`:

1. **Väntar på godkännande** – `profiles` där `!approved`: godkänn / avvisa. Valfritt välkomstmejl.
2. **Familjer** – lista `groups`; skapa / byt namn / sätt tidszon / radera.
3. **Medlemskap** – välj grupp → dess `group_members` med roll-`<select>` (admin/medlem/begränsad);
   lägg till befintlig godkänd användare via mejl; ta bort; flera admins tillåtna; blockera att ta bort/degradera sista admin.
4. **Personer** – per grupp: hantera `people` (vuxna + barn), `linked_user_id`, färger, `people_parents`,
   `contact_email` för konto-lösa barn.
5. **Nya konton** – `admin-create-user` (temp-lösenordsflöde från N-BV); val att auto-godkänna + auto-lägg i grupp.
6. **Loggar** – `audit_logs` (paginerat, från N-BV `AuditTab`) + `reminder_log` / `digest_log`-status.
7. **Inställningar** – `app_settings` (edit window, materialize horizon, reminder lookback, digest veckodag/timme).

`GroupAdmin.tsx` (`/familj`) = delmängd för `is_group_admin` av aktiv grupp: hantera den gruppens medlemmar
(roller), personer, och namn/tidszon – ingen cross-group-åtkomst.

---

## 9. Realtid för listor

- M07: `alter publication supabase_realtime add table public.list_items, public.lists;`
- RLS förblir på → varje prenumerant får bara change-events deras policies tillåter (deras egen grupp).
  Verifiera att "Realtime" är på för tabellerna i dashboarden.
- Klient: en kanal per öppen lista; uppdatera React Query-cachen från payloaden (refetcha inte);
  hantera `DELETE` via `payload.old`; `filter: 'list_id=eq.<id>'`.
- Meals/events behöver **inte** realtid i v1.

---

## 10. Verifiering & test (ingen testsvit, som N-BV)

**Lokal stack**: `supabase init` + `supabase start`, `supabase db reset` för att applicera migrationer i ordning,
`supabase functions serve`, `npm run dev` mot lokala stacken.

**Build-gate**: `npm run build` (`tsc -b && vite build`) grön före varje commit.

**Seed-script** (`supabase/seed.sql`, endast dev): super-admin; 2 grupper ("Familjen A", "Familjen B");
användare A-admin, A-medlem, A-begränsad, B-user; personer inkl. barn; några händelser, en återkommande serie,
en inköpslista, en veckomeny.

**Manuell RLS-prob-checklista** (säkerhetskritisk – kör som varje roll):

| # | Som | Försök | Förvänta |
|---|---|---|---|
| 1 | väntande användare | valfri sida / `select * from events` | PendingApproval; `[]` |
| 2 | A-medlem | `select` events där `group_id` = B | `[]` |
| 3 | A-medlem | `insert` event `group_id` = B | fel / 0 rader |
| 4 | A-medlem | insert event, assignee = person från grupp B | trigger avvisar |
| 5 | A-medlem | redigera A-admins event | avvisas |
| 6 | A-medlem | redigera eget event efter `edit_window_hours` | avvisas |
| 7 | A-begränsad | insert/update/delete något | avvisas överallt |
| 8 | A-begränsad | `select` events / listor / meny | rader synliga |
| 9 | A-admin | redigera/radera A-medlems event, hantera personer, sätta roller | tillåtet |
| 10 | A-admin | något i grupp B | avvisas |
| 11 | privat event av A-medlem | A-admin ser det; A-annan-medlem (ej assignee) ser inte | enligt design |
| 12 | super-admin | läs/skriv båda grupper, godkänn användare, skapa grupp | tillåtet |
| 13 | recurrence | "denna" ändrar en; "denna och kommande" delar; "hela serien" uppdaterar framtid, behåller overrides | enligt design |
| 14 | reminders | kör `dispatch_due_reminders()` två gånger snabbt | exakt en `reminder_log`-rad, ett mejl |
| 15 | realtid | bocka en rad som X | Y:s öppna lista uppdateras utan refresh |

**Efter varje schemaändring**: kör Supabase **security advisor** (`get_advisors`), fixa varningar;
regenerera `src/types/database.types.ts`; håll `canEditOwn()` / roll-helpers i synk.

**Edge-function-checkar**: `bootstrap-super-admin` → 409 när admin finns; `admin-create-user` → 403 för
icke-admin-anropare; `send-reminders` → 401 utan cron-secret.

---

## 11. Byggordning / milstolpar

- **M0 — Skelett & auth (minsta deploybara).** Scaffold, deploy-workflow, Supabase-projekt, M01+M03,
  `AuthProvider`, login/register/forgot/reset, `ProtectedRoute` + approved-gate, `PendingApproval`,
  `bootstrap-super-admin`. *Användbart:* folk registrerar sig, super-admin finns, andra ser "väntar".
- **M1 — Tenancy.** M02, `ActiveGroupProvider`, `GroupSwitcher`, `NoGroups`, `SuperAdmin`
  (godkänn / skapa grupp / tilldela medlemmar / hantera personer), `admin-create-user`, `GroupAdmin`.
  *Användbart:* super-admin bygger en familj; medlemmar landar i en tom grupp-scopad app.
- **M2 — Kalender (första riktigt användbara skivan).** M04 (endast fristående händelser), `Calendar`
  (månad + vecka), `EventForm`, `EventDetail`, `PersonPicker`, `PersonFilter`, ikon-bibliotek + `IconPicker`,
  pickup/dropoff, "privat". *Användbart:* familjen ersätter sin delade Google-kalender för engångshändelser.
- **M3 — Återkommande.** M05 (serier, materialisering, cron, scope-RPC:er), `RecurrenceEditor`,
  `RecurrenceScopeDialog`. *Användbart:* veckoaktiviteter läggs in en gång.
- **M4 — Påminnelser.** M06 (+ `pg_net`, cron), `ReminderEditor`, `send-reminders` + Resend, `reminder_log`.
  *Användbart:* "imorgon har Emilia dansträning 18:00"-mejl.
- **M5 — Listor + realtid.** M07, `Lists`/`ListDetail`, realtid.
- **M6 — Måltider.** M08, `MealPlanner`, `add_meal_to_list`.
- **M7 — Polish.** M09 audit, M10 digest (`send-digest` + veckovis "Veckans schema"), M11 hardening,
  advisor-sweep, README/CLAUDE.md, valfri PWA-manifest för "lägg till på hemskärmen".

Varje milstolpe: grön build, migrationer applicerade, advisor ren, typer regenererade, RLS-probar körda om,
sedan commit + push (auto-deploy).

---

## 12. Öppna risker / senare beslut

1. **Egen mejldomän** – innan verifierad domän i Resend hamnar påminnelser oftare i skräppost och
   sandbox-avsändaren har låga gränser. Skaffa en domän tidigt om påminnelserna ska vara pålitliga.
2. **Öppen registrering – missbruk** – vem som helst kan skapa konto (ser inget före godkännande).
   Överväg Supabase CAPTCHA (hCaptcha/Turnstile) på sign-up + inbyggda rate limits.
3. **Tidszon** – schema stödjer per-grupp `timezone`; UI kan dölja det och anta `Europe/Stockholm`.
4. **Recurrence-scope** – v1 stödjer weekly / var N:e vecka / monthly med until/count. Ej: yearly,
   "sista fredagen i månaden", flera regler.
5. **Materialiserings-horisont** – 12 månader; en långt-framtida `count`-serie är kapad tills tiden går.
6. **Barn som får konto senare** – `people.linked_user_id` sätts, `group_members.role` = `begransad`/`medlem`.
   Ingen migration.
7. **Förälder i två familjer** – två `people`-rader (en per grupp), samma `linked_user_id`; växlar via group switcher.
8. **Realtids-auth** – kräver RLS-on-publication som verklig gräns; verifiera på Supabase-planen. Fallback = polling.
9. **`pg_net` / `pg_cron`** – finns på Supabase men måste aktiveras; cron→edge-HTTP-anropet behöver
   funktions-URL + delad hemlighet server-sidan (`private.app_config` eller Vault).
10. **GDPR / export** – super-admin "exportera denna familj (JSON/ICS)" och "radera denna familj";
    ej v1-scope men noterat. `app_settings` kan få `retention_months` + `gdpr_purge(dry_run)` som N-BV.
11. **Super-admin är också vanlig familjemedlem** – behöver egna `group_members`-rader för att delta;
    `is_super_admin` är bara god-mode-overlay.

---

## Kritiska referensfiler (N-BV, read-only källa att kopiera mönster från)

- `supabase/migrations/20260817090002_functions_triggers.sql` — gate-funktioner, `handle_new_user`,
  `protect_profile_privileges`, `set_updated_at/created_by`, audit-trigger (mall för M01/M09).
- `supabase/migrations/20260817090003_rls_policies.sql` + `supabase/migrations/20260819090001_avatars_and_shifts.sql`
  — policy-quad + capacity-trigger + join-tabell-RLS (mall för M02/M04/M07).
- `supabase/migrations/20260827090001_shift_history.sql` — `pg_cron` + `security definer` +
  write-policy-fri append-only-tabell (mall för M05/M06-materialisering + `reminder_log`).
- `src/pages/Calendar.tsx` + `src/components/WeekView.tsx` + `src/components/ShiftForm.tsx` + `src/lib/shifts.ts`
  — grid-matte, range-nycklad React Query, nested-join-flatten, modal-formulär
  (mall för `Calendar.tsx` / `EventForm.tsx` / `lib/events.ts`).
- `src/auth/AuthProvider.tsx` + `src/components/ProtectedRoute.tsx` + `src/pages/Admin.tsx` +
  `supabase/functions/admin-create-user/index.ts` + `supabase/functions/bootstrap-admin/index.ts` +
  `supabase/functions/_shared/cors.ts` — auth-kontext, gate-skärm, admin-panel-struktur,
  dual-client edge-function-mönster (mall för `AuthProvider` + `ActiveGroupProvider`, `SuperAdmin.tsx`, alla fyra edge functions).
