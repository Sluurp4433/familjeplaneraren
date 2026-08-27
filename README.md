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

Nästa steg: M4 – påminnelser via e-post (`event_reminders`, `reminder_log`,
`pg_cron` + edge function `send-reminders` + Resend).
(Ej gjort än: `admin-create-user`; vecko-vy i kalendern.)

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
