import type { Report, Localized, Score } from "@/types/report";
import type { CatastroData } from "@/adapters/catastro";
import type { AmenityData, NearestPlace } from "@/adapters/amenities";
import type { UrbanismData } from "@/adapters/urbanism";
import type { AffectationData } from "@/adapters/affectation";
import type { HeritageData, HeritageLevel } from "@/adapters/heritage";
import type { EnergyData } from "@/adapters/energy";
import type { FloodData } from "@/adapters/flood";
import { SEISMIC, RADON, crimeContext } from "@/config/static-risk";
import { buildCostFacts, buildSubsidyPanels } from "@/config/costs";
import { buildBuilding } from "@/config/building";
import { buildLegal } from "@/config/legal";
import { buildFooter } from "@/config/footer";
import type { CompListing } from "@/adapters/idealista";
import type { CompRow } from "@/types/report";
import type { ReportInput } from "@/types/db";
import { scoreOrder, type ScoreKey } from "@/config/scoring";

const EMPTY: Localized = { en: "", es: "" };

/** A structurally-complete but blank Report the operator fills in / edits. */
export function emptyReport(id: string, cadastralRef: string): Report {
  return {
    id,
    generatedAt: new Date().toISOString().slice(0, 10),
    cadastralRef,
    hero: { title: "", floorLabel: { ...EMPTY }, sub: { ...EMPTY }, meta: [] },
    verdict: {
      headline: { ...EMPTY },
      body: { ...EMPTY },
      overall: 0,
      tag: { ...EMPTY },
    },
    alerts: [],
    scores: [],
    snapshot: { facts: [], note: { ...EMPTY } },
    price: {
      lede: { ...EMPTY },
      panels: [],
      comps: [],
      fairValue: { ...EMPTY },
      ladder: [],
    },
    building: { panels: [], keyline: { ...EMPTY } },
    risks: [],
    legal: { intro: { ...EMPTY }, items: [] },
    neighbourhood: { lede: { ...EMPTY }, facts: [], note: { ...EMPTY } },
    urbanism: { body: { ...EMPTY } },
    costs: { intro: { ...EMPTY }, facts: [], footnote: { ...EMPTY } },
    subsidies: { panels: [] },
    negotiation: { intro: { ...EMPTY }, items: [], tactic: { ...EMPTY } },
    checklist: [],
    footer: { sources: { ...EMPTY }, disclaimer: { ...EMPTY } },
  };
}

const both = (s: string): Localized => ({ en: s, es: s });

/**
 * Prefill the snapshot + hero meta from Catastro facts. Only the deterministic,
 * sourced fields are touched; everything qualitative is left for the operator
 * (and, in Phase 3, the AI narrative layer).
 */
export function seedFromCatastro(
  report: Report,
  input: ReportInput,
  cat: CatastroData,
): Report {
  const { unit, parcel } = cat;
  const r: Report = structuredClone(report);

  // Hero title: street + number from the Catastro address label.
  const street = unit.addressLabel?.split(" Pl:")[0]?.trim();
  if (street) r.hero.title = street;
  if (unit.floor || unit.door) {
    r.hero.floorLabel = both(
      [unit.floor && `Fl. ${unit.floor}`, unit.door && `Dr. ${unit.door}`]
        .filter(Boolean)
        .join(" · "),
    );
  }

  // Hero meta strip.
  if (input.askingPriceEur) {
    r.hero.meta.push({
      labelKey: "meta.asking",
      value: `€${input.askingPriceEur.toLocaleString("en-GB")}`,
      accent: true,
    });
    const m2 = input.builtM2 ?? unit.builtAreaM2;
    if (m2) {
      r.hero.meta.push({
        labelKey: "meta.pricePerM2",
        value: `€${Math.round(input.askingPriceEur / m2).toLocaleString("en-GB")}`,
      });
    }
  }
  if (unit.yearBuilt) {
    r.hero.meta.push({ labelKey: "meta.built", value: String(unit.yearBuilt) });
  }

  // Snapshot facts (deterministic, sourced from Catastro).
  const facts = r.snapshot.facts;
  if (unit.addressLabel)
    facts.push({ labelKey: "snapshot.address", value: unit.addressLabel });
  if (unit.builtAreaM2)
    facts.push({
      labelKey: "snapshot.builtArea",
      value: `${unit.builtAreaM2} m²`,
    });
  if (unit.usableAreaM2)
    facts.push({
      labelKey: "snapshot.usableArea",
      value: `${unit.usableAreaM2} m²`,
    });
  if (unit.yearBuilt)
    facts.push({
      labelKey: "snapshot.yearBuilt",
      value: both(`${unit.yearBuilt}`),
    });
  facts.push({ labelKey: "snapshot.cadastralRef", value: unit.cadastralRef });

  // The signature "how many flats in the building" note.
  r.snapshot.note = {
    en: `The cadastral parcel contains ${parcel.unitCount} units in total — so this is a multi-unit building, not a single home. Confirm the true count on-site (count the mailboxes) and via the building's división horizontal.`,
    es: `La parcela catastral contiene ${parcel.unitCount} unidades en total, así que es un edificio de varias viviendas, no una casa única. Confirma el número real in situ (cuenta los buzones) y mediante la división horizontal del edificio.`,
  };

  return r;
}

/* ---------- amenities → neighbourhood facts ---------- */

function near(p: NearestPlace | undefined): Localized | null {
  if (!p) return null;
  const txt = p.name ? `${p.name} · ~${p.walkMin} min` : `~${p.walkMin} min`;
  return { en: txt, es: txt };
}

export function seedAmenities(report: Report, a: AmenityData): Report {
  const r: Report = structuredClone(report);
  const facts = r.neighbourhood.facts;
  const push = (labelKey: string, value: Localized | null) => {
    if (value) facts.push({ labelKey, value });
  };

  if (a.metro.names.length || a.metro.nearest) {
    const names = a.metro.names.slice(0, 3).join(", ");
    const mins = a.metro.nearest?.walkMin;
    push("neigh.metro", {
      en: `${names || "Metro"}${mins ? ` · ~${mins} min` : ""} (${a.metro.within800} within 800 m)`,
      es: `${names || "Metro"}${mins ? ` · ~${mins} min` : ""} (${a.metro.within800} a 800 m)`,
    });
  }
  push("neigh.health", near(a.health.nearest));
  push("neigh.green", near(a.green.nearest));
  push("neigh.shopping", near(a.supermarket.nearest));
  push("neigh.market", near(a.market.nearest));
  if (a.schools.within1000 > 0) {
    push("neigh.schools", {
      en: `${a.schools.within1000} within ~10 min walk`,
      es: `${a.schools.within1000} a ~10 min a pie`,
    });
  }
  return r;
}

/* ---------- comparable listings (idealista API) → comps table ---------- */

const eur = (n: number) => `€${Math.round(n).toLocaleString("en-GB")}`;

export function seedComps(
  report: Report,
  opts: { askingPriceEur?: number; builtM2?: number; comps: CompListing[] },
): Report {
  const r: Report = structuredClone(report);
  const rows: CompRow[] = [];

  // Subject property row (highlighted).
  if (opts.askingPriceEur) {
    const m2 = opts.builtM2;
    rows.push({
      reference: { en: "This flat", es: "Este piso" },
      price: eur(opts.askingPriceEur),
      size: m2 ? `${m2} m²` : undefined,
      pricePerM2: m2 ? Math.round(opts.askingPriceEur / m2).toLocaleString("en-GB") : undefined,
      note: { en: "Subject property", es: "Inmueble objeto" },
      highlight: true,
    });
  }

  for (const c of opts.comps) {
    rows.push({
      reference: c.neighborhood || c.address || "Comparable",
      price: eur(c.price),
      size: c.size ? `${c.size} m²` : undefined,
      pricePerM2: c.pricePerM2 ? Math.round(c.pricePerM2).toLocaleString("en-GB") : undefined,
      note: {
        en: `${c.rooms ?? "?"} bed · ${c.bathrooms ?? "?"} bath`,
        es: `${c.rooms ?? "?"} hab · ${c.bathrooms ?? "?"} baños`,
      },
      url: c.url,
    });
  }

  r.price.comps = rows;
  return r;
}

/** Median asking €/m² across comparables, for grounding the AI read. */
export function compsMedianPerM2(comps: CompListing[]): number | null {
  const vals = comps
    .map((c) => c.pricePerM2)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
}

/* ---------- building & condition + legal (deterministic) ---------- */

export function seedBuilding(report: Report, yearBuilt?: number): Report {
  const r: Report = structuredClone(report);
  const { panels, keyline } = buildBuilding(yearBuilt);
  r.building.panels = panels;
  r.building.keyline = keyline;
  return r;
}

export function seedLegal(report: Report): Report {
  const r: Report = structuredClone(report);
  const { intro, items } = buildLegal();
  r.legal.intro = intro;
  r.legal.items = items;
  return r;
}

export function seedFooter(report: Report): Report {
  const r: Report = structuredClone(report);
  const { sources, disclaimer } = buildFooter({
    hasComps: r.price.comps.some((c) => !c.highlight),
  });
  r.footer.sources = sources;
  r.footer.disclaimer = disclaimer;
  return r;
}

/* ---------- costs & taxes (deterministic, maintained) ---------- */

export function seedCostsTaxes(report: Report, askingPriceEur?: number): Report {
  const r: Report = structuredClone(report);
  const { intro, facts, footnote } = buildCostFacts(askingPriceEur);
  r.costs.intro = intro;
  r.costs.facts = facts;
  r.costs.footnote = footnote;
  r.subsidies.panels = buildSubsidyPanels();
  return r;
}

/* ---------- price reference links (buyer compares themselves) ---------- */

export function seedPriceRefs(report: Report): Report {
  const r: Report = structuredClone(report);
  const street = r.hero.title || "";
  const searchQ = encodeURIComponent(
    `${street} Barcelona precio venta piso`.trim(),
  );

  const refs: NonNullable<Report["price"]["references"]> = [
    {
      kind: "official",
      label: {
        en: "Catastro — official reference value (valor de referencia)",
        es: "Catastro — valor de referencia oficial",
      },
      url: "https://www.sedecatastro.gob.es/Accesos/SECAccvr.aspx",
    },
    {
      kind: "official",
      label: {
        en: "Ministerio de Vivienda — transaction price statistics",
        es: "Ministerio de Vivienda — estadística de precios de transacción",
      },
      url: "https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/precios-vivienda",
    },
    {
      kind: "official",
      label: {
        en: "Col·legi de Registradors — closing-price statistics",
        es: "Col·legi de Registradors — estadística de precios de cierre",
      },
      url: "https://www.registradores.org/-/estadistica-registral-inmobiliaria",
    },
    {
      kind: "portal",
      label: {
        en: "idealista — Barcelona published price report (asking)",
        es: "idealista — informe de precios de Barcelona (oferta)",
      },
      url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/barcelona-provincia/barcelona-capital/",
    },
    {
      kind: "portal",
      label: {
        en: "Fotocasa — Barcelona real-estate index (asking)",
        es: "Fotocasa — índice inmobiliario de Barcelona (oferta)",
      },
      url: "https://www.fotocasa.es/es/indice-inmobiliario__1/",
    },
    {
      kind: "search",
      label: {
        en: "Find current listings near this address",
        es: "Buscar anuncios actuales cerca de esta dirección",
      },
      url: `https://www.google.com/search?q=${searchQ}`,
    },
  ];

  r.price.references = refs;
  return r;
}

/* ---------- energy certificate → meta + risk row ---------- */

export function seedEnergy(report: Report, e: EnergyData): Report {
  const r: Report = structuredClone(report);
  const cls = e.consumptionClass;
  if (!cls) return r;

  const year = e.dateRegistered?.slice(0, 4);
  r.hero.meta.push({
    labelKey: "meta.energy",
    value: { en: `Class ${cls}`, es: `Clase ${cls}` },
  });

  const tone: "good" | "ok" | "low" =
    "ABC".includes(cls) ? "good" : "DE".includes(cls) ? "ok" : "low";
  const detailBits = [
    e.primaryEnergyKwh ? `${Math.round(e.primaryEnergyKwh)} kWh/m²·yr` : null,
    year ? `reg. ${year}` : null,
  ].filter(Boolean);
  const detailBitsEs = [
    e.primaryEnergyKwh ? `${Math.round(e.primaryEnergyKwh)} kWh/m²·año` : null,
    year ? `reg. ${year}` : null,
  ].filter(Boolean);

  r.risks.push({
    labelKey: "risk.energy",
    tone,
    detail: {
      en: `Class ${cls}${detailBits.length ? ` · ${detailBits.join(" · ")}` : ""}.${
        tone !== "good"
          ? " Higher bills; future EU rules may pressure low-rated homes' value."
          : ""
      }`,
      es: `Clase ${cls}${detailBitsEs.length ? ` · ${detailBitsEs.join(" · ")}` : ""}.${
        tone !== "good"
          ? " Facturas más altas; futuras normas de la UE pueden presionar el valor de viviendas con baja calificación."
          : ""
      }`,
    },
  });
  return r;
}

/* ---------- natural risks + crime → Risk & Safety (section 05) ---------- */

export function seedRisks(
  report: Report,
  opts: { flood?: FloodData; districtCode?: number; yearBuilt?: number },
): Report {
  const r: Report = structuredClone(report);

  if (opts.flood) {
    const lvl = opts.flood.level;
    const tone: "good" | "ok" | "low" =
      lvl === "low" ? "good" : lvl === "medium" ? "ok" : "low";
    const detail: Localized =
      lvl === "low"
        ? {
            en: "Not in a SNCZI fluvial flood-risk zone.",
            es: "No está en zona de riesgo de inundación fluvial (SNCZI).",
          }
        : lvl === "medium"
          ? {
              en: "Within the T100 (medium-probability) flood zone — verify with a hydraulic study.",
              es: "Dentro de la zona inundable T100 (probabilidad media) — verifícalo con un estudio hidráulico.",
            }
          : {
              en: "Within the T10 (high-frequency) flood zone — significant flood risk; seek specialist advice.",
              es: "Dentro de la zona inundable T10 (alta frecuencia) — riesgo de inundación significativo; busca asesoramiento especializado.",
            };
    r.risks.push({ labelKey: "risk.flood", tone, detail });
  }

  // Static (Barcelona-wide) seismic + radon.
  r.risks.push({ labelKey: "risk.seismic", tone: SEISMIC.tone, detail: SEISMIC.detail });
  r.risks.push({ labelKey: "risk.radon", tone: RADON.tone, detail: RADON.detail });

  // Building-age flags derived from the Catastro year.
  if (opts.yearBuilt) {
    const age = new Date().getFullYear() - opts.yearBuilt;
    if (age >= 45) {
      r.risks.push({
        labelKey: "risk.ite",
        tone: "ok",
        detail: {
          en: `${age}-year building — a valid ITE technical inspection is mandatory; confirm it and any pending works.`,
          es: `Edificio de ${age} años — la ITE (inspección técnica) es obligatoria; confírmala y las obras pendientes.`,
        },
      });
    }
    if (opts.yearBuilt < 2002) {
      r.risks.push({
        labelKey: "risk.asbestos",
        tone: "ok",
        detail: {
          en: "Pre-2002 build — possible asbestos in legacy installations; usually low-cost if isolated.",
          es: "Construcción anterior a 2002 — posible amianto en instalaciones antiguas; normalmente de bajo coste si está aislado.",
        },
      });
    }
  }

  // District-level crime context.
  const crime = crimeContext(opts.districtCode);
  r.risks.push({ labelKey: "risk.crime", tone: crime.tone, detail: crime.detail });

  return r;
}

/* ---------- urbanistic situation → section 08 ---------- */

/**
 * Seed the urbanism section + top-of-report affectation alert.
 *
 * The affectation verdict prefers the official Ajuntament AFH service (`a`):
 * category A → affected, C/D → specific circumstances, B → clear. When the AFH
 * service is unavailable, it falls back to the qualification inference in `u`
 * (a system clau touching the parcel → possible affectation).
 */
export function seedUrbanism(
  report: Report,
  u: UrbanismData,
  a?: AffectationData,
): Report {
  const r: Report = structuredClone(report);
  const cls = u.classification;
  const q = u.qualification;
  const code = u.qualCode ? ` (clau ${u.qualCode})` : "";

  // Name the specific systems touching the finca, e.g. "7a — Equipaments
  // actuals; viari — Xarxa viària", so the buyer sees exactly what's affected.
  const affList = u.affectations
    .map((af) => (af.name ? `${af.clau} — ${af.name}` : af.clau))
    .join("; ");
  const systemsClause = affList
    ? { en: ` (${affList})`, es: ` (${affList})` }
    : { en: "", es: "" };

  // Unified verdict: AFH category if present, else the qualification inference.
  const level: "affected" | "specific" | "clear" = a
    ? a.category === "A"
      ? "affected"
      : a.category === "B"
        ? "clear"
        : "specific"
    : u.possibleAffectation
      ? "affected"
      : "clear";
  // AFH gives a confirmed call; the inference is only a "possible" affectation.
  const confirmed = Boolean(a);

  const affEn =
    level === "affected"
      ? `⚠ ${confirmed ? "The Ajuntament flags this finca as carrying an urbanistic affectation" : "Part of the finca carries a system qualification, a possible urbanistic affectation"}${systemsClause.en}. An affectation can limit works, reduce value, or expose the property to expropriation — verify it urgently with a certificat urbanístic before offering.`
      : level === "specific"
        ? "⚠ The Ajuntament flags specific urbanistic circumstances for this finca (e.g. a plan in progress, an urban-management area, suspended licences, or a court ruling). Check what applies before offering."
        : "No urbanistic affectation impeding housing use was found for this finca.";
  const affEs =
    level === "affected"
      ? `⚠ ${confirmed ? "El Ayuntamiento señala que esta finca tiene una afectación urbanística" : "Parte de la finca tiene una calificación de sistema, una posible afectación urbanística"}${systemsClause.es}. Una afectación puede limitar obras, reducir el valor o exponer el inmueble a expropiación: verifícalo con urgencia con un certificado urbanístico antes de ofertar.`
      : level === "specific"
        ? "⚠ El Ayuntamiento señala circunstancias urbanísticas específicas para esta finca (p. ej. un planeamiento en trámite, un ámbito de gestión urbanística, licencias suspendidas o una sentencia). Comprueba qué aplica antes de ofertar."
        : "No se ha encontrado ninguna afectación urbanística que impida el uso como vivienda en esta finca.";

  r.urbanism.body = {
    en: `${cls ? `Land classification: ${cls}. ` : ""}${
      q ? `Planning qualification: ${q}${code}. ` : ""
    }${affEn} All of Barcelona inside the Rondes is within the ZBE low-emissions zone (only relevant if you keep a non-compliant car). This is orientation only — confirm the definitive status with an official certificat urbanístic from the Ajuntament before committing.`,
    es: `${cls ? `Clasificación del suelo: ${cls}. ` : ""}${
      q ? `Calificación urbanística: ${q}${code}. ` : ""
    }${affEs} Toda Barcelona dentro de las Rondas está en la ZBE (Zona de Bajas Emisiones; solo relevante si mantienes un coche sin etiqueta). Esto es orientativo: confirma el estado definitivo con un certificado urbanístico oficial del Ayuntamiento antes de comprometerte.`,
  };

  // Surface a serious finding at the top of the report, not just in the section.
  if (level === "affected") {
    r.alerts = [
      ...(r.alerts ?? []),
      {
        tone: "caution",
        title: {
          en: confirmed ? "Urbanistic affectation" : "Possible urbanistic affectation",
          es: confirmed ? "Afectación urbanística" : "Posible afectación urbanística",
        },
        detail: {
          en: `${confirmed ? "The Ajuntament flags this finca as affected" : "Part of the finca is qualified as a system"}${systemsClause.en}. It can limit works, reduce value, or expose the property to expropriation. Confirm with a certificat urbanístic before offering.`,
          es: `${confirmed ? "El Ayuntamiento señala esta finca como afectada" : "Parte de la finca está calificada como sistema"}${systemsClause.es}. Puede limitar obras, reducir el valor o exponer el inmueble a expropiación. Confírmalo con un certificado urbanístico antes de ofertar.`,
        },
      },
    ];
  } else if (level === "specific") {
    r.alerts = [
      ...(r.alerts ?? []),
      {
        tone: "check",
        title: {
          en: "Specific urbanistic circumstances",
          es: "Circunstancias urbanísticas específicas",
        },
        detail: {
          en: "The Ajuntament flags specific circumstances for this finca (a plan in progress, an urban-management area, suspended licences, or a court ruling). Check what applies before offering.",
          es: "El Ayuntamiento señala circunstancias específicas para esta finca (un planeamiento en trámite, un ámbito de gestión urbanística, licencias suspendidas o una sentencia). Comprueba qué aplica antes de ofertar.",
        },
      },
    ];
  }
  return r;
}

const HERITAGE_LEVEL: Record<HeritageLevel, Localized> = {
  A: {
    en: "Bé Cultural d'Interès Nacional (BCIN — the strictest level)",
    es: "Bien Cultural de Interés Nacional (BCIN, el nivel más estricto)",
  },
  B: {
    en: "Bé Cultural d'Interès Local (BCIL)",
    es: "Bien Cultural de Interés Local (BCIL)",
  },
  C: {
    en: "Bé d'Interès Urbanístic",
    es: "Bien de Interés Urbanístico",
  },
  D: {
    en: "Bé d'Interès Documental (the lightest level)",
    es: "Bien de Interés Documental (el nivel más leve)",
  },
};

/**
 * Append architectural-heritage protection to the urbanism section, and raise a
 * top-of-report alert for a building-specific listing (A/B → caution, C/D →
 * check). An area-wide ensemble (e.g. the whole Eixample) is reported as context
 * only, never an alert — almost every Eixample finca is inside one.
 * Run AFTER seedUrbanism, which authors the section body this appends to.
 */
export function seedHeritage(report: Report, h: HeritageData): Report {
  const r: Report = structuredClone(report);

  if (h.level) {
    const lvl = HERITAGE_LEVEL[h.level];
    const name = h.name ? `${h.name} — ` : "";
    const meta = [h.style, h.epoch].filter(Boolean).join(", ");
    const metaClause = meta ? ` (${meta})` : "";
    const sentenceEn = ` Heritage: this building is catalogued — ${name}${lvl.en}${metaClause}. Listing restricts façade and often interior changes; expect special permits, higher renovation costs, and longer timelines.`;
    const sentenceEs = ` Patrimonio: este edificio está catalogado — ${name}${lvl.es}${metaClause}. La protección limita los cambios en fachada y a menudo en el interior; prevé permisos especiales, mayores costes de reforma y plazos más largos.`;
    r.urbanism.body = {
      en: `${r.urbanism.body.en}${sentenceEn}`,
      es: `${r.urbanism.body.es}${sentenceEs}`,
    };

    const high = h.level === "A" || h.level === "B";
    r.alerts = [
      ...(r.alerts ?? []),
      {
        tone: high ? "caution" : "check",
        title: {
          en: high ? "Heritage-protected building" : "Catalogued building",
          es: high ? "Edificio protegido (patrimonio)" : "Edificio catalogado",
        },
        detail: {
          en: `${h.name ? `${h.name}. ` : ""}${lvl.en}. Heritage protection restricts works (façade/interior), needs special permits, and raises renovation cost and time. Check the catalog file before offering.`,
          es: `${h.name ? `${h.name}. ` : ""}${lvl.es}. La protección patrimonial limita las obras (fachada/interior), exige permisos especiales y aumenta el coste y el plazo de reforma. Consulta la ficha del catálogo antes de ofertar.`,
        },
      },
    ];
  } else if (h.inEnsemble) {
    const ens = h.ensembleName ?? "a protected ensemble";
    r.urbanism.body = {
      en: `${r.urbanism.body.en} Heritage: the building sits within a protected ensemble (${ens}); façade interventions are regulated, though there is no building-specific listing.`,
      es: `${r.urbanism.body.es} Patrimonio: el edificio está dentro de un conjunto protegido (${ens}); las intervenciones en fachada están reguladas, aunque no hay una catalogación específica del edificio.`,
    };
  }
  return r;
}

/* ---------- computed scores → score rings ---------- */

const SCORE_CAPTION: Record<ScoreKey, (ctx: ScoreCtx) => Localized> = {
  building: ({ year }) => ({
    en: year ? `${year} · ${new Date().getFullYear() - year} yrs` : "—",
    es: year ? `${year} · ${new Date().getFullYear() - year} años` : "—",
  }),
  energy: ({ energyClass }) => ({
    en: energyClass ? `Class ${energyClass}` : "—",
    es: energyClass ? `Clase ${energyClass}` : "—",
  }),
  transport: ({ amenities }) => {
    const m = amenities?.metro;
    return {
      en: m?.within800 ? `${m.within800} metro within 800 m` : "Limited metro",
      es: m?.within800 ? `${m.within800} metros a 800 m` : "Metro limitado",
    };
  },
  location: ({ amenities }) => {
    const g = amenities?.green.nearest;
    return {
      en: g ? `Green ~${g.walkMin} min` : "Urban",
      es: g ? `Zona verde ~${g.walkMin} min` : "Urbano",
    };
  },
  price: () => ({ en: "Awaiting comps", es: "Pendiente de comparables" }),
};

interface ScoreCtx {
  year?: number;
  energyClass?: string;
  amenities?: AmenityData;
}

export function seedScores(
  report: Report,
  values: Partial<Record<ScoreKey, number>>,
  overall: number | null,
  ctx: ScoreCtx,
): Report {
  const r: Report = structuredClone(report);
  const scores: Score[] = [];
  for (const key of scoreOrder) {
    const value = values[key];
    if (value == null) continue;
    scores.push({ key, value, caption: SCORE_CAPTION[key](ctx) });
  }
  r.scores = scores;
  if (overall != null) r.verdict.overall = overall;
  return r;
}
