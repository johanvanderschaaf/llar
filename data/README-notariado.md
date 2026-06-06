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

The portal exports one PDF per postcode (no bulk CSV at the CP level — that's
why this dataset is curated by hand). For each Barcelona-city postcode you
care about:

1. Sign in at <https://penotariado.com/> and open *Estadísticas → Mapa*.
2. Filter **Provincia: Barcelona → Municipio: Barcelona → Código Postal: 080xx**.
3. Leave **Property type** and **Construction type** as *All*. The Barcelona-
   city CPs are >99% apartments and >90% second-hand, so the "All" mix is
   effectively what a buyer is looking at; restricting further produces
   identical numbers for most CPs and missing data for the rest.
4. Use the "Share / PDF" button to export the report.
5. Paste the four numbers into `byCp`:
   - `pricePerM2` ← *Average price m²* (drop the dot — `6.620 €/m²` → `6620`)
   - `transactions` ← *Sales*
   - `avgSurfaceM2` ← *Average surface area*
6. Update the file-level `asOf` to the *Values from … to …* line on the PDF
   (rolling 12-month window) and commit.

Drop rows where the portal blanks values for low transaction counts —
`unavailable` is better than misleading.
