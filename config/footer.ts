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
  const compsCa = opts.hasComps
    ? " API oficial d'idealista (anuncis comparables en venda);"
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
      ca:
        "Fonts i mètode. Recopilat automàticament a partir de dades oficials i obertes: " +
        "Dirección General del Catastro (registre cadastral, superfícies, unitats de la parcel·la, coordenades); " +
        "ICAEN (certificat energètic registrat); " +
        "Mapa Urbanístic de Catalunya / Generalitat (qualificació i classificació urbanística); " +
        "MITECO–SNCZI (zones inundables fluvials); IGN / NCSE-02 (perillositat sísmica); CTE DB-HS6 (radó); " +
        "dades obertes de l'Ajuntament de Barcelona (context de delinqüència per districte, ZBE); " +
        "OpenStreetMap (serveis del barri);" +
        compsCa +
        " índexs de preus oficials i el valor de referència del Cadastre per a la comparació de preu. " +
        "Les xifres de preu són orientatives i s'indiquen com a tals; es distingeixen preus d'oferta i de tancament. " +
        "Les puntuacions són una valoració editorial independent.",
    },
    disclaimer: {
      en: "Not formal advice. This report is an automated orientation tool and does not replace a professional technical survey, legal review or mortgage valuation. Figures marked “estimate”, “~” or “to verify” must be confirmed with your gestor, lawyer and bank before you commit.",
      es: "No es asesoramiento formal. Este informe es una herramienta de orientación automática y no sustituye un informe técnico profesional, una revisión legal ni una tasación hipotecaria. Las cifras marcadas como «estimación», «~» o «por verificar» deben confirmarse con tu gestor, abogado y banco antes de comprometerte.",
      ca: "No és assessorament formal. Aquest informe és una eina d'orientació automàtica i no substitueix un informe tècnic professional, una revisió legal ni una taxació hipotecària. Les xifres marcades com «estimació», «~» o «per verificar» s'han de confirmar amb el teu gestor, advocat i banc abans de comprometre't.",
    },
  };
}
