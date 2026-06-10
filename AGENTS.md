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

## Operational facts

- **Vercel auto-deploys on push to `main`** (production). The `feat/*` branches get Preview deploys.
- **Env vars are set in Vercel Production only**, not Preview. PR previews currently can't generate reports until Preview-scope vars are added.
- **Schema lives in `supabase/migrations/`.** Apply via the Supabase SQL editor or `supabase db push`.
- **All keys are read at request time** via `process.env` — no module-level reads, so feature-flag adapters (`hasAnthropicKey()`, `hasStripe()`) work.

## Don't

- Add fallbacks for "the env var is missing" — fail loudly at boundary or feature-flag the whole adapter. Silent fallbacks hide misconfigurations like the one that made the whole site error for hours.
- Rename `toVerify`, `Localized`, or `AdapterResult` — they're load-bearing across the pipeline.
- Add a `console.log` to the pipeline path you're debugging and leave it. Use the `note` field on `AdapterResult`.
