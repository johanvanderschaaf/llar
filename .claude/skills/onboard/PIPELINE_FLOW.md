# Pipeline flow

`pipeline/generate.ts:generateReport()` is the spine. This page documents the call order, dependencies, and what triggers Section 03 to render in each of its three states.

## Sequence

```
1. cachedCatastro(ref)                         ← only blocking call before parallel fan-out
2. INSERT into reports (status='in_review')   ← report id is fixed here
3. seedFromCatastro / seedPriceRefs / seedCostsTaxes / seedBuilding / seedLegal
4. Promise.all([ fetchEnergy(ref), fetchIpv() ])
5. seedEnergy if energy.ok, else seedEnergyMissing ("Not certified")
6. if cat.ok:
     Promise.all([ geocodeWithRetry(ref), fetchAffectation(parcelRef) ])
     if geo.ok:
         Promise.all([
           fetchAmenities,
           fetchUrbanism,
           fetchComps,
           fetchFlood,
           fetchHeritage,
         ])
         seedAmenities  / seedUrbanism / seedHeritage / seedComps
         barri = fetchGencatBarri(geo)
         if barri.ok:  seedBarriPricing  → Section 03 STATE 01 or 02
         else:         seedPricingUnavailable(ipv)  → Section 03 STATE 03
     else:
         seedPricingUnavailable(ipv)  → Section 03 STATE 03
     if !urbanismSeeded:
         seedUrbanism(EMPTY_URBANISM, affData)   ← affectation alert without geo;
                                                   flags "unverified" if affData absent too
7. seedRisks (flood + static seismic/radon + district crime)
8. seedFooter
9. computeScores (5 pillars + risk modifier) → seedScores   ← see SCORING.md
10. UPDATE reports SET data
11. UPSERT into report_sources (one row per attempted source)
```

Steps 4 and 6's `Promise.all`s run their adapters concurrently — they share no inputs.

## Section 03 state decision

| Branch reached | `Pricing.state` |
|---|---|
| `cat.ok` + `geo.ok` + `barri.ok` + `asking known + builtM2 known` | `asking-known` |
| `cat.ok` + `geo.ok` + `barri.ok` + asking OR builtM2 missing | `asking-unknown` |
| `cat.ok` + `geo.ok` + barri lookup misses | `barri-unavailable` |
| `cat.ok` + `geo` fails | `barri-unavailable` |
| `cat` fails | (no Section 03 payload — the report itself is in trouble) |

State 03 always tries to pass the IPV result as a footnote — that's the only place IPV currently surfaces.

## What gets written to `report.price` per state

Both seeders set the legacy text fields **and** the structured `pricing` payload:

| Field | State 01 | State 02 | State 03 |
|---|---|---|---|
| `lede` | verdict sentence (asking vs barri) | "barri €/m²…" sentence | (untouched — defaults from `emptyReport`) |
| `panels` | 1 panel: "Where the €X/m² figure comes from" | same | (none) |
| `range` | `{lo, hi}` rounded to €1,000 | same | (none) |
| `fairValue` | range-with-framing prose | same | (none) |
| `liveSearches` | 3 portals | same | (none) |
| `pricing` | full payload, `state="asking-known"` | full payload, `state="asking-unknown"` | full payload, `state="barri-unavailable"` |
| `hero.meta.vsMarket` pill | pushed | not pushed | not pushed |

The legacy text fields are kept because `pipeline/narrate.ts` and the PDF generator read them as prose. The new component reads `pricing` exclusively.

## Renderer fallback

`components/report/ReportView.tsx` checks `report.price.pricing`:

- If set: render the new `<PriceSection>`.
- If not set: render the legacy lede-only fallback. **The static fixture `data/sample-sors35.ts` does not have `pricing` set**, so the sample report URL still uses the legacy render. Keep this in mind when modifying the component.

## Caching

Only Catastro is cached (`source_cache` row, 30 days). Everything else is fetched fresh per request — they're either fast or have their own free-tier limits.

To invalidate after a parser change:

```ts
// pipeline/generate.ts
const CATASTRO_CACHE_VERSION = "v3";  // was "v2" — bumping invalidates all rows
```

## Serverless time budget (don't let it write an empty report)

`generateReport` inserts the row with `data: {}` and only writes the real report
via the final `UPDATE` (step 10). It runs as a **Server Action**, so its timeout
is governed by the **page's** `maxDuration` — set to `60` on
`app/[locale]/start/page.tsx` (buyer) and `app/admin/new/page.tsx` (admin).
Without it, Vercel's ~10s default kills the action mid-pipeline and the row stays
`data: {}` ("almost no data"). Keep slow sources bounded (e.g. the Overpass race
in `adapters/amenities.ts`) so the fan-out never approaches the budget.

## Provenance

After all seeders run, `report_sources` is upserted with one row per attempted source. The upsert uses `onConflict: "report_id,source"` so re-running on the same report replaces rows rather than duplicating them.

`source` strings used today (must match `SourceKey`): `catastro`, `amenities`, `urbanism`, `affectation`, `heritage`, `energy`, `ipv`, `market` (idealista), `flood`, `seismic`, `radon`, `crime`, `gencat-barri`.

## Failure modes

- **Catastro fails** → `throw new Error("Could not create report: …")`. The buyer sees the generic error banner. This is the only adapter whose failure bubbles up.
- **Geo fails** → retried once (`geocodeWithRetry`); if still failing: no amenities, urbanism, comps, flood, heritage, barri pricing. Section 03 renders State 03. Affectation can still fire (uses parcel ref only) and the urbanism section degrades to "affectation alert only".
- **Affectation unavailable** → no score cap (may read too high), but the buyer is told: `seedUrbanism` flags it "unverified" (check-tone row + top alert). See [SCORING.md](./SCORING.md).
- **Any other adapter fails** → its section degrades to `unavailable` (toVerify=true on the row). The buyer sees a placeholder; the operator dashboard surfaces the issue.

This is why adapters never throw — every `try/catch` in an adapter ultimately calls `failed(source, message)`.
