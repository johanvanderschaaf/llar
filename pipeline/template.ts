import type { Report, Localized, Score, UrbanismItem } from "@/types/report";
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
import type { IpvData } from "@/adapters/ine-ipv";
import type { GencatBarriData } from "@/adapters/gencat-barri";
import { buildLiveSearches } from "@/adapters/live-listings";
import type { Pricing } from "@/types/report";
import type { CompRow } from "@/types/report";
import type { ReportInput } from "@/types/db";
import {
  scoreOrder,
  type ScoreKey,
  type RiskOutcome,
  type RiskSeverity,
} from "@/config/scoring";

const EMPTY: Localized = { en: "", es: "", ca: "" };

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
    urbanism: { items: [] },
    costs: { intro: { ...EMPTY }, facts: [], footnote: { ...EMPTY } },
    subsidies: { panels: [] },
    negotiation: { intro: { ...EMPTY }, items: [], tactic: { ...EMPTY } },
    checklist: [],
    footer: { sources: { ...EMPTY }, disclaimer: { ...EMPTY } },
  };
}

const both = (s: string): Localized => ({ en: s, es: s, ca: s });

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
    ca: `La parcel·la cadastral conté ${parcel.unitCount} unitats en total — per tant és un edifici de diversos habitatges, no una casa única. Confirma el nombre real in situ (compta les bústies) i mitjançant la divisió horitzontal de l'edifici.`,
  };

  return r;
}

/* ---------- amenities → neighbourhood facts ---------- */

function near(p: NearestPlace | undefined): Localized | null {
  if (!p) return null;
  const txt = p.name ? `${p.name} · ~${p.walkMin} min` : `~${p.walkMin} min`;
  return { en: txt, es: txt, ca: txt };
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
      ca: `${names || "Metro"}${mins ? ` · ~${mins} min` : ""} (${a.metro.within800} a 800 m)`,
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
      ca: `${a.schools.within1000} a ~10 min a peu`,
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
      reference: { en: "This flat", es: "Este piso", ca: "Aquest pis" },
      price: eur(opts.askingPriceEur),
      size: m2 ? `${m2} m²` : undefined,
      pricePerM2: m2 ? Math.round(opts.askingPriceEur / m2).toLocaleString("en-GB") : undefined,
      note: { en: "Subject property", es: "Inmueble objeto", ca: "Immoble objecte" },
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
        ca: `${c.rooms ?? "?"} hab · ${c.bathrooms ?? "?"} banys`,
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

/* ---------- INE IPV → market-context panel in section 03 ---------- */

/**
 * Seed the "market context" panel and price lede from the INE IPV YoY change
 * for Cataluña. Plain-language framing of *how the market is moving* — not an
 * investment yield. Always paired with the "verify with current comparables"
 * disclaimer because the index lags the asking-price reality by a quarter.
 */
export function seedIpvContext(report: Report, ipv: IpvData): Report {
  const r: Report = structuredClone(report);
  const pct = ipv.yoyPct;
  const sign = pct > 0 ? "+" : "";
  const dir =
    pct > 4
      ? { en: "rising fast", es: "subiendo con fuerza", ca: "pujant amb força" }
      : pct > 0.5
        ? { en: "edging up", es: "subiendo de forma moderada", ca: "pujant moderadament" }
        : pct < -0.5
          ? { en: "easing", es: "bajando", ca: "baixant" }
          : { en: "broadly flat", es: "prácticamente plano", ca: "pràcticament pla" };

  const segLabel = ipv.segment === "secondHand"
    ? { en: "second-hand homes", es: "viviendas de segunda mano", ca: "habitatges de segona mà" }
    : { en: "all homes", es: "todas las viviendas", ca: "tots els habitatges" };

  r.price.panels = [
    {
      heading: {
        en: "Market context (Catalonia)",
        es: "Contexto de mercado (Cataluña)",
        ca: "Context de mercat (Catalunya)",
      },
      body: {
        en: `Across Catalonia, prices for ${segLabel.en} are ${dir.en}: ${sign}${pct.toFixed(1)}% year-on-year in ${ipv.quarter} (INE Housing Price Index). This is regional context, not a quote for this address — verify with current comparables before offering.`,
        es: `En Cataluña, los precios de ${segLabel.es} están ${dir.es}: ${sign}${pct.toFixed(1)}% interanual en ${ipv.quarter} (Índice de Precios de Vivienda, INE). Es contexto regional, no una valoración de esta dirección — contrástalo con comparables actuales antes de ofertar.`,
        ca: `A Catalunya, els preus dels ${segLabel.ca} estan ${dir.ca}: ${sign}${pct.toFixed(1)}% interanual al ${ipv.quarter} (Índex de Preus de l'Habitatge, INE). És context regional, no una valoració d'aquesta adreça — contrasta-ho amb comparables actuals abans d'ofertar.`,
      },
    },
    ...r.price.panels,
  ];

  if (!r.price.lede.en) {
    r.price.lede = {
      en: `Catalan housing prices are ${dir.en} (${sign}${pct.toFixed(1)}% YoY, ${ipv.quarter}). The figures below are the regional backdrop — pair them with the specific comparables for this street.`,
      es: `Los precios de la vivienda en Cataluña están ${dir.es} (${sign}${pct.toFixed(1)}% interanual, ${ipv.quarter}). Las cifras siguientes son el contexto regional — combínalas con los comparables concretos de esta calle.`,
      ca: `Els preus de l'habitatge a Catalunya estan ${dir.ca} (${sign}${pct.toFixed(1)}% interanual, ${ipv.quarter}). Les xifres següents són el context regional — combina-les amb els comparables concrets d'aquest carrer.`,
    };
  }

  return r;
}

/* ---------- Generalitat barri pricing → real-sale-price panel ---------- */

/**
 * Seed the entire price section (03) from the Generalitat Habitatge barri
 * data. Drives, in order of buyer importance:
 *
 *  1. `price.lede`        — a one-sentence verdict (asking €/m² vs barri).
 *  2. `price.fairValue`   — the realistic ±15% range with positioning guide.
 *  3. `price.panels[0]`   — the source detail (sales count, period, surface).
 *  4. `hero.meta` pill    — `vs barri €/m²` delta for the top-of-report strip.
 *
 * Catalonia-wide IPV context is intentionally NOT seeded here — it's too
 * coarse to drive a Barcelona buyer's offer; `seedIpvContext` remains
 * available for the Verdict section or a footer if we want it elsewhere.
 */
export function seedBarriPricing(
  report: Report,
  barri: GencatBarriData,
  opts: { askingPriceEur?: number; builtM2?: number } = {},
): Report {
  const r: Report = structuredClone(report);
  const ppm = barri.pricePerM2;
  const ppmStr = ppm.toLocaleString("en-GB");

  // --- 1. Verdict lede: lead with the asking €/m² vs barri delta ---
  if (opts.askingPriceEur && opts.builtM2) {
    const askPerM2 = opts.askingPriceEur / opts.builtM2;
    const delta = ((askPerM2 - ppm) / ppm) * 100;
    const absDelta = Math.abs(delta).toFixed(1);
    const askStr = Math.round(askPerM2).toLocaleString("en-GB");
    const dir =
      delta > 1
        ? { en: "above", es: "por encima de", ca: "per sobre de" }
        : delta < -1
          ? { en: "below", es: "por debajo de", ca: "per sota de" }
          : { en: "in line with", es: "en línea con", ca: "en línia amb" };
    r.price.lede = {
      en: `Asking €${askStr}/m² in ${barri.name} — ${absDelta}% ${dir.en} the barri's €${ppmStr}/m² closing-price average (${barri.asOf}, registered second-hand sales).`,
      es: `Precio pedido €${askStr}/m² en ${barri.name} — ${absDelta}% ${dir.es} la media de cierre del barrio €${ppmStr}/m² (${barri.asOf}, ventas registradas de segunda mano).`,
      ca: `Preu demanat €${askStr}/m² a ${barri.name} — ${absDelta}% ${dir.ca} la mitjana de tancament del barri €${ppmStr}/m² (${barri.asOf}, vendes registrades de segona mà).`,
    };
  } else {
    // Asking unknown — verdict-less version centred on the barri figure.
    r.price.lede = {
      en: `${barri.name}: €${ppmStr}/m² closing-price average across registered second-hand sales (${barri.asOf}). The range below is what flats this size actually close at — position the asking price within it.`,
      es: `${barri.name}: €${ppmStr}/m² de media de cierre en ventas registradas de segunda mano (${barri.asOf}). El rango siguiente refleja a qué precio se cierran realmente los pisos de este tamaño — sitúa el precio pedido dentro de él.`,
      ca: `${barri.name}: €${ppmStr}/m² de mitjana de tancament en vendes registrades de segona mà (${barri.asOf}). El rang següent reflecteix a quin preu es tanquen realment els pisos d'aquesta mida — situa el preu demanat dins d'aquest rang.`,
    };
  }

  // --- 3. Supporting evidence panel — single panel, replaces any prior ---
  const tx = barri.transactions ? `${barri.transactions} registered second-hand sales` : "registered second-hand sales";
  const txEs = barri.transactions ? `${barri.transactions} ventas registradas de segunda mano` : "ventas registradas de segunda mano";
  const txCa = barri.transactions ? `${barri.transactions} vendes registrades de segona mà` : "vendes registrades de segona mà";
  const surf = barri.avgSurfaceM2 ? ` The average flat sold in the barri is ${barri.avgSurfaceM2} m².` : "";
  const surfEs = barri.avgSurfaceM2 ? ` El tamaño medio del piso vendido en el barrio es ${barri.avgSurfaceM2} m².` : "";
  const surfCa = barri.avgSurfaceM2 ? ` La mida mitjana del pis venut al barri és ${barri.avgSurfaceM2} m².` : "";

  r.price.panels = [
    {
      heading: {
        en: `Where the €${ppmStr}/m² figure comes from`,
        es: `De dónde sale el €${ppmStr}/m²`,
        ca: `D'on surt el €${ppmStr}/m²`,
      },
      body: {
        en: `${barri.asOf}, ${tx}.${surf} The figure is the arithmetic average €/m² built area at closing — not asking. Source: Generalitat de Catalunya — Habitatge (notarial deeds).`,
        es: `${barri.asOf}, ${txEs}.${surfEs} La cifra es la media aritmética de €/m² construido al cierre — no precio de oferta. Fuente: Generalitat de Catalunya — Habitatge (escrituras notariales).`,
        ca: `${barri.asOf}, ${txCa}.${surfCa} La xifra és la mitjana aritmètica de €/m² construït al tancament — no preu d'oferta. Font: Generalitat de Catalunya — Habitatge (escriptures notarials).`,
      },
    },
  ];

  // --- 4. Live listings deep links (no data ingested, buyer clicks out) ---
  r.price.liveSearches = buildLiveSearches({
    districtCode: barri.districtCode,
    barriName: barri.name,
    builtM2: opts.builtM2,
    askingPriceEur: opts.askingPriceEur,
  });

  // Hero "vs market" pill when we can compute the delta.
  if (opts.askingPriceEur && opts.builtM2) {
    const delta = ((opts.askingPriceEur / opts.builtM2 - ppm) / ppm) * 100;
    const sign = delta > 0 ? "+" : "";
    const txt = `${sign}${delta.toFixed(1)}%`;
    r.hero.meta.push({
      labelKey: "meta.vsMarket",
      value: { en: txt, es: txt, ca: txt },
    });
  }

  // --- Structured payload for the redesigned Section 03 component ---
  r.price.pricing = buildPricingPayload(barri, opts);

  // Fair-value range grounded in the barri €/m². Width is ±15% — wide enough
  // to bracket realistic spreads within a single barri (an unreformed planta
  // baja interior vs. a reformed high floor with balcony are easily ±15–25%
  // either side of the average), so the range tells the buyer where their
  // flat plausibly sits, not just where the average is.
  if (opts.builtM2) {
    const lo = Math.round(ppm * 0.85 * opts.builtM2);
    const hi = Math.round(ppm * 1.15 * opts.builtM2);
    const loStr = lo.toLocaleString("en-GB");
    const hiStr = hi.toLocaleString("en-GB");
    r.price.range = { lo, hi };
    r.price.fairValue = {
      en: `Most flats this size in ${barri.name} close between €${loStr} and €${hiStr} (barri €/m² ±15% × ${opts.builtM2} m²). The lower end is older / unreformed / low floor; the upper end is reformed / high floor / outdoor space. Position the offer relative to this flat's specific features, then verify with concrete comparables.`,
      es: `La mayoría de los pisos de este tamaño en ${barri.name} se cierran entre €${loStr} y €${hiStr} (€/m² del barrio ±15% × ${opts.builtM2} m²). El extremo inferior corresponde a pisos antiguos / sin reformar / planta baja; el superior, a reformados / planta alta / con espacio exterior. Sitúa la oferta según las características concretas de este piso y contrástala con comparables.`,
      ca: `La majoria dels pisos d'aquesta mida a ${barri.name} es tanquen entre €${loStr} i €${hiStr} (€/m² del barri ±15% × ${opts.builtM2} m²). L'extrem inferior correspon a pisos antics / sense reformar / planta baixa; el superior, a reformats / planta alta / amb espai exterior. Situa l'oferta segons les característiques concretes d'aquest pis i contrasta-la amb comparables.`,
    };
  }

  return r;
}

/* ---------- structured Pricing payload (drives the new Section 03) ---------- */

const EUR = (n: number) => `€${Math.round(n).toLocaleString("en-GB")}`;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

/** Position-within-range narrative, picked from where the asking marker lands. */
function positionPhrase(pct: number): {
  en: string;
  es: string;
  ca: string;
} {
  if (pct < 0)
    return {
      en: "below the fair range",
      es: "por debajo del rango razonable",
      ca: "per sota del rang raonable",
    };
  if (pct > 1)
    return {
      en: "above the fair range",
      es: "por encima del rango razonable",
      ca: "per sobre del rang raonable",
    };
  if (pct < 0.25)
    return {
      en: "toward the lower end of a fair range",
      es: "hacia el extremo bajo de un rango razonable",
      ca: "cap a l'extrem baix d'un rang raonable",
    };
  if (pct > 0.75)
    return {
      en: "toward the upper end of a fair range",
      es: "hacia el extremo alto de un rango razonable",
      ca: "cap a l'extrem alt d'un rang raonable",
    };
  return {
    en: "right inside a fair range",
    es: "justo dentro de un rango razonable",
    ca: "just dins d'un rang raonable",
  };
}

function chipForDelta(
  delta: number,
): { tone: Pricing["chip"]["tone"]; text: Localized } {
  // Within ±15% of the barri average is the fair range → "Fairly priced",
  // regardless of which side. Only label "Below" / "Above" market once the
  // asking falls outside that range — anything inside is the buyer's fair
  // working band.
  if (delta < -15)
    return {
      tone: "clear",
      text: {
        en: "Below market",
        es: "Por debajo del mercado",
        ca: "Per sota del mercat",
      },
    };
  if (delta > 15)
    return {
      tone: "check",
      text: {
        en: "Above market",
        es: "Por encima del mercado",
        ca: "Per sobre del mercat",
      },
    };
  return {
    tone: "clear",
    text: { en: "Fairly priced", es: "Precio razonable", ca: "Preu raonable" },
  };
}

function deltaPhrase(delta: number): Localized {
  const sign = delta > 0 ? "+" : ""; // bare for negative — we'll spell it
  const txt = `${Math.abs(delta).toFixed(0)}%`;
  if (Math.abs(delta) < 1)
    return {
      en: "in line with",
      es: "en línea con",
      ca: "en línia amb",
    };
  return delta < 0
    ? { en: `≈${txt} below`, es: `≈${txt} por debajo de`, ca: `≈${txt} per sota de` }
    : { en: `≈${sign}${txt} above`, es: `≈${sign}${txt} por encima de`, ca: `≈${sign}${txt} per sobre de` };
}

/** Build the structured payload for State 01 (asking known) or State 02 (unknown). */
function buildPricingPayload(
  barri: GencatBarriData,
  opts: { askingPriceEur?: number; builtM2?: number },
): Pricing {
  const ppm = barri.pricePerM2;
  const builtM2 = opts.builtM2;
  // Range bookends are inherently fuzzy (±15% × a barri average that's already
  // an arithmetic mean across ~hundreds of sales) — round to the nearest €1,000
  // so the buyer reads them as a band, not a precise number. The asking price
  // and barri-implied value stay precise (they are exact arithmetic).
  const round1k = (n: number) => Math.round(n / 1000) * 1000;
  const impliedValue = builtM2 ? Math.round(ppm * builtM2) : 0;
  const range = builtM2
    ? { lo: round1k(ppm * 0.85 * builtM2), hi: round1k(ppm * 1.15 * builtM2) }
    : undefined;

  const barriPayload: NonNullable<Pricing["barri"]> = {
    name: barri.name,
    pricePerM2: ppm,
    avgSurfaceM2: barri.avgSurfaceM2,
    transactions: barri.transactions,
    asOf: barri.asOf,
    impliedValue,
  };

  // ---------- State 02: asking unknown ----------
  if (!opts.askingPriceEur || !builtM2) {
    // Marker = barri average → sits at 50% by construction.
    const markerPct = 0.5;
    const verdict: Localized = range
      ? {
          en: `For a <span class="num">${builtM2 ?? "—"} m²</span> flat in ${barri.name}, a fair price runs about <span class="num">${EUR(range.lo)}</span> to <span class="num">${EUR(range.hi)}</span> — built on what nearby flats actually closed at.`,
          es: `Para un piso de <span class="num">${builtM2 ?? "—"} m²</span> en ${barri.name}, un precio razonable ronda entre <span class="num">${EUR(range.lo)}</span> y <span class="num">${EUR(range.hi)}</span> — basado en lo que pisos cercanos cerraron de verdad.`,
          ca: `Per a un pis de <span class="num">${builtM2 ?? "—"} m²</span> a ${barri.name}, un preu raonable ronda entre <span class="num">${EUR(range.lo)}</span> i <span class="num">${EUR(range.hi)}</span> — basat en el que pisos propers van tancar realment.`,
        }
      : {
          en: `In ${barri.name}, registered second-hand flats closed at an average <span class="num">€${ppm.toLocaleString("en-GB")}/m²</span> built. Apply that to this flat's m² once known.`,
          es: `En ${barri.name}, los pisos de segunda mano registrados se cerraron a una media de <span class="num">€${ppm.toLocaleString("en-GB")}/m²</span> construido. Aplícalo al m² de este piso cuando se conozca.`,
          ca: `A ${barri.name}, els pisos de segona mà registrats es van tancar a una mitjana de <span class="num">€${ppm.toLocaleString("en-GB")}/m²</span> construït. Aplica'l al m² d'aquest pis quan es conegui.`,
        };
    return {
      state: "asking-unknown",
      builtM2,
      chip: {
        tone: "neutral",
        text: {
          en: "No asking price yet",
          es: "Aún sin precio de oferta",
          ca: "Encara sense preu de sortida",
        },
      },
      verdict,
      barri: barriPayload,
      range,
      markerPct: range ? markerPct : undefined,
      marker: range ? { kind: "barri-avg", value: impliedValue } : undefined,
    };
  }

  // ---------- State 01: asking known + barri matched ----------
  const askPerM2 = opts.askingPriceEur / builtM2;
  const delta = ((askPerM2 - ppm) / ppm) * 100;
  const chip = chipForDelta(delta);
  // markerPct = where the asking price lands on the [lo, hi] axis.
  const markerPct = range
    ? clamp01((opts.askingPriceEur - range.lo) / (range.hi - range.lo))
    : 0.5;
  const dphrase = deltaPhrase(delta);
  const positionAfterDash = positionPhrase(markerPct);
  const verdict: Localized = {
    en: `Asking <span class="num">${EUR(opts.askingPriceEur)}</span> sits <strong class="pct">${dphrase.en}</strong> the neighbourhood's closing average — ${positionAfterDash.en}.`,
    es: `Precio pedido <span class="num">${EUR(opts.askingPriceEur)}</span> queda <strong class="pct">${dphrase.es}</strong> la media de cierre del barrio — ${positionAfterDash.es}.`,
    ca: `Preu demanat <span class="num">${EUR(opts.askingPriceEur)}</span> queda <strong class="pct">${dphrase.ca}</strong> la mitjana de tancament del barri — ${positionAfterDash.ca}.`,
  };

  return {
    state: "asking-known",
    builtM2,
    asking: { price: opts.askingPriceEur, pricePerM2: Math.round(askPerM2) },
    chip,
    verdict,
    barri: barriPayload,
    range,
    deltaPct: delta,
    markerPct,
    marker: { kind: "asking", value: opts.askingPriceEur },
  };
}

/**
 * Seed Section 03 in State 03 — barri benchmark unavailable. Called from
 * the pipeline when `fetchGencatBarri` returns `unavailable` (coords
 * outside the 73 BCN barris, or a low-volume barri with no €/m² for the
 * period). No fair range, no barri average, no Δ — never render zeros.
 */
export function seedPricingUnavailable(
  report: Report,
  opts: {
    askingPriceEur?: number;
    builtM2?: number;
    ipv?: IpvData;
  } = {},
): Report {
  const r: Report = structuredClone(report);
  const askPerM2 =
    opts.askingPriceEur && opts.builtM2
      ? Math.round(opts.askingPriceEur / opts.builtM2)
      : undefined;

  let ipvFootnote: Localized | undefined;
  if (opts.ipv) {
    const pct = opts.ipv.yoyPct;
    const sign = pct > 0 ? "+" : "";
    ipvFootnote = {
      en: `For wider context only — across Catalonia, second-hand home prices moved ${sign}${pct.toFixed(1)}% year-on-year in ${opts.ipv.quarter} (INE Housing Price Index). That's a regional figure, far too coarse to price a single flat — but it's the closest we can offer when the neighbourhood data isn't there.`,
      es: `Solo como contexto amplio — en Cataluña, los precios de la vivienda de segunda mano variaron un ${sign}${pct.toFixed(1)}% interanual en ${opts.ipv.quarter} (Índice de Precios de Vivienda, INE). Es una cifra regional, demasiado gruesa para valorar un piso concreto — pero es lo más cercano cuando no hay datos del barrio.`,
      ca: `Només com a context ampli — a Catalunya, els preus de l'habitatge de segona mà van variar un ${sign}${pct.toFixed(1)}% interanual al ${opts.ipv.quarter} (Índex de Preus de l'Habitatge, INE). És una xifra regional, massa gruixuda per valorar un pis concret — però és el més proper quan no hi ha dades del barri.`,
    };
  }

  r.price.pricing = {
    state: "barri-unavailable",
    builtM2: opts.builtM2,
    asking:
      opts.askingPriceEur && askPerM2
        ? { price: opts.askingPriceEur, pricePerM2: askPerM2 }
        : undefined,
    chip: {
      tone: "check",
      text: {
        en: "No barri benchmark",
        es: "Sin referencia del barrio",
        ca: "Sense referència del barri",
      },
    },
    verdict: {
      en: `We can't benchmark this flat against its neighbourhood yet.`,
      es: `Aún no podemos comparar este piso con su barrio.`,
      ca: `Encara no podem comparar aquest pis amb el seu barri.`,
    },
    ipvFootnote,
  };
  return r;
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
        ca: "Cadastre — valor de referència oficial",
      },
      url: "https://www.sedecatastro.gob.es/Accesos/SECAccvr.aspx",
    },
    {
      kind: "official",
      label: {
        en: "Ministerio de Vivienda — transaction price statistics",
        es: "Ministerio de Vivienda — estadística de precios de transacción",
        ca: "Ministerio de Vivienda — estadística de preus de transacció",
      },
      url: "https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/precios-vivienda",
    },
    {
      kind: "official",
      label: {
        en: "Col·legi de Registradors — closing-price statistics",
        es: "Col·legi de Registradors — estadística de precios de cierre",
        ca: "Col·legi de Registradors — estadística de preus de tancament",
      },
      url: "https://www.registradores.org/-/estadistica-registral-inmobiliaria",
    },
    {
      kind: "portal",
      label: {
        en: "idealista — Barcelona published price report (asking)",
        es: "idealista — informe de precios de Barcelona (oferta)",
        ca: "idealista — informe de preus de Barcelona (oferta)",
      },
      url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/barcelona-provincia/barcelona-capital/",
    },
    {
      kind: "portal",
      label: {
        en: "Fotocasa — Barcelona real-estate index (asking)",
        es: "Fotocasa — índice inmobiliario de Barcelona (oferta)",
        ca: "Fotocasa — índex immobiliari de Barcelona (oferta)",
      },
      url: "https://www.fotocasa.es/es/indice-inmobiliario__1/",
    },
    {
      kind: "search",
      label: {
        en: "Find current listings near this address",
        es: "Buscar anuncios actuales cerca de esta dirección",
        ca: "Cerca anuncis actuals a prop d'aquesta adreça",
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
    value: { en: `Class ${cls}`, es: `Clase ${cls}`, ca: `Classe ${cls}` },
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
  const detailBitsCa = [
    e.primaryEnergyKwh ? `${Math.round(e.primaryEnergyKwh)} kWh/m²·any` : null,
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
      ca: `Classe ${cls}${detailBitsCa.length ? ` · ${detailBitsCa.join(" · ")}` : ""}.${
        tone !== "good"
          ? " Factures més altes; les futures normes de la UE poden pressionar el valor dels habitatges amb baixa qualificació."
          : ""
      }`,
    },
  });
  return r;
}

/**
 * No ICAEN certificate registered for this unit. Energy drops out of the score
 * (re-normalised away), but we still state it where energy would appear, so the
 * buyer knows it's missing rather than assuming it wasn't checked.
 */
export function seedEnergyMissing(report: Report): Report {
  const r: Report = structuredClone(report);
  r.hero.meta.push({
    labelKey: "meta.energy",
    value: { en: "Not certified", es: "Sin certificado", ca: "Sense certificat" },
  });
  r.risks.push({
    labelKey: "risk.energy",
    tone: "ok",
    detail: {
      en: "No energy performance certificate (certificat d'eficiència energètica) is registered for this flat, so it isn't scored on energy. Ask the seller for it — it's legally required to complete a sale.",
      es: "No hay certificado de eficiencia energética registrado para este piso, así que no se puntúa en energía. Pídeselo al vendedor — es obligatorio para cerrar la compraventa.",
      ca: "No hi ha cap certificat d'eficiència energètica registrat per a aquest pis, així que no es puntua en energia. Demana'l al venedor — és obligatori per tancar la compravenda.",
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
            ca: "No es troba en zona de risc d'inundació fluvial (SNCZI).",
          }
        : lvl === "medium"
          ? {
              en: "Within the T100 (medium-probability) flood zone — verify with a hydraulic study.",
              es: "Dentro de la zona inundable T100 (probabilidad media) — verifícalo con un estudio hidráulico.",
              ca: "Dins de la zona inundable T100 (probabilitat mitjana) — verifica-ho amb un estudi hidràulic.",
            }
          : {
              en: "Within the T10 (high-frequency) flood zone — significant flood risk; seek specialist advice.",
              es: "Dentro de la zona inundable T10 (alta frecuencia) — riesgo de inundación significativo; busca asesoramiento especializado.",
              ca: "Dins de la zona inundable T10 (alta freqüència) — risc d'inundació significatiu; busca assessorament especialitzat.",
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
          ca: `Edifici de ${age} anys — la ITE (inspecció tècnica) és obligatòria; confirma-la i les obres pendents.`,
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
          ca: "Construcció anterior al 2002 — possible amiant en instal·lacions antigues; normalment de baix cost si està aïllat.",
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

/** Translate the affected systems into a plain phrase ("a public facility"). */
function plainSystems(affs: UrbanismData["affectations"]): Localized {
  const cats = new Set<string>();
  for (const a of affs) {
    const g = `${a.group ?? ""} ${a.family ?? ""} ${a.name ?? ""}`.toLowerCase();
    if (/equipament/.test(g)) cats.add("facility");
    else if (/vi[aà]ri|vial|carrer/.test(g)) cats.add("road");
    else if (/verd|parc|lliure|jard/.test(g)) cats.add("green");
    else if (/ferro|infra|servei|t[èe]cnic|hidr|port/.test(g)) cats.add("infra");
    else cats.add("public");
  }
  const EN: Record<string, string> = {
    facility: "a public facility",
    road: "a road or street layout",
    green: "a public green space",
    infra: "public infrastructure",
    public: "a public use",
  };
  const ES: Record<string, string> = {
    facility: "un equipamiento público",
    road: "viario o ensanche de calle",
    green: "una zona verde pública",
    infra: "infraestructura pública",
    public: "un uso público",
  };
  const CA: Record<string, string> = {
    facility: "un equipament públic",
    road: "vial o eixamplament de carrer",
    green: "una zona verda pública",
    infra: "infraestructura pública",
    public: "un ús públic",
  };
  const list = [...cats];
  return {
    en: list.map((c) => EN[c]).join(" and ") || "a public use",
    es: list.map((c) => ES[c]).join(" y ") || "un uso público",
    ca: list.map((c) => CA[c]).join(" i ") || "un ús públic",
  };
}

/**
 * Seed the urbanism section as a list of plain-language status rows (one per
 * planning aspect) plus the top-of-report affectation alert.
 *
 * The affectation verdict prefers the official Ajuntament AFH service (`a`):
 * category A → affected, C/D → specific circumstances, B → clear. When the AFH
 * service is unavailable, it falls back to the qualification inference in `u`.
 */
export function seedUrbanism(
  report: Report,
  u: UrbanismData,
  a?: AffectationData,
): Report {
  const r: Report = structuredClone(report);
  const items: UrbanismItem[] = [];

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
  const confirmed = Boolean(a); // AFH = confirmed; inference = "appears".
  // "clear" reached without the authoritative AFH source (service down, or only
  // the qualification fallback ran). With no operator review, the buyer must be
  // told this is unverified rather than a confirmed all-clear.
  const unverified = level === "clear" && !a;
  const plain = plainSystems(u.affectations);
  const codes = u.affectations.map((af) => af.clau).join(", ");
  const codeTag = codes
    ? { en: ` (zoning code ${codes})`, es: ` (código ${codes})`, ca: ` (codi ${codes})` }
    : { en: "", es: "", ca: "" };

  // 1) Affectation — the headline planning aspect.
  items.push({
    key: "affectation",
    tone:
      level === "affected"
        ? "caution"
        : level === "specific" || unverified
          ? "check"
          : "clear",
    label: { en: "Planning affectation", es: "Afectación urbanística", ca: "Afectació urbanística" },
    text:
      level === "affected"
        ? {
            en: `${confirmed ? "The city officially flags this property as affected" : "Part of the plot appears reserved for public use"} — part of the plot is reserved for ${plain.en}. This can restrict renovations, cap the resale value, or in extreme cases lead to expropriation. Confirm before offering with an official planning certificate (certificat urbanístic).${codeTag.en}`,
            es: `${confirmed ? "El ayuntamiento marca oficialmente esta propiedad como afectada" : "Parte de la parcela parece reservada para uso público"} — parte de la parcela está reservada para ${plain.es}. Puede limitar reformas, reducir el valor de reventa o, en casos extremos, llevar a expropiación. Confírmalo antes de ofertar con un certificado urbanístico oficial.${codeTag.es}`,
            ca: `${confirmed ? "L'ajuntament marca oficialment aquesta propietat com a afectada" : "Una part de la parcel·la sembla reservada per a ús públic"} — part de la parcel·la està reservada per a ${plain.ca}. Pot limitar reformes, reduir el valor de revenda o, en casos extrems, comportar expropiació. Confirma-ho abans d'ofertar amb un certificat urbanístic oficial.${codeTag.ca}`,
          }
        : level === "specific"
          ? {
              en: "The city notes specific planning circumstances here (for example a plan being processed, an area under redevelopment, or suspended permits). Check what applies before offering.",
              es: "El ayuntamiento señala circunstancias urbanísticas específicas (por ejemplo un planeamiento en trámite, un ámbito en transformación o licencias suspendidas). Comprueba qué aplica antes de ofertar.",
              ca: "L'ajuntament assenyala circumstàncies urbanístiques específiques (per exemple un planejament en tràmit, un àmbit en transformació o llicències suspeses). Comprova què s'aplica abans d'ofertar.",
            }
          : unverified
            ? {
                en: "We couldn't confirm this property's official planning-affectation status (the city service was unavailable). This part of the score is provisional — verify with an official planning certificate (certificat urbanístic) before relying on it.",
                es: "No hemos podido confirmar la afectación urbanística oficial de esta propiedad (el servicio municipal no estaba disponible). Esta parte de la valoración es provisional — verifícalo con un certificado urbanístico oficial antes de confiar en ella.",
                ca: "No hem pogut confirmar l'afectació urbanística oficial d'aquesta propietat (el servei municipal no estava disponible). Aquesta part de la valoració és provisional — verifica-ho amb un certificat urbanístic oficial abans de confiar-hi.",
              }
            : {
                en: "No planning affectation was found that would limit using this as a home.",
                es: "No se ha encontrado ninguna afectación urbanística que impida usarla como vivienda.",
                ca: "No s'ha trobat cap afectació urbanística que impedeixi utilitzar-lo com a habitatge.",
              },
  });

  // 2) Zoning — reassuring context, only when we resolved a qualification.
  if (u.qualCode || u.classification) {
    items.push({
      key: "zoning",
      tone: "clear",
      label: { en: "Zoning", es: "Calificación", ca: "Qualificació" },
      text: {
        en: `Residential, build-ready land — standard for a city flat.${u.qualCode ? ` (zoning code ${u.qualCode})` : ""}`,
        es: `Suelo residencial y consolidado — lo normal para un piso urbano.${u.qualCode ? ` (código ${u.qualCode})` : ""}`,
        ca: `Sòl residencial i consolidat — el que és habitual en un pis urbà.${u.qualCode ? ` (codi ${u.qualCode})` : ""}`,
      },
    });
  }

  // 3) Low Emission Zone — static city-wide context.
  items.push({
    key: "lez",
    tone: "info",
    label: {
      en: "Low Emission Zone (ZBE)",
      es: "Zona de Bajas Emisiones (ZBE)",
      ca: "Zona de Baixes Emissions (ZBE)",
    },
    text: {
      en: "Like all of central Barcelona, this address is inside the Low Emission Zone. Only relevant if you keep a car without an emissions sticker.",
      es: "Como toda Barcelona central, esta dirección está dentro de la Zona de Bajas Emisiones. Solo importa si mantienes un coche sin etiqueta ambiental.",
      ca: "Com tota la Barcelona central, aquesta adreça és dins la Zona de Baixes Emissions. Només importa si tens cotxe sense etiqueta ambiental.",
    },
  });

  r.urbanism = { items };

  // Surface a serious finding at the top of the report, not just in the section.
  if (level === "affected") {
    r.alerts = [
      ...(r.alerts ?? []),
      {
        tone: "caution",
        title: {
          en: confirmed ? "Planning affectation" : "Possible planning affectation",
          es: confirmed ? "Afectación urbanística" : "Posible afectación urbanística",
          ca: confirmed ? "Afectació urbanística" : "Possible afectació urbanística",
        },
        detail: {
          en: `${confirmed ? "The city flags this property as affected" : "Part of the plot appears reserved for public use"} — part is reserved for ${plain.en}. It can restrict works, cap the value, or lead to expropriation. Confirm with an official planning certificate (certificat urbanístic) before offering.`,
          es: `${confirmed ? "El ayuntamiento marca esta propiedad como afectada" : "Parte de la parcela parece reservada para uso público"} — parte está reservada para ${plain.es}. Puede limitar obras, reducir el valor o llevar a expropiación. Confírmalo con un certificado urbanístico oficial antes de ofertar.`,
          ca: `${confirmed ? "L'ajuntament marca aquesta propietat com a afectada" : "Una part de la parcel·la sembla reservada per a ús públic"} — una part està reservada per a ${plain.ca}. Pot limitar obres, reduir el valor o comportar expropiació. Confirma-ho amb un certificat urbanístic oficial abans d'ofertar.`,
        },
      },
    ];
  } else if (level === "specific") {
    r.alerts = [
      ...(r.alerts ?? []),
      {
        tone: "check",
        title: {
          en: "Specific planning circumstances",
          es: "Circunstancias urbanísticas específicas",
          ca: "Circumstàncies urbanístiques específiques",
        },
        detail: {
          en: "The city notes specific circumstances for this property (a plan being processed, an area under redevelopment, or suspended permits). Check what applies before offering.",
          es: "El ayuntamiento señala circunstancias específicas (un planeamiento en trámite, un ámbito en transformación o licencias suspendidas). Comprueba qué aplica antes de ofertar.",
          ca: "L'ajuntament assenyala circumstàncies específiques (un planejament en tràmit, un àmbit en transformació o llicències suspeses). Comprova què s'aplica abans d'ofertar.",
        },
      },
    ];
  } else if (unverified) {
    r.alerts = [
      ...(r.alerts ?? []),
      {
        tone: "check",
        title: {
          en: "Planning affectation not confirmed",
          es: "Afectación urbanística sin confirmar",
          ca: "Afectació urbanística sense confirmar",
        },
        detail: {
          en: "We couldn't reach the city's affectation service for this property, so the score doesn't account for a possible planning affectation. Verify with an official planning certificate (certificat urbanístic) before offering.",
          es: "No hemos podido acceder al servicio municipal de afectaciones para esta propiedad, así que la valoración no tiene en cuenta una posible afectación urbanística. Verifícalo con un certificado urbanístico oficial antes de ofertar.",
          ca: "No hem pogut accedir al servei municipal d'afectacions per a aquesta propietat, així que la valoració no té en compte una possible afectació urbanística. Verifica-ho amb un certificat urbanístic oficial abans d'ofertar.",
        },
      },
    ];
  }
  return r;
}

// Plain-language gloss for each catalog level (official Catalan term as a tag).
const HERITAGE_LEVEL: Record<HeritageLevel, Localized> = {
  A: {
    en: "a nationally protected landmark — the strictest level (Bé Cultural d'Interès Nacional)",
    es: "un bien protegido de interés nacional — el nivel más estricto (Bé Cultural d'Interès Nacional)",
    ca: "un bé protegit d'interès nacional — el nivell més estricte (Bé Cultural d'Interès Nacional)",
  },
  B: {
    en: "a locally protected building (Bé Cultural d'Interès Local)",
    es: "un bien protegido de interés local (Bé Cultural d'Interès Local)",
    ca: "un bé protegit d'interès local (Bé Cultural d'Interès Local)",
  },
  C: {
    en: "a building of urban-planning interest — lighter protection (Bé d'Interès Urbanístic)",
    es: "un bien de interés urbanístico — protección más leve (Bé d'Interès Urbanístic)",
    ca: "un bé d'interès urbanístic — protecció més lleu (Bé d'Interès Urbanístic)",
  },
  D: {
    en: "a building of documentary interest — the lightest protection (Bé d'Interès Documental)",
    es: "un bien de interés documental — la protección más leve (Bé d'Interès Documental)",
    ca: "un bé d'interès documental — la protecció més lleu (Bé d'Interès Documental)",
  },
};

/**
 * Add a heritage status row to the urbanism section, and raise a top-of-report
 * alert for a building-specific listing (A/B → caution, C/D → check). An
 * area-wide ensemble (e.g. the whole Eixample) is reported as a neutral context
 * row, never an alert — almost every Eixample finca is inside one.
 * Run AFTER seedUrbanism, which initialises the items list this appends to.
 */
export function seedHeritage(report: Report, h: HeritageData): Report {
  const r: Report = structuredClone(report);

  if (h.level) {
    const lvl = HERITAGE_LEVEL[h.level];
    const name = h.name ? `${h.name}: ` : "";
    const meta = [h.style, h.epoch].filter(Boolean).join(", ");
    const metaClause = meta ? ` (${meta})` : "";
    const high = h.level === "A" || h.level === "B";

    r.urbanism.items.push({
      key: "heritage",
      tone: high ? "caution" : "check",
      label: { en: "Heritage", es: "Patrimonio", ca: "Patrimoni" },
      text: {
        en: `This building is heritage-listed — ${name}${lvl.en}${metaClause}. Listing restricts façade and often interior changes; expect special permits and higher, slower renovations. Check the catalog file before offering.`,
        es: `Este edificio está catalogado — ${name}${lvl.es}${metaClause}. La protección limita los cambios en fachada y a menudo en el interior; prevé permisos especiales y reformas más caras y lentas. Consulta la ficha del catálogo antes de ofertar.`,
        ca: `Aquest edifici està catalogat — ${name}${lvl.ca}${metaClause}. La protecció limita els canvis a la façana i sovint a l'interior; preveu permisos especials i reformes més cares i lentes. Consulta la fitxa del catàleg abans d'ofertar.`,
      },
    });

    r.alerts = [
      ...(r.alerts ?? []),
      {
        tone: high ? "caution" : "check",
        title: {
          en: high ? "Heritage-protected building" : "Catalogued building",
          es: high ? "Edificio protegido (patrimonio)" : "Edificio catalogado",
          ca: high ? "Edifici protegit (patrimoni)" : "Edifici catalogat",
        },
        detail: {
          en: `${h.name ? `${h.name}. ` : ""}This building is ${lvl.en}. Heritage protection restricts works (façade/interior), needs special permits, and raises renovation cost and time. Check the catalog file before offering.`,
          es: `${h.name ? `${h.name}. ` : ""}Este edificio es ${lvl.es}. La protección patrimonial limita las obras (fachada/interior), exige permisos especiales y aumenta el coste y el plazo de reforma. Consulta la ficha del catálogo antes de ofertar.`,
          ca: `${h.name ? `${h.name}. ` : ""}Aquest edifici és ${lvl.ca}. La protecció patrimonial limita les obres (façana/interior), exigeix permisos especials i augmenta el cost i el termini de la reforma. Consulta la fitxa del catàleg abans d'ofertar.`,
        },
      },
    ];
  } else if (h.inEnsemble) {
    const ens = h.ensembleName ?? "a protected ensemble";
    r.urbanism.items.push({
      key: "heritage",
      tone: "info",
      label: { en: "Heritage", es: "Patrimonio", ca: "Patrimoni" },
      text: {
        en: `The building is in a protected conservation area (${ens}). Façade changes are regulated, but there's no individual listing on this building.`,
        es: `El edificio está en un conjunto protegido (${ens}). Los cambios en fachada están regulados, pero no hay catalogación específica de este edificio.`,
        ca: `L'edifici està dins un conjunt protegit (${ens}). Els canvis a la façana estan regulats, però no hi ha catalogació específica d'aquest edifici.`,
      },
    });
  }
  return r;
}

/* ---------- computed scores → score rings ---------- */

const SCORE_CAPTION: Record<ScoreKey, (ctx: ScoreCtx) => Localized> = {
  building: ({ year }) => ({
    en: year ? `${year} · ${new Date().getFullYear() - year} yrs` : "—",
    es: year ? `${year} · ${new Date().getFullYear() - year} años` : "—",
    ca: year ? `${year} · ${new Date().getFullYear() - year} anys` : "—",
  }),
  energy: ({ energyClass }) => ({
    en: energyClass ? `Class ${energyClass}` : "—",
    es: energyClass ? `Clase ${energyClass}` : "—",
    ca: energyClass ? `Classe ${energyClass}` : "—",
  }),
  transport: ({ amenities }) => {
    const m = amenities?.metro;
    return {
      en: m?.within800 ? `${m.within800} metro within 800 m` : "Limited metro",
      es: m?.within800 ? `${m.within800} metros a 800 m` : "Metro limitado",
      ca: m?.within800 ? `${m.within800} metros a 800 m` : "Metro limitat",
    };
  },
  location: ({ amenities }) => {
    const g = amenities?.green.nearest;
    return {
      en: g ? `Green ~${g.walkMin} min` : "Urban",
      es: g ? `Zona verde ~${g.walkMin} min` : "Urbano",
      ca: g ? `Zona verda ~${g.walkMin} min` : "Urbà",
    };
  },
  price: ({ deltaPct }) => {
    if (deltaPct == null)
      return {
        en: "No barri benchmark",
        es: "Sin referencia del barrio",
        ca: "Sense referència del barri",
      };
    const pct = Math.round(Math.abs(deltaPct));
    if (deltaPct < -8)
      return {
        en: `~${pct}% below barri`,
        es: `~${pct}% bajo el barrio`,
        ca: `~${pct}% sota el barri`,
      };
    if (deltaPct > 8)
      return {
        en: `~${pct}% above barri`,
        es: `~${pct}% sobre el barrio`,
        ca: `~${pct}% sobre el barri`,
      };
    return {
      en: "In line with barri",
      es: "En línea con el barrio",
      ca: "En línia amb el barri",
    };
  },
};

interface ScoreCtx {
  year?: number;
  energyClass?: string;
  amenities?: AmenityData;
  /** Asking €/m² vs barri €/m² (Pricing.deltaPct), for the price caption. */
  deltaPct?: number;
}

/**
 * Verdict tag for a risk that overrode / dragged the overall, so the headline
 * number and the top-of-report alert agree. Returns null for none/mild — those
 * don't materially move the score and need no caveat. The detail lives in the
 * affectation/heritage/flood alerts; this is just the one-line label.
 */
function riskTag(severity: RiskSeverity): Localized | null {
  switch (severity) {
    case "critical":
      return {
        en: "Serious restriction — verify before offering",
        es: "Restricción grave — verifica antes de ofertar",
        ca: "Restricció greu — verifica abans d'oferir",
      };
    case "serious":
      return {
        en: "Notable restriction to check",
        es: "Restricción relevante a revisar",
        ca: "Restricció rellevant a revisar",
      };
    default:
      return null;
  }
}

export function seedScores(
  report: Report,
  values: Partial<Record<ScoreKey, number>>,
  overall: number | null,
  ctx: ScoreCtx,
  risk?: RiskOutcome,
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
  if (risk) {
    const tag = riskTag(risk.severity);
    if (tag) r.verdict.tag = tag;
  }
  return r;
}
