# Scoring model

The report's headline number and the five-tile Scores grid. All logic is in
[`config/scoring.ts`](../../../config/scoring.ts); it's wired into the pipeline
by `seedScores` ([`pipeline/template.ts`](../../../pipeline/template.ts)) and
`computeScores` is called from [`pipeline/generate.ts`](../../../pipeline/generate.ts).

Design intent: a **balanced composite** spanning *deal*, *home*, and *risk*,
using **absolute thresholds** (not percentile-vs-Barcelona), with the overall
**re-normalised** over whatever pillars have data.

## Shape: 5 weighted pillars × a risk modifier

```
overall = round( weightedAvg(present pillars) × ∏(risk factors) ), capped
```

The five pillars are a weighted average; **risk is NOT a pillar** — it's a
modifier applied to the overall so a serious finding can override the weighting.

| Pillar | Weight | Source | Notes |
|---|---|---|---|
| price | 0.25 | `Pricing.deltaPct` (asking vs barri €/m²) | Only present in Section-03 state `asking-known`. Asking price is **optional**, so this pillar is often absent. |
| location | 0.18 | OSM amenities | mean of green / supermarket / market / schools / health bands |
| building | 0.15 | Catastro year built | softened age curve (see below) |
| transport | 0.12 | OSM metro | nearest-distance band + density bonus |
| energy | 0.10 | ICAEN class A–G | fixed letter map. ICAEN coverage is sparse, so often absent. |

Weights sum to 0.80; the missing 0.20 of "buyer concern" is expressed through
the risk modifier, not an averaged pillar. Weights are **re-normalised at
runtime** over the pillars that have data — so a report missing price + energy
still produces an overall from the other three.

### Pillar bands (absolute)

- **building** (`buildingScore`): age bands `[10→88][30→80][60→73][100→67]`,
  floor `63`. Deliberately flat/high at the old end — most of Barcelona's
  desirable stock predates 1930, and age is a weak proxy for quality. New
  construction earns a real bonus; old stock stays a solid "ok".
- **price** (`priceScore`, on `deltaPct`, negative = below market):
  `<-20%→90 · <-8%→82 · ≤8%→74 · ≤18%→60 · >18%→44`.
- **energy**: `A95 B86 C74 D60 E46 F32 G22`.
- **transport / location**: distance bands in `transportScore` / `locationScore`.

## Risk modifier (`assessRisk` → `RiskOutcome`)

Two primitives: a **hard cap** (the override) and **compounding multiplicative
factors**. Inputs map straight from adapter categories (`RiskInputs`).

| Trigger | Effect | Severity |
|---|---|---|
| **Affectation A** (AFH: finca has an affectation) | **cap overall ≤ `CRITICAL_CAP` (30)** | critical |
| Affectation C/D (plan in progress / suspension / indeterminate) | × 0.85 | serious |
| Flood high (T10) | × 0.80 | serious |
| Flood medium (T100) | × 0.90 | moderate |
| Heritage A/B (BCIN/BCIL) | × 0.95 / 0.96 | mild |
| Heritage C/D | × 0.98 | mild |
| Affectation B / flood low (T500) / heritage ensemble | no effect | none |

The cap is the override: a near-perfect flat with a confirmed affectation still
lands at 30 ("loses most of its value"). `seedScores` sets `verdict.tag` from
the severity (critical/serious) so the headline number and the top-of-report
alert agree.

**T500 flood ("low") is intentionally NOT penalised** — a 1-in-500-year
floodplain covers much of Barcelona and is negligible.

## Missing data & honesty (no operator review at MVP)

Reports reach the buyer without a human review step, so caveats are surfaced
automatically rather than via `toVerify`/the dashboard:

- **Unverified affectation.** If the AFH service is unavailable, `seedUrbanism`
  flags the affectation as *unverified* (a `check`-tone planning row + a
  "Planning affectation not confirmed" top alert) instead of a false "all
  clear". The score is still computed without the cap (may read too high) — the
  flag is the mitigation.
- **No energy certificate.** `seedEnergyMissing` states "Not certified" in the
  hero meta + a Risk row when ICAEN has no cert; energy drops out of the score.
- **Geocoding retry.** `geocodeWithRetry` retries once — transient geocode
  failures were leaving thin scores (building + energy only).

## Colour banding

`bandFor(score)`: `≥70 good · ≥50 ok · <50 low`. A capped (30) flat reads "low".

## Tests & calibration

- `npm test` (vitest): [`config/scoring.test.ts`](../../../config/scoring.test.ts)
  (bands, the A-cap override, compounding, re-normalisation) and
  [`pipeline/template.test.ts`](../../../pipeline/template.test.ts) (the safety
  flags).
- `npx tsx scripts/score-calibration.mts "<ref|address>[=askingEur]"` runs the
  live adapter chain (no DB) and prints the pillar breakdown — the tool used to
  tune the bands against real flats.

## Next iteration

- **Granular A-grade affectation.** Today affectation A is binary → always
  caps at 30, which over-penalises flats whose "A" is only a conservation
  overlay. The AFH response carries structured fields (`qu.elements[].c_group`
  / `c_codi` = which planning system the parcel touches, and `qu.als.resultat`
  = whether there's a road-widening substitution alignment) that let us
  distinguish *expropriation-grade* A (reserved for a public facility/road →
  keep the cap) from *minor* A (overlay/conservation → a milder ~×0.88 penalty)
  **using authoritative codes, not free-text keyword heuristics**. Moderate
  effort (~half a day); needs a handful more category-A samples to validate the
  split first. Deferred for MVP (binary A→30 kept).
- **Document upload → richer analysis.** A planned section where the buyer
  uploads building documents (ITE — *inspecció tècnica de l'edifici*, actes de
  la comunitat, etc.) to feed the analysis. The building/risk pillars are the
  natural consumers (e.g. an unfavourable ITE should weigh on the building
  score and surface as an alert). Not yet designed.
