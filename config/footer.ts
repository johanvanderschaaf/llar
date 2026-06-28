import type { Localized } from "@/types/report";

/**
 * Deterministic "Sources & method" + disclaimer for the report footer. Lists
 * the actual official/open sources the pipeline draws on, never AI-written, so
 * the provenance statement is always accurate and consistent.
 */
export function buildFooter(): {
  sources: Localized;
  disclaimer: Localized;
} {
  return {
    sources: {
      en:
        "Sources & method. Compiled automatically from official and open data: " +
        "Dirección General del Catastro (cadastral record, surfaces, units in the parcel, coordinates); " +
        "ICAEN (registered energy certificate); " +
        "Mapa Urbanístic de Catalunya / Generalitat (planning qualification and classification); " +
        "MITECO–SNCZI (fluvial flood zones); IGN / NCSE-02 (seismic hazard); CTE DB-HS6 (radon); " +
        "Ajuntament de Barcelona open data (district crime context, ZBE); " +
        "OpenStreetMap (neighbourhood amenities); " +
        "Generalitat de Catalunya, Habitatge (registered notarial closing prices by neighbourhood, the single price benchmark). " +
        "Price figures are orientation only, not portal asking prices. " +
        "Scores are an independent, documented editorial assessment.",
      es:
        "Fuentes y método. Recopilado automáticamente a partir de datos oficiales y abiertos: " +
        "Dirección General del Catastro (registro catastral, superficies, unidades de la parcela, coordenadas); " +
        "ICAEN (certificado energético registrado); " +
        "Mapa Urbanístic de Catalunya / Generalitat (calificación y clasificación urbanística); " +
        "MITECO–SNCZI (zonas inundables fluviales); IGN / NCSE-02 (peligrosidad sísmica); CTE DB-HS6 (radón); " +
        "datos abiertos del Ajuntament de Barcelona (contexto de delincuencia por distrito, ZBE); " +
        "OpenStreetMap (servicios del barrio); " +
        "Generalitat de Catalunya, Habitatge (precios de cierre notariales registrados por barrio, la referencia de precio única). " +
        "Las cifras de precio son orientativas, no precios de oferta de portales. " +
        "Las puntuaciones son una valoración editorial independiente.",
      ca:
        "Fonts i mètode. Recopilat automàticament a partir de dades oficials i obertes: " +
        "Dirección General del Catastro (registre cadastral, superfícies, unitats de la parcel·la, coordenades); " +
        "ICAEN (certificat energètic registrat); " +
        "Mapa Urbanístic de Catalunya / Generalitat (qualificació i classificació urbanística); " +
        "MITECO–SNCZI (zones inundables fluvials); IGN / NCSE-02 (perillositat sísmica); CTE DB-HS6 (radó); " +
        "dades obertes de l'Ajuntament de Barcelona (context de delinqüència per districte, ZBE); " +
        "OpenStreetMap (serveis del barri); " +
        "Generalitat de Catalunya, Habitatge (preus de tancament notarials registrats per barri, la referència única de preu). " +
        "Les xifres de preu són orientatives, no preus d'oferta de portals. " +
        "Les puntuacions són una valoració editorial independent.",
    },
    disclaimer: {
      en: "Not formal advice. This report is an automated orientation tool and does not replace a professional technical survey, legal review or mortgage valuation. Figures marked “estimate”, “~” or “to verify” must be confirmed with your gestor, lawyer and bank before you commit.",
      es: "No es asesoramiento formal. Este informe es una herramienta de orientación automática y no sustituye un informe técnico profesional, una revisión legal ni una tasación hipotecaria. Las cifras marcadas como «estimación», «~» o «por verificar» deben confirmarse con tu gestor, abogado y banco antes de comprometerte.",
      ca: "No és assessorament formal. Aquest informe és una eina d'orientació automàtica i no substitueix un informe tècnic professional, una revisió legal ni una taxació hipotecària. Les xifres marcades com «estimació», «~» o «per verificar» s'han de confirmar amb el teu gestor, advocat i banc abans de comprometre't.",
    },
  };
}
