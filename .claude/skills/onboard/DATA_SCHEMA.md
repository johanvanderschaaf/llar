# Data schemas

All shapes are defined in [`types/`](../../../types) — this page captures the non-obvious bits.

## Report — the single render-ready blob

Stored in `reports.data` (jsonb). Consumed by `components/report/ReportView.tsx` and `pipeline/narrate.ts`.

```
Report
├── id, generatedAt, cadastralRef
├── hero      { title, floorLabel, sub, meta: Fact[] }
├── verdict   { headline, body, overall, tag }
├── alerts?   ReportAlert[]            ← top-of-report banner, visible in free preview
├── scores    Score[5]                 ← location, transport, building, price, energy
├── snapshot  { facts, note }
├── price     { …see below… }
├── building  { panels, keyline }
├── risks     RiskRow[]
├── legal     { intro, items }
├── neighbourhood { lede, facts, note }
├── urbanism  { items: UrbanismItem[] } ← plain-language status rows, not alerts
├── costs     { intro, facts, footnote }
├── subsidies { panels }
├── negotiation { intro, items, tactic }
├── checklist Localized[]
└── footer    { sources, disclaimer }
```

### `Report.price` (the gnarly one)

Two parallel shapes coexist by design:

| Field | Purpose |
|---|---|
| `pricing?: Pricing` | **Drives the rendered Section 03 (new design).** State-discriminated payload. |
| `lede`, `panels`, `fairValue`, `range`, `liveSearches?` | Legacy text fields, still populated for the AI narrative path + the static sample fixture in `data/sample-sors35.ts`. |
| `comps: CompRow[]` | Optional benchmark listings table. Currently always empty unless the Idealista adapter is wired with keys. |
| `ladder: OfferRung[]` | Carried in the type for the AI narrative but no longer rendered. |
| `references?: PriceRef[]` | Carried in the type but no longer rendered. |

### `Pricing` — the structured Section 03 payload

```ts
type PricingState = "asking-known" | "asking-unknown" | "barri-unavailable";

interface Pricing {
  state:    PricingState;
  builtM2?: number;
  asking?:  { price: number; pricePerM2: number };   // ← absent in state 02
  chip:     { tone: "clear" | "neutral" | "check"; text: Localized };
  verdict:  Localized;                                // may contain <span class="num"> / <strong class="pct">
  barri?:   { name, pricePerM2, avgSurfaceM2?, transactions?, asOf, impliedValue };
  range?:   { lo: number; hi: number };               // rounded to nearest €1,000
  deltaPct?:  number;     // asking €/m² vs barri €/m². State 01 only.
  markerPct?: number;     // [0..1] — where the marker sits on the number line
  marker?:    { kind: "asking" | "barri-avg"; value: number };
  ipvFootnote?: Localized; // State 03 only — explicitly-coarse Catalonia INE YoY
}
```

State decision: built in `pipeline/template.ts:buildPricingPayload()` and `seedPricingUnavailable()`. Renderer in `components/report/PriceSection.tsx` switches on `state`.

The verdict line is HTML-bearing — fed through `dangerouslySetInnerHTML`. Safe because we generate the string in the seeder from typed values.

### `Pricing.chip.tone` mapping

Defined in `chipForDelta()`. **Threshold is ±15%**, matching the fair range:

| Δ asking/barri | Chip tone | Label |
|---|---|---|
| < -15% | clear | Below market |
| -15% to +15% | clear | Fairly priced |
| > +15% | check | Above market |

## Committed datasets in `data/`

| File | What | Schema | Refresh cadence |
|---|---|---|---|
| `bcn-barri-prices.json` | Per-barri closing €/m² | `{asOf, source, sourceUrl, byBarri: { "01": { name, pricePerM2\|null, transactions\|null, avgSurfaceM2\|null } } }` | Quarterly |
| `bcn-barris.json` | Official BCN barri polygons (WGS84) | GeoJSON `FeatureCollection`, 73 features, `properties: { code, name, districtCode }`, geometry already reprojected from EPSG:25831 | Annual at most |
| `sample-sors35.ts` | Static UI fixture (Carrer de Sors 35) | `Report` shape — used by `/en/sample` to demo without the pipeline | Manual |

**Barri codes:** 2-digit string `"01"`–`"73"` (zero-padded). Match Generalitat XLSX codes 1:1.

**District codes:** 2-digit string `"01"`–`"10"`. Used by `adapters/live-listings.ts` to slug portal URLs.

The barri-price file is small (~10 KB) so it's checked into git rather than fetched at request time. Polygons (~600 KB) are JSON, not GeoJSON, for `resolveJsonModule` compatibility with TypeScript.

### `bcn-barri-prices.json` — currently shipped figures

- **Period:** rolling 12 months ending the latest published quarter (right now `gener 2025 - desembre 2025`).
- **Coverage:** 70 of 73 barris have a `pricePerM2`. Three are blanked by Gencat for low volume: la Clota (38), Can Peguera (39), Baró de Viver (60).
- **Total sales in window:** 14,405. Median sales/barri: 191. Min with data: 10 (Vallbona).

## Database — `reports`, `report_sources`, `source_cache`, `orders`

Schema in `supabase/migrations/0001_init.sql`. Conventions:

| Table | Purpose | Non-obvious |
|---|---|---|
| `reports` | The render-ready Report blob (`data` jsonb) + the operator/buyer input (`input` jsonb). Status: `draft` \| `in_review` \| `published`. | The pipeline writes status `in_review` on create. |
| `report_sources` | One row per (report, source) fetch attempt. **One source per report only** — unique constraint. | Used by `app/admin/reports/[id]/page.tsx` to show provenance. `source` matches `SourceKey` in `adapters/types.ts`. |
| `source_cache` | Per-source TTL cache keyed by cadastral ref. | Currently only Catastro uses it (30-day TTL, version bump via `CATASTRO_CACHE_VERSION` invalidates old rows). |
| `orders` | Phase 4 Stripe flow. Status: `created` \| `checkout` \| `paid` \| `refunded`. | Webhook handler at `app/api/stripe/webhook/route.ts`. |

**RLS:** all four tables are locked down. `authenticated` users (operators) get a global `for all` policy. The pipeline uses `lib/supabase/admin.ts` (service role) and bypasses RLS.

## `SourceKey` enum

Defined in `adapters/types.ts`. Add a new key here when adding an adapter; the value also goes into `report_sources.source`. Current values:

```
catastro · flood · seismic · radon · energy · crime · amenities
urbanism · affectation · heritage · zbe · tax · market · ipv
gencat-barri
```

Note `tax` and `zbe` exist for historical reasons but aren't currently wired in the pipeline — don't reuse them for unrelated sources.

## `AdapterResult<T>` (re-cap of the contract)

```ts
{ source: SourceKey; status: "ok"|"unavailable"|"error"; data?: T; toVerify: boolean; fetchedAt: ISO; note?: string }
```

Helpers in `adapters/types.ts`:

| Helper | Use when |
|---|---|
| `ok(source, data, { toVerify?, note? })` | Confident success. `toVerify` defaults to `false`. |
| `unavailable(source, note)` | The source legitimately has no data for this input. `toVerify: true`. |
| `failed(source, note)` | The source threw / timed out / returned malformed data. `toVerify: true`. |

The `fetchWithTimeout(url, ms)` helper enforces a hard timeout so a slow source can't stall the parallel `Promise.all` in `pipeline/generate.ts`.
