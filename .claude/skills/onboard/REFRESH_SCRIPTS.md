# Static-dataset refresh scripts

Static data files live in `data/`. They're committed so the runtime adapter is a zero-dep synchronous lookup. Refresh on a schedule per dataset.

## `scripts/refresh-bcn-pricing.py`

Refreshes the two files behind `adapters/gencat-barri.ts`:

| Output | What | Refresh cadence |
|---|---|---|
| `data/bcn-barri-prices.json` | Per-barri closing €/m² (Generalitat Habitatge) | **Quarterly** — Gencat publishes a fresh XLSX after each calendar quarter, usually with a 4–6 week lag. Q1 lands in early May, Q4 in mid-Feb the next year. |
| `data/bcn-barris.json` | Official BCN barri polygons (Ajuntament Open Data, reprojected to WGS84) | **Annual at most.** Polygons rarely change. |

### Requirements

```bash
pip install pandas openpyxl pyproj
```

Reasonably likely to be already-installed if you've touched any xlsx work.

### Run

```bash
cd llar
python3 scripts/refresh-bcn-pricing.py
```

Output:
```
[gencat] https://habitatge.gencat.cat/.../2025/BCN_usat_acum1any_2025.xlsx
[gencat] latest sheet: 4t25acum_1any
[gencat] parsed 73 barris
[bcn] https://opendata-ajuntament.barcelona.cat/data/dataset/…/download
[bcn] 73 barri polygons reprojected to WGS84
Wrote:
  data/bcn-barri-prices.json
  data/bcn-barris.json
```

### Things that can go wrong

| Symptom | Why | Fix |
|---|---|---|
| `Could not find a Gencat usat_acum1any file for recent years.` | Gencat reorganised their `.content/` paths. | Open `habitatge.gencat.cat/.../compravendes-habitatges-Barcelona/` in a browser, grab the new URL pattern, update `GENCAT_BASE` in the script. |
| `Could not locate 'Barris de Barcelona' row in the sheet` | Gencat changed the sheet structure. | Add a print to the start of `fetch_gencat_prices()` to dump `df.head(40)` and find the new marker. |
| `ValueError: could not convert string to float: 'n.d.'` | Already handled — `n.d.` (no disponible) cells map to `null`. If you see this error a NEW null sentinel string has appeared; add it to the `{"n.d.", "n.d", "-"}` set in `num()`. |
| Polygon download stream-decoded as UTF-8 (ZIP corruption) | You're using `r.text()` instead of `r.arrayBuffer()` somewhere. The current script reads with `urllib.request.urlopen().read()` which is bytes. |

### Re-projection

Polygons are published in EPSG:25831 (UTM 31N, Spain). The script reprojects to EPSG:4326 (WGS84) with pyproj so the runtime adapter can do a plain lat/lon point-in-polygon. Don't change this — `adapters/geo.ts` returns WGS84 too.

### Safety check

Before writing, `check()` refuses data that looks broken (not 73 barris, fewer
than 50 priced, implausible €/m², or 10+ fewer priced barris than the current
file) and exits 1.

## `scripts/refresh-bcn-amenities.py`

Builds `data/bcn-amenities.json`, the local dataset behind `adapters/amenities.ts`
(it replaced the live OpenStreetMap/Overpass lookup in Nov 2026, which failed on
every request by then). Standard library only. Sources, all Ajuntament de
Barcelona Open Data (CC BY 4.0), resolved through the CKAN API by dataset id:

| Category | Dataset | Notes |
|---|---|---|
| metro | `transports` | Metro + urban FGC **entrances**; the adapter takes each station's nearest entrance |
| health | `equipament-sanitat` | Hospitals/clinics, CAPs, CUAPs (pharmacies excluded) |
| schools | `equipament-educacio` | Infant 3–6, primary, secondary |
| market | `equipament-mercats-i-centres-comercials` | Municipal markets only |
| supermarket | `cens-locals-planta-baixa-act-economica` | Newest yearly shop census; **chains only** (`CHAINS` list), since the census files corner shops as supermarkets too |
| green | `espais-verds-publics` | Public parks > 0.5 ha, as outlines (distance to the edge) |

Refresh: quarterly is plenty (the shop census is yearly; the rest rarely change).
The script refuses to write if a category falls below its floor or shrinks by
more than 25% versus the current file. `adapters/amenities.test.ts` checks real
landmarks (Catalunya station at Plaça de Catalunya, Ciutadella park), so a
broken refresh fails the tests.

## Monthly automation: `.github/workflows/refresh-data.yml`

On the 1st of every month (or by hand: Actions → Refresh data → Run workflow)
GitHub runs both scripts, runs the test suite on the new data, and — if any
`data/` file changed — opens or updates one pull request (branch
`data/monthly-refresh`) whose description is `scripts/data-summary.py`'s
before/after summary. **Nothing deploys until someone merges it.** The job fails
(and GitHub emails the owner) when a script refuses, the tests fail, or the
barri prices cover a period that ended more than 7 months ago — the last one
catches Gencat renaming or moving its file, which the price script can't detect
on its own.

Requires the repo setting *Settings → Actions → General → Allow GitHub Actions
to create and approve pull requests*.

## Adding a new refresh script

Conventions, so a future agent can find them:

1. Land it at `scripts/refresh-<dataset>.py` (or `.ts` if you stay in Node land).
2. Write the output to `data/<dataset>.json`.
3. Make the runtime adapter a pure synchronous lookup that imports the JSON via `@/data/...`.
4. Document the cadence + source URLs in this file.
5. Add the source to `SourceKey` (`adapters/types.ts`) **only** if the pipeline records a `report_sources` row for it. Static datasets don't always need one — `gencat-barri` does (the adapter logs its lookup result); a hypothetical `bcn-postcodes.json` wouldn't.

## Why not fetch at request time?

For these specific sources:

- Gencat XLSX is 60 KB. Fetching, parsing with `xlsx`/`exceljs`, and reprojecting 600 KB of polygons per buyer-facing request would be wasteful.
- Gencat updates quarterly. There's nothing to gain from a per-request fetch.
- Committing the JSON makes the provenance explicit and auditable in git history.

If you need request-time data from a source like this, add it to `source_cache` instead — that's what Catastro does.
