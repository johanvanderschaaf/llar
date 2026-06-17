# Report page — design brief for Claude Design

**Goal:** redesign the buyer **report page** (`/[locale]/report/[id]`). The content
and data are settled (see below). **All visual, layout, typographic and interaction
decisions are yours** — this brief only fixes *what is true about the product* and *what
must keep working technically*. Trust your design judgement within those guardrails.

The marketing homepage was already redesigned ("Field & Air"); treat it as the brand
reference for tone and identity, but the report is its own surface — you are not
constrained to copy the homepage layout.

---

## 1. What the report is (and who it's for)

An independent, buyer-side due-diligence report for **one specific Barcelona flat**, for
**local first-time buyers** (resident, buying a home to live in — not investors, not
short-let). Built only from **official/open data**; deliberately honest (it never invents
a valuation, a photo, or an offer number). The honesty/independence *is* the brand.

It's freemium and trilingual:
- **Preview (free, pre-paywall)** vs **full report (unlocked)** — see §4.
- **Catalan / Spanish / English**, locale-prefixed routes (`/ca`, `/es`, `/en`).
- There's a **print/PDF** path (the report must stay printable).

---

## 2. Hard constraints that shape the design

These come from what the data layer actually provides. Designing around things we don't
have is the main trap.

- **No property media.** We never ingest the listing, so there are **no photos, no floor
  plans, no agent/portal branding**, and no bed/bath count, condition ("reformed"),
  fixtures (lift, terrace, A/C, heating) or seller identity. A real-estate layout that
  leans on a hero photo won't work here. The "hero" is the address + a few official facts.
- **The content is facts, numbers, scores and short text rows**, plus a generated date.
  Geodata available: the parcel's lat/lon and named nearby amenities with walking
  distances. **No map tiles are integrated** — a map would be a new integration (fine to
  propose, flag it as such).
- **Trilingual length.** CA/ES copy often runs ~15–30% longer than EN and overflows
  first. Everything must flex; test all three. A few legal/document terms are kept in
  Spanish/Catalan on purpose (nota simple, cédula d'habitabilitat, ITE, actas, derrama,
  división horizontal) with a short gloss — don't "fix" these to English.
- **Graceful absence.** Many fields are optional and can be missing:
  - **Asking price is optional** → the Price section has **three states** (§5.03).
  - **Energy** may be absent (no certificate) → one fewer score ring / row.
  - **Score** can have **4 rings instead of 5** when a pillar lacks data.
  - **Alerts** are `0..n`.
  Design every section for the empty/absent case, not just the happy path.
- **No emoji.** The caution arrow `⚠` is the only typographic alert glyph allowed. **No
  em-dashes** in copy (commas/colons/parentheses instead) — keep this if you add any text.
- **Facts-first.** No verdict-on-price language, no fabricated precision (no invented
  offer amounts, no single valuation number). The score is shown, but it is **not** a
  recommendation.

---

## 3. The score (how to treat it visually)

Five rings, each **0–100**: **location, transport, building, price, energy**, plus one
**overall 0–100**. Bands drive colour semantics: **good ≥ 70, ok ≥ 50, low < 50**. A
serious risk (planning affectation, flood, heritage) can **cap/drag the overall** below
what the pillars suggest — so a high-pillar flat can still read "low". Each ring has a
short caption. **Do not present the overall as a single price verdict** (we just removed a
tag that did exactly that). Pillars can be missing — design for 4 or 5 rings.

---

## 4. Free preview vs full report

`PREMIUM_SECTIONS = price, building, legal, negotiation, checklist`. In **preview** mode
these render **locked/teaser**; everything else is fully visible. There's a **paywall
banner/CTA** (price from `config/brand.ts`, currently €35). The preview also shows a
generic, score-band tag ("Worth a viewing" / "Check carefully" / "Proceed with caution")
and the overall score. Design needs **two states per gated section** (teaser vs full) and
a compelling locked state — the visible free sections (scores, alerts, snapshot, planning,
risks, neighbourhood, costs) are what sells the unlock.

---

## 5. Content inventory (the sections)

Free unless marked **[premium]**. This is the content; **order and grouping below
include the product owner's requirements — please honour the ones marked “REQUIRED”,
everything else is yours.**

- **Hero** — address (title), floor (Catastro), a one-line sub, and a compact meta strip:
  asking price, €/m², energy class (only these — they're all we have). **Eyebrow**: shows
  "Independent buyer's report · {date}". **REQUIRED:** make it responsive — full label on
  desktop, **date-only on mobile** (it overflows otherwise).
- **Bottom line (verdict)** — headline + 3–4 sentence body + the overall score ring. **No
  tag/chip beside the score** (removed — it implied the score was only about price).
- **Alerts** (0..n) — top-of-report banners for serious findings (e.g. a planning
  affectation), tone `caution`/`check`. Shown in the free preview. This is how a
  deal-breaker reaches the buyer above the paywall.
- **01 Scores** — the five rings (§3).
- **02 Snapshot** — fact grid (address, neighbourhood, built area, usable area, year
  built, cadastral ref) + a note (e.g. number of units in the building).
- **03 Price & value [premium]** — the flagship. Driven by a structured payload with
  **three states** you must design for:
  1. `asking-known`: a verdict line + a **number line** (asking marker vs barri
     closing-price average, within a low–high range) + an asking-vs-closing compare + an
     evidence panel (avg €/m², registered sales count, period, source).
  2. `asking-unknown`: same minus the asking marker (barri average is the anchor) + a
     big-stat.
  3. `barri-unavailable`: a ⚠ note + how-to-read guidance (we won't fake a range).
  The single price anchor is the **barri closing-price** benchmark (Gencat). State its
  "closing" nature once; don't repeat it.
- **Planning & restrictions** — **REQUIRED: place this immediately after Price**, and give
  it real prominence; it's the product's strongest differentiator. A list of status rows
  (affectation, zoning, heritage, ZBE), each tone `caution`/`check`/`clear`/`info`. **Even
  a "clear" result should communicate what was officially checked** (affectation A/B/C/D,
  zoning qualification, heritage listing, low-emission zone). Always keep the "verify with
  a *certificat urbanístic*" disclaimer.
- **Building & condition [premium]** — two panels (the building / what to check) + a
  keyline. Year-based facts only (ITE obligation, possible asbestos) — no interior claims.
- **Risk & safety** — rows with tone good/ok/low (flood, seismic, radon, ITE, asbestos,
  crime).
- **Neighbourhood** — lede + amenity facts (metro, health, green, markets, schools) + note.
- **Costs & taxes** — intro + fact grid (ITP, notary, gestoria, valuation, all-in) +
  footnote. ITP is maintained (Catalan brackets) with caveats in the footnote — **no "to
  verify" badge** here.
- **Tax & subsidies** — panels (deductions, grants, what the buyer takes on).
- **Negotiation playbook [premium]** — intro + 2–3 fact-based **reasons to negotiate** + a
  tactic. **No specific offer amounts or target prices** (we can't know a sound number);
  it's about *why* and *how* (conditions to attach), not *how much*.
- **Before you offer [premium]** — **REQUIRED: make this a hub** with two parts: (a) the
  on-site/process **actions** (count mailboxes, inspect for damp, visit at different times,
  mortgage decision-in-principle), and (b) a clearly-labelled **"Documents to request"
  sub-list** (nota simple, cédula, ITE, actas, derrama, etc.). Keep the documents as a
  distinct sub-section — a future product version will let buyers **upload and analyse
  those documents**, so this container should read as the natural home for that.
- **Footer** — sources & method + disclaimer + generated date.

---

## 6. The data contract (so the design maps to real data)

The page renders from a single typed `Report` object (`types/report.ts`). Key points:
- Every text-with-words field is a `Localized = { en, es, ca? }` (ca falls back to es).
- `report.alerts?` is optional and variable-length; `report.scores` can be < 5 entries.
- `report.price.pricing.state` selects the 3 price states; many price sub-fields are
  optional per state. `report.price.comps` is effectively always empty (no portal data).
- `toVerify` flags exist on some facts (mostly when a source was unavailable) — render
  them as a subtle "to confirm" affordance, not an error.
- Don't rename or restructure the `Report` type, the pipeline, or the adapters — design
  against the existing shape. If you need a new field, flag it rather than inventing data.

---

## 7. Technical integration (what will and won't work on the site)

- **Next.js 16, App Router, React Server Components.** `ReportView` is a server component;
  `PriceSection` is the Section-03 renderer. Edit `components/report/*`.
- **Tailwind v4 (CSS-first).** Design tokens are CSS variables `--pw-*` in
  `app/globals.css`; report styles live there + in CSS Modules (`PriceSection.module.css`).
  Reuse/extend the tokens. **Scoping trap:** landing styles are scoped under `.lp` and use
  generic class names; keep report styles from colliding, and remember global element
  rules (`h2`, `.eyebrow`, …) bleed in unless reset.
- **Fonts:** Manrope (UI/headlines) + Space Mono (numbers/codes), via `next/font`.
- **Print/PDF:** there's a print path with a print-only brand header; keep the report
  printable (or coordinate if you change structure significantly).
- **Dev gotcha:** the Turbopack dev cache (`.next`) goes stale on CSS edits — if a style
  isn't applying, `rm -rf .next` and restart; trust `next build` over the dev server.
- **Page chrome:** interior pages render their own `<TopBar/>` (not in the layout) and the
  shared branded `LocaleSwitcher`. Don't move chrome into the layout.
- **Verify across all three locales** and at mobile widths (CA/ES overflow first).

---

## 8. Brand assets & references

- `config/brand.ts` — wordmark (Piso + Wise), market, price. Single rebrand/reprice file.
- `design_handoff_pisowise_brand/` — brand spec + the homepage "Field & Air" design (the
  current visual language to harmonise with).
- `app/globals.css` — existing tokens and the current report styles.
- `data/sample-sors35.ts` — a complete, realistic sample `Report` (Carrer de Sors 35) you
  can render at `/[locale]/report/sample-sors35` to see every section with real content
  and exercise the states.

---

## 9. The one line

Design a trustworthy, scannable, mobile-first **buyer's due-diligence report** that makes
the **planning/affectation** intelligence and the **honest price picture** the heroes,
works with **facts only (no photos, no fabricated numbers)**, degrades gracefully when
data is missing, and reads cleanly in **CA/ES/EN** and in print. The rest is your call.
