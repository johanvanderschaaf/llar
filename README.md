# PisoWise — Barcelona property due-diligence reports

Freemium, bilingual (EN/ES/CA) due-diligence reports for foreign buyers
evaluating a specific Barcelona flat. A free preview plus a paid full report
with PDF download.

> **Brand & price are placeholders.** Everything brand-related (name, wordmark,
> tagline, glyph) and the report price live in **`config/brand.ts`** — change them
> there to rebrand or reprice in one place.

## Status

The deterministic data pipeline, public buyer flow, operator dashboard, and the
AI-narrative + paywall scaffolding are in place. The most accurate signal so far
is the **planning / restrictions** section, which is grounded in three official
Ajuntament de Barcelona sources (see below).

| Area | State |
|---|---|
| Data layer (Supabase + source adapters + operator dashboard) | ✅ live |
| Buyer flow: address search → unit pick → free preview | ✅ live |
| Planning & restrictions (affectation + zoning + heritage + ZBE) | ✅ live, sourced from Ajuntament BCN |
| AI narrative (Anthropic) | 🟡 wired; opt-in per report once unlocked |
| Stripe checkout + PDF unlock | 🟡 scaffolded; needs production Stripe keys |
| Landing / SEO / legal polish | 🟡 partial |

## Tech

- **Next.js 16** (App Router, TypeScript) — this repo pins a Next version whose
  docs are bundled in `node_modules/next/dist/docs/`; consult them. The
  `middleware` convention is now `proxy.ts`.
- **Tailwind v4** (CSS-first) — design tokens + ported component classes live in
  `app/globals.css`.
- **next-intl** — locale-prefixed routing (`/ca`, `/es`, `/en`); UI strings in
  `messages/{ca,es,en}.json`; AI narrative stored per-language inside each report.
- **Supabase** for storage + auth (operator dashboard).
- **Fonts:** Manrope (interface, headlines) + Space Mono (numbers, codes), via
  `next/font` — matches the brand spec in `design_handoff_pisowise_brand/`.

## Data sources

The pipeline never throws on a missing source — each adapter degrades to
`unavailable` and the operator flags the field for manual entry.

| Source | Adapter | Endpoint |
|---|---|---|
| Cadastre (year built, surface, parcel, units) | `adapters/catastro.ts` | Catastro OVC `Consulta_DNPRC` |
| Address search → cadastral ref | `adapters/catastro-search.ts` | Catastro OVC `ConsultaVia` / `Consulta_DNPLOC` |
| Parcel coordinates + polygon (whole-finca queries) | `adapters/geo.ts` | Catastro `Consulta_CPMRC` + INSPIRE WFS |
| Energy certificate (ICAEN) | `adapters/energy.ts` | Generalitat ICAEN |
| Amenities, transport, services | `adapters/amenities.ts` | OSM / Overpass |
| Flood risk | `adapters/flood.ts` | ACA (Agència Catalana de l'Aigua) |
| Comparable listings | `adapters/idealista.ts` | Idealista (official API, optional) |
| **Planning qualification (whole parcel)** | `adapters/urbanism.ts` | Ajuntament BCN `WMSURBANISME` |
| **Official affectation verdict (A/B/C/D)** | `adapters/affectation.ts` | PIU AFH service (`AfectacionsHabitatge`) |
| **Architectural heritage (BCIN/BCIL/…)** | `adapters/heritage.ts` | Ajuntament BCN `Catàleg_de_patrimoni` |

### How the planning section works

Section 08 of the report (*Planning & restrictions*) is a list of plain-language
status rows — one per planning aspect — driven by:

1. The **official AFH service** as the primary affectation signal (category A →
   caution, C/D → "worth checking", B → standard).
2. The **whole-parcel qualification map** as a fallback inference when AFH is
   unreachable, sampling the finca polygon point-by-point against the
   `Qualificació_urbanística` WMS layer and classifying via the authoritative
   `DESTI` attribute (no keyword heuristics).
3. The **heritage catalog** to detect building-specific listings (BCIN/BCIL/…)
   and protected ensembles, surfacing high-protection findings as a top alert.

Serious findings (a confirmed affectation, a heritage listing) raise a
top-of-report banner above the paywall, so they're visible in the free preview.

## Project layout

```
app/[locale]/            localized routes (layout, home, /start, /report/[id])
app/admin/               operator dashboard (auth-gated)
app/api/catastro/        catastro search proxies
app/api/stripe/webhook   stripe webhook handler
components/              TopBar, LanguageToggle, BuyerForm, PropertyPicker, …
components/report/       ReportView + LockedSection (premium teaser)
adapters/                external data adapters (one file per source)
pipeline/                generate.ts, narrate.ts, template.ts (seeders)
config/brand.ts          brand + price (single rebrand surface)
config/scoring.ts        score weights + overall computation
data/sample-sors35.ts    the Sors 35 sample report (EN + ES) — UI fixture
types/db.ts              ReportInput / ReportRow (the row contract)
types/report.ts          the structured Report contract
lib/supabase/            client.ts / server.ts / admin.ts
i18n/                    next-intl routing/request/navigation
messages/                ca.json / es.json / en.json UI strings
proxy.ts                 locale middleware (Next 16 "proxy")
supabase/migrations/     SQL migrations
reference/               the canonical design HTML (source of truth)
```

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill the Supabase + Anthropic keys
npm run dev
```

Open:

- http://localhost:3000/ca — Catalan landing (default)
- http://localhost:3000/en — English landing
- http://localhost:3000/es — Spanish landing
- http://localhost:3000/en/start — buyer flow (street → unit → preview)

```bash
npm run build   # production build + type-check
npm run lint
```

### Environment variables

See `.env.local.example` for the full list. The minimum for the buyer flow to
work end-to-end:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
- `NEXT_PUBLIC_BASE_URL` (the deployed origin)

Optional, enable extra features when present: `ANTHROPIC_API_KEY` (AI
narrative), `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID`
(paid unlock), `IDEALISTA_API_KEY` / `_SECRET` (comparable listings).

## Deploy (Vercel)

1. Push to a Git repo and import the project into Vercel.
2. Add the env vars from `.env.local.example` (Production and Preview).
3. Vercel auto-detects Next.js; no extra build config required.

Pushes to `main` deploy to production automatically. Branches get Preview
deployments — these need the env vars set in the Preview scope too.
