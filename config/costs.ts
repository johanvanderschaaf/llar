import type { Localized, Fact, TermDef } from "@/types/report";

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

  // Cost values use a "main · subtext" pattern: ReportView's `splitSubtext`
  // lifts the tail after " · " into the design's small annotation. Keep ranges
  // explicit (honest about the spread) rather than the design's exact figures.

  // ITP
  if (askingPriceEur) {
    const itp = estimateItp(askingPriceEur);
    facts.push({
      labelKey: "costs.itp",
      value: {
        en: `~${eur(itp)} · 10–13% by bracket`,
        es: `~${eur(itp)} · 10–13% por tramos`,
        ca: `~${eur(itp)} · 10–13% per trams`,
      },
    });
  } else {
    facts.push({
      labelKey: "costs.itp",
      value: {
        en: "10–13% of the price · by bracket",
        es: "10–13% del precio · por tramos",
        ca: "10–13% del preu · per trams",
      },
    });
  }

  // Notary and Land Registry are itemised separately so the grid fills both
  // cells in the design's 6-cell layout. Approximate ranges; the registry
  // is per-act and tends to come in lighter than the notary fee.
  facts.push({
    labelKey: "costs.notary",
    value: {
      en: "~€700–1,200 · approx",
      es: "~€700–1,200 · aprox.",
      ca: "~€700–1,200 · aprox.",
    },
  });
  facts.push({
    labelKey: "costs.registry",
    value: {
      en: "~€400–700 · approx",
      es: "~€400–700 · aprox.",
      ca: "~€400–700 · aprox.",
    },
  });
  facts.push({
    labelKey: "costs.gestoria",
    value: {
      en: "~€300–500 · approx",
      es: "~€300–500 · aprox.",
      ca: "~€300–500 · aprox.",
    },
  });
  facts.push({
    labelKey: "costs.valuation",
    value: {
      en: "~€300–500 · if mortgaged",
      es: "~€300–500 · si hipoteca",
      ca: "~€300–500 · si hi ha hipoteca",
    },
  });

  // All-in estimate — emphasised (accent: true → `.fact--em`).
  if (askingPriceEur) {
    const itp = estimateItp(askingPriceEur);
    const low = askingPriceEur + itp + 1300;
    const high = askingPriceEur + itp + 3000;
    facts.push({
      labelKey: "costs.allIn",
      value: both(`~${eur(low)}–${eur(high)} · about +11–13%`),
      accent: true,
    });
  } else {
    facts.push({
      labelKey: "costs.allIn",
      value: {
        en: "~+11–13% over the price",
        es: "~+11–13% sobre el precio",
        ca: "~+11–13% sobre el preu",
      },
      accent: true,
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

/** Maintained tax-relief / subsidy + buyer-obligation deflists (date-stamped).
 *  Shape mirrors the report-page design: two grouped panels rendered as
 *  definition lists. */
export function buildSubsidies(): { deductions: TermDef[]; takeOn: TermDef[] } {
  return {
    deductions: [
      {
        term: {
          en: "IRPF energy deductions",
          es: "Deducciones de IRPF por eficiencia",
          ca: "Deduccions d'IRPF per eficiència",
        },
        def: {
          en: "20% / 40% / 60% income-tax relief on qualifying efficiency works (windows, insulation, heating). Keep invoices and the before/after energy certificates.",
          es: "Desgravación del 20% / 40% / 60% por obras que cumplan requisitos (ventanas, aislamiento, calefacción). Guarda facturas y los certificados energéticos antes/después.",
          ca: "Desgravació del 20% / 40% / 60% per obres que compleixin els requisits (finestres, aïllament, calefacció). Guarda factures i els certificats energètics abans/després.",
        },
      },
      {
        term: {
          en: "Next Generation rehabilitation",
          es: "Rehabilitación Next Generation",
          ca: "Rehabilitació Next Generation",
        },
        def: {
          en: "Grants of 40–80% on qualifying works (up to ~€21k/home), largely exhausted or waitlisted in Catalonia. Funds must be justified by 30 June 2026, so don't count on them for a future reform.",
          es: "Ayudas del 40–80% sobre obras (hasta ~21.000 €/vivienda), en gran parte agotadas o en lista de espera en Cataluña. Los fondos deben justificarse antes del 30 de junio de 2026: no cuentes con ellos para una reforma futura.",
          ca: "Ajuts del 40–80% sobre obres (fins a ~21.000 €/habitatge), en gran part exhaurits o en llista d'espera a Catalunya. Els fons s'han de justificar abans del 30 de juny de 2026: no hi comptis per a una reforma futura.",
        },
      },
      {
        term: {
          en: "Young-buyer support",
          es: "Ayuda a compradores jóvenes",
          ca: "Ajut a compradors joves",
        },
        def: {
          en: "Public guarantee schemes can help cover part of the deposit on a first habitual home; bracket-reduced ITP may also apply for buyers aged 35 or under.",
          es: "Los avales públicos pueden cubrir parte de la entrada de una primera vivienda habitual; también puede aplicarse el ITP reducido por tramo para compradores de hasta 35 años.",
          ca: "Els avals públics poden cobrir part de l'entrada d'un primer habitatge habitual; també pot aplicar-se l'ITP reduït per tram per a compradors de fins a 35 anys.",
        },
      },
    ],
    takeOn: [
      {
        term: {
          en: "Pending derrama",
          es: "Derrama pendiente",
          ca: "Derrama pendent",
        },
        def: {
          en: "Any special levy already voted by the community usually transfers with the flat. Ask for the last two community minutes (actes) before you offer.",
          es: "Cualquier cuota extraordinaria ya aprobada por la comunidad suele transferirse con el piso. Pide las dos últimas actas de la comunidad antes de ofertar.",
          ca: "Qualsevol quota extraordinària ja aprovada per la comunitat sol transferir-se amb el pis. Demana les dues últimes actes de la comunitat abans d'ofertar.",
        },
      },
      {
        term: {
          en: "ITE works",
          es: "Obras de la ITE",
          ca: "Obres de la ITE",
        },
        def: {
          en: "If the technical inspection is unmet or has flagged works, the obligation passes to owners. Confirm the certificate and the works plan, if any.",
          es: "Si la inspección técnica no se ha cumplido o ha señalado obras, la obligación pasa a los propietarios. Confirma el certificado y el plan de obras, si existe.",
          ca: "Si la inspecció tècnica no s'ha complert o ha assenyalat obres, l'obligació passa als propietaris. Confirma el certificat i el pla d'obres, si n'hi ha.",
        },
      },
      {
        term: {
          en: "Ongoing charges",
          es: "Gastos recurrentes",
          ca: "Despeses recurrents",
        },
        def: {
          en: "IBI (property tax) annually, plus monthly community fees. Plusvalía municipal is normally paid by the seller. Ask for current amounts before offering.",
          es: "IBI (impuesto de bienes inmuebles) anual, más cuota de comunidad mensual. La plusvalía municipal la paga normalmente el vendedor. Pide los importes actuales antes de ofertar.",
          ca: "IBI (impost de béns immobles) anual, més quota de comunitat mensual. La plusvàlua municipal normalment la paga el venedor. Demana els imports actuals abans d'ofertar.",
        },
      },
    ],
  };
}
