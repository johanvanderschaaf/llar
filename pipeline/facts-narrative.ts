import type { Localized, NegReason, Report } from "@/types/report";
import type { AmenityData } from "@/adapters/amenities";
import type { AffectationCategory } from "@/adapters/affectation";
import type { HeritageLevel } from "@/adapters/heritage";
import type { FloodLevel } from "@/adapters/flood";
import { localizePeriod } from "@/lib/period";
import { L, type L3, cap, dotted, fewSalesNote, money, perM2, prep } from "@/lib/phrasing";

/**
 * Fact-based prose for the parts of the report that used to come only from the
 * AI narrative: the hero subtitle, the bottom line, the neighbourhood lede and
 * note, the negotiation playbook and the pre-offer checklist.
 *
 * Why: the AI narrative runs only after a paid unlock, and only when it
 * succeeds. Without this, every free preview showed an empty bottom line and a
 * failed AI call left paying buyers without a playbook or checklist. These
 * builders are pure functions of verified pipeline facts, written in the
 * report's facts-first voice; when the AI narrative runs it overwrites them
 * with richer prose, and when it doesn't, these stay.
 *
 * Voice rules (docs/report-review-tracker.md): facts first, no price verdicts
 * ("good deal"), no em-dashes, no emoji, no listing attributes we don't ingest
 * (condition, bedrooms, lift, terrace, seller).
 */

/** What the pipeline established. `checked: false` = the source failed. */
export interface FactsContext {
  builtM2?: number;
  /** Build year used for age checks (the original one for a renovated listed building). */
  yearBuilt?: number;
  /** Catastro's year when it is a full renovation of an older listed building. */
  renovatedYear?: number;
  /** Original date as the heritage catalogue writes it, e.g. "1898–1900". */
  yearLabel?: string;
  /** Barri (neighbourhood) name from the pricing lookup. */
  barri?: string;
  /** District name from Catastro, used when no barri is known. */
  district?: string;
  askingPriceEur?: number;
  energyClass?: string;
  energyChecked: boolean;
  affectation: { checked: boolean; category?: AffectationCategory };
  heritage: { checked: boolean; level?: HeritageLevel; inEnsemble?: boolean };
  flood: { checked: boolean; level?: FloodLevel };
  amenities?: AmenityData;
}

const join = (parts: L3[]): L3 =>
  L(
    parts.map((p) => p.en).filter(Boolean).join(" "),
    parts.map((p) => p.es).filter(Boolean).join(" "),
    parts.map((p) => p.ca).filter(Boolean).join(" "),
  );

const ITE_AGE = 45;

/** English article for a spoken number: "an 8…", "an 11", "an 18", else "a". */
const aOrAn = (n: number) => (n === 11 || n === 18 || String(n).startsWith("8") ? "An" : "A");
const ASBESTOS_BEFORE = 2002;

/**
 * Barri names keep their Catalan article ("el Raval", "la Vila de Gràcia").
 * English capitalises it ("El Raval"); Spanish and Catalan contract it after
 * a preposition ("del Raval", "al Raval", "dels Penitents").
 */
function placeName(ctx: FactsContext): string {
  return ctx.barri ?? ctx.district ?? "Barcelona";
}
function place(ctx: FactsContext): L3 {
  const n = placeName(ctx);
  return L(cap(n), n, n);
}
/** "of/in the barri" with the right contraction: { en: "in X", es: "de X", ca: "de X" } style helpers. */
const deP = (ctx: FactsContext) => L(`in ${cap(placeName(ctx))}`, prep("de", placeName(ctx)), prep("de", placeName(ctx)));

function flatPhrase(ctx: FactsContext): L3 {
  const n = placeName(ctx);
  return ctx.builtM2
    ? L(`${ctx.builtM2} m² flat in ${cap(n)}`, `Piso de ${ctx.builtM2} m² ${prep("en", n)}`, `Pis de ${ctx.builtM2} m² ${prep("a", n)}`)
    : L(`Flat in ${cap(n)}`, `Piso ${prep("en", n)}`, `Pis ${prep("a", n)}`);
}

/* ---------- price position ---------- */

interface PricePosition {
  delta?: number; // % vs barri average, + = above
  barriPerM2?: number;
  period?: string; // raw Catalan period label
  askingPerM2?: number;
}

function pricePosition(report: Report, ctx: FactsContext): PricePosition {
  const p = report.price.pricing;
  return {
    delta: p?.deltaPct,
    barriPerM2: p?.barri?.pricePerM2,
    period: p?.barri?.asOf,
    askingPerM2: p?.asking?.pricePerM2 ?? (ctx.askingPriceEur && ctx.builtM2 ? ctx.askingPriceEur / ctx.builtM2 : undefined),
  };
}

/** |delta| below this reads as "in line with the average". */
const IN_LINE = 3;

/* ---------- serious findings ---------- */

const seriousAffectation = (c: FactsContext) => c.affectation.category === "A";
const checkAffectation = (c: FactsContext) => c.affectation.category === "C" || c.affectation.category === "D";
const listedHigh = (c: FactsContext) => c.heritage.level === "A" || c.heritage.level === "B";
const listed = (c: FactsContext) => Boolean(c.heritage.level);
const floodZone = (c: FactsContext) => c.flood.level === "high" || c.flood.level === "medium";
const lowEnergy = (c: FactsContext) => /^[FG]/i.test(c.energyClass ?? "");

/* ---------- hero subtitle ---------- */

export function buildHeroSub(ctx: FactsContext): L3 {
  const f = flatPhrase(ctx);
  return L(
    `A ${f.en.charAt(0).toLowerCase()}${f.en.slice(1)}. An independent check of its price, building, planning and neighbourhood before you offer.`,
    `Un ${f.es.charAt(0).toLowerCase()}${f.es.slice(1)}. Una revisión independiente de su precio, edificio, urbanismo y entorno antes de que hagas una oferta.`,
    `Un ${f.ca.charAt(0).toLowerCase()}${f.ca.slice(1)}. Una revisió independent del seu preu, edifici, urbanisme i entorn abans que facis una oferta.`,
  );
}

/* ---------- bottom line ---------- */

export function buildBottomLine(report: Report, ctx: FactsContext): { headline: L3; body: L3 } {
  const f = flatPhrase(ctx);
  const pp = pricePosition(report, ctx);

  // Headline: a serious finding first, otherwise the price position.
  let tail: L3;
  if (seriousAffectation(ctx)) {
    tail = L(", on a parcel with a planning affectation.", ", en una parcela con afectación urbanística.", ", en una parcel·la amb afectació urbanística.");
  } else if (listedHigh(ctx)) {
    tail = L(", in a heritage-protected building.", ", en un edificio con protección patrimonial.", ", en un edifici amb protecció patrimonial.");
  } else if (ctx.flood.level === "high") {
    tail = L(", inside a high-frequency flood zone.", ", dentro de una zona inundable de alta frecuencia.", ", dins d'una zona inundable d'alta freqüència.");
  } else if (pp.delta != null && Math.abs(pp.delta) < IN_LINE) {
    tail = L(", asking in line with the neighbourhood average.", ", con un precio de salida en línea con la media del barrio.", ", demanat en línia amb la mitjana del barri.");
  } else if (pp.delta != null) {
    const pct = Math.abs(Math.round(pp.delta));
    tail = pp.delta < 0
      ? L(`, asking about ${pct}% below the neighbourhood average.`, `, con un precio de salida un ${pct}% por debajo de la media del barrio.`, `, demanat un ${pct}% per sota de la mitjana del barri.`)
      : L(`, asking about ${pct}% above the neighbourhood average.`, `, con un precio de salida un ${pct}% por encima de la media del barrio.`, `, demanat un ${pct}% per sobre de la mitjana del barri.`);
  } else if (ctx.yearBuilt) {
    const y = ctx.yearLabel ?? String(ctx.yearBuilt);
    tail = L(` in a ${y} building.`, ` en un edificio de ${y}.`, ` en un edifici de ${y}.`);
  } else {
    tail = L(".", ".", ".");
  }
  const headline = L(`${f.en}${tail.en}`, `${f.es}${tail.es}`, `${f.ca}${tail.ca}`);

  const sentences: L3[] = [];
  const d = deP(ctx);

  // 1. Price against the barri's registered closing prices.
  if (pp.barriPerM2 && pp.period) {
    const bm = perM2(pp.barriPerM2);
    const per = L(localizePeriod(pp.period, "en"), localizePeriod(pp.period, "es"), localizePeriod(pp.period, "ca"));
    if (ctx.askingPriceEur && pp.askingPerM2 && pp.delta != null) {
      const a = money(ctx.askingPriceEur);
      const am = perM2(pp.askingPerM2);
      const pct = Math.abs(Math.round(pp.delta));
      // Catalan contracts "de els" → "dels", so the article lives in `rel`.
      const rel = Math.abs(pp.delta) < IN_LINE
        ? L("in line with", "en línea con", "en línia amb els")
        : pp.delta < 0
          ? L(`about ${pct}% below`, `alrededor de un ${pct}% por debajo de`, `al voltant d'un ${pct}% per sota dels`)
          : L(`about ${pct}% above`, `alrededor de un ${pct}% por encima de`, `al voltant d'un ${pct}% per sobre dels`);
      sentences.push(L(
        `The asking ${a.en} (${am.en}) is ${rel.en} the ${bm.en} that second-hand flats ${d.en} registered at the notary (${per.en}).`,
        `El precio de salida de ${a.es} (${am.es}) está ${rel.es} los ${bm.es} a los que se registraron ante notario los pisos de segunda mano ${d.es} (${per.es}).`,
        `El preu demanat de ${a.ca} (${am.ca}) està ${rel.ca} ${bm.ca} als quals es van registrar a la notaria els pisos de segona mà ${d.ca} (${per.ca}).`,
      ));
    } else {
      sentences.push(L(
        `Second-hand flats ${d.en} registered an average of ${bm.en} at the notary (${per.en}). Add the asking price to see where this flat sits.`,
        `Los pisos de segunda mano ${d.es} se registraron ante notario a una media de ${bm.es} (${per.es}). Añade el precio de salida para ver dónde se sitúa este piso.`,
        `Els pisos de segona mà ${d.ca} es van registrar a la notaria a una mitjana de ${bm.ca} (${per.ca}). Afegeix el preu demanat per veure on se situa aquest pis.`,
      ));
    }
    const few = fewSalesNote(report.price.pricing?.barri?.transactions);
    if (few.en) sentences.push(L(few.en.trim(), few.es.trim(), few.ca.trim()));
  } else if (ctx.askingPriceEur) {
    const a = money(ctx.askingPriceEur);
    const am = ctx.builtM2 ? perM2(ctx.askingPriceEur / ctx.builtM2) : null;
    sentences.push(L(
      `The asking ${a.en}${am ? ` (${am.en})` : ""} can't be compared with registered sales: there is no recent closing-price figure for this neighbourhood, where too few flats sold. Judge it against concrete comparable sales.`,
      `El precio de salida de ${a.es}${am ? ` (${am.es})` : ""} no se puede comparar con ventas registradas: no hay una cifra reciente de precios de cierre para este barrio, donde se vendieron muy pocos pisos. Valóralo con ventas comparables concretas.`,
      `El preu demanat de ${a.ca}${am ? ` (${am.ca})` : ""} no es pot comparar amb vendes registrades: no hi ha cap xifra recent de preus de tancament per a aquest barri, on es van vendre molt pocs pisos. Valora'l amb vendes comparables concretes.`,
    ));
  } else {
    sentences.push(L(
      "There is no recent registered closing-price benchmark for this neighbourhood, so judge the price against concrete comparable sales.",
      "No hay una referencia reciente de precios de cierre registrados para este barrio, así que valora el precio con ventas comparables concretas.",
      "No hi ha cap referència recent de preus de tancament registrats per a aquest barri, així que valora el preu amb vendes comparables concretes.",
    ));
  }

  // 2. Building age.
  if (ctx.yearBuilt && ctx.renovatedYear) {
    // A listed building Catastro dates to its renovation: give both dates and
    // what to ask, rather than "dates from 2017".
    const y = ctx.yearLabel ?? String(ctx.yearBuilt);
    sentences.push(L(
      `The building dates from ${y}, and Catastro records a full renovation in ${ctx.renovatedYear}. Ask for the renovation's completion certificate, the ITE status and whether all old installations were replaced.`,
      `El edificio es de ${y} y el Catastro registra una reforma integral en ${ctx.renovatedYear}. Pide el certificado final de obra de la reforma, el estado de la ITE y si se sustituyeron todas las instalaciones antiguas.`,
      `L'edifici és de ${y} i el Cadastre registra una reforma integral el ${ctx.renovatedYear}. Demana el certificat final d'obra de la reforma, l'estat de la ITE i si es van substituir totes les instal·lacions antigues.`,
    ));
  } else if (ctx.yearBuilt) {
    const age = new Date().getFullYear() - ctx.yearBuilt;
    const ite = age >= ITE_AGE;
    const asb = ctx.yearBuilt < ASBESTOS_BEFORE;
    if (ite && asb) {
      sentences.push(L(
        `The building dates from ${ctx.yearBuilt}, so its ITE technical inspection is due and a pre-2002 build can carry asbestos in old installations.`,
        `El edificio es de ${ctx.yearBuilt}, por lo que su inspección técnica ITE está pendiente y una construcción anterior a 2002 puede tener amianto en instalaciones antiguas.`,
        `L'edifici és de ${ctx.yearBuilt}, de manera que la seva inspecció tècnica ITE està pendent i una construcció anterior al 2002 pot tenir amiant en instal·lacions antigues.`,
      ));
    } else if (asb) {
      sentences.push(L(
        `The building dates from ${ctx.yearBuilt}; a pre-2002 build can carry asbestos in old installations.`,
        `El edificio es de ${ctx.yearBuilt}; una construcción anterior a 2002 puede tener amianto en instalaciones antiguas.`,
        `L'edifici és de ${ctx.yearBuilt}; una construcció anterior al 2002 pot tenir amiant en instal·lacions antigues.`,
      ));
    } else {
      sentences.push(L(
        `The building dates from ${ctx.yearBuilt}.`,
        `El edificio es de ${ctx.yearBuilt}.`,
        `L'edifici és de ${ctx.yearBuilt}.`,
      ));
    }
  }

  // 3. Planning, heritage and flood: findings, gaps, or the all-clear.
  const findings: L3[] = [];
  if (seriousAffectation(ctx)) {
    findings.push(L(
      "The parcel has a planning affectation: the city has earmarked it for another use, which can limit works and resale. A certificat urbanístic confirms its scope.",
      "La parcela tiene una afectación urbanística: el Ajuntament la ha reservado para otro uso, lo que puede limitar las obras y la reventa. Un certificat urbanístic confirma su alcance.",
      "La parcel·la té una afectació urbanística: l'Ajuntament l'ha reservada per a un altre ús, cosa que pot limitar les obres i la revenda. Un certificat urbanístic en confirma l'abast.",
    ));
  } else if (checkAffectation(ctx)) {
    findings.push(L(
      "The official planning check flags the parcel as worth verifying; a certificat urbanístic confirms what it means for this flat.",
      "La consulta urbanística oficial marca la parcela como a verificar; un certificat urbanístic confirma qué implica para este piso.",
      "La consulta urbanística oficial marca la parcel·la com a verificar; un certificat urbanístic confirma què implica per a aquest pis.",
    ));
  }
  if (listed(ctx)) {
    findings.push(L(
      "The building is heritage-listed, which restricts works and makes renovations slower and more expensive.",
      "El edificio está catalogado, lo que limita las obras y hace las reformas más lentas y caras.",
      "L'edifici està catalogat, cosa que limita les obres i fa les reformes més lentes i cares.",
    ));
  }
  if (floodZone(ctx)) {
    findings.push(ctx.flood.level === "high"
      ? L("It lies in a high-frequency (T10) flood zone, which affects insurance.", "Está en una zona inundable de alta frecuencia (T10), lo que afecta al seguro.", "És en una zona inundable d'alta freqüència (T10), cosa que afecta l'assegurança.")
      : L("It lies in a medium-probability (T100) flood zone, which affects insurance.", "Está en una zona inundable de probabilidad media (T100), lo que afecta al seguro.", "És en una zona inundable de probabilitat mitjana (T100), cosa que afecta l'assegurança."));
  }
  const unchecked: L3[] = [];
  if (!ctx.affectation.checked) unchecked.push(L("planning affectation", "afectación urbanística", "afectació urbanística"));
  if (!ctx.heritage.checked) unchecked.push(L("heritage listing", "catalogación patrimonial", "catalogació patrimonial"));
  if (!ctx.flood.checked) unchecked.push(L("flood zone", "zona inundable", "zona inundable"));

  if (findings.length) sentences.push(...findings);
  else if (!unchecked.length) {
    sentences.push(L(
      "No planning affectation or heritage listing limits its use as a home.",
      "Ninguna afectación urbanística ni protección patrimonial limita su uso como vivienda.",
      "Cap afectació urbanística ni protecció patrimonial no en limita l'ús com a habitatge.",
    ));
  }
  if (unchecked.length) {
    const list = (k: "en" | "es" | "ca", and: string) => {
      const items = unchecked.map((u) => u[k]);
      return items.length > 1 ? `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}` : items[0];
    };
    sentences.push(L(
      `The ${list("en", "and")} check could not be completed for this report; see the sections below.`,
      `No se ha podido completar la consulta de ${list("es", "y")} para este informe; consulta las secciones de abajo.`,
      `No s'ha pogut completar la consulta de ${list("ca", "i")} per a aquest informe; consulta les seccions de sota.`,
    ));
  }

  // 4. What only a visit and the documents can tell.
  sentences.push(L(
    "Before offering, confirm the building's collective health (reserve fund, pending derramas), the documents, and the flat's actual condition and layout on a viewing.",
    "Antes de ofertar, comprueba la salud colectiva del edificio (fondo de reserva, derramas pendientes), los documentos y el estado y la distribución reales del piso en una visita.",
    "Abans d'ofertar, comprova la salut col·lectiva de l'edifici (fons de reserva, derrames pendents), els documents i l'estat i la distribució reals del pis en una visita.",
  ));

  return { headline, body: join(sentences) };
}

/* ---------- neighbourhood ---------- */

export function buildNeighbourhood(ctx: FactsContext): { lede: L3; note: L3 } | null {
  const a = ctx.amenities;
  if (!a) return null;
  const p = place(ctx);
  const parts: L3[] = [];
  const m = a.metro;
  if (m.nearest) {
    const n = m.within800;
    const stations = n === 1
      ? L("1 metro station", "1 estación de metro", "1 estació de metro")
      : L(`${n} metro stations`, `${n} estaciones de metro`, `${n} estacions de metro`);
    parts.push(n > 0
      ? L(
          `${stations.en} within 800 m (nearest ${m.nearest.name}, ~${m.nearest.walkMin} min walk)`,
          `${stations.es} a menos de 800 m (la más cercana, ${m.nearest.name}, a ~${m.nearest.walkMin} min a pie)`,
          `${stations.ca} a menys de 800 m (la més propera, ${m.nearest.name}, a ~${m.nearest.walkMin} min a peu)`,
        )
      : L(
          `the nearest metro is ${m.nearest.name}, ~${m.nearest.walkMin} min walk`,
          `el metro más cercano es ${m.nearest.name}, a ~${m.nearest.walkMin} min a pie`,
          `el metro més proper és ${m.nearest.name}, a ~${m.nearest.walkMin} min a peu`,
        ));
  }
  if (a.supermarket.nearest) {
    parts.push(L(
      `a supermarket ~${a.supermarket.nearest.walkMin} min away`,
      `un supermercado a ~${a.supermarket.nearest.walkMin} min`,
      `un supermercat a ~${a.supermarket.nearest.walkMin} min`,
    ));
  }
  if (a.schools.within1000 > 0) {
    parts.push(L(
      `${a.schools.within1000} schools within a 10-minute walk`,
      `${a.schools.within1000} escuelas a 10 minutos a pie`,
      `${a.schools.within1000} escoles a 10 minuts a peu`,
    ));
  }
  if (!parts.length) return null;
  const list = (k: "en" | "es" | "ca", and: string) => {
    const items = parts.map((x) => x[k]);
    return items.length > 1 ? `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}` : items[0];
  };
  const lede = L(
    `${p.en}: ${list("en", "and")}.`,
    `${cap(p.es)}: ${list("es", "y")}.`,
    `${cap(p.ca)}: ${list("ca", "i")}.`,
  );

  const extras: L3[] = [];
  if (a.green.nearest) {
    extras.push(a.green.nearest.distanceM === 0
      ? L(`The flat is right by ${a.green.nearest.name}.`, `El piso está junto a ${a.green.nearest.name}.`, `El pis és tocant a ${a.green.nearest.name}.`)
      : L(
          `Nearest park: ${a.green.nearest.name}, ~${a.green.nearest.walkMin} min.`,
          `Parque más cercano: ${a.green.nearest.name}, a ~${a.green.nearest.walkMin} min.`,
          `Parc més proper: ${a.green.nearest.name}, a ~${a.green.nearest.walkMin} min.`,
        ));
  }
  if (a.market.nearest) {
    extras.push(L(
      `Nearest municipal market: ${a.market.nearest.name}, ~${a.market.nearest.walkMin} min.`,
      `Mercado municipal más cercano: ${a.market.nearest.name}, a ~${a.market.nearest.walkMin} min.`,
      `Mercat municipal més proper: ${a.market.nearest.name}, a ~${a.market.nearest.walkMin} min.`,
    ));
  }
  extras.push(L(
    "Walking times are straight-line estimates from Ajuntament de Barcelona data; check the real routes and slopes on a visit.",
    "Los tiempos a pie son estimaciones en línea recta a partir de datos del Ajuntament de Barcelona; comprueba los recorridos y las pendientes reales en una visita.",
    "Els temps a peu són estimacions en línia recta a partir de dades de l'Ajuntament de Barcelona; comprova els recorreguts i els pendents reals en una visita.",
  ));
  return { lede, note: join(extras) };
}

/* ---------- negotiation playbook ---------- */

const MAX_LEVERS = 4;

export function buildNegotiation(report: Report, ctx: FactsContext): {
  intro: L3;
  items: NegReason[];
  tactic: L3;
} {
  const pp = pricePosition(report, ctx);
  const d = deP(ctx);
  const items: NegReason[] = [];

  if (seriousAffectation(ctx)) {
    items.push({
      title: L("Planning affectation", "Afectación urbanística", "Afectació urbanística"),
      desc: L(
        "An affectation limits works and resale. It justifies a substantially lower price, or walking away, until a certificat urbanístic clarifies its scope.",
        "Una afectación limita las obras y la reventa. Justifica un precio sensiblemente más bajo, o retirarse, hasta que un certificat urbanístic aclare su alcance.",
        "Una afectació limita les obres i la revenda. Justifica un preu sensiblement més baix, o retirar-se, fins que un certificat urbanístic n'aclareixi l'abast.",
      ),
    });
  }
  if (pp.delta != null && pp.delta >= IN_LINE && pp.barriPerM2) {
    const pct = Math.round(pp.delta);
    const bm = perM2(pp.barriPerM2);
    items.push({
      title: L("Above the neighbourhood average", "Por encima de la media del barrio", "Per sobre de la mitjana del barri"),
      desc: L(
        `The asking is about ${pct}% above the ${bm.en} that flats ${d.en} closed at. Ask the seller what justifies the premium.`,
        `El precio de salida está alrededor de un ${pct}% por encima de los ${bm.es} a los que cerraron los pisos ${d.es}. Pregunta al vendedor qué justifica la diferencia.`,
        `El preu demanat està al voltant d'un ${pct}% per sobre dels ${bm.ca} als quals van tancar els pisos ${d.ca}. Pregunta al venedor què justifica la diferència.`,
      ),
    });
  }
  if (listed(ctx)) {
    items.push({
      title: L("Heritage restrictions", "Restricciones patrimoniales", "Restriccions patrimonials"),
      desc: L(
        "A listed building means slower, more expensive works and fewer options to change the flat. Factor that into the number.",
        "Un edificio catalogado implica obras más lentas y caras y menos opciones de cambiar el piso. Tenlo en cuenta en la cifra.",
        "Un edifici catalogat implica obres més lentes i cares i menys opcions de canviar el pis. Tingues-ho en compte en la xifra.",
      ),
    });
  }
  if (ctx.yearBuilt && new Date().getFullYear() - ctx.yearBuilt >= ITE_AGE) {
    const age = new Date().getFullYear() - ctx.yearBuilt;
    items.push({
      title: L("Building age and ITE", "Edad del edificio e ITE", "Edat de l'edifici i ITE"),
      desc: L(
        `${aOrAn(age)} ${age}-year-old building with inspection obligations and an unknown reserve fund is a basis for trimming the number.`,
        `Un edificio de ${age} años con obligaciones de inspección y un fondo de reserva desconocido es una base para recortar la cifra.`,
        `Un edifici de ${age} anys amb obligacions d'inspecció i un fons de reserva desconegut és una base per retallar la xifra.`,
      ),
    });
  }
  if (lowEnergy(ctx)) {
    const c = (ctx.energyClass ?? "").trim().toUpperCase()[0];
    items.push({
      title: L(`Energy class ${c}`, `Clase energética ${c}`, `Classe energètica ${c}`),
      desc: L(
        "A low rating points to insulation or window work and higher bills. Price that in.",
        "Una calificación baja apunta a obras de aislamiento o ventanas y facturas más altas. Inclúyelo en el precio.",
        "Una qualificació baixa apunta a obres d'aïllament o finestres i factures més altes. Inclou-ho en el preu.",
      ),
    });
  } else if (ctx.energyChecked && !ctx.energyClass) {
    items.push({
      title: L("No registered energy certificate", "Sin certificado energético registrado", "Sense certificat energètic registrat"),
      desc: L(
        "The seller must provide one to sell. Ask for it before offering, and treat energy costs as unknown until you have it.",
        "El vendedor debe aportarlo para vender. Pídelo antes de ofertar y considera desconocido el coste energético hasta tenerlo.",
        "El venedor l'ha d'aportar per vendre. Demana'l abans d'ofertar i considera desconegut el cost energètic fins que el tinguis.",
      ),
    });
  }
  if (floodZone(ctx)) {
    items.push({
      title: L("Flood zone", "Zona inundable", "Zona inundable"),
      desc: L(
        "Flood-zone status can raise insurance costs and narrow the resale market. Get a premium quote and use it.",
        "Estar en zona inundable puede encarecer el seguro y reducir el mercado de reventa. Pide un presupuesto del seguro y úsalo.",
        "Ser en zona inundable pot encarir l'assegurança i reduir el mercat de revenda. Demana un pressupost de l'assegurança i fes-lo servir.",
      ),
    });
  }
  if (ctx.askingPriceEur) {
    items.push({
      title: L("Asking is not closing", "Pedir no es cerrar", "Demanar no és tancar"),
      desc: L(
        "Listed prices usually settle a little below the asking price, which leaves room for a measured offer.",
        "Los precios anunciados suelen cerrarse algo por debajo del precio de salida, lo que deja margen para una propuesta medida.",
        "Els preus anunciats solen tancar-se una mica per sota del preu demanat, cosa que deixa marge per a una proposta mesurada.",
      ),
    });
  }

  // True for every flat in a community of owners, so the playbook is never
  // empty (a newer, clean building with no asking price had no levers at all).
  items.push({
    title: L("Approved community levies", "Derramas aprobadas", "Derrames aprovades"),
    desc: L(
      "Ask the administrador de finques whether any derramas (special levies) are approved or planned. Works the community has already agreed are a basis to lower the price or to agree that the seller pays them.",
      "Pregunta al administrador de fincas si hay derramas aprobadas o previstas. Las obras que la comunidad ya ha acordado son una base para bajar el precio o para acordar que las pague el vendedor.",
      "Pregunta a l'administrador de finques si hi ha derrames aprovades o previstes. Les obres que la comunitat ja ha acordat són una base per baixar el preu o per acordar que les pagui el venedor.",
    ),
  });

  const levers = items.slice(0, MAX_LEVERS);
  const n = levers.length;
  const count = L(
    n === 1 ? "One fact-based lever:" : `${n} fact-based levers:`,
    n === 1 ? "Una palanca objetiva:" : `${n} palancas objetivas:`,
    n === 1 ? "Una palanca objectiva:" : `${n} palanques objectives:`,
  );
  let intro: L3;
  if (pp.delta == null) {
    intro = L(
      `Without an asking price the flat can't be placed against the market yet. ${count.en}`,
      `Sin precio de salida aún no se puede situar el piso respecto al mercado. ${count.es}`,
      `Sense preu demanat encara no es pot situar el pis respecte al mercat. ${count.ca}`,
    );
  } else if (pp.delta <= -IN_LINE) {
    intro = L(
      `The asking sits below the neighbourhood average, so this is fine-tuning. ${count.en}`,
      `El precio de salida está por debajo de la media del barrio, así que se trata de ajustar detalles. ${count.es}`,
      `El preu demanat està per sota de la mitjana del barri, així que es tracta d'ajustar detalls. ${count.ca}`,
    );
  } else if (pp.delta < IN_LINE) {
    intro = L(
      `The asking is in line with the neighbourhood average. ${count.en}`,
      `El precio de salida está en línea con la media del barrio. ${count.es}`,
      `El preu demanat està en línia amb la mitjana del barri. ${count.ca}`,
    );
  } else {
    intro = L(
      `The asking sits above the neighbourhood average, which is your first lever. ${count.en}`,
      `El precio de salida está por encima de la media del barrio, y esa es tu primera palanca. ${count.es}`,
      `El preu demanat està per sobre de la mitjana del barri, i aquesta és la teva primera palanca. ${count.ca}`,
    );
  }

  const oldBuilding = ctx.yearBuilt != null && new Date().getFullYear() - ctx.yearBuilt >= ITE_AGE;
  const tactic = oldBuilding
    ? L(
        "Anchor any reduction to the building's age and inspection obligations, and make the offer conditional on receiving a valid ITE, cédula and clean community minutes. That protects you and is the cleanest justification for a lower price. Set the figure yourself once you've seen the flat and concrete comparables.",
        "Fundamenta cualquier rebaja en la antigüedad del edificio y las obligaciones de inspección, y condiciona la oferta a recibir una ITE vigente, la cédula y unas actas de comunidad limpias. Eso te protege y es la justificación más limpia para un precio más bajo. La cifra la fijas tú tras ver el piso y comparables concretos.",
        "Fonamenta qualsevol rebaixa en l'antiguitat de l'edifici i les obligacions d'inspecció, i condiciona l'oferta a rebre una ITE vigent, la cèdula i unes actes de comunitat netes. Això et protegeix i és la justificació més neta per a un preu més baix. La xifra la fixes tu després de veure el pis i comparables concrets.",
      )
    : L(
        "Anchor any reduction to the facts above, and make the offer conditional on receiving the cédula, the energy certificate and clean community minutes. Set the figure yourself once you've seen the flat and concrete comparables.",
        "Fundamenta cualquier rebaja en los hechos anteriores y condiciona la oferta a recibir la cédula, el certificado energético y unas actas de comunidad limpias. La cifra la fijas tú tras ver el piso y comparables concretos.",
        "Fonamenta qualsevol rebaixa en els fets anteriors i condiciona l'oferta a rebre la cèdula, el certificat energètic i unes actes de comunitat netes. La xifra la fixes tu després de veure el pis i comparables concrets.",
      );

  return { intro, items: levers, tactic };
}

/* ---------- pre-offer checklist ---------- */

export function buildChecklist(ctx: FactsContext): L3[] {
  // Finding-specific steps first: they are the ones a buyer would miss.
  const items: L3[] = [];
  if (seriousAffectation(ctx) || checkAffectation(ctx) || !ctx.affectation.checked) {
    items.push(L(
      "Request a certificat urbanístic from the Ajuntament before signing anything.",
      "Solicita un certificat urbanístic al Ajuntament antes de firmar nada.",
      "Sol·licita un certificat urbanístic a l'Ajuntament abans de signar res.",
    ));
  }
  if (listed(ctx) || !ctx.heritage.checked) {
    items.push(L(
      "Ask the Ajuntament which works the building's heritage status allows before planning any renovation.",
      "Pregunta al Ajuntament qué obras permite la situación patrimonial del edificio antes de planificar cualquier reforma.",
      "Pregunta a l'Ajuntament quines obres permet la situació patrimonial de l'edifici abans de planificar cap reforma.",
    ));
  }
  if (floodZone(ctx) || !ctx.flood.checked) {
    items.push(L(
      "Get a home-insurance quote that covers flooding before you offer.",
      "Pide un presupuesto de seguro de hogar que cubra inundaciones antes de ofertar.",
      "Demana un pressupost d'assegurança de la llar que cobreixi inundacions abans d'ofertar.",
    ));
  }
  if (ctx.yearBuilt && ctx.yearBuilt < ASBESTOS_BEFORE) {
    items.push(L(
      "Ask whether old pipes, roof sheets or ducts in the building have been checked for asbestos (amiant).",
      "Pregunta si se han revisado por amianto las tuberías, cubiertas o conductos antiguos del edificio.",
      "Pregunta si s'han revisat per amiant les canonades, cobertes o conductes antics de l'edifici.",
    ));
  }
  items.push(
    L(
      "Count the mailboxes and doorbells on site to confirm the real number of units in the block.",
      "Cuenta los buzones y timbres in situ para confirmar el número real de viviendas del bloque.",
      "Compta les bústies i els timbres in situ per confirmar el nombre real d'habitatges del bloc.",
    ),
    L(
      "Inspect the flat and stairwell for damp, and ask about the roof and how any lift is maintained.",
      "Inspecciona el piso y la escalera por humedades, y pregunta por la cubierta y el mantenimiento de cualquier ascensor.",
      "Inspecciona el pis i l'escala per humitats, i pregunta per la coberta i el manteniment de qualsevol ascensor.",
    ),
    L(
      "Visit at different times of day to judge light and street noise.",
      "Visita a distintas horas del día para valorar la luz y el ruido de la calle.",
      "Visita a diferents hores del dia per valorar la llum i el soroll del carrer.",
    ),
    L(
      "If the flat has been renovated, check that the works had the required permits.",
      "Si el piso ha sido reformado, comprueba que las obras tuvieron los permisos necesarios.",
      "Si el pis ha estat reformat, comprova que les obres van tenir els permisos necessaris.",
    ),
    L(
      "Line up your mortgage decision-in-principle before making a written offer.",
      "Consigue tu acuerdo hipotecario previo antes de hacer una oferta por escrito.",
      "Aconsegueix el teu acord hipotecari previ abans de fer una oferta per escrit.",
    ),
  );
  return items;
}

/* ---------- seeder ---------- */

/**
 * Fill the fact-based prose. Runs last in the pipeline (after pricing, planning
 * and scores are seeded). The AI narrative, when it runs, overwrites these
 * fields; everything it doesn't touch stays fact-based.
 */
export function seedFactsNarrative(report: Report, ctx: FactsContext): Report {
  const r: Report = structuredClone(report);
  r.hero.sub = buildHeroSub(ctx);
  const bl = buildBottomLine(r, ctx);
  r.verdict.headline = bl.headline;
  r.verdict.body = bl.body;
  const nb = buildNeighbourhood(ctx);
  if (nb) {
    r.neighbourhood.lede = nb.lede;
    r.neighbourhood.note = nb.note;
  }
  r.negotiation = buildNegotiation(r, ctx);
  r.checklist = buildChecklist(ctx);
  r.narrative = { source: "facts" };
  return r;
}

/* ---------- free-preview teaser ---------- */

/**
 * The free preview's bottom line. It shows THAT the report has a price answer
 * for this flat, with the evidence behind it (how many registered sales, where,
 * when), but not the answer: no barri €/m², no gap, not even its direction.
 * "Below the average" alone would reassure the buyers closest to an offer, and
 * a reassured buyer doesn't unlock. Built at render time from the structured
 * pricing data, so it works for every stored report, AI-written or not.
 */
export function buildPreviewTeaser(report: Report): { question: L3; proof: L3 } {
  const p = report.price.pricing;
  const asking = p?.asking?.price;
  const barri = p?.barri;
  const ctx = { barri: barri?.name } as FactsContext;
  const n = placeName(ctx);

  let question: L3;
  if (asking) {
    const a = money(asking);
    question = L(
      `How does the asking ${a.en} compare with what flats here actually sell for?`,
      `¿Cómo se compara el precio de salida de ${a.es} con lo que realmente se paga por los pisos de la zona?`,
      `Com es compara el preu demanat de ${a.ca} amb el que realment es paga pels pisos de la zona?`,
    );
  } else if (barri) {
    question = L(
      `What do flats like this one actually sell for in ${cap(n)}?`,
      `¿Por cuánto se venden realmente los pisos como este ${prep("en", n)}?`,
      `Per quant es venen realment els pisos com aquest ${prep("a", n)}?`,
    );
  } else {
    question = L(
      "What should you know about this flat before you offer?",
      "¿Qué deberías saber de este piso antes de ofertar?",
      "Què hauries de saber d'aquest pis abans de fer una oferta?",
    );
  }

  let proof: L3;
  if (barri) {
    const per = L(localizePeriod(barri.asOf, "en"), localizePeriod(barri.asOf, "es"), localizePeriod(barri.asOf, "ca"));
    const sales = barri.transactions
      ? L(
          `${barri.transactions.toLocaleString("en-GB")} second-hand sales`,
          `${dotted(barri.transactions)} ventas de segunda mano`,
          `${dotted(barri.transactions)} vendes de segona mà`,
        )
      : L("the second-hand sales", "las ventas de segunda mano", "les vendes de segona mà");
    proof = asking
      ? L(
          `We compared it with ${sales.en} registered at the notary in ${cap(n)} (${per.en}).`,
          `Lo hemos comparado con ${sales.es} registradas ante notario ${prep("en", n)} (${per.es}).`,
          `L'hem comparat amb ${sales.ca} registrades a la notaria ${prep("a", n)} (${per.ca}).`,
        )
      : L(
          `We have the closing prices of ${sales.en} registered at the notary in ${cap(n)} (${per.en}).`,
          `Tenemos los precios de cierre de ${sales.es} registradas ante notario ${prep("en", n)} (${per.es}).`,
          `Tenim els preus de tancament de ${sales.ca} registrades a la notaria ${prep("a", n)} (${per.ca}).`,
        );
  } else {
    proof = L(
      "We checked it against the official registers for planning, heritage, flood risk and the building.",
      "Lo hemos contrastado con los registros oficiales de urbanismo, patrimonio, riesgo de inundación y el edificio.",
      "L'hem contrastat amb els registres oficials d'urbanisme, patrimoni, risc d'inundació i l'edifici.",
    );
  }

  return { question, proof };
}
