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

Nästa steg: M2 – kalendern (händelser, "vem gör vad", personfilter, ikoner).
(Ej gjort än: edge function `admin-create-user` – onboarding sker via
självregistrering + godkännande så länge.)

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
