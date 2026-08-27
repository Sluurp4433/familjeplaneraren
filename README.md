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

Skelett (scaffold) klart. Nästa steg: M0 – inloggning + godkännande-spärr.
