import type { Report } from "@/types/report";

/**
 * Sample report transcribed from the canonical reference design
 * (reference/sors-35-property-dossier.html). Used in Phase 1 to render the
 * full dossier in EN + ES + CA before any live data/AI is wired up.
 */
export const sampleSors35: Report = {
  id: "sample-sors35",
  generatedAt: "2026-06-02",
  cadastralRef: "9648812DF2894H0013RQ",

  hero: {
    title: "Carrer de Sors 35",
    floorLabel: { en: "3rd floor", es: "3.º piso", ca: "3r pis" },
    sub: {
      en: "A reformed 90 m² apartment in upper Vila de Gràcia, listed by Clikalia. Strong location, sound layout, and priced broadly in line with the barrio. Here's the honest read before you offer.",
      es: "Un piso reformado de 90 m² en la parte alta de la Vila de Gràcia, anunciado por Clikalia. Buena ubicación, distribución sólida y un precio en línea con el barrio. Esta es la lectura honesta antes de que hagas una oferta.",
      ca: "Un pis reformat de 90 m² a la part alta de la Vila de Gràcia, anunciat per Clikalia. Bona ubicació, distribució sòlida i un preu en línia amb el barri. Aquesta és la lectura honesta abans que facis una oferta.",
    },
    meta: [
      { labelKey: "meta.asking", value: "€455,000", accent: true },
      { labelKey: "meta.pricePerM2", value: "€5,056" },
      {
        labelKey: "meta.size",
        value: { en: "90 m² · 3 bed · 2 bath", es: "90 m² · 3 hab · 2 baños", ca: "90 m² · 3 hab · 2 banys" },
      },
      { labelKey: "meta.built", value: "1965" },
      {
        labelKey: "meta.energy",
        value: { en: "Class E", es: "Clase E", ca: "Classe E" },
      },
      {
        labelKey: "meta.floor",
        value: {
          en: "3rd · lift · terrace",
          es: "3.º · ascensor · terraza",
          ca: "3r · ascensor · terrassa",
        },
      },
    ],
  },

  verdict: {
    headline: {
      en: "A good flat in a great street, priced fairly for what it is.",
      es: "Un buen piso en una gran calle, con un precio justo para lo que es.",
      ca: "Un bon pis en un gran carrer, amb un preu just per al que és.",
    },
    body: {
      en: "Location, light and layout are genuinely strong, and the lift + reform remove the usual Gràcia headaches. On price, at €5,056/m² the asking sits below the barrio's average asking levels (idealista €5,761, Fotocasa €6,712) — reasonable for a reformed, lift-equipped top-floor flat. It's not a bargain (these are asking prices; deals close a little lower), but it's not overpriced either. The 61-year-old building, the ITE due, and the fact it's a professional flip are your modest negotiation levers — worth fine-tuning the number, not slashing it.",
      es: "La ubicación, la luz y la distribución son realmente buenas, y el ascensor más la reforma eliminan los dolores de cabeza habituales de Gràcia. En precio, a 5.056 €/m² la oferta se sitúa por debajo de los niveles medios de oferta del barrio (idealista 5.761 €, Fotocasa 6.712 €): razonable para un piso reformado, con ascensor y en última planta. No es un chollo (son precios de oferta; las operaciones cierran algo más bajas), pero tampoco está sobrevalorado. El edificio de 61 años, la ITE pendiente y el hecho de que sea una reforma profesional para revender son tus palancas de negociación modestas: conviene afinar la cifra, no recortarla drásticamente.",
      ca: "La ubicació, la llum i la distribució són realment bones, i l'ascensor més la reforma eliminen els mals de cap habituals de Gràcia. En preu, a 5.056 €/m² l'oferta se situa per sota dels nivells mitjans d'oferta del barri (idealista 5.761 €, Fotocasa 6.712 €): raonable per a un pis reformat, amb ascensor i en última planta. No és una ganga (són preus d'oferta; les operacions tanquen una mica més avall), però tampoc està sobrevalorat. L'edifici de 61 anys, la ITE pendent i el fet que sigui una reforma professional per a revenda són les teves palanques de negociació modestes: convé afinar la xifra, no retallar-la dràsticament.",
    },
    overall: 71,
    tag: {
      en: "Solid buy — negotiate on the details",
      es: "Compra sólida — negocia en los detalles",
      ca: "Compra sòlida — negocia els detalls",
    },
  },

  scores: [
    {
      key: "location",
      value: 87,
      caption: { en: "Prime Gràcia", es: "Gràcia de primera", ca: "Gràcia de primera" },
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
        en: "Below barrio asking",
        es: "Bajo la oferta del barrio",
        ca: "Per sota de l'oferta del barri",
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
        value: {
          en: "Vila de Gràcia (upper edge)",
          es: "Vila de Gràcia (parte alta)",
          ca: "Vila de Gràcia (part alta)",
        },
      },
      { labelKey: "snapshot.builtArea", value: "90 m²" },
      { labelKey: "snapshot.usableArea", value: "~80–82 m²" },
      {
        labelKey: "snapshot.bedsBaths",
        value: { en: "3 / 2", es: "3 / 2", ca: "3 / 2" },
      },
      {
        labelKey: "snapshot.floor",
        value: {
          en: "3rd, exterior · top floor",
          es: "3.º, exterior · última planta",
          ca: "3r, exterior · àtic",
        },
      },
      { labelKey: "snapshot.lift", value: { en: "Yes", es: "Sí", ca: "Sí" } },
      { labelKey: "snapshot.terrace", value: { en: "Yes", es: "Sí", ca: "Sí" } },
      {
        labelKey: "snapshot.heating",
        value: {
          en: "Individual heating · A/C",
          es: "Calefacción individual · A/A",
          ca: "Calefacció individual · A/A",
        },
      },
      {
        labelKey: "snapshot.yearBuilt",
        value: { en: "1965 (61 years)", es: "1965 (61 años)", ca: "1965 (61 anys)" },
      },
      {
        labelKey: "snapshot.condition",
        value: {
          en: "Reformed (Clikalia flip)",
          es: "Reformado (reventa Clikalia)",
          ca: "Reformat (revenda Clikalia)",
        },
      },
      { labelKey: "snapshot.cadastralRef", value: "9648812DF2894H0013RQ" },
    ],
    note: {
      en: "On the building: aggregators show \"1 dwelling\" at this address, but the cadastral suffix 0013 means your flat is unit #13 in the parcel — so it's a normal multi-unit block, not a single home. The other units are filed under the adjacent entrance. Confirm the true count on-site (count the mailboxes) and via the building's división horizontal.",
      es: "Sobre el edificio: los portales muestran \"1 vivienda\" en esta dirección, pero el sufijo catastral 0013 indica que tu piso es la unidad n.º 13 de la parcela, así que es un bloque normal de varias viviendas, no una casa única. Las demás unidades constan en la entrada contigua. Confirma el número real in situ (cuenta los buzones) y mediante la división horizontal del edificio.",
      ca: "Sobre l'edifici: els portals mostren \"1 habitatge\" en aquesta adreça, però el sufix cadastral 0013 indica que el teu pis és la unitat núm. 13 de la parcel·la, així que és un bloc normal de diversos habitatges, no una casa única. La resta d'unitats consten a l'entrada contigua. Confirma el nombre real in situ (compta les bústies) i mitjançant la divisió horitzontal de l'edifici.",
    },
  },

  price: {
    lede: {
      en: "Pricing depends heavily on whether you look at the district or the barrio — and on which portal. Measured correctly, against Vila de Gràcia itself, this flat is priced below the asking average.",
      es: "El precio depende mucho de si miras el distrito o el barrio, y de qué portal. Medido correctamente, frente a la propia Vila de Gràcia, este piso está por debajo de la media de oferta.",
      ca: "El preu depèn molt de si mires el districte o el barri, i de quin portal. Mesurat correctament, contra la mateixa Vila de Gràcia, aquest pis està per sota de la mitjana d'oferta.",
    },
    panels: [
      {
        heading: { en: "Market context", es: "Contexto de mercado", ca: "Context de mercat" },
        body: {
          en: "Asking prices in the barrio of Vila de Gràcia run €5,761/m² (idealista) to €6,712/m² (Fotocasa) in mid-2026 — the two portals differ by ~16% on sample. The wider district of Gràcia is lower (~€5,570/m²) because it folds in cheaper barrios. Note these are all asking prices; recorded closings sit somewhat below.",
          es: "Los precios de oferta en el barrio de la Vila de Gràcia van de 5.761 €/m² (idealista) a 6.712 €/m² (Fotocasa) a mediados de 2026: los dos portales difieren un ~16% según la muestra. El distrito de Gràcia, más amplio, es más bajo (~5.570 €/m²) porque incluye barrios más baratos. Recuerda que son precios de oferta; las operaciones registradas quedan algo por debajo.",
          ca: "Els preus d'oferta al barri de la Vila de Gràcia van de 5.761 €/m² (idealista) a 6.712 €/m² (Fotocasa) a mitjans de 2026: els dos portals difereixen un ~16% segons la mostra. El districte de Gràcia, més ampli, és més baix (~5.570 €/m²) perquè inclou barris més barats. Recorda que són preus d'oferta; les operacions registrades queden una mica per sota.",
        },
      },
      {
        heading: {
          en: "This flat vs market",
          es: "Este piso frente al mercado",
          ca: "Aquest pis enfront del mercat",
        },
        body: {
          en: "At €5,056/m², the asking is ~12% below idealista and ~25% below Fotocasa barrio averages. On a whole-price basis it's €455k vs Fotocasa's ~€444k average for sub-100 m² homes. For a reformed flat with lift, terrace and 2 baths, that reads as fair-to-keen, not inflated.",
          es: "A 5.056 €/m², la oferta está ~12% por debajo de idealista y ~25% por debajo de las medias de barrio de Fotocasa. En precio total son 455.000 € frente a la media de ~444.000 € de Fotocasa para viviendas de menos de 100 m². Para un piso reformado con ascensor, terraza y 2 baños, eso resulta justo o incluso ajustado, no inflado.",
          ca: "A 5.056 €/m², l'oferta està ~12% per sota d'idealista i ~25% per sota de les mitjanes de barri de Fotocasa. En preu total són 455.000 € enfront de la mitjana de ~444.000 € de Fotocasa per a habitatges de menys de 100 m². Per a un pis reformat amb ascensor, terrassa i 2 banys, això resulta just o fins i tot ajustat, no inflat.",
        },
      },
    ],
    comps: [
      {
        reference: {
          en: "Sors 35 — this flat",
          es: "Sors 35 — este piso",
          ca: "Sors 35 — aquest pis",
        },
        price: "€455,000",
        size: "90 m²",
        pricePerM2: "5,056",
        note: {
          en: "Reformed, lift, terrace",
          es: "Reformado, ascensor, terraza",
          ca: "Reformat, ascensor, terrassa",
        },
        highlight: true,
      },
      {
        reference: "Vila de Gràcia — Fotocasa (3-bed)",
        pricePerM2: "6,388",
        note: { en: "Barrio asking avg", es: "Media oferta barrio", ca: "Mitjana d'oferta del barri" },
      },
      {
        reference: "Vila de Gràcia — Fotocasa (all)",
        pricePerM2: "6,712",
        note: { en: "Barrio asking avg", es: "Media oferta barrio", ca: "Mitjana d'oferta del barri" },
      },
      {
        reference: "Vila de Gràcia — idealista (all)",
        pricePerM2: "5,761",
        note: { en: "Barrio asking avg", es: "Media oferta barrio", ca: "Mitjana d'oferta del barri" },
      },
      {
        reference: "Fotocasa — avg value <100 m²",
        price: "€444,433",
        note: { en: "Closest size band", es: "Banda de tamaño más cercana", ca: "Franja de mida més propera" },
      },
      {
        reference: {
          en: "District closing benchmark",
          es: "Referencia de cierre del distrito",
          ca: "Referència de tancament del districte",
        },
        pricePerM2: "4,566",
        note: {
          en: "Notarial, 1H 2025 (district)",
          es: "Notarial, 1S 2025 (distrito)",
          ca: "Notarial, 1S 2025 (districte)",
        },
      },
    ],
    fairValue: {
      en: "Fair-value read: roughly €440,000–465,000 for this spec in Vila de Gràcia. The €455k ask sits inside that band — fairly priced. Earlier drafts of this dossier used district figures and understated the barrio; corrected here.",
      es: "Lectura de valor justo: aproximadamente 440.000–465.000 € para estas características en la Vila de Gràcia. La oferta de 455.000 € está dentro de esa banda: precio justo. Borradores anteriores de este dosier usaban cifras de distrito e infravaloraban el barrio; corregido aquí.",
      ca: "Lectura de valor just: aproximadament 440.000–465.000 € per a aquestes característiques a la Vila de Gràcia. L'oferta de 455.000 € és dins d'aquesta franja: preu just. Esborranys anteriors d'aquest dossier feien servir xifres de districte i infravaloraven el barri; corregit aquí.",
    },
    ladder: [
      {
        kind: "open",
        amount: "€438,000",
        rationale: {
          en: "Building age + ITE + flip margin",
          es: "Edad del edificio + ITE + margen de reventa",
          ca: "Edat de l'edifici + ITE + marge de revenda",
        },
      },
      {
        kind: "target",
        amount: "€448,000",
        rationale: {
          en: "Fair value, realistic",
          es: "Valor justo, realista",
          ca: "Valor just, realista",
        },
      },
      {
        kind: "ceiling",
        amount: "€455,000",
        rationale: {
          en: "Ask is defensible if docs clean",
          es: "La oferta es defendible si los papeles están limpios",
          ca: "L'oferta és defensable si els papers estan nets",
        },
      },
    ],
  },

  building: {
    panels: [
      {
        heading: { en: "What's good", es: "Lo bueno", ca: "El bo" },
        body: {
          en: "Interior is freshly reformed with a lift, A/C and a terrace — rare and valuable in this part of Gràcia. Top-floor exterior means light and quiet. Individual heating keeps running costs in your control.",
          es: "El interior está recién reformado, con ascensor, aire acondicionado y terraza: algo poco común y valioso en esta parte de Gràcia. La última planta exterior aporta luz y tranquilidad. La calefacción individual mantiene los costes bajo tu control.",
          ca: "L'interior està acabat de reformar, amb ascensor, aire condicionat i terrassa: una cosa poc habitual i valuosa en aquesta part de Gràcia. L'àtic exterior aporta llum i tranquil·litat. La calefacció individual manté els costos sota el teu control.",
        },
      },
      {
        heading: {
          en: "What to scrutinise",
          es: "Lo que hay que escrutar",
          ca: "Què cal escrutar",
        },
        body: {
          en: "1965 structure (61 yrs) → ITE technical inspection is mandatory; demand the current valid certificate. Pre-2002 build → possible asbestos in old pipes/elements. Top floor → check the roof for damp and who pays for upkeep.",
          es: "Estructura de 1965 (61 años) → la inspección técnica ITE es obligatoria; exige el certificado vigente. Construcción anterior a 2002 → posible amianto en tuberías/elementos antiguos. Última planta → revisa la cubierta por humedades y quién paga su mantenimiento.",
          ca: "Estructura de 1965 (61 anys) → la inspecció tècnica ITE és obligatòria; exigeix el certificat vigent. Construcció anterior al 2002 → possible amiant en canonades/elements antics. Àtic → revisa la coberta per humitats i qui en paga el manteniment.",
        },
      },
    ],
    keyline: {
      en: "Reform ≠ structure. A nice kitchen doesn't fix a tired façade or roof. The reform is cosmetic value; the building's collective health (reserve fund, pending derramas) is the real risk — verify it in the community minutes (actas) before you commit.",
      es: "Reforma ≠ estructura. Una cocina bonita no arregla una fachada o cubierta cansadas. La reforma es valor estético; la salud colectiva del edificio (fondo de reserva, derramas pendientes) es el verdadero riesgo: verifícalo en las actas de la comunidad antes de comprometerte.",
      ca: "Reforma ≠ estructura. Una cuina bonica no arregla una façana o coberta cansades. La reforma és valor estètic; la salut col·lectiva de l'edifici (fons de reserva, derrames pendents) és el risc real: verifica-ho a les actes de la comunitat abans de comprometre't.",
    },
  },

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
        en: "PGA 0.04 g — standard for Barcelona.",
        es: "PGA 0,04 g — estándar para Barcelona.",
        ca: "PGA 0,04 g — estàndard a Barcelona.",
      },
    },
    {
      labelKey: "risk.radon",
      tone: "good",
      detail: {
        en: "Barcelona is a low-radon area; top floor makes it a non-issue.",
        es: "Barcelona es zona de radón bajo; la última planta lo hace irrelevante.",
        ca: "Barcelona és zona de radó baix; l'àtic ho fa irrellevant.",
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
        en: "61-yr building — confirm valid inspection & no major works pending.",
        es: "Edificio de 61 años — confirma inspección vigente y que no haya obras importantes pendientes.",
        ca: "Edifici de 61 anys — confirma inspecció vigent i que no hi hagi obres importants pendents.",
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

  legal: {
    intro: {
      en: "Nothing alarming has surfaced, but these are get-before-you-offer documents — not optional. A Clikalia purchase is usually clean on title, but verify everything in writing.",
      es: "No ha surgido nada alarmante, pero estos son documentos que debes conseguir antes de ofertar, no opcionales. Una compra a Clikalia suele estar limpia de título, pero verifica todo por escrito.",
      ca: "No ha sorgit res alarmant, però aquests són documents que has d'aconseguir abans d'ofertar, no són opcionals. Una compra a Clikalia sol estar neta de títol, però verifica-ho tot per escrit.",
    },
    items: [
      {
        en: "Updated nota simple — confirms ownership and any charges/mortgage on the property.",
        es: "Nota simple actualizada — confirma la titularidad y cualquier carga/hipoteca sobre el inmueble.",
        ca: "Nota simple actualitzada — confirma la titularitat i qualsevol càrrega/hipoteca sobre l'immoble.",
      },
      {
        en: "Cédula d'habitabilitat — mandatory to sell in Catalunya; check it's valid and unexpired.",
        es: "Cédula d'habitabilitat — obligatoria para vender en Cataluña; comprueba que es válida y no está caducada.",
        ca: "Cèdula d'habitabilitat — obligatòria per vendre a Catalunya; comprova que sigui vigent i no estigui caducada.",
      },
      {
        en: "Valid ITE certificate — the building's technical inspection report and any required actions.",
        es: "Certificado ITE vigente — el informe de inspección técnica del edificio y las actuaciones requeridas.",
        ca: "Certificat ITE vigent — l'informe d'inspecció tècnica de l'edifici i les actuacions requerides.",
      },
      {
        en: "Community minutes (actas), last 2–3 years — reveals reserve fund, votes, and pending works.",
        es: "Actas de la comunidad, últimos 2–3 años — revelan el fondo de reserva, votaciones y obras pendientes.",
        ca: "Actes de la comunitat, últims 2–3 anys — revelen el fons de reserva, votacions i obres pendents.",
      },
      {
        en: "Pending or approved derrama — confirm there's no special levy for façade/roof you'd inherit.",
        es: "Derrama pendiente o aprobada — confirma que no haya una derrama por fachada/cubierta que heredarías.",
        ca: "Derrama pendent o aprovada — confirma que no hi hagi una derrama per façana/coberta que heretaries.",
      },
      {
        en: "Updated energy certificate — the registered one is Class E (2022); ask for a post-reform CEE, it may now rate higher.",
        es: "Certificado energético actualizado — el registrado es Clase E (2022); pide un CEE posterior a la reforma, puede que ahora califique mejor.",
        ca: "Certificat energètic actualitzat — el registrat és Classe E (2022); demana un CEE posterior a la reforma, pot ser que ara qualifiqui millor.",
      },
      {
        en: "Surface check — confirm useful m² vs the ~80–82 m² on record.",
        es: "Comprobación de superficie — confirma los m² útiles frente a los ~80–82 m² registrados.",
        ca: "Comprovació de superfície — confirma els m² útils enfront dels ~80–82 m² registrats.",
      },
    ],
  },

  neighbourhood: {
    lede: {
      en: "Upper Vila de Gràcia, on the La Salut / Camp d'en Grassot edge — residential, well-served, and a short walk from one of Europe's most famous parks.",
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
      en: "Honest note: Park Güell proximity is a lifestyle plus but brings tourist foot-traffic on the upper streets. The reopening of the Abaceria market should lift the area further over the next two years.",
      es: "Nota honesta: la cercanía al Park Güell es un plus de estilo de vida, pero atrae tránsito turístico en las calles altas. La reapertura del mercado de l'Abaceria debería revalorizar la zona en los próximos dos años.",
      ca: "Nota honesta: la proximitat al Park Güell és un plus d'estil de vida, però atrau trànsit turístic als carrers alts. La reobertura del Mercat de l'Abaceria hauria de revaloritzar la zona els pròxims dos anys.",
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
          en: "Residential, build-ready land — standard for a mid-block flat in consolidated Gràcia.",
          es: "Suelo residencial y consolidado — lo normal para un piso a media manzana en la Gràcia consolidada.",
          ca: "Sòl residencial i consolidat — el que és habitual per a un pis a mitja illa en la Gràcia consolidada.",
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
          en: "~10–11% (tiered) — confirm 2026 rate",
          es: "~10–11% (por tramos) — confirma el tipo de 2026",
          ca: "~10–11% (per trams) — confirma el tipus de 2026",
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
      en: "Catalan ITP brackets were revised in 2025 — confirm the exact current rate with your gestor before budgeting. Reduced rates may apply (e.g. habitual residence, buyers ≤35, large families).",
      es: "Los tramos del ITP catalán se revisaron en 2025: confirma el tipo exacto vigente con tu gestor antes de presupuestar. Pueden aplicar tipos reducidos (p. ej. vivienda habitual, compradores ≤35 años, familia numerosa).",
      ca: "Els trams de l'ITP català es van revisar el 2025: confirma el tipus exacte vigent amb el teu gestor abans de pressupostar. Poden aplicar-se tipus reduïts (p. ex. habitatge habitual, compradors ≤35 anys, família nombrosa).",
    },
  },

  subsidies: {
    panels: [
      {
        heading: { en: "Still available", es: "Aún disponible", ca: "Encara disponible" },
        body: {
          en: "IRPF energy deductions — 20% / 40% / 60% income-tax relief for qualifying efficiency works. Useful if you upgrade windows or insulation later.",
          es: "Deducciones de IRPF por eficiencia — desgravación del 20% / 40% / 60% por obras que cumplan requisitos. Útil si más adelante mejoras ventanas o aislamiento.",
          ca: "Deduccions d'IRPF per eficiència — desgravació del 20% / 40% / 60% per obres que compleixin els requisits. Útil si més endavant millores finestres o aïllament.",
        },
      },
      {
        heading: { en: "Closing window", es: "Ventana que se cierra", ca: "Finestra que es tanca" },
        body: {
          en: "Next Generation grants (40–80% of works, up to ~€21k/home) are largely exhausted/waitlisted in Catalonia and must be justified by 30 June 2026 — don't count on them for a future reform.",
          es: "Las ayudas Next Generation (40–80% de la obra, hasta ~21.000 €/vivienda) están en gran parte agotadas o en lista de espera en Cataluña y deben justificarse antes del 30 de junio de 2026: no cuentes con ellas para una reforma futura.",
          ca: "Els ajuts Next Generation (40–80% de l'obra, fins a ~21.000 €/habitatge) estan en gran part exhaurits o en llista d'espera a Catalunya i s'han de justificar abans del 30 de juny de 2026: no comptis amb ells per a una reforma futura.",
        },
      },
    ],
  },

  negotiation: {
    intro: {
      en: "The price is fair, so this is fine-tuning, not a battle. Three legitimate levers:",
      es: "El precio es justo, así que esto es afinar, no una batalla. Tres palancas legítimas:",
      ca: "El preu és just, així que això és afinar, no una batalla. Tres palanques legítimes:",
    },
    items: [
      {
        en: "It's a professional flip. Clikalia bought to resell — there's built-in margin, and a clean, fast close is worth real money to them.",
        es: "Es una reventa profesional. Clikalia compró para revender: hay margen incorporado, y un cierre limpio y rápido vale dinero real para ellos.",
        ca: "És una revenda professional. Clikalia va comprar per revendre: hi ha marge incorporat, i un tancament net i ràpid val diners reals per a ells.",
      },
      {
        en: "Building age & ITE. A 61-year-old building with inspection obligations and an unknown reserve fund is a fair basis for trimming the number.",
        es: "Edad del edificio e ITE. Un edificio de 61 años con obligaciones de inspección y un fondo de reserva desconocido es base justa para recortar la cifra.",
        ca: "Edat de l'edifici i ITE. Un edifici de 61 anys amb obligacions d'inspecció i un fons de reserva desconegut és una base justa per retallar la xifra.",
      },
      {
        en: "Asking ≠ closing. Even in a strong barrio, listed prices usually settle a little lower — room for a measured ask, not a lowball.",
        es: "Oferta ≠ cierre. Incluso en un barrio fuerte, los precios anunciados suelen cerrarse algo más bajos: hay margen para una propuesta medida, no para una oferta a la baja agresiva.",
        ca: "Oferta ≠ tancament. Fins i tot en un barri fort, els preus anunciats solen tancar-se una mica més baixos: hi ha marge per a una proposta mesurada, no per a una oferta a la baixa agressiva.",
      },
    ],
    tactic: {
      en: "Tactic: open around €438k on building-age and flip grounds, settle near €448k. Make any offer conditional on receiving valid ITE, cédula and clean community minutes — that protects you and is the cleanest justification for shaving the price.",
      es: "Táctica: abre en torno a 438.000 € por la edad del edificio y la reventa, cierra cerca de 448.000 €. Condiciona cualquier oferta a recibir una ITE vigente, la cédula y unas actas de comunidad limpias: eso te protege y es la justificación más limpia para rebajar el precio.",
      ca: "Tàctica: obre al voltant de 438.000 € per l'edat de l'edifici i la revenda, tanca prop dels 448.000 €. Condiciona qualsevol oferta a rebre una ITE vigent, la cèdula i unes actes de comunitat netes: això et protegeix i és la justificació més neta per rebaixar el preu.",
    },
  },

  checklist: [
    {
      en: "Count the mailboxes/doorbells → real number of neighbours.",
      es: "Cuenta los buzones/timbres → número real de vecinos.",
      ca: "Compta les bústies/timbres → nombre real de veïns.",
    },
    {
      en: "Collect: nota simple, cédula, valid ITE, división horizontal, 2–3 yrs of actas.",
      es: "Reúne: nota simple, cédula, ITE vigente, división horizontal, 2–3 años de actas.",
      ca: "Recull: nota simple, cèdula, ITE vigent, divisió horitzontal, 2–3 anys d'actes.",
    },
    {
      en: "Ask directly about any derrama voted or pending, and the reserve fund balance.",
      es: "Pregunta directamente por cualquier derrama votada o pendiente y por el saldo del fondo de reserva.",
      ca: "Pregunta directament per qualsevol derrama votada o pendent i pel saldo del fons de reserva.",
    },
    {
      en: "Inspect the roof / top-floor ceilings for damp; confirm lift maintenance status.",
      es: "Inspecciona la cubierta / techos de la última planta por humedades; confirma el estado de mantenimiento del ascensor.",
      ca: "Inspecciona la coberta / sostres de l'àtic per humitats; confirma l'estat de manteniment de l'ascensor.",
    },
    {
      en: "Request an updated post-reform energy certificate.",
      es: "Solicita un certificado energético actualizado tras la reforma.",
      ca: "Sol·licita un certificat energètic actualitzat després de la reforma.",
    },
    {
      en: "Confirm the useful m² and that the reform had permits (if structural).",
      es: "Confirma los m² útiles y que la reforma tuvo permisos (si fue estructural).",
      ca: "Confirma els m² útils i que la reforma va tenir permisos (si va ser estructural).",
    },
    {
      en: "Get your mortgage decision-in-principle aligned before making a written offer.",
      es: "Consigue tu acuerdo hipotecario previo antes de hacer una oferta por escrito.",
      ca: "Aconsegueix el teu acord hipotecari previ abans de fer una oferta per escrit.",
    },
  ],

  footer: {
    sources: {
      en: "Sources & method. Compiled from public data: Dirección General del Catastro (cadastral record); idealista and Fotocasa barrio-level price indices for Vila de Gràcia (mid-2026); notarial closing data via district market trackers; Ajuntament de Barcelona (crime & ZBE); MITECO/SNCZI (flood); Generalitat / ICAEN (subsidies). Portal asking-price averages differ by sample (idealista €5,761/m² vs Fotocasa €6,712/m² for the same barrio) and sit above actual closings — both are shown for transparency. Scores are an independent editorial assessment.",
      es: "Fuentes y método. Recopilado a partir de datos públicos: Dirección General del Catastro (registro catastral); índices de precios a nivel de barrio de idealista y Fotocasa para la Vila de Gràcia (mediados de 2026); datos de cierre notariales mediante observatorios de mercado de distrito; Ajuntament de Barcelona (delincuencia y ZBE); MITECO/SNCZI (inundación); Generalitat / ICAEN (ayudas). Las medias de precio de oferta de los portales difieren por muestra (idealista 5.761 €/m² frente a Fotocasa 6.712 €/m² para el mismo barrio) y están por encima de los cierres reales: se muestran ambas por transparencia. Las puntuaciones son una valoración editorial independiente.",
      ca: "Fonts i mètode. Recopilat a partir de dades públiques: Dirección General del Catastro (registre cadastral); índexs de preus a nivell de barri d'idealista i Fotocasa per a la Vila de Gràcia (mitjans de 2026); dades de tancament notarials mitjançant observatoris de mercat de districte; Ajuntament de Barcelona (delinqüència i ZBE); MITECO/SNCZI (inundació); Generalitat / ICAEN (ajuts). Les mitjanes de preu d'oferta dels portals difereixen per mostra (idealista 5.761 €/m² enfront de Fotocasa 6.712 €/m² per al mateix barri) i estan per sobre dels tancaments reals: es mostren totes dues per transparència. Les puntuacions són una valoració editorial independent.",
    },
    disclaimer: {
      en: "Not formal advice. This dossier is an orientation tool and does not replace a professional technical survey, legal review, or mortgage valuation. Figures marked \"estimate\" or \"~\" should be confirmed with your gestor, lawyer and bank before you commit.",
      es: "No es asesoramiento formal. Este dosier es una herramienta de orientación y no sustituye un informe técnico profesional, una revisión legal ni una tasación hipotecaria. Las cifras marcadas como \"estimación\" o \"~\" deben confirmarse con tu gestor, abogado y banco antes de comprometerte.",
      ca: "No és assessorament formal. Aquest dossier és una eina d'orientació i no substitueix un informe tècnic professional, una revisió legal ni una taxació hipotecària. Les xifres marcades com a \"estimació\" o \"~\" s'han de confirmar amb el teu gestor, advocat i banc abans de comprometre't.",
    },
  },
};
