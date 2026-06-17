import type { Localized, Fact, Panel } from "@/types/report";

/**
 * Operator-maintained, date-stamped acquisition-cost + tax facts for buying a
 * resale flat in Barcelona (Catalonia). Deterministic, NOT AI-written, since
 * these are financial/legal figures. Review when rates change.
 *
 * IMPORTANT: figures are ESTIMATES/orientation. The Catalan ITP scale was
 * reformed in 2025; reduced rates exist (young buyers, large families, etc.).
 * Always shown with a "confirm with your gestor" caveat.
 */
export const COSTS_AS_OF = "2026-06";

/** Catalonia ITP (resale) marginal brackets [upperLimit €, rate]. */
const ITP_BRACKETS: [number, number][] = [
  [600_000, 0.1],
  [900_000, 0.11],
  [1_500_000, 0.12],
  [Infinity, 0.13],
];

/** Estimated ITP for a resale price, applied marginally by bracket. */
export function estimateItp(price: number): number {
  let prev = 0;
  let tax = 0;
  for (const [upper, rate] of ITP_BRACKETS) {
    const band = Math.min(price, upper) - prev;
    if (band <= 0) break;
    tax += band * rate;
    prev = upper;
    if (price <= upper) break;
  }
  return Math.round(tax);
}

const eur = (n: number) => `€${Math.round(n).toLocaleString("en-GB")}`;
const both = (s: string): Localized => ({ en: s, es: s, ca: s });

/** Build the deterministic cost facts (ITP, fees, total) for a price. */
export function buildCostFacts(askingPriceEur?: number): {
  intro: Localized;
  facts: Fact[];
  footnote: Localized;
} {
  const facts: Fact[] = [];

  // ITP
  if (askingPriceEur) {
    const itp = estimateItp(askingPriceEur);
    facts.push({
      labelKey: "costs.itp",
      value: {
        en: `~${eur(itp)} (10–13% by bracket)`,
        es: `~${eur(itp)} (10–13% por tramos)`,
        ca: `~${eur(itp)} (10–13% per trams)`,
      },
    });
  } else {
    facts.push({
      labelKey: "costs.itp",
      value: {
        en: "10–13% of the price (by bracket)",
        es: "10–13% del precio (por tramos)",
        ca: "10–13% del preu (per trams)",
      },
    });
  }

  facts.push({ labelKey: "costs.notary", value: both("~€1,000–2,500") });
  facts.push({ labelKey: "costs.gestoria", value: both("~€300–500") });
  facts.push({
    labelKey: "costs.valuation",
    value: {
      en: "~€300–500 (if mortgaged)",
      es: "~€300–500 (si hipoteca)",
      ca: "~€300–500 (si hi ha hipoteca)",
    },
  });

  // All-in estimate
  if (askingPriceEur) {
    const itp = estimateItp(askingPriceEur);
    const low = askingPriceEur + itp + 1300;
    const high = askingPriceEur + itp + 3000;
    facts.push({
      labelKey: "costs.allIn",
      value: both(`~${eur(low)}–${eur(high)}`),
    });
  } else {
    facts.push({
      labelKey: "costs.allIn",
      value: { en: "~+11–13% over the price", es: "~+11–13% sobre el precio", ca: "~+11–13% sobre el preu" },
    });
  }

  return {
    facts,
    intro: {
      en: "As a resale in Catalonia, the purchase carries transfer tax (ITP), not VAT. Budget roughly 11–13% over the price for taxes and fees.",
      es: "Al ser una segunda transmisión en Cataluña, la compra conlleva el impuesto de transmisiones (ITP), no IVA. Presupuesta aproximadamente un 11–13% sobre el precio en impuestos y gastos.",
      ca: "Com que és una segona transmissió a Catalunya, la compra comporta l'impost de transmissions (ITP), no IVA. Pressuposta aproximadament un 11–13% sobre el preu en impostos i despeses.",
    },
    footnote: {
      en: `The Catalan ITP scale was reformed in 2025 (progressive brackets). Reduced rates may apply (e.g. buyers aged ≤35, large families, habitual residence). Confirm the exact rate and any reductions with your gestor. Remember the annual IBI and community fees. Figures as of ${COSTS_AS_OF}.`,
      es: `La escala del ITP catalán se reformó en 2025 (tramos progresivos). Pueden aplicar tipos reducidos (p. ej. compradores ≤35 años, familia numerosa, vivienda habitual). Confirma el tipo exacto y las reducciones con tu gestor. Recuerda el IBI anual y los gastos de comunidad. Datos a ${COSTS_AS_OF}.`,
      ca: `L'escala de l'ITP català es va reformar el 2025 (trams progressius). Poden aplicar-se tipus reduïts (p. ex. compradors de ≤35 anys, família nombrosa, habitatge habitual). Confirma el tipus exacte i les reduccions amb el teu gestor. Recorda l'IBI anual i les despeses de comunitat. Dades a ${COSTS_AS_OF}.`,
    },
  };
}

/** Maintained tax-relief / subsidy panels (date-stamped). */
export function buildSubsidyPanels(): Panel[] {
  return [
    {
      heading: { en: "Still available", es: "Aún disponible", ca: "Encara disponible" },
      body: {
        en: "IRPF energy deductions, 20% / 40% / 60% income-tax relief for qualifying efficiency works (windows, insulation, heating). Useful if you upgrade the flat later; keep invoices and the energy certificates.",
        es: "Deducciones de IRPF por eficiencia energética, desgravación del 20% / 40% / 60% por obras que cumplan requisitos (ventanas, aislamiento, calefacción). Útil si mejoras el piso más adelante; guarda facturas y los certificados energéticos.",
        ca: "Deduccions d'IRPF per eficiència energètica, desgravació del 20% / 40% / 60% per obres que compleixin els requisits (finestres, aïllament, calefacció). Útil si millores el pis més endavant; guarda factures i els certificats energètics.",
      },
    },
    {
      heading: { en: "Closing window", es: "Ventana que se cierra", ca: "Finestra que es tanca" },
      body: {
        en: "Next Generation grants (40–80% of works, up to ~€21k/home) are largely exhausted or waitlisted in Catalonia and must be justified by 30 June 2026, don't count on them for a future reform.",
        es: "Las ayudas Next Generation (40–80% de la obra, hasta ~21.000 €/vivienda) están en gran parte agotadas o en lista de espera en Cataluña y deben justificarse antes del 30 de junio de 2026: no cuentes con ellas para una reforma futura.",
        ca: "Els ajuts Next Generation (40–80% de l'obra, fins a ~21.000 €/habitatge) estan en gran part exhaurits o en llista d'espera a Catalunya i s'han de justificar abans del 30 de juny de 2026: no comptis amb ells per a una reforma futura.",
      },
    },
    {
      heading: { en: "Don't forget", es: "No olvides", ca: "No oblidis" },
      body: {
        en: "Plusvalía municipal is normally paid by the seller. As the buyer you take on the annual IBI (property tax) and community fees, ask for the current amounts before you offer.",
        es: "La plusvalía municipal la paga normalmente el vendedor. Como comprador asumes el IBI anual y los gastos de comunidad: pide los importes actuales antes de ofertar.",
        ca: "La plusvàlua municipal normalment la paga el venedor. Com a comprador assumeixes l'IBI anual i les despeses de comunitat: demana els imports actuals abans d'ofertar.",
      },
    },
  ];
}
