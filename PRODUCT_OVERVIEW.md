# PisoWise — Product Overview

> **Purpose of this document.** A self-contained briefing on what PisoWise is, what
> it can do today, where it can go, and where it is weak — written to bring an
> advisory context (e.g. a Claude Chat project) fully up to speed. It is grounded in
> the actual codebase as of **2026-07-01**, not aspirations. Where something is an
> inference rather than a documented fact, it is marked *(inference)*.

---

## 1. What PisoWise is, in one paragraph

PisoWise generates **independent, plain-language due-diligence reports for a specific
Barcelona flat** a buyer is considering. You enter an address (or cadastral
reference); it pulls that property's official data — cadastre, energy certificate,
urban-planning qualification and affectations, heritage protection, natural risks,
neighbourhood amenities, and barri-level closing prices — cross-checks them, scores
the flat on five dimensions, and writes the whole thing up in language a non-expert
can act on. There is a **free preview** and a **paid full report + PDF** (currently
**€49**, set in `config/brand.ts` and overridable via the `REPORT_PRICE_EUR` env
var). It is trilingual: **Catalan, Spanish, English**.

> **Pre-launch gate (as of 2026-07-01).** While the live report-generation flow is
> being finalised, the primary **"Check my flat" CTA routes to an early-access
> waitlist** (`/[locale]/early-access`), not to `/start`. It captures an email plus
> (optionally) the specific flat into a Supabase `waitlist` table. The real `/start`
> flow still works and is reachable by URL. Flip the single `PRIMARY_CTA_HREF`
> constant in `i18n/navigation.ts` back to `/start` when the flow ships.

**Who it is for (and deliberately not for).** Local **first-time buyers buying a home
to live in**. It is explicitly **not** for foreign investors and **not** for the
tourist-home / short-let market. This is a hard product principle, not a slogan: no
NIE / "moving to Spain" framing, no rental-yield or Airbnb-licence features, taxes
default to Catalan-resident assumptions. The positioning is **buyer-side and
conflict-free**: PisoWise never sells flats and never takes money from sellers, which
is what lets it say what is *wrong* with a flat, not just what looks nice.

**The honesty stance is a feature.** The product refuses to invent a single valuation
("AVM") number. Instead it shows the official €/m² references and the barri's recent
**closing-price** range and lets the buyer judge. The tagline of the approach: *honest
beats precise-looking.*

---

## 2. The two things in the operation

1. **The product** — the Next.js web app (`llar/`). This is "PisoWise." Everything
   below is about this unless stated otherwise.
2. **The marketing engine** — a separate small Python tool (Reddit Lead Digest) that
   finds Reddit posts where the founder can helpfully answer first-time-buyer
   questions and drafts replies. It is a **lead/credibility channel**, not part of the
   product. Covered briefly in §9.

---

## 3. What the product does today (capabilities, in detail)

### 3.1 The buyer flow
*(Currently gated — see the pre-launch note in §1. The "Check my flat" CTA sends
buyers to the early-access waitlist; the flow below is live at `/start` by URL and
is the destination the CTA reverts to at launch.)*
1. **Find the flat** — street search or cadastral reference, with a unit picker
   (address → cadastral ref → specific unit). Backed by Catastro search proxies.
2. **Generate** — a deterministic pipeline fans out to ~13 data sources, seeds a
   structured report, computes the scores, and stores it.
3. **Read** — a **free preview** with the headline verdict, the five scores, key
   facts, risks, neighbourhood, planning, and costs; the deeper analytical sections
   are gated behind the paywall. A downloadable **PDF** comes with the paid unlock.

### 3.2 The report: 12 sections
The report is a single structured object (`types/report.ts`). Sections:

| # | Section | What it contains |
|---|---|---|
| 00 | Hero + Verdict | Headline score (0–100), one-line verdict tag, key facts |
| — | Alerts | Top-of-report banners for serious findings (affectation, heritage) — **shown in the free preview** |
| 01 | Scores | Five rings: location, transport, building, price, energy |
| 02 | Snapshot | Fact grid (barri/district, surface, year, etc.) |
| 03 | Price & value | Barri closing €/m², a fair-value **range** (never a single number), asking-vs-market delta, offer ladder |
| 04 | Building & condition | Age, what's good / what to scrutinise, ITE prompt |
| 05 | Risk & safety | Flood, seismic, radon, district crime |
| 06 | Legal & documents | Nota simple, cédula, comunidad minutes, levies — what to request and why |
| 07 | Neighbourhood | Metro, healthcare, green space, markets, schools |
| 08 | Planning & restrictions | Per-aspect status rows: affectation, zoning qualification, heritage, ZBE |
| 09 | Costs & taxes | Resident-assumption ITP and purchase costs |
| 10 | Tax & subsidies | Applicable buyer schemes |
| 11 | Negotiation playbook | Tactics grounded in the findings |
| 12 | Pre-offer checklist | What to do before signing |

**Paywalled (premium) sections:** `price`, `building`, `legal`, `negotiation`,
`checklist`. Everything else — including the scores and the serious alerts — is in the
**free preview**. (This split is defined by `PREMIUM_SECTIONS` and is a deliberate
lever: it's what a buyer sees before paying.)

### 3.3 The scoring model
The headline number is **not a flat average**. It is **five weighted pillars × a risk
modifier**, with absolute thresholds (not "percentile vs Barcelona") and the overall
**re-normalised over whatever pillars actually have data**.

- **Pillars & weights:** price 0.25 · location 0.18 · building 0.15 · transport 0.12 ·
  energy 0.10 (sum 0.80; the missing 0.20 is expressed via risk, not an averaged
  pillar).
- **Risk is a modifier, not a pillar.** A serious finding can override the weighting:
  - **Affectation A (the city has earmarked the finca) hard-caps the overall at 30** —
    a near-perfect flat with a confirmed affectation still reads "low."
  - Affectation C/D ×0.85, high flood (T10) ×0.80, medium flood (T100) ×0.90, heritage
    listings ×0.95–0.98. T500 ("1-in-500-year") flood is intentionally **not**
    penalised (it covers much of Barcelona).
- **Bands:** ≥70 good · ≥50 ok · <50 low.

### 3.4 The planning section — the strongest signal
Section 08 is the part most grounded in authoritative data and the clearest
differentiator. It is driven by three official Ajuntament de Barcelona sources:
1. **Official AFH affectation verdict (A/B/C/D)** — the primary signal, keyed by parcel.
2. **Whole-parcel qualification map** — fallback inference when AFH is down, sampling
   the finca polygon point-by-point against the authoritative `DESTI` attribute (no
   keyword guessing).
3. **Heritage catalogue** — detects building-specific listings (BCIN/BCIL) and
   protected ensembles.

Serious findings raise a banner **above the paywall**, so a buyer sees a deal-breaker
in the free preview.

### 3.5 AI narrative (Anthropic)
- Wired but **opt-in per report** and **feature-flagged off** if no Anthropic key.
- Stored per-language (CA/ES/EN).
- **Grounded to the deterministic data**: the prompt is fed the authoritative barri /
  district and the Gencat closing-price benchmark, and is forbidden from inferring a
  neighbourhood from the street or contradicting the computed sections. This is what
  stops the LLM from saying "Eixample" for a Gràcia flat or inventing a price.

### 3.6 Trilingual
Catalan / Spanish / English with locale-prefixed routing (`/ca`, `/es`, `/en`). UI
strings are fully translated; the per-report AI narrative is stored per language. **CA
currently falls back to ES** until per-report Catalan narrative exists.

---

## 4. Output quality & UX

**Voice.** Plain language first, with the Catalan technical term in parentheses as a
reference tag (e.g. *"a public facility (zoning code 7a)"*, never raw jargon). No
emoji. Every planning claim carries a *"verify with a certificat urbanístic"*
disclaimer — the report is explicitly an **orientation tool, not a legal certificate**,
and says so.

**What the landing page promises (actual copy):**
- *"Know what you're really buying — before you sign."*
- *"Official, open sources only. No portal scraping. Verifiable, date-stamped data."*
- *"We never invent a price… Honest beats precise-looking."*
- *"For people buying a home to live in. Not investors. Not short-lets."*

**Where the output is genuinely strong:**
- The **planning / affectation / heritage** analysis — official, parcel-specific, and
  the kind of thing buyers otherwise discover at the notary or never.
- The **price honesty** — separating asking from closing prices, showing a range with
  sources, refusing a fake point-estimate. Credible and differentiating.
- **Conflict-free framing** — buyer-only, no seller money — is a real trust asset.
- **Graceful degradation** — when a source is down, the report says so rather than
  printing a confident "all clear."

**Where the UX/output is still thin (see §6 for the full list):**
- The **landing/SEO/legal polish is partial**. (The old €14.90/€35 price split is
  now resolved — the price is **€49** in `config/brand.ts` and the `REPORT_PRICE_EUR`
  env var, kept in sync.)
- **Comparable listings are usually empty** (Idealista API not provisioned), so
  Section 03 leans entirely on the barri benchmark.
- The **paid unlock isn't live** (Stripe scaffolded, needs production keys), so the
  end-to-end "pay → PDF" path can't be exercised in production yet.

---

## 5. Data sources & how trustworthy each section is

PisoWise's whole pitch rests on **official, open sources** — no portal scraping. The
adapters degrade gracefully: a missing source becomes "unavailable," never a crash.

| Source | Feeds | Grounding strength |
|---|---|---|
| **Catastro** (OVC) | year built, surface, parcel, units, search | High — public, authoritative; cached 30 days |
| **Ajuntament BCN AFH** | official affectation verdict A/B/C/D | High — the headline differentiator |
| **Ajuntament BCN WMS** | zoning qualification (fallback) | High — authoritative `DESTI` attribute |
| **BCN heritage catalogue** | BCIN/BCIL listings | High |
| **Gencat Habitatge** | barri closing €/m² (notarial deeds, second-hand) | High but **coarse** — barri-level, 73 barris only, quarterly |
| **ICAEN** | energy certificate A–G | High when present; **coverage is sparse** |
| **ACA / SNCZI** | flood T10/T100/T500 | High — point-queried rasters |
| **OSM / Overpass** | amenities, transport | Medium — public mirrors are flaky; raced at 8s timeout |
| **INE IPV** | Catalonia price index | Low resolution — only a footnote when barri data is missing |
| **Idealista API** | comparable listings | **Not provisioned** — usually empty |
| **Live deep links** (Idealista/Fotocasa/Habitaclia) | "see similar listings" | Built but **not currently rendered** |

**Caching:** only Catastro is cached (30 days); everything else is fetched fresh per
report.

---

## 6. Weaknesses & risks (candid, detailed)

### Coverage & data
- **Single city.** Barcelona only. The affectation/heritage/zoning moat is BCN-specific;
  the planning logic does **not** transfer to other Spanish cities without new sources.
- **Barri price coverage is partial.** Closing-price benchmarks exist for **73 barris**;
  addresses outside them (or barris with too few recent sales) get no fair-value range.
  The product correctly refuses to fake it, but that's a coverage hole.
- **The price pillar is often absent.** Asking price is optional input, so the
  highest-weighted pillar (0.25) frequently doesn't fire — the score then re-normalises
  over the rest, which is honest but means the headline number leans on fewer signals
  than its design implies.
- **Energy coverage is sparse.** ICAEN often has no certificate → energy drops out of
  the score.
- **Comparables are effectively missing.** Idealista API isn't provisioned; Section 03
  rests entirely on the (coarse, barri-level) Gencat benchmark.

### Trust, safety & correctness
- **No human review before the buyer sees it (MVP).** Reports reach the buyer without
  an operator gate. The mitigation is that uncertainty must be **surfaced to the buyer**
  (a caution row/alert), not silently dropped — but it means a bad data day ships
  directly to a paying customer.
- **A transient Catastro failure guts the whole report.** Catastro is the one adapter
  whose failure bubbles up — and it has **no retry**. A flaky "fetch failed" can produce
  a near-empty report that still reaches the buyer. *(Known fragility.)*
- **Serverless time budget.** The pipeline runs as a Server Action; if a slow source
  (historically Overpass) blows the `maxDuration`, the row can be left with empty data.
  Mitigated by bounding slow sources, but it's a structural risk.
- **The affectation A-cap is blunt.** Category A always caps at 30, which over-penalises
  flats whose "A" is only a minor conservation overlay rather than expropriation-grade.
  A granular split (using the AFH structured fields) is designed but **deferred**.
- **AI narrative is a hallucination surface.** It's grounded and opt-in, but any LLM
  prose over property facts carries contradiction/hallucination risk; the guardrails
  reduce but don't eliminate it.

### Monetization & go-to-market
- **Paywall isn't live.** Stripe is scaffolded but needs production keys; the
  pay → unlock → PDF loop is unproven in production.
- **Pricing is settled at €49** (`config/brand.ts` + `REPORT_PRICE_EUR`, in sync).
  Anchoring is decided; what's unproven is willingness-to-pay at that point, since
  the paywall hasn't run live yet.
- **Demand is being pre-collected via the early-access waitlist** (see §1), plus the
  founder's manual Reddit presence (§9). No paid acquisition, SEO depth, or partner
  pipeline live yet.
- **Landing/SEO/legal polish is partial** — a conversion and credibility drag.

### Strategic
- **Thin moat outside BCN planning data.** The genuinely hard-to-replicate asset is the
  parcel-level affectation/heritage/zoning integration. Most other sections (amenities,
  energy, generic price context) are commoditizable. *(inference)*
- **Operator-scaling not designed.** "No operator review at MVP" is fine at low volume;
  there's no built path for human QA at scale if quality complaints arise. *(inference)*

---

## 7. Potential & where it can go

- **Document upload → richer analysis (designed, not built).** Let the buyer upload the
  building's ITE, comunidad minutes, etc., and fold them into the score and alerts (e.g.
  an unfavourable ITE weighs on the building/risk pillars). This is the single biggest
  depth upgrade and turns a data-aggregation tool into a real diligence assistant.
- **Granular affectation grading** — distinguish expropriation-grade A from a minor
  overlay using authoritative AFH codes; removes the blunt over-penalty and increases
  trust in the headline score.
- **Geographic expansion** — the architecture (per-source adapters, never-throw
  contract) is built to add cities; the limiting factor is finding the equivalent
  official planning/affectation feeds elsewhere.
- **B2B / partner channel** — the landing already pitches buyer's agents, mortgage
  brokers, lawyers, and gestories: **co-branded reports, referrals, API access.** This
  may be a faster revenue path than B2C one-off sales. *(inference)*
- **Negotiation positioning** — the report's findings (planning issues, asking-vs-
  closing gap) are literally the levers that move a price; "the report that pays for
  itself in one negotiation" is a strong, honest narrative. *(inference)*
- **The trust/honesty stance as the brand** — "we never invent a price, we only work
  for the buyer" is a defensible, hard-to-copy-for-incumbents position in a market full
  of portals that take seller money.

---

## 8. Tech & operational facts (for grounding advice)

- **Stack:** Next.js 16 (App Router, TS; middleware is `proxy.ts`), Tailwind v4,
  next-intl, Supabase (storage + operator auth), Anthropic (narrative), Stripe
  (scaffolded). Fonts: Manrope + Space Mono.
- **Deploy:** Vercel; **push to `main` = production deploy.** `feat/*` branches get
  previews, but **env vars are Production-only**, so previews can't generate reports.
- **Pipeline contract:** adapters **never throw** (`AdapterResult` with
  ok/unavailable/error + `toVerify`); seeders are pure; provenance tracked in
  `report_sources`. Three **non-interchangeable** Supabase clients (admin/server/client).
- **Rebrand/reprice surface:** `config/brand.ts` (price default `reportPriceEur`).
  **Reprice = two places:** update `config/brand.ts` *and* the `REPORT_PRICE_EUR`
  env var in **Vercel Production** (it overrides the config at runtime via
  `lib/stripe.ts`); a redeploy is required. Scoring lives in `config/scoring.ts`.
- **In-repo knowledge base:** `README.md`, `AGENTS.md`, and `.claude/skills/onboard/`
  (DATA_SCHEMA, INTEGRATIONS, PIPELINE_FLOW, SCORING, REFRESH_SCRIPTS).

---

## 9. The marketing engine (context, not product)

A separate Python tool (**PisoWise Reddit Lead Digest**) runs daily as a GitHub Action.
It reads Reddit's public RSS feeds for first-time-buyer / mortgage / buying-process
questions across Spain-wide subreddits, scores them with Claude, drafts peer-voice
reply suggestions (never mentioning PisoWise), and emails the founder a digest to
review and post manually. It exists to **build credibility and a lead channel** ahead
of the product mentioning itself. Scope was recently broadened from Barcelona-only to
Spain-wide to build Reddit standing first; the plan is to narrow back to Barcelona once
the founder starts referencing PisoWise. It is intentionally minimal — no database, no
auto-posting, no web UI.

---

## 10. The one-line summary for an advisor

> A trustworthy, buyer-only, Barcelona-specific property due-diligence report whose real
> edge is parcel-level **planning/affectation/heritage** intelligence and a refusal to
> fake a valuation — currently strong on data integrity and honesty, weak on coverage
> breadth, live monetization, and demand generation, with its biggest near-term upside
> in **document-upload depth** and a **B2B partner channel**.
