import type { Report } from "@/types/report";
import type { GencatBarriData } from "@/adapters/gencat-barri";
import { buildPricingPayload } from "@/pipeline/template";
import barriPrices from "@/data/bcn-barri-prices.json";
import { buildFooter } from "@/config/footer";
import { buildLegal } from "@/config/legal";
import { buildBuilding } from "@/config/building";

/**
 * Sample report transcribed from the canonical reference design
 * (reference/sors-35-property-dossier.html). Used in Phase 1 to render the
 * full dossier in EN + ES + CA before any live data/AI is wired up.
 */

/**
 * la Vila de Gràcia (barri code 31) closing-price benchmark, read from the same
 * dataset (`bcn-barri-prices.json`, Gencat Habitatge registered second-hand
 * sales) that the live pipeline uses. The demo's Section 03 is then built by the
 * same `buildPricingPayload` the pipeline calls, so the preview and generated
 * reports render identically and stay current whenever the logic or data change.
 */
const VILA_DE_GRACIA: GencatBarriData = (() => {
  const row = (
    barriPrices.byBarri as Record<
      string,
      { name: string; transactions: number; avgSurfaceM2: number; pricePerM2: number | null }
    >
  )["31"];
  if (row.pricePerM2 == null) throw new Error("Sample barri 31 has no €/m²");
  return {
    barriCode: "31",
    name: row.name,
    districtCode: "06",
    pricePerM2: row.pricePerM2,
    transactions: row.transactions,
    avgSurfaceM2: row.avgSurfaceM2,
    asOf: barriPrices.asOf,
  };
})();

export const sampleSors35: Report = {
  id: "sample-sors35",
  generatedAt: "2026-06-02",
  cadastralRef: "9648812DF2894H0013RQ",

  hero: {
    title: "Carrer de Sors 35",
    floorLabel: { en: "3rd floor", es: "3.º piso", ca: "3r pis" },
    sub: {
      en: "A 90 m² flat in upper Vila de Gràcia. An independent check of its price, building, planning and neighbourhood before you offer.",
      es: "Un piso de 90 m² en la parte alta de la Vila de Gràcia. Una revisión independiente de su precio, edificio, urbanismo y entorno antes de que hagas una oferta.",
      ca: "Un pis de 90 m² a la part alta de la Vila de Gràcia. Una revisió independent del seu preu, edifici, urbanisme i entorn abans que facis una oferta.",
    },
    // Hero meta mirrors the live pipeline: asking price (buyer-entered), derived
    // €/m², and energy class (ICAEN). Bed/bath count, lift and terrace are listing
    // attributes we don't ingest, so they are not shown.
    meta: [
      { labelKey: "meta.asking", value: "€455,000", accent: true },
      { labelKey: "meta.pricePerM2", value: "€5,056" },
      {
        labelKey: "meta.energy",
        value: { en: "Class E", es: "Clase E", ca: "Classe E" },
      },
    ],
  },

  verdict: {
    headline: {
      en: "90 m² flat in Vila de Gràcia, asking about 9% below the neighbourhood average.",
      es: "Piso de 90 m² en la Vila de Gràcia, pedido un 9% por debajo de la media del barrio.",
      ca: "Pis de 90 m² a la Vila de Gràcia, demanat un 9% per sota de la mitjana del barri.",
    },
    body: {
      en: "The asking €455,000 (€5,056/m²) is about 9% below the €5,584/m² that second-hand flats in Vila de Gràcia registered at the notary across 2025. The building dates from 1965, so its ITE technical inspection is due and a pre-2002 build can carry asbestos in old installations. No planning affectation or heritage listing limits its use as a home. Before offering, confirm the building's collective health (reserve fund, pending derramas), the documents, and the flat's actual condition and layout on a viewing.",
      es: "El precio pedido de 455.000 € (5.056 €/m²) está alrededor de un 9% por debajo de los 5.584 €/m² a los que los pisos de segunda mano de la Vila de Gràcia se registraron en notaría durante 2025. El edificio es de 1965, por lo que su inspección técnica ITE está pendiente y una construcción anterior a 2002 puede tener amianto en instalaciones antiguas. Ninguna afectación urbanística ni protección patrimonial limita su uso como vivienda. Antes de ofertar, comprueba la salud colectiva del edificio (fondo de reserva, derramas pendientes), los documentos y el estado y la distribución reales del piso en una visita.",
      ca: "El preu demanat de 455.000 € (5.056 €/m²) està al voltant d'un 9% per sota dels 5.584 €/m² als quals els pisos de segona mà de la Vila de Gràcia es van registrar a notaria durant el 2025. L'edifici és del 1965, de manera que la seva inspecció tècnica ITE està pendent i una construcció anterior al 2002 pot tenir amiant en instal·lacions antigues. Cap afectació urbanística ni protecció patrimonial no en limita l'ús com a habitatge. Abans d'ofertar, comprova la salut col·lectiva de l'edifici (fons de reserva, derrames pendents), els documents i l'estat i la distribució reals del pis en una visita.",
    },
    overall: 71,
    tag: {
      en: "Asking below the neighbourhood average",
      es: "Pedido por debajo de la media del barrio",
      ca: "Demanat per sota de la mitjana del barri",
    },
  },

  scores: [
    {
      key: "location",
      value: 87,
      caption: { en: "Upper Vila de Gràcia", es: "Parte alta de Gràcia", ca: "Part alta de Gràcia" },
    },
    {
      key: "transport",
      value: 84,
      caption: { en: "3 metro lines near", es: "3 líneas de metro cerca", ca: "3 línies de metro a prop" },
    },
    {
      key: "building",
      value: 60,
      caption: { en: "1965 · ITE due", es: "1965 · ITE pendiente", ca: "1965 · ITE pendent" },
    },
    {
      key: "price",
      value: 71,
      caption: {
        en: "9% below neighbourhood avg",
        es: "9% bajo la media del barrio",
        ca: "9% sota la mitjana del barri",
      },
    },
    {
      key: "energy",
      value: 45,
      caption: { en: "Class E (2022)", es: "Clase E (2022)", ca: "Classe E (2022)" },
    },
  ],

  snapshot: {
    facts: [
      {
        labelKey: "snapshot.address",
        value: "Carrer de Sors 35, 3-3 · 08024",
      },
      {
        labelKey: "snapshot.neighbourhood",
        value: "la Vila de Gràcia · Gràcia",
      },
      { labelKey: "snapshot.builtArea", value: "90 m²" },
      { labelKey: "snapshot.usableArea", value: "~80–82 m²" },
      {
        labelKey: "snapshot.yearBuilt",
        value: { en: "1965 (61 years)", es: "1965 (61 años)", ca: "1965 (61 anys)" },
      },
      { labelKey: "snapshot.cadastralRef", value: "9648812DF2894H0013RQ" },
    ],
    note: {
      en: "On the building: aggregators show \"1 dwelling\" at this address, but the cadastral suffix 0013 means your flat is unit #13 in the parcel, so it's a normal multi-unit block, not a single home. The other units are filed under the adjacent entrance. Confirm the true count on-site (count the mailboxes) and via the building's división horizontal.",
      es: "Sobre el edificio: los portales muestran \"1 vivienda\" en esta dirección, pero el sufijo catastral 0013 indica que tu piso es la unidad n.º 13 de la parcela, así que es un bloque normal de varias viviendas, no una casa única. Las demás unidades constan en la entrada contigua. Confirma el número real in situ (cuenta los buzones) y mediante la división horizontal del edificio.",
      ca: "Sobre l'edifici: els portals mostren \"1 habitatge\" en aquesta adreça, però el sufix cadastral 0013 indica que el teu pis és la unitat núm. 13 de la parcel·la, així que és un bloc normal de diversos habitatges, no una casa única. La resta d'unitats consten a l'entrada contigua. Confirma el nombre real in situ (compta les bústies) i mitjançant la divisió horitzontal de l'edifici.",
    },
  },

  price: {
    // Section 03 is driven entirely by `pricing` below. lede/fairValue are
    // factual fallbacks for the legacy render and PDF path; panels and the offer
    // ladder are unused by the current design (offer guidance is in negotiation).
    lede: {
      en: "Asking €455,000 (€5,056/m²), about 9% below the Vila de Gràcia registered closing-price average.",
      es: "Precio pedido 455.000 € (5.056 €/m²), alrededor de un 9% por debajo de la media de cierre registrada de la Vila de Gràcia.",
      ca: "Preu demanat 455.000 € (5.056 €/m²), al voltant d'un 9% per sota de la mitjana de tancament registrada de la Vila de Gràcia.",
    },
    panels: [],
    // No portal (idealista/Fotocasa) comps: we don't ingest portal data and the
    // barri closing-price benchmark is the single price anchor. Generated reports
    // have no comps either, so the comps table renders in neither.
    comps: [],
    // Structured Section 03 payload, built by the SAME function the live pipeline
    // calls, from the real Vila de Gràcia closing data. Keeps preview == generated.
    pricing: buildPricingPayload(VILA_DE_GRACIA, {
      askingPriceEur: 455000,
      builtM2: 90,
    }),
    fairValue: {
      en: "Flats around 90 m² in Vila de Gràcia registered between about €427,000 and €578,000 over 2025 (neighbourhood €/m² ±15%). Position the offer by this flat's specific features, then verify against concrete comparables.",
      es: "Los pisos de unos 90 m² en la Vila de Gràcia se registraron entre unos 427.000 € y 578.000 € durante 2025 (€/m² del barrio ±15%). Sitúa la oferta según las características concretas de este piso y contrástala con comparables.",
      ca: "Els pisos d'uns 90 m² a la Vila de Gràcia es van registrar entre uns 427.000 € i 578.000 € durant el 2025 (€/m² del barri ±15%). Situa l'oferta segons les característiques concretes d'aquest pis i contrasta-la amb comparables.",
    },
    ladder: [],
  },

  // Building & condition is deterministic in the live pipeline (year-based, from
  // Catastro), so the demo derives it from the same builder. It states what's
  // verifiable from the build year (ITE obligation, possible asbestos) and what
  // to check, never the interior condition, which we don't have a source for.
  building: buildBuilding(1965),

  risks: [
    {
      labelKey: "risk.flood",
      tone: "good",
      detail: {
        en: "Not in a SNCZI / MITECO flood-risk zone.",
        es: "No está en zona de riesgo de inundación SNCZI / MITECO.",
        ca: "No es troba en zona de risc d'inundació SNCZI / MITECO.",
      },
    },
    {
      labelKey: "risk.seismic",
      tone: "good",
      detail: {
        en: "PGA 0.04 g, standard for Barcelona.",
        es: "PGA 0,04 g, estándar para Barcelona.",
        ca: "PGA 0,04 g, estàndard a Barcelona.",
      },
    },
    {
      labelKey: "risk.radon",
      tone: "good",
      detail: {
        en: "Barcelona is a low-radon area.",
        es: "Barcelona es una zona de radón bajo.",
        ca: "Barcelona és una zona de radó baix.",
      },
    },
    {
      labelKey: "risk.energy",
      tone: "ok",
      detail: {
        en: "Higher bills; future EU rules may pressure low-rated homes' value.",
        es: "Facturas más altas; futuras normas de la UE pueden presionar el valor de viviendas con baja calificación.",
        ca: "Factures més altes; les futures normes de la UE poden pressionar el valor dels habitatges amb baixa qualificació.",
      },
    },
    {
      labelKey: "risk.ite",
      tone: "ok",
      detail: {
        en: "61-yr building, confirm valid inspection & no major works pending.",
        es: "Edificio de 61 años, confirma inspección vigente y que no haya obras importantes pendientes.",
        ca: "Edifici de 61 anys, confirma inspecció vigent i que no hi hagi obres importants pendents.",
      },
    },
    {
      labelKey: "risk.asbestos",
      tone: "ok",
      detail: {
        en: "Possible in legacy installations; usually low-cost if isolated.",
        es: "Posible en instalaciones antiguas; normalmente de bajo coste si está aislado.",
        ca: "Possible en instal·lacions antigues; normalment de baix cost si està aïllat.",
      },
    },
    {
      labelKey: "risk.crime",
      tone: "good",
      detail: {
        en: "Gràcia is a calm residential district; city crime fell ~9% in 2025.",
        es: "Gràcia es un distrito residencial tranquilo; la delincuencia en la ciudad bajó ~9% en 2025.",
        ca: "Gràcia és un districte residencial tranquil; la delinqüència a la ciutat va baixar ~9% el 2025.",
      },
    },
  ],

  // Documents to request come from the same deterministic builder the pipeline
  // uses, so the demo legal section matches generated reports. The on-site and
  // process actions live in `checklist` below, with no document overlap.
  legal: buildLegal(),

  neighbourhood: {
    lede: {
      en: "Upper Vila de Gràcia, on the La Salut / Camp d'en Grassot edge, residential, well-served, and a short walk from one of Europe's most famous parks.",
      es: "Parte alta de la Vila de Gràcia, en el límite con La Salut / Camp d'en Grassot: residencial, bien dotada y a pocos minutos a pie de uno de los parques más famosos de Europa.",
      ca: "Part alta de la Vila de Gràcia, al límit amb La Salut / Camp d'en Grassot: residencial, ben dotada i a pocs minuts a peu d'un dels parcs més famosos d'Europa.",
    },
    facts: [
      {
        labelKey: "neigh.metro",
        value: {
          en: "Joanic (L4) ~4 min · Lesseps (L3) · Alfons X (L4)",
          es: "Joanic (L4) ~4 min · Lesseps (L3) · Alfons X (L4)",
          ca: "Joanic (L4) ~4 min · Lesseps (L3) · Alfons X (L4)",
        },
      },
      {
        labelKey: "neigh.health",
        value: {
          en: "Hospital de l'Esperança ~5 min",
          es: "Hospital de l'Esperança ~5 min",
          ca: "Hospital de l'Esperança ~5 min",
        },
      },
      {
        labelKey: "neigh.green",
        value: {
          en: "Park Güell ~10 min uphill",
          es: "Park Güell ~10 min cuesta arriba",
          ca: "Park Güell ~10 min costa amunt",
        },
      },
      {
        labelKey: "neigh.shopping",
        value: {
          en: "Sorli supermarket ~3 min",
          es: "Supermercado Sorli ~3 min",
          ca: "Supermercat Sorli ~3 min",
        },
      },
      {
        labelKey: "neigh.market",
        value: {
          en: "Mercat de l'Abaceria (reopens 2026–27)",
          es: "Mercat de l'Abaceria (reabre 2026–27)",
          ca: "Mercat de l'Abaceria (reobre 2026–27)",
        },
      },
      {
        labelKey: "neigh.schools",
        value: {
          en: "Several public & concertada options nearby",
          es: "Varias opciones públicas y concertadas cerca",
          ca: "Diverses opcions públiques i concertades a prop",
        },
      },
    ],
    note: {
      en: "Note: Park Güell is a short walk uphill, which also brings tourist foot-traffic on the upper streets. The Abaceria market is due to reopen in 2026 to 2027.",
      es: "Nota: el Park Güell queda a poca distancia cuesta arriba, lo que también atrae tránsito turístico en las calles altas. El mercado de l'Abaceria tiene prevista su reapertura en 2026 a 2027.",
      ca: "Nota: el Park Güell queda a poca distància costa amunt, cosa que també atrau trànsit turístic als carrers alts. El Mercat de l'Abaceria té prevista la reobertura el 2026 a 2027.",
    },
  },

  urbanism: {
    items: [
      {
        key: "affectation",
        tone: "clear",
        label: { en: "Planning affectation", es: "Afectación urbanística", ca: "Afectació urbanística" },
        text: {
          en: "No planning affectation was found that would limit using this as a home.",
          es: "No se ha encontrado ninguna afectación urbanística que impida usarla como vivienda.",
          ca: "No s'ha trobat cap afectació urbanística que impedeixi utilitzar-lo com a habitatge.",
        },
      },
      {
        key: "zoning",
        tone: "clear",
        label: { en: "Zoning", es: "Calificación", ca: "Qualificació" },
        text: {
          en: "Residential, build-ready land, standard for a mid-block flat in consolidated Gràcia.",
          es: "Suelo residencial y consolidado, lo normal para un piso a media manzana en la Gràcia consolidada.",
          ca: "Sòl residencial i consolidat, el que és habitual per a un pis a mitja illa en la Gràcia consolidada.",
        },
      },
      {
        key: "lez",
        tone: "info",
        label: { en: "Low Emission Zone (ZBE)", es: "Zona de Bajas Emisiones (ZBE)", ca: "Zona de Baixes Emissions (ZBE)" },
        text: {
          en: "Like all of central Barcelona, this address is inside the Low Emission Zone. Only relevant if you keep a car without an emissions sticker.",
          es: "Como toda Barcelona central, esta dirección está dentro de la Zona de Bajas Emisiones. Solo importa si mantienes un coche sin etiqueta ambiental.",
          ca: "Com tota la Barcelona central, aquesta adreça és dins la Zona de Baixes Emissions. Només importa si tens cotxe sense etiqueta ambiental.",
        },
      },
    ],
  },

  costs: {
    intro: {
      en: "As a resale in Catalonia, the purchase carries transfer tax (ITP) rather than VAT. Budget ~12–14% on top of the price for taxes and fees.",
      es: "Al ser una segunda transmisión en Cataluña, la compra conlleva el impuesto de transmisiones (ITP) en lugar de IVA. Presupuesta ~12–14% sobre el precio para impuestos y gastos.",
      ca: "Com que és una segona transmissió a Catalunya, la compra comporta l'impost de transmissions (ITP) en lloc d'IVA. Pressuposta ~12–14% sobre el preu per a impostos i despeses.",
    },
    facts: [
      {
        labelKey: "costs.itp",
        value: {
          en: "~10–11% (tiered), confirm 2026 rate",
          es: "~10–11% (por tramos), confirma el tipo de 2026",
          ca: "~10–11% (per trams), confirma el tipus de 2026",
        },
        toVerify: true,
      },
      {
        labelKey: "costs.notary",
        value: "~€2,000–3,500",
      },
      {
        labelKey: "costs.gestoria",
        value: {
          en: "~€1,000–4,000 (recommended)",
          es: "~1.000–4.000 € (recomendado)",
          ca: "~1.000–4.000 € (recomanat)",
        },
      },
      { labelKey: "costs.valuation", value: "~€300–500" },
      { labelKey: "costs.allIn", value: "~€510,000–520,000" },
    ],
    footnote: {
      en: "Catalan ITP brackets were revised in 2025, confirm the exact current rate with your gestor before budgeting. Reduced rates may apply (e.g. habitual residence, buyers ≤35, large families).",
      es: "Los tramos del ITP catalán se revisaron en 2025: confirma el tipo exacto vigente con tu gestor antes de presupuestar. Pueden aplicar tipos reducidos (p. ej. vivienda habitual, compradores ≤35 años, familia numerosa).",
      ca: "Els trams de l'ITP català es van revisar el 2025: confirma el tipus exacte vigent amb el teu gestor abans de pressupostar. Poden aplicar-se tipus reduïts (p. ex. habitatge habitual, compradors ≤35 anys, família nombrosa).",
    },
  },

  subsidies: {
    panels: [
      {
        heading: { en: "Still available", es: "Aún disponible", ca: "Encara disponible" },
        body: {
          en: "IRPF energy deductions, 20% / 40% / 60% income-tax relief for qualifying efficiency works. Useful if you upgrade windows or insulation later.",
          es: "Deducciones de IRPF por eficiencia, desgravación del 20% / 40% / 60% por obras que cumplan requisitos. Útil si más adelante mejoras ventanas o aislamiento.",
          ca: "Deduccions d'IRPF per eficiència, desgravació del 20% / 40% / 60% per obres que compleixin els requisits. Útil si més endavant millores finestres o aïllament.",
        },
      },
      {
        heading: { en: "Closing window", es: "Ventana que se cierra", ca: "Finestra que es tanca" },
        body: {
          en: "Next Generation grants (40–80% of works, up to ~€21k/home) are largely exhausted/waitlisted in Catalonia and must be justified by 30 June 2026, don't count on them for a future reform.",
          es: "Las ayudas Next Generation (40–80% de la obra, hasta ~21.000 €/vivienda) están en gran parte agotadas o en lista de espera en Cataluña y deben justificarse antes del 30 de junio de 2026: no cuentes con ellas para una reforma futura.",
          ca: "Els ajuts Next Generation (40–80% de l'obra, fins a ~21.000 €/habitatge) estan en gran part exhaurits o en llista d'espera a Catalunya i s'han de justificar abans del 30 de juny de 2026: no comptis amb ells per a una reforma futura.",
        },
      },
    ],
  },

  negotiation: {
    intro: {
      en: "The asking sits below the neighbourhood average, so this is fine-tuning. Two fact-based levers:",
      es: "El precio pedido está por debajo de la media del barrio, así que esto es afinar. Dos palancas objetivas:",
      ca: "El preu demanat està per sota de la mitjana del barri, així que això és afinar. Dues palanques objectives:",
    },
    items: [
      {
        en: "Building age & ITE. A 61-year-old building with inspection obligations and an unknown reserve fund is a basis for trimming the number.",
        es: "Edad del edificio e ITE. Un edificio de 61 años con obligaciones de inspección y un fondo de reserva desconocido es una base para recortar la cifra.",
        ca: "Edat de l'edifici i ITE. Un edifici de 61 anys amb obligacions d'inspecció i un fons de reserva desconegut és una base per retallar la xifra.",
      },
      {
        en: "Asking ≠ closing. Listed prices usually settle a little below the asking price, which leaves room for a measured offer.",
        es: "Oferta ≠ cierre. Los precios anunciados suelen cerrarse algo por debajo del precio pedido, lo que deja margen para una propuesta medida.",
        ca: "Oferta ≠ tancament. Els preus anunciats solen tancar-se una mica per sota del preu demanat, cosa que deixa marge per a una proposta mesurada.",
      },
    ],
    tactic: {
      en: "Tactic: open around €438k on building-age and inspection grounds, settle near €448k. Make any offer conditional on receiving a valid ITE, cédula and clean community minutes, which protects you and is the cleanest justification for shaving the price.",
      es: "Táctica: abre en torno a 438.000 € por la edad del edificio y la inspección, cierra cerca de 448.000 €. Condiciona cualquier oferta a recibir una ITE vigente, la cédula y unas actas de comunidad limpias: eso te protege y es la justificación más limpia para rebajar el precio.",
      ca: "Tàctica: obre al voltant de 438.000 € per l'edat de l'edifici i la inspecció, tanca prop dels 448.000 €. Condiciona qualsevol oferta a rebre una ITE vigent, la cèdula i unes actes de comunitat netes: això et protegeix i és la justificació més neta per rebaixar el preu.",
    },
  },

  // On-site and process actions only. The documents to request live in the
  // Legal section above; this list does not repeat them.
  checklist: [
    {
      en: "Count the mailboxes and doorbells on site to confirm the real number of units in the block.",
      es: "Cuenta los buzones y timbres in situ para confirmar el número real de viviendas del bloque.",
      ca: "Compta les bústies i els timbres in situ per confirmar el nombre real d'habitatges del bloc.",
    },
    {
      en: "Inspect the flat and stairwell for damp, and ask about the roof and any lift's maintenance.",
      es: "Inspecciona el piso y la escalera por humedades, y pregunta por la cubierta y el mantenimiento de cualquier ascensor.",
      ca: "Inspecciona el pis i l'escala per humitats, i pregunta per la coberta i el manteniment de qualsevol ascensor.",
    },
    {
      en: "Visit at different times of day to judge light, street noise and tourist foot-traffic.",
      es: "Visita a distintas horas del día para valorar la luz, el ruido de la calle y el tránsito turístico.",
      ca: "Visita a diferents hores del dia per valorar la llum, el soroll del carrer i el trànsit turístic.",
    },
    {
      en: "If the flat has been renovated, check the works had the required permits.",
      es: "Si el piso ha sido reformado, comprueba que las obras tuvieron los permisos necesarios.",
      ca: "Si el pis ha estat reformat, comprova que les obres van tenir els permisos necessaris.",
    },
    {
      en: "Line up your mortgage decision-in-principle before making a written offer.",
      es: "Consigue tu acuerdo hipotecario previo antes de hacer una oferta por escrito.",
      ca: "Aconsegueix el teu acord hipotecari previ abans de fer una oferta per escrit.",
    },
  ],

  // Sources & disclaimer come from the same deterministic builder the pipeline
  // uses (seedFooter → buildFooter), so the demo footer matches generated reports
  // and reflects the single closing-price anchor (no portal sources).
  footer: buildFooter(),
};
