# CLAUDE.md

Vägledning för Claude Code i detta repo.

## Vad detta är

Familjeplaneraren – intern, svenskspråkig familjeplanerare som ersätter länkade Google-kalendrar.
All UI-text och alla commit-meddelanden är på svenska. Flera **helt isolerade familjegrupper**;
en inloggad person kan vara med i flera och växla mellan dem.

Fullständig plan med datamodell, RLS-strategi, återkommande-modell, påminnelse-pipeline och
milstolpar: **`docs/PLAN.md`**. Läs den innan större ändringar.

## Kommandon

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b + vite build – måste vara grön före commit/push
npm run lint      # tsc -b --noEmit
```

`.env` (kopia av `.env.example`) krävs lokalt: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
(publika, skyddade av RLS). I CI kommer de från Actions **Variables**. Deploy sker automatiskt:
push till `main` → GitHub Actions → GitHub Pages. Ingen manuell deploy.

## Arkitektur

**Statisk frontend, databas-enforcad behörighet.** Vite/React/TS-SPA (HashRouter → fungerar på
GitHub Pages utan server-routing). Pratar direkt med Supabase med enbart anon-nyckeln.
**All access control ligger i Postgres RLS-policies, inte i frontend.** `ProtectedRoute` och
rollkontroller i UI är bara UX – den matchande RLS-policyn i `supabase/migrations/` är det som
faktiskt gäller.

**Roller.** Global: `is_super_admin` (Alexander) – skapar grupper, godkänner registreringar,
allt överallt. Per grupp (`group_members.role`): `admin` (flera tillåtna, ändrar allt i gruppen) ·
`medlem` (skapar + ändrar egna) · `begransad` (endast läsa, t.ex. yngre barn). Nyregistrerad
användare har **noll åtkomst** (`profiles.approved = false`) tills superadmin godkänt.

**Gate-funktioner (SQL, `security definer`).** `is_super_admin()`, `is_approved()`,
`is_group_member(gid)`, `is_group_writer(gid)`, `is_group_admin(gid)`. Varje domän-policy är
`is_approved() AND <grupp-check på radens group_id>`. Varje domäntabell har `group_id NOT NULL`,
trigger-validerad mot förälder → cross-group-läckage omöjligt.

**Återkommande händelser.** `event_series` (liten RRULE-delmängd) → materialiseras till konkreta
`events`-rader via `pg_cron` + trigger, 12-månadershorisont. `overridden`/`status='cancelled'`
för instansundantag. Redigering via scope-RPC:er (denna / denna och kommande / hela serien).

**Påminnelser.** `pg_cron` var 10:e min → `dispatch_due_reminders()` claim:ar via
`reminder_log unique (reminder_id, fire_at)` (idempotent) → edge function `send-reminders` →
Resend. Tidszon från `groups.timezone`.

## Schemaändrings-workflow

Aldrig ändra en befintlig migration. Lägg till ny tidsstämplad fil under `supabase/migrations/`
(`YYYYMMDDHHmmss_snake_case.sql`, körs i filnamnsordning), applicera på Supabase-projektet, kör
sedan **security advisor** (`get_advisors`) och lös nya RLS-varningar, regenerera sedan
`src/types/database.types.ts` från live-schemat. Ändringen är inte klar förrän båda stegen skett.

Varje SQL-funktion: `security definer` (helpers) eller `security invoker` (RPC:er som måste
respektera RLS), `set search_path = public, pg_temp`, `revoke ... from anon` + explicit
`grant execute ... to authenticated` för anropbara RPC:er. RLS på **varje** tabell.

**`audit_logs` är append-only** – trigger blockerar DELETE/TRUNCATE; enda sanktionerade sättet
att rensa är `purge_audit_logs()`.

## Supabase

Projekt: `familjeplaneraren` / `gyjelwdvjrkbzqgnkhzk` / `eu-north-1`.
Edge Function-hemligheter (aldrig i repo): `RESEND_API_KEY`, `CRON_SECRET`.
