# Pipeline flow

`pipeline/generate.ts:generateReport()` is the spine. This page documents the call order, dependencies, and what triggers Section 03 to render in each of its three states.

## Sequence

```
1. cachedCatastro(ref, budget)                 ← only blocking call; up to 3 attempts by 24s;
                                                  throws if not ok (nothing is saved)
2. id = crypto.randomUUID()                     ← no DB row yet
3. seedFromCatastro / seedPriceRefs / seedCostsTaxes / seedBuilding / seedLegal
4. start fetchEnergy, fetchIpv, fetchAffectation, geocodeWithRetry together
5. seedEnergy if energy.ok, else seedEnergyMissing ("Not certified")
6. (Catastro is always ok here)
     await [ geocodeWithRetry (2 attempts, by 34s), fetchAffectation ]
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
10. INSERT into reports (status='in_review', full data)   ← the only write; throws on error
11. UPSERT into report_sources (one row per attempted source; failure is logged, not thrown)
```

Steps 4 and 6 run their adapters concurrently — they share no inputs. Every
source after Catastro is wrapped in `withDeadline` (`pipeline/budget.ts`): if it
hasn't answered by 45s it is recorded as an `error` ("Timed out … (report time
budget)") and the report treats it as unavailable. Each source's duration is
appended to its `note` in `report_sources`, e.g. `[3.2s]`.

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

Catastro data is cached in `source_cache` for **1 year**, under three sources:
`catastro` (the flat's facts, keyed by full ref), `geocode` (coordinates, keyed
by the 14-char parcel ref) and `parcel-polygon` (the parcel outline used by the
whole-parcel planning check). Cadastral data almost never changes.

**Outage fallback.** When the live lookup fails with status `error` (network
failure, HTTP error, or Catastro's maintenance answer — see
`adapters/catastro-outage.ts`), a cached copy of **any age** is used instead,
with a "from cache saved YYYY-MM-DD; live lookup failed" note (and
`toVerify: true` once it is past the TTL). This only covers flats looked up
before. With nothing cached, `generateReport` throws `CatastroDownError` and
the buyer flow shows the "registry temporarily down — email me my report"
notice (`components/RegistryDownNotice.tsx`), stored in `waitlist` with
`reason = 'registry_down'` (migration 0003). `scripts/process-pending.mts`
generates those reports once Catastro is back.

A Catastro answer of "no such record" is `unavailable`, not `error`: it is not
retried, never falls back to the cache, and throws a plain `Error`.

Everything else is fetched fresh per request — they're either fast or have their own free-tier limits.

To invalidate after a parser change:

```ts
// pipeline/generate.ts
const CATASTRO_CACHE_VERSION = "v3";  // was "v2" — bumping invalidates all rows
```

## Serverless time budget

`generateReport` runs as a **Server Action**, so its timeout is governed by the
**page's** `maxDuration` — set to `60` on `app/[locale]/start/page.tsx` (buyer)
and `app/admin/new/page.tsx` (admin). The pipeline keeps itself inside that with
fixed deadlines measured from the start of the run (constants at the top of
`pipeline/generate.ts`): Catastro by 24s, geocoding by 34s, every other source
by 45s, leaving ~15s for cold start, the database writes and the redirect. If
you raise `maxDuration`, you can raise these too.

The report row is written **once, at the end, with its full data**. If Vercel
kills the run anyway, nothing is saved — an empty `data: {}` report can no
longer exist. Covered by `pipeline/generate.test.ts`.

## Provenance

After all seeders run, `report_sources` is upserted with one row per attempted source. The upsert uses `onConflict: "report_id,source"` so re-running on the same report replaces rows rather than duplicating them.

`source` strings used today (must match `SourceKey`): `catastro`, `amenities`, `urbanism`, `affectation`, `heritage`, `energy`, `ipv`, `market` (idealista), `flood`, `seismic`, `radon`, `crime`, `gencat-barri`.

## Failure modes

- **Catastro fails** → `throw new Error("Could not create report: …")`. The buyer sees the generic error banner. This is the only adapter whose failure bubbles up.
- **Geo fails** → retried once (`geocodeWithRetry`); if still failing: no amenities, urbanism, comps, flood, heritage, barri pricing. Section 03 renders State 03. Affectation can still fire (uses parcel ref only) and the urbanism section degrades to "affectation alert only".
- **Affectation unavailable** → no score cap (may read too high), but the buyer is told: `seedUrbanism` flags it "unverified" (check-tone row + top alert). See [SCORING.md](./SCORING.md).
- **Any other adapter fails** → its section degrades to `unavailable` (toVerify=true on the row). The buyer sees a placeholder; the operator dashboard surfaces the issue.

This is why adapters never throw — every `try/catch` in an adapter ultimately calls `failed(source, message)`.
