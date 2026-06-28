<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PisoWise — agent conventions

Read these before editing. They're the rules a fresh chat will silently violate.

## Target audience & ethical stance

This product is for **local first-time buyers** in Barcelona — people buying a
home to live in. It is deliberately **not** aimed at foreign investors and
explicitly **not** at the tourist-home / short-let market. When making product
decisions (copy, features, partnerships, data sources), default to what serves
a resident buyer; flag anything that would primarily serve investors or
short-let operators.

Concrete implications:
- No NIE / non-resident / "moving to Spain" framing in report or marketing copy.
- No rental-yield or Airbnb-licence features.
- Costs & taxes reflect Catalan residents (default to resident ITP reductions
  where they apply); never assume non-resident mortgage limits.
- Language priority: **CA + ES first**, EN as the international convenience.

## The pipeline contract

- **Adapters never throw.** They return `AdapterResult<T>` with `status: "ok" | "unavailable" | "error"` and `toVerify: true` on anything but a confident `ok`. Throwing breaks `pipeline/generate.ts` and the buyer sees a generic error banner. See `adapters/types.ts` for `ok()` / `unavailable()` / `failed()` helpers.
- **Adapters are pure functions of their inputs.** No DB writes, no logging side-effects beyond the returned `note`. Caching lives in `pipeline/generate.ts` via the `source_cache` table.
- **Seeders are pure too.** `pipeline/template.ts` exports `seedX(report, data)` that `structuredClone` the report and return the new one. Never mutate in place.
- **Provenance.** When you add an adapter, add a row to `report_sources` in `pipeline/generate.ts` and a key to `SourceKey` in `adapters/types.ts`.

## Data shapes you'll touch

- **`Localized = { en, es }`** for every string with words (see `types/report.ts`). The resolver in `lib/localized.ts` falls back to `es` for `ca` until per-report Catalan narrative exists. Never hardcode an `en`-only string in report data.
- **`toVerify: true`** marks a field the operator must confirm before publishing. Default to `true` on `unavailable` / `error`; only set `false` on a confident `ok`.
- **`alerts[]` vs `urbanism.items[]`.** Section 08 ("Planning & restrictions") is a list of plain-language status rows in `urbanism.items` (tone: `caution` / `check` / `clear` / `info`). Anything *serious enough that the buyer must see it above the paywall* goes ALSO in `report.alerts` (tone: `caution` / `check`). Add to both for a serious finding; just `items` for context.
- **Alerts have an optional `previewDetail`.** When set, the free preview renders that generic line instead of `detail`; the paid full report always renders `detail`. The split exists so the buyer sees that a finding is real without giving away the specifics that motivate the unlock — currently only the *planning-affected* alert uses it (see `seedUrbanism` in `pipeline/template.ts`). Most alerts (ITE, heritage, unverified, etc.) intentionally show the same `detail` in both states; leave `previewDetail` undefined for those.
- **`PREMIUM_SECTIONS`** in `types/report.ts` lists sections gated behind the paywall. Changing the membership changes what the free preview shows — do it deliberately.
- **The score is 5 weighted pillars × a risk modifier**, not a flat average. Risk (affectation/flood/heritage) can *override* the pillars — affectation A hard-caps the overall at 30. Don't add a risk "pillar"; don't bypass `computeScores`. Full model in `.claude/skills/onboard/SCORING.md`.

## No operator review at MVP — flag to the buyer

The `in_review` status still exists, but reports currently reach the buyer
without a human gate. So `toVerify`/the dashboard are **not** the safety net:
anything that needs verifying must be surfaced to the buyer automatically (a
`check`-tone alert/row), not left for an operator. Examples already wired:
unverified affectation (AFH down) and "energy not certified". Don't print a
confident "all clear" for data you couldn't actually confirm.

## Voice & jargon

- **Plain English first; Catalan term in parentheses as a reference tag.** The section was rewritten precisely because it leaked terms like *clau 13E* and *Conjunt Especial de l'Eixample* into prose foreign buyers can't read. Match the existing pattern: *"a public facility (zoning code 7a)"*, not *"7a — Equipaments actuals"*.
- **Always keep the *"verify with a certificat urbanístic"* disclaimer** in planning prose. It's deliberate: our data is informational, not a legal certificate.
- **No emoji in report copy.** Caution arrow `⚠` is the only typographic alert allowed.

## Supabase clients are NOT interchangeable

In `lib/supabase/`:
- `admin.ts` — service role, **bypasses RLS**. Server-only. Use from the pipeline and operator-only actions.
- `server.ts` — anon key + the request's session cookies. Use in Server Components / Route Handlers acting as the signed-in operator.
- `client.ts` — browser client.

Importing the wrong one is the easiest way to leak data or break auth.

## Page chrome is per-page, not in the layout

`app/[locale]/layout.tsx` does **not** render a nav. The marketing homepage
(`components/landing/`) owns its own sticky `LandingNav`; interior pages
(`/start`, `/report/[id]`) render `<TopBar/>` themselves. Don't "helpfully" move
`TopBar` back into the layout — it would double up under the homepage's
`LandingNav`. A new interior page needs to render its own `<TopBar/>`.

The homepage CSS is a 1:1 port of `design_handoff_pisowise_brand/design_handoff_homepage`,
scoped under a `.lp` root in `app/globals.css`. Keep landing styles under `.lp`
(the design uses generic names like `.nav`, `.band`, `.story` that would collide
otherwise), and edit landing copy in the `landing` namespace of `messages/*.json`.

The language switcher (`components/LocaleSwitcher.tsx`) is a branded dropdown
(`.langdd*` styles, spec'd in `design_handoff_homepage_language_toggle`) shared
by the marketing nav and the interior-page `TopBar`. Items navigate via the
next-intl router (not local state). On phones the nav drops to a mark-only logo
(`≤430px`) so the logo + dropdown + CTA fit without overflow — verify across all
three locales (CA/ES labels run longer than EN and overflow first).

Two traps when overriding shared styles under `.lp`:
- **Global element/class rules bleed in.** A bare `h2`, `.eyebrow`, etc. still
  applies inside `.lp`, so a `.lp` override must explicitly reset what it
  doesn't want (e.g. `.lp .eyebrow` had to zero the global `margin-bottom`, and
  `.lp .partner h2` must set `color:#fff` or the global `h2` colour hides it on
  the dark band).
- **The CSS pipeline (Lightning CSS) can silently drop a redundant-looking
  override.** A `.lp .nav .pw-wordmark` rule was dropped from the compiled
  output entirely because the same selector already existed in another
  `@media` block. Give the override a distinct selector (e.g. scope it through
  a parent like `.lp .nav .pw-lockup .pw-wordmark`) so it survives — and verify
  it landed in the **built** CSS, not just the source.

## Local dev gotcha — stale styles survive a server restart

The Turbopack dev server (`npm run dev`) caches in `.next`, and that cache can
go stale: edits to `app/globals.css` (and occasionally components) keep serving
the **old** compiled CSS even after stopping and restarting the server. Symptoms:
a rule you just wrote isn't in the page, `getComputedStyle` shows old values, the
served `_next/static/chunks/*.css` doesn't match the source. Don't burn time
re-editing the rule or debugging specificity — **`rm -rf .next` and restart**.
Running `npm run build` (production) into the same `.next` makes this worse, so
clear the cache after a build if you go back to dev. `next build` itself is
reliable; trust it (and the built CSS) over the dev server when verifying.

## Operational facts

- **Vercel auto-deploys on push to `main`** (production). The `feat/*` branches get Preview deploys.
- **Env vars are set in Vercel Production only**, not Preview. PR previews currently can't generate reports until Preview-scope vars are added.
- **Schema lives in `supabase/migrations/`.** Apply via the Supabase SQL editor or `supabase db push`.
- **All keys are read at request time** via `process.env` — no module-level reads, so feature-flag adapters (`hasAnthropicKey()`, `hasStripe()`) work.

## Don't

- Add fallbacks for "the env var is missing" — fail loudly at boundary or feature-flag the whole adapter. Silent fallbacks hide misconfigurations like the one that made the whole site error for hours.
- Rename `toVerify`, `Localized`, or `AdapterResult` — they're load-bearing across the pipeline.
- Add a `console.log` to the pipeline path you're debugging and leave it. Use the `note` field on `AdapterResult`.
