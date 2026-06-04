# llar — Barcelona property due-diligence dossiers

Freemium, bilingual (EN/ES) due-diligence reports for foreign buyers evaluating a
specific Barcelona flat. A free preview plus a paid full report with PDF download.

> **Brand & price are placeholders.** Everything brand-related (name, wordmark,
> tagline, glyph) and the report price live in **`config/brand.ts`** — change them
> there to rebrand or reprice in one place.

## Status

**Phase 1 (skeleton) — done.** Next.js + Tailwind v4 + next-intl scaffold; the
canonical reference design (`reference/sors-35-property-dossier.html`) is ported
into React components and rendered from a hardcoded sample report
(`data/sample-sors35.ts`) in both English and Spanish.

Upcoming: data layer (Supabase + source adapters + operator dashboard) → AI
narrative → Stripe/PDF monetization → landing/SEO/legal polish.

## Tech

- **Next.js 16** (App Router, TypeScript) — note: this repo pins a Next version
  whose docs are bundled in `node_modules/next/dist/docs/`; consult them, the
  `middleware` convention is now `proxy.ts`.
- **Tailwind v4** (CSS-first) — design tokens + ported component classes live in
  `app/globals.css`.
- **next-intl** — locale-prefixed routing (`/en`, `/es`); UI strings in
  `messages/{en,es}.json`; AI narrative stored per-language inside each report.
- Fonts: **Fraunces** + **Hanken Grotesk** via `next/font`.

## Project layout

```
app/[locale]/            localized routes (layout, home = sample report)
app/[locale]/report/[id] canonical report route (sample only for now)
components/               TopBar, LanguageToggle
components/report/        ReportView + LockedSection (premium teaser)
config/brand.ts          brand + price (single rebrand surface)
config/scoring.ts        score weights + overall computation
data/sample-sors35.ts    the Sors 35 sample report (EN + ES)
types/report.ts          the structured Report contract
i18n/                    next-intl routing/request/navigation
messages/                en.json / es.json UI strings
proxy.ts                 locale middleware (Next 16 "proxy")
reference/               the canonical design HTML (source of truth)
```

## Local development

```bash
npm install
cp .env.local.example .env.local   # no keys needed for Phase 1
npm run dev
```

Open:

- http://localhost:3000/en — English dossier
- http://localhost:3000/es — Spanish dossier

`/` redirects to the browser-preferred locale. Use the toggle in the top bar to
switch languages.

```bash
npm run build   # production build + type-check
npm run lint
```

## Deploy (Vercel)

1. Push to a Git repo and import the project into Vercel.
2. Add the env vars from `.env.local.example` (Production + Preview) as they
   become relevant per phase.
3. Vercel auto-detects Next.js; no extra build config required.
