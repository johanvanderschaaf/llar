# External integrations

Operational details that don't fit in the README's source table — endpoint patterns, auth, file formats, refresh quirks.

## Catastro — building / unit / search

| Endpoint family | Adapter | Notes |
|---|---|---|
| OVC `Consulta_DNPRC` (cadastral ref → unit detail) | `adapters/catastro.ts` | Public, no key. **Cached 30 days** via `source_cache` keyed by `"<ref>#v2"`. Bump `CATASTRO_CACHE_VERSION` in `pipeline/generate.ts` when the parsed shape changes. |
| OVC `ConsultaVia` / `Consulta_DNPLOC` (street search → ref) | `adapters/catastro-search.ts` | Backs `/api/catastro/streets` and `/api/catastro/units`. |
| `Consulta_CPMRC` + INSPIRE WFS (parcel coords + polygon) | `adapters/geo.ts` | Coordinates are WGS84 (lat/lon). Needed by every geo-dependent adapter downstream. |

Catastro returns SOAP/XML — adapters parse it with a tiny regex helper, no SOAP library.

## INE — IPV (Índice de Precios de Vivienda)

- **Adapter:** `adapters/ine-ipv.ts`
- **Endpoint:** `https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/25171?nult=1`
- **No key**, no rate limit issues at our volume.
- Filters by `Nombre` matching `/^Cataluña\.\s*Vivienda segunda mano\.\s*Variación anual/` with `Cataluña. General. Variación anual` as fallback.
- Currently used **only** for state-03 footnote in Section 03 (when barri unavailable). The IPV panel was removed from the headline state — IPV-at-CCAA is too coarse to drive a Barcelona offer.

## Generalitat de Catalunya — Habitatge (barri-level closing prices)

- **Adapter:** `adapters/gencat-barri.ts` (synchronous lookup against committed JSON)
- **Source XLSX:** `BCN_usat_acum1any_<YEAR>.xlsx` published quarterly on `habitatge.gencat.cat`. URL pattern:
  ```
  https://habitatge.gencat.cat/web/.content/home/dades/estadistiques/
    01_Estadistiques_de_construccio_i_mercat_immobiliari/
    02_Compravenda_i_preu_de_venda/
    02_Compravendes_d_habitatges_registrades_i_el_preu_de_venda/
    <YEAR>/BCN_usat_acum1any_<YEAR>.xlsx
  ```
- File contains 4 sheets (one per quarter, each a rolling 12-month window). The refresh script picks the latest by name (`4t<YY>acum_1any` > `3t<YY>…` > `2t…` > `1t…`).
- Source: registered notarial deeds (Notariado-Registradores), **second-hand homes only** (`usat`).
- Refresh by running `scripts/refresh-bcn-pricing.py` — see [REFRESH_SCRIPTS.md](./REFRESH_SCRIPTS.md).

## ICAEN — Energy certificate

- **Adapter:** `adapters/energy.ts`
- Keyed by **cadastral reference**, not coordinates.
- Returns class A–G + consumption + emissions when registered.

## Ajuntament Barcelona — planning + heritage

| Source | Adapter | Endpoint |
|---|---|---|
| Whole-parcel qualification map | `adapters/urbanism.ts` | BCN `WMSURBANISME` — point-samples a parcel polygon and classifies via the `DESTI` attribute. |
| Architectural heritage catalogue | `adapters/heritage.ts` | BCN `Catàleg_de_patrimoni` WMS. Surfaces BCIN/BCIL as top-level alerts. |
| Official affectation verdict (A/B/C/D) | `adapters/affectation.ts` | PIU AFH service `AfectacionsHabitatge`. **Keyed by parcel ref, not coordinates** — runs in parallel with the geo step. |
| BCN barri polygons | (built-time, in `scripts/refresh-bcn-pricing.py`) | Open Data BCN resource `cd800462-…`. ZIP containing `POLIGONS.json`; reprojected EPSG:25831 → 4326. |

**Heritage catalogue traps (all three once gave buyers false "national monument" alerts):**
- The level is the feature's `NIVELL` attribute. The sublayer names (`…__A_`, `…__B_`, `…__C_`) are not the level: the service returns every listed building on all three.
- `Fitxa 0 de <district>` is a district-wide sheet (Ciutat Vella), not a building listing. It is read as area context ("in a protected area").
- Probe points must stay inside the flat's own parcel (the outline from `fetchParcelPolygon`); a fixed ring around the centre picked up the listed building next door.

**Catastro's year is "built or last fully renovated"** (the `ant` field): Casa Calvet (1898–1900) reads 2017. `lib/building-years.ts` uses the heritage catalogue's epoch, when clearly older, as the build date: age checks (ITE, asbestos, structure era) use the original date, and the building score uses Catastro's year. Report text never says "completed in" Catastro's year.

**Catastro parcel listing:** the second Catastro query lists every unit in the parcel just to count them, and is slow for big blocks (517 units: 23 s). It has its own 6 s timeout in `adapters/catastro.ts`; when it runs out the report goes ahead without the count instead of failing as "Catastro down".

## ACA — Flood

- **Adapter:** `adapters/flood.ts`
- Endpoint: SNCZI / IDEE INSPIRE WMS at `servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones`.
- Point-queries fluvial flood-zone rasters T10 / T100 / T500. `GRAY_INDEX = 999` means outside the zone; any other value means in.

## Amenities & transport — local Ajuntament open data

- **Adapter:** `adapters/amenities.ts`, a synchronous lookup in `data/bcn-amenities.json` (built by `scripts/refresh-bcn-amenities.py`, see [REFRESH_SCRIPTS.md](./REFRESH_SCRIPTS.md)). No network at report time, so it can't fail or slow a report.
- Until Nov 2026 this queried OpenStreetMap's Overpass API live. That failed in ~1 in 5 reports, then in every one (main instance HTTP 406, mirrors timing out), which dropped the location and transport scores. Don't go back to a live call without a fallback.
- Barcelona only: outside the city's bounding box it returns `unavailable`.

## Idealista — Comparable listings

- **Adapter:** `adapters/idealista.ts`
- Requires `IDEALISTA_API_KEY` + `IDEALISTA_API_SECRET`. **Not currently provisioned** — the adapter degrades to `unavailable`. The official API contract is being pursued separately.
- For now, similar-listings UX is fulfilled by `adapters/live-listings.ts` — pure URL builder, no API.

## Idealista / Fotocasa / Habitaclia — Live deep links (no fetch)

- **Adapter:** `adapters/live-listings.ts` — pure function, builds three URLs (Idealista / Fotocasa / Habitaclia) pre-filtered to:
  - district slug (from `gencat-barri.districtCode`, stable per portal)
  - size band ±20% of subject built area
  - price ceiling: asking +25%
- URLs are NOT validated at build time. If a portal changes its URL scheme the link fails open into the portal's home page.
- Currently produced but **not rendered** in Section 03 per the design hand-off. The data is preserved on `report.price.liveSearches`.

## Supabase

Three clients in `lib/supabase/`, **not interchangeable**:

| Client | Key | Use from |
|---|---|---|
| `admin.ts` | service role | server only; **bypasses RLS**. The pipeline and operator-only server actions. |
| `server.ts` | anon + session cookies | Server Components / Route Handlers acting as the signed-in operator. |
| `client.ts` | anon | the browser. |

`SUPABASE_SERVICE_ROLE` is read at request time (`process.env`) — not module-level — so missing-env errors surface at the boundary, not at startup.

## Anthropic — AI narrative

- Read at request time via `hasAnthropicKey()` in `lib/`; the whole `pipeline/narrate.ts` step is feature-flagged off if the key is missing.
- Narrative is opt-in per report (operator triggers in the dashboard once the report is `in_review`).
- Stored per-language on `report.data.narrative` (CA/ES/EN).
- **Grounding (don't let it contradict the deterministic sections):** `buildFacts` passes the authoritative location (the `snapshot.neighbourhood` fact = barri · district) and the `barriClosing` benchmark (Gencat closing €/m²). The prompt forbids inferring a neighbourhood from the street address and uses `barriClosing` as the price anchor — so the narrative can't say "Eixample" for a Gràcia flat or "no comparable data" when a barri closing benchmark exists. `comps` (idealista ASKING) is secondary and usually empty. If you add a price/location source, feed it here too.

## Stripe — Phase 4 paywall

- Requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`. **Not configured in dev** by default.
- Checkout entry point: server action in `app/[locale]/actions.ts`. Webhook: `app/api/stripe/webhook/route.ts`.
- Without keys, the `Unlock for €14.90` button surfaces an "unconfigured" notice via `?checkout=unconfigured` redirect.

## Env vars summary

| Var | Required for | Behaviour if missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anything reading/writing the DB | Whole site errors at boundary. |
| `SUPABASE_SERVICE_ROLE` | Pipeline + operator dashboard | Pipeline can't write reports. |
| `NEXT_PUBLIC_BASE_URL` | Stripe checkout `success_url`, magic-link callback | Inputs default to relative paths; magic-link auth breaks. |
| `ANTHROPIC_API_KEY` | AI narrative | Narrative step skipped silently. |
| `STRIPE_*` | Paywall | Unlock CTA goes to `?checkout=unconfigured`. |
| `IDEALISTA_API_KEY`/`_SECRET` | `adapters/idealista.ts` | Adapter returns `unavailable`; live-listings deep links still work. |

Per AGENTS.md: **never add silent fallbacks for missing env vars** — fail loudly at boundary or feature-flag the whole adapter.
