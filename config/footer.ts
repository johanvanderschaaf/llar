import type { Localized } from "@/types/report";

/**
 * Deterministic "Sources & method" + disclaimer for the report footer. Lists
 * the actual official/open sources the pipeline draws on — never AI-written, so
 * the provenance statement is always accurate and consistent.
 */
export function buildFooter(opts: { hasComps?: boolean } = {}): {
  sources: Localized;
  disclaimer: Localized;
} {
  const compsEn = opts.hasComps
    ? " idealista official API (comparable on-sale listings);"
    : "";
  const compsEs = opts.hasComps
    ? " API oficial de idealista (anuncios comparables en venta);"
    : "";

  return {
    sources: {
      en:
        "Sources & method. Compiled automatically from official and open data: " +
        "Dirección General del Catastro (cadastral record, surfaces, units in the parcel, coordinates); " +
        "ICAEN (registered energy certificate); " +
        "Mapa Urbanístic de Catalunya / Generalitat (planning qualification and classification); " +
        "MITECO–SNCZI (fluvial flood zones); IGN / NCSE-02 (seismic hazard); CTE DB-HS6 (radon); " +
        "Ajuntament de Barcelona open data (district crime context, ZBE); " +
        "OpenStreetMap (neighbourhood amenities);" +
        compsEn +
        " official price indices and the Catastro reference value for price comparison. " +
        "Price figures are orientation only and labelled as such; asking prices are distinguished from closings. " +
        "Scores are an independent, documented editorial assessment.",
      es:
        "Fuentes y método. Recopilado automáticamente a partir de datos oficiales y abiertos: " +
        "Dirección General del Catastro (registro catastral, superficies, unidades de la parcela, coordenadas); " +
        "ICAEN (certificado energético registrado); " +
        "Mapa Urbanístic de Catalunya / Generalitat (calificación y clasificación urbanística); " +
        "MITECO–SNCZI (zonas inundables fluviales); IGN / NCSE-02 (peligrosidad sísmica); CTE DB-HS6 (radón); " +
        "datos abiertos del Ajuntament de Barcelona (contexto de delincuencia por distrito, ZBE); " +
        "OpenStreetMap (servicios del barrio);" +
        compsEs +
        " índices de precios oficiales y el valor de referencia del Catastro para la comparación de precio. " +
        "Las cifras de precio son orientativas y se indican como tales; se distinguen precios de oferta y de cierre. " +
        "Las puntuaciones son una valoración editorial independiente.",
    },
    disclaimer: {
      en: "Not formal advice. This report is an automated orientation tool and does not replace a professional technical survey, legal review or mortgage valuation. Figures marked “estimate”, “~” or “to verify” must be confirmed with your gestor, lawyer and bank before you commit.",
      es: "No es asesoramiento formal. Este informe es una herramienta de orientación automática y no sustituye un informe técnico profesional, una revisión legal ni una tasación hipotecaria. Las cifras marcadas como «estimación», «~» o «por verificar» deben confirmarse con tu gestor, abogado y banco antes de comprometerte.",
    },
  };
}
