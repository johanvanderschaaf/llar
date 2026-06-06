# Notariado postcode dataset

`notariado-cp-bcn.json` holds postcode-level price statistics from the official
[Portal Estadístico del Notariado](https://penotariado.com/inmobiliario/buscador-precio-vivienda).
The adapter (`adapters/notariado.ts`) reads it synchronously at request time;
when a buyer's postcode isn't in the file the adapter degrades to `unavailable`
and the rest of the pipeline keeps working.

We commit a static file rather than calling the portal at runtime because:

- The portal has no public API.
- Notarial figures are monthly at best — there is nothing to gain from a
  per-request fetch.
- Committing the file makes the provenance explicit and auditable.

## Schema

```jsonc
{
  "asOf": "2026-Q1",                       // period the figures cover
  "source": "Portal Estadístico del Notariado",
  "sourceUrl": "https://penotariado.com/...",
  "byCp": {
    "08012": {
      "pricePerM2": 4320,                  // €/m², "vivienda" average
      "transactions": 87,                  // count in period
      "avgSurfaceM2": 78                   // average flat size
    }
  }
}
```

Only `pricePerM2` is required per row. `transactions` and `avgSurfaceM2` are
optional but the seeder uses them for confidence-and-volume framing when
present, so include them when the portal exposes them.

## How to refresh from a Notariado export

1. Sign in at <https://penotariado.com/>.
2. Filter by **Provincia: Barcelona** and the latest period available
   (the portal updates monthly).
3. Export the by-postcode table (CSV or XLSX).
4. Convert to the schema above. Keep only the Barcelona-city postcodes
   (`080xx`). Drop rows where the portal blanks values for low transaction
   counts — `unavailable` is better than misleading.
5. Update `asOf` (e.g. `"2026-Q1"`) and commit.

If you'd rather paste the raw export and let the adapter handle the mapping,
open an issue and we'll add a small converter script — not built yet because
the portal's export shape isn't documented publicly.
