import type { ScoreKey, Band } from "@/config/scoring";

/**
 * The single structured source of truth for a report.
 *
 * Conventions:
 * - Numeric / code-like data is stored language-neutral and formatted in the UI.
 * - Any prose or value containing words is a `Localized` pair so EN + ES render
 *   from the same object. In later phases the `es` side is produced by the AI
 *   synthesis layer; here it is authored in the sample data.
 * - `toVerify: true` marks a field that could not be sourced automatically and
 *   must be confirmed by the operator / buyer (per the brief's "to verify" rule).
 */
export interface Localized {
  en: string;
  es: string;
  /** Catalan. Optional during the trilingual rollout — falls back to `es`. */
  ca?: string;
}

export type Tone = "good" | "ok" | "low";

/** A single score (0–100) plus its one-line AI commentary. */
export interface Score {
  key: ScoreKey;
  value: number;
  /** Short caption under the ring, e.g. "Prime Gràcia". */
  caption: Localized;
}

/** Key/value row used in the hero meta strip and fact grids. */
export interface Fact {
  /** i18n message key for the label (resolved via next-intl). */
  labelKey: string;
  value: Localized | string;
  accent?: boolean;
  toVerify?: boolean;
}

export interface CompRow {
  reference: Localized | string;
  price?: string;
  size?: string;
  pricePerM2?: string;
  note: Localized | string;
  /** Direct link to the listing (comparables from the idealista API). */
  url?: string;
  /** Highlight the subject property row. */
  highlight?: boolean;
}

export interface PriceRef {
  label: Localized;
  url: string;
  /** "official" benchmark, "portal" published stats, or "search" helper. */
  kind: "official" | "portal" | "search";
}

/** A pre-filtered live-listings deep link to a Spanish property portal. */
export interface LiveSearch {
  /** Display name of the portal, e.g. "Idealista" / "Fotocasa". */
  portal: string;
  /** Absolute https URL to a portal-side search page. */
  url: string;
  /** One-line description of what the link filters down to. */
  label: Localized;
}

/** Which of the three Section 03 states to render. */
export type PricingState = "asking-known" | "asking-unknown" | "barri-unavailable";

/**
 * Structured data driving the redesigned Section 03 "Price & value".
 *
 * Stance (load-bearing):
 * - never invent a single estimated value / AVM number
 * - the fair *range* is the answer
 * - barri figure is always framed as closing prices (not asking)
 * - every state carries a humility note
 */
export interface Pricing {
  state: PricingState;
  /** Catastro built area in m². */
  builtM2?: number;
  /** Subject flat's asking price + derived €/m². Present only when known. */
  asking?: { price: number; pricePerM2: number };
  /** Verdict chip — tone + per-state label. */
  chip: { tone: "clear" | "neutral" | "check"; text: Localized };
  /**
   * Verdict line displayed beneath the chip. May include a `<strong>` span
   * wrapping the delta phrase ("≈10% below"); the renderer trusts the HTML.
   */
  verdict: Localized;
  /** Barri snapshot — present in states 01 + 02. */
  barri?: {
    name: string;
    pricePerM2: number;
    avgSurfaceM2?: number;
    transactions?: number;
    /** Period label, e.g. "gen – des 2025". */
    asOf: string;
    /** barri €/m² × builtM2 — sits at 50% on the number-line by construction. */
    impliedValue: number;
  };
  /** Range bookends, present in states 01 + 02. */
  range?: { lo: number; hi: number };
  /** Δ% from asking €/m² vs barri €/m². Negative = below. State 01 only. */
  deltaPct?: number;
  /** Marker dot position on the number line [0, 1]. */
  markerPct?: number;
  /** What the marker represents. Color follows the kind. */
  marker?: { kind: "asking" | "barri-avg"; value: number };
  /**
   * Catalonia INE IPV YoY footnote — explicitly framed as too coarse to
   * price one flat. Optional, only used in state 03 ("barri-unavailable").
   */
  ipvFootnote?: Localized;
}

export interface OfferRung {
  /** "open" | "target" | "ceiling" — drives label + highlight styling. */
  kind: "open" | "target" | "ceiling";
  amount: string;
  rationale: Localized;
}

export interface RiskRow {
  labelKey: string;
  tone: Tone;
  /** Pill text, e.g. "Low" / "Watch" — resolved from i18n by tone. */
  detail: Localized;
}

export interface Panel {
  heading: Localized;
  body: Localized;
}

/** A prominent, top-of-report warning. Tone drives the signal colour. */
export type AlertTone = "caution" | "check";
export interface ReportAlert {
  tone: AlertTone;
  title: Localized;
  detail: Localized;
}

/** Tone of a planning-section row. `info`/`clear` are neutral/reassuring. */
export type PlanTone = "caution" | "check" | "clear" | "info";
/** One planning aspect, shown as a status row in the urbanism section. */
export interface UrbanismItem {
  /** Stable key for ordering/keys, e.g. "affectation" | "heritage" | "zoning". */
  key: string;
  tone: PlanTone;
  label: Localized;
  text: Localized;
}

export interface Report {
  // --- meta ---
  id: string;
  /** ISO date the report was generated. */
  generatedAt: string;
  cadastralRef: string;

  // --- hero ---
  hero: {
    /** Street / property title, e.g. "Carrer de Sors 35". */
    title: string;
    /** Floor descriptor, e.g. "3rd floor". */
    floorLabel: Localized;
    sub: Localized;
    meta: Fact[];
  };

  // --- verdict ---
  verdict: {
    headline: Localized;
    body: Localized;
    overall: number;
  };

  /**
   * Prominent top-of-report warnings shown right under the verdict (and in the
   * free preview), for issues serious enough that the buyer must see them
   * before reading on — e.g. an urbanistic affectation on the finca.
   */
  alerts?: ReportAlert[];

  // --- 01 scores ---
  scores: Score[];

  // --- 02 snapshot ---
  snapshot: {
    facts: Fact[];
    note: Localized;
  };

  // --- 03 price & value ---
  price: {
    lede: Localized;
    panels: Panel[]; // market context + this-flat-vs-market
    comps: CompRow[];
    fairValue: Localized; // keyline (explanatory text) — kept for narrative/PDF legacy paths
    /** Numeric €€ bookends of the fair-value range. Legacy alongside `pricing.range`. */
    range?: { lo: number; hi: number };
    /** Deprecated for section 03 render — kept on the type for the older narrative path. */
    liveSearches?: LiveSearch[];
    /**
     * Structured pricing payload that drives the redesigned Section 03.
     * Computed from the barri lookup + the subject flat's m² + (optional)
     * asking price. The renderer picks one of three states from `state`.
     */
    pricing?: Pricing;
    ladder: OfferRung[];
    /** Source links so the buyer can compare the price themselves. */
    references?: PriceRef[];
  };

  // --- 04 building & condition ---
  building: {
    panels: Panel[]; // what's good / what to scrutinise
    keyline: Localized;
  };

  // --- 05 risk & safety ---
  risks: RiskRow[];

  // --- 06 legal & documents ---
  legal: {
    intro: Localized;
    items: Localized[];
  };

  // --- 07 neighbourhood ---
  neighbourhood: {
    lede: Localized;
    facts: Fact[];
    note: Localized;
  };

  // --- 08 urbanism / ZBE ---
  urbanism: {
    /** One scannable row per planning aspect (affectation, heritage, zoning…). */
    items: UrbanismItem[];
  };

  // --- 09 costs & taxes ---
  costs: {
    intro: Localized;
    facts: Fact[];
    footnote: Localized;
  };

  // --- 10 tax & subsidies ---
  subsidies: {
    panels: Panel[];
  };

  // --- 11 negotiation playbook ---
  negotiation: {
    intro: Localized;
    items: Localized[];
    tactic: Localized;
  };

  // --- 12 pre-offer checklist ---
  checklist: Localized[];

  // --- footer ---
  footer: {
    sources: Localized;
    disclaimer: Localized;
  };
}

/** Convenience: which sections are gated behind the paywall (Phase 4). */
export const PREMIUM_SECTIONS = [
  "price",
  "building",
  "legal",
  "negotiation",
  "checklist",
] as const;

export type { Band };
