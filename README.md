# Familjeplaneraren

Intern, svenskspråkig familjeplanerare som ersätter länkade Google-kalendrar. Flera helt
isolerade familjegrupper, delad kalender med tydligt "vem gör vad", återkommande händelser,
delade listor, veckomeny och proaktiva påminnelsemejl.

Byggd på samma grund som N-BV: statisk Vite/React/TypeScript-SPA på GitHub Pages (HashRouter),
pratar direkt med Supabase med enbart den publika anon-nyckeln. **All behörighet enforced i
Postgres Row Level Security** – frontend-gates är endast UX.

## Kommandon

```bash
npm install
npm run dev       # lokal dev-server på http://localhost:5173
npm run build     # tsc -b (typecheck) + vite build – måste vara grön före commit/push
npm run lint      # tsc -b --noEmit
npm run preview   # förhandsgranska en produktionsbuild lokalt
```

Lokal utveckling behöver en `.env` (kopiera `.env.example`) med `VITE_SUPABASE_URL` och
`VITE_SUPABASE_ANON_KEY`. Båda är publika värden – varje tabell skyddas av RLS. I CI kommer
samma två värden från GitHub-repots Actions **Variables** (inte Secrets) och används av
`.github/workflows/deploy.yml`.

Deploy är automatisk: push till `main` → GitHub Actions bygger → publicerar till GitHub Pages.

## Projekt

- Supabase-projekt: `familjeplaneraren` (`gyjelwdvjrkbzqgnkhzk`), region `eu-north-1`.
- Implementationsplan och milstolpar: se `docs/PLAN.md`.

## Status

M0 + M1 klart:
- **M0** – databaslager (profiler, gate-funktioner, app_settings), inloggning,
  registrering, glömt/återställ lösenord, godkännande-spärr, `bootstrap-super-admin`.
- **M1** – familjegrupper (`groups`/`group_members`/`people`/`people_parents`),
  fyra rollnivåer med RLS-isolering mellan grupper, `ActiveGroupProvider` +
  gruppväxlare, superadmin-panel (godkänn konton, skapa familjer, tilldela
  medlemmar/roller, hantera personer), `GroupAdmin`-sida.

- **M2** – kalendern: `events` + `event_assignees` med fyra-nivåers RLS,
  månadsvy (desktop-grid + mobil prick-grid), `EventForm` (vem gör vad,
  hämtar/lämnar, aktivitetssymboler, privat), personfilter, aktivitetsikoner
  (emoji: ⚽ 🩰 …). Route `/kalender`.

- **M3** – återkommande händelser: `event_series` (weekly/monthly, interval,
  veckodagar, slut på datum/antal) → materialiseras till `events`-rader via
  trigger + nattlig `pg_cron`, 12-månadershorisont. Redigering: "bara denna"
  (overridden), "denna och kommande" (`series_split`), "hela serien". Undantag =
  overridden / status='cancelled'.

- **M4** – påminnelser via e-post: `event_reminders` / `event_series_reminders`
  med trigger-beräknad `fire_at` (väggklocka i gruppens tidszon: "kvällen innan
  kl HH:MM" / "på morgonen" / "N min innan"), meddelande + "ta med"-lista,
  mottagare (ansvariga / alla vuxna / egna adresser). `pg_cron` var 10:e min →
  `dispatch_due_reminders()` → idempotent claim i `reminder_log` → edge function
  `send-reminders` → Resend. `ReminderEditor` i EventForm.

- **M5** – delade listor: `lists` + `list_items` (inköp / att-göra), vilken
  skrivare som helst kan bocka av vilken rad som helst, optimistisk toggle,
  realtid via `postgres_changes` + polling som skyddsnät (20 s). Sidor
  `/listor` + `/listor/:id`.

- **M6** – matsedel: `meals` + `meal_ingredients` + `meal_plan` (unik
  `(group_id,date,slot)`), veckovy med middag per dag, sparade rätter med
  ingredienser, `add_meal_to_list()` RPC ("lägg alla ingredienser i
  inköpslistan", dedup mot obockade). Sida `/matsedel`.

Nästa steg: M7 – polish (audit-vy i admin, veckodigest, `admin-create-user`).

## Aktivera påminnelser (engångssetup)

1. **Resend**: skapa gratiskonto på resend.com → API-nyckel.
2. **Supabase → Edge Functions → send-reminders → Secrets**, lägg till:
   - `RESEND_API_KEY` = din Resend-nyckel
   - `CRON_SECRET` = `mxSTXzJs2RDGsZHHpMxCb6y8TVMfgv6fRwj9SRwJ`
   - (valfritt) `REMINDER_FROM` = `Familjeplaneraren <onboarding@resend.dev>` tills egen domän
3. Klart – cron-jobbet `dispatch-reminders` skickar sen automatiskt.
   Felmeddelanden syns i tabellen `reminder_log` (kolumn `error`).

(Ej gjort än: `admin-create-user`; vecko-vy i kalendern; digest-mejl.)

## Uppsättning kvar (görs en gång i Supabase-dashboarden)

1. **Auth → URL Configuration**
   - Site URL: `https://sluurp4433.github.io/familjeplaneraren/`
   - Redirect URLs: lägg till `http://localhost:5173/**` och
     `https://sluurp4433.github.io/familjeplaneraren/**`
   (annars pekar bekräftelse- och återställningsmejl fel.)
2. **Skapa superadmin** – anropa edge-funktionen en gång:
   ```bash
   curl -X POST "https://gyjelwdvjrkbzqgnkhzk.supabase.co/functions/v1/bootstrap-super-admin" \
     -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"email":"DIN@EPOST","name":"Ditt namn","password":"valfritt-minst-8-tecken"}'
   ```
   Utelämna `password` för att få ett slumpat i svaret. Funktionen självinaktiveras
   sedan.
3. **Aktivera deploy** – `.github/workflows/deploy.yml` ligger i
   `.github/workflows-pending/` tills gh-token får `workflow`-scope
   (`gh auth refresh -h github.com -s workflow`).
