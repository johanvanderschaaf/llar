import type { LiveSearch } from "@/types/report";

/**
 * Build pre-filtered deep links to Spanish property portals for *live*
 * comparable listings — we never ingest, scrape, or cache portal data;
 * the buyer clicks out to the portal's own live view.
 *
 * District is the granularity we deep-link at: Idealista, Fotocasa and
 * Habitaclia all use stable URL slugs for the 10 Barcelona districts.
 * Barri-level slugs vary per portal and break silently when they change,
 * so we keep the URL at district level and surface the barri name in the
 * label text so the buyer knows what to look for once on the portal.
 *
 * Inputs that can be missing degrade individually:
 * - no district  → nothing returned (we'd be linking to all of Spain).
 * - no size m²   → search is unconstrained by size.
 * - no asking €  → search is unconstrained by price.
 */
export interface BuildLiveSearchesInput {
  /** Barcelona district code, "01"–"10" (from gencat-barri). */
  districtCode?: string;
  /** Display name of the barri for the label text. */
  barriName?: string;
  /** Built m² of the subject flat (Catastro / operator input). */
  builtM2?: number;
  /** Asking price in € (operator input). */
  askingPriceEur?: number;
}

/** BCN district code → Idealista / Fotocasa / Habitaclia slug. */
const IDEALISTA_SLUG: Record<string, string> = {
  "01": "ciutat-vella",
  "02": "eixample",
  "03": "sants-montjuic",
  "04": "les-corts",
  "05": "sarria-sant-gervasi",
  "06": "gracia",
  "07": "horta-guinardo",
  "08": "nou-barris",
  "09": "sant-andreu",
  "10": "sant-marti",
};

/**
 * Fotocasa uses district names with a `-barcelona-capital` suffix in their
 * URL but the canonical form is the simple slug. We mirror Idealista here.
 */
const FOTOCASA_SLUG: Record<string, string> = {
  "01": "ciutat-vella",
  "02": "eixample",
  "03": "sants-montjuic",
  "04": "les-corts",
  "05": "sarria-sant-gervasi",
  "06": "gracia",
  "07": "horta-guinardo",
  "08": "nou-barris",
  "09": "sant-andreu",
  "10": "sant-marti",
};

/**
 * Habitaclia routes through district names with the `_barcelona` suffix.
 * Habitaclia's URL is the least-stable of the three so we point at the
 * municipality if a district doesn't resolve and let the user filter.
 */
const HABITACLIA_SLUG: Record<string, string> = {
  "01": "ciutat_vella_barcelona",
  "02": "eixample_barcelona",
  "03": "sants_montjuic_barcelona",
  "04": "les_corts_barcelona",
  "05": "sarria_sant_gervasi_barcelona",
  "06": "gracia_barcelona",
  "07": "horta_guinardo_barcelona",
  "08": "nou_barris_barcelona",
  "09": "sant_andreu_barcelona",
  "10": "sant_marti_barcelona",
};

/** Idealista path segment for size + price filters, e.g.
 *  `con-metros-cuadrados-mas-de_70,metros-cuadrados-menos-de_110,precio-hasta_550000`.
 *  Returns an empty string when neither filter applies. */
function idealistaFilterPath(opts: { minM2?: number; maxM2?: number; maxPrice?: number }): string {
  const parts: string[] = [];
  if (opts.minM2 != null) parts.push(`metros-cuadrados-mas-de_${opts.minM2}`);
  if (opts.maxM2 != null) parts.push(`metros-cuadrados-menos-de_${opts.maxM2}`);
  if (opts.maxPrice != null) parts.push(`precio-hasta_${opts.maxPrice}`);
  return parts.length ? `con-${parts.join(",")}/` : "";
}

/** Fotocasa search params: ?precio-max=…&metros-min=…&metros-max=…. */
function fotocasaQuery(opts: { minM2?: number; maxM2?: number; maxPrice?: number }): string {
  const params = new URLSearchParams();
  if (opts.maxPrice != null) params.set("precio-max", String(opts.maxPrice));
  if (opts.minM2 != null) params.set("metros-min", String(opts.minM2));
  if (opts.maxM2 != null) params.set("metros-max", String(opts.maxM2));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function buildLiveSearches({
  districtCode,
  barriName,
  builtM2,
  askingPriceEur,
}: BuildLiveSearchesInput): LiveSearch[] {
  if (!districtCode) return [];
  const ideSlug = IDEALISTA_SLUG[districtCode];
  const fotoSlug = FOTOCASA_SLUG[districtCode];
  const habSlug = HABITACLIA_SLUG[districtCode];

  // Size band: ±20% of subject built area, rounded to whole m².
  const minM2 = builtM2 ? Math.round(builtM2 * 0.8) : undefined;
  const maxM2 = builtM2 ? Math.round(builtM2 * 1.2) : undefined;
  // Price ceiling: subject asking +25% (gives the buyer a meaningful upper bound
  // when the asking is low, without cutting reformed comps out of the picture).
  const maxPrice = askingPriceEur ? Math.round(askingPriceEur * 1.25) : undefined;

  const filterLabel = (en: string, es: string, ca: string) => ({
    en: barriName ? `${en} — refine to ${barriName} on the portal` : en,
    es: barriName ? `${es} — afina a ${barriName} en el portal` : es,
    ca: barriName ? `${ca} — afina a ${barriName} al portal` : ca,
  });

  const out: LiveSearch[] = [];

  if (ideSlug) {
    out.push({
      portal: "Idealista",
      url: `https://www.idealista.com/venta-viviendas/barcelona/${ideSlug}/${idealistaFilterPath({ minM2, maxM2, maxPrice })}?ordenado-por=precios-asc`,
      label: filterLabel(
        `Listings in the district at this size${maxPrice ? ` and price band` : ""}, sorted by price`,
        `Pisos en el distrito de este tamaño${maxPrice ? ` y rango de precio` : ""}, ordenados por precio`,
        `Pisos al districte d'aquesta mida${maxPrice ? ` i rang de preu` : ""}, ordenats per preu`,
      ),
    });
  }

  if (fotoSlug) {
    out.push({
      portal: "Fotocasa",
      url: `https://www.fotocasa.es/es/comprar/viviendas/${fotoSlug}-barcelona-capital/l${fotocasaQuery({ minM2, maxM2, maxPrice })}`,
      label: filterLabel(
        `Same filters on Fotocasa — different inventory, useful cross-check`,
        `Mismos filtros en Fotocasa — distinto inventario, contraste útil`,
        `Els mateixos filtres a Fotocasa — inventari diferent, contrast útil`,
      ),
    });
  }

  if (habSlug) {
    out.push({
      portal: "Habitaclia",
      url: `https://www.habitaclia.com/comprar-vivienda-${habSlug}.htm`,
      label: filterLabel(
        `Catalan portal, often shows listings the others miss`,
        `Portal catalán, suele incluir pisos que los otros no tienen`,
        `Portal català, sovint mostra pisos que els altres no tenen`,
      ),
    });
  }

  return out;
}
