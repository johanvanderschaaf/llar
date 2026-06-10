/**
 * Scoring rubric configuration (single tunable source).
 *
 * Phase 1: only the weights + metadata live here so the overall score's
 * derivation is documented and adjustable. The deterministic computation from
 * raw data lands in Phase 3 (AI/scoring layer); for now sample reports carry
 * pre-computed score values.
 */
export type ScoreKey =
  | "location"
  | "transport"
  | "building"
  | "price"
  | "energy";

export interface ScoreMeta {
  /** Weight in the overall weighted average. Weights are normalised at runtime. */
  weight: number;
}

// Weights for the five quality pillars. Risk is NOT a pillar — it applies as a
// modifier on the overall (see assessRisk) so a serious finding can override the
// weighted average entirely. Weights are normalised at runtime, so only their
// ratios matter; they sum to 0.80 because the remaining 0.20 of buyer concern is
// expressed through the risk modifier rather than an averaged pillar.
export const scoreConfig: Record<ScoreKey, ScoreMeta> = {
  price: { weight: 0.25 },
  location: { weight: 0.18 },
  building: { weight: 0.15 },
  transport: { weight: 0.12 },
  energy: { weight: 0.1 },
};

/** Ordered list of scores as shown in the report's Scores grid. */
export const scoreOrder: ScoreKey[] = [
  "location",
  "transport",
  "building",
  "price",
  "energy",
];

/** Compute a 0–100 weighted overall from individual scores. */
export function computeOverall(scores: Record<ScoreKey, number>): number {
  const totalWeight = Object.values(scoreConfig).reduce(
    (sum, m) => sum + m.weight,
    0,
  );
  const weighted = (Object.keys(scoreConfig) as ScoreKey[]).reduce(
    (sum, key) => sum + scores[key] * scoreConfig[key].weight,
    0,
  );
  return Math.round(weighted / totalWeight);
}

/* ---------- deterministic score computation ---------- */

import type { AmenityData } from "@/adapters/amenities";
import type { AffectationCategory } from "@/adapters/affectation";
import type { FloodLevel } from "@/adapters/flood";
import type { HeritageLevel } from "@/adapters/heritage";

export interface ScoreInputs {
  yearBuilt?: number;
  /** Energy certificate letter A–G, if known. */
  energyClass?: string;
  amenities?: AmenityData;
  /** Asking €/m² vs barri €/m², from Pricing.deltaPct. Negative = below market. */
  deltaPct?: number;
  /** Inputs for the risk modifier applied to the overall (not a pillar). */
  risk?: RiskInputs;
}

/* ---------- risk modifier (overrides the weighted average) ---------- */

/**
 * Risk inputs, mapped straight from the adapter categories:
 * - `affectation` — AFH verdict: "A" = the finca HAS an urbanistic affectation
 *   (expropriation / planning-system exposure), "C"/"D" = worth checking,
 *   "B" = clear.
 * - `flood` — ACA/SNCZI fluvial zone: high (T10) / medium (T100) / low (T500).
 * - `heritageLevel` — building-specific catalogue level A–D (ensembles are
 *   context, not a building constraint, so they are not passed here).
 */
export interface RiskInputs {
  affectation?: AffectationCategory;
  flood?: FloodLevel;
  heritageLevel?: HeritageLevel;
}

export type RiskSeverity = "critical" | "serious" | "moderate" | "mild" | "none";

export interface RiskOutcome {
  /** Compounded multiplicative penalty applied to the base, before the cap. */
  factor: number;
  /** Hard ceiling on the overall — the override primitive. Infinity if none. */
  cap: number;
  /** Most severe active risk, for the verdict tag + colour. */
  severity: RiskSeverity;
}

/**
 * Hard ceiling for a confirmed affectation (category A). A near-perfect flat
 * with expropriation exposure must still read as a serious caution — even all
 * green pillars can't lift the overall above this. Tunable single knob.
 */
export const CRITICAL_CAP = 30;

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

export function assessRisk(r: RiskInputs): RiskOutcome {
  let factor = 1;
  let cap = Infinity;
  let severity: RiskSeverity = "none";
  const escalate = (s: RiskSeverity) => {
    if (SEVERITY_RANK[s] > SEVERITY_RANK[severity]) severity = s;
  };

  // Affectation — category A is the override; C/D are a multiplicative caution.
  if (r.affectation === "A") {
    cap = CRITICAL_CAP;
    escalate("critical");
  } else if (r.affectation === "C" || r.affectation === "D") {
    factor *= 0.85;
    escalate("serious");
  }

  // Flood — frequency-weighted. T500 ("low") is not penalised: a 1-in-500-year
  // floodplain covers much of Barcelona and is effectively negligible.
  if (r.flood === "high") {
    factor *= 0.8;
    escalate("serious");
  } else if (r.flood === "medium") {
    factor *= 0.9;
    escalate("moderate");
  }

  // Heritage — a renovation constraint (cost/permits), so a mild negative that
  // scales with protection level.
  if (r.heritageLevel === "A") {
    factor *= 0.95;
    escalate("mild");
  } else if (r.heritageLevel === "B") {
    factor *= 0.96;
    escalate("mild");
  } else if (r.heritageLevel === "C" || r.heritageLevel === "D") {
    factor *= 0.98;
    escalate("mild");
  }

  return { factor, cap, severity };
}

/**
 * Price pillar from the asking-vs-barri gap (Pricing.deltaPct, negative =
 * below market). Absolute bands matching the ±15% fair-range stance.
 */
function priceScore(deltaPct: number): number {
  if (deltaPct < -20) return 90;
  if (deltaPct < -8) return 82;
  if (deltaPct <= 8) return 74;
  if (deltaPct <= 18) return 60;
  return 44;
}

/** Pick the first band whose threshold the value is below. */
function band(value: number, table: [number, number][], fallback: number) {
  for (const [limit, score] of table) if (value < limit) return score;
  return fallback;
}

// Age is a weak proxy for building quality in Barcelona, where most of the
// desirable stock (Eixample, Gràcia) predates 1930. New construction earns a
// real bonus (modern standards, lift, no aluminosi-era risk), but old stock is
// the norm and stays a solid "ok" rather than being penalised toward the floor.
function buildingScore(year: number): number {
  const age = new Date().getFullYear() - year;
  return band(
    age,
    [
      [10, 88],
      [30, 80],
      [60, 73],
      [100, 67],
    ],
    63,
  );
}

function energyScore(letter: string): number | undefined {
  const map: Record<string, number> = {
    A: 95, B: 86, C: 74, D: 60, E: 46, F: 32, G: 22,
  };
  return map[letter.trim().toUpperCase()[0]];
}

function transportScore(a: AmenityData): number {
  const d = a.metro.nearest?.distanceM;
  if (d == null) return 40;
  const base = band(d, [[250, 85], [450, 76], [700, 66], [1000, 55]], 45);
  return Math.min(95, base + Math.min(a.metro.within800 * 3, 12));
}

function locationScore(a: AmenityData): number {
  const near = (p?: { distanceM: number }) => p?.distanceM ?? Infinity;
  const green = band(near(a.green.nearest), [[300, 90], [600, 78], [1000, 64]], 50);
  const sup = band(near(a.supermarket.nearest), [[200, 90], [400, 80], [700, 66]], 50);
  const mkt = band(near(a.market.nearest), [[400, 85], [800, 72], [1500, 62]], 55);
  const sch = a.schools.within1000 >= 3 ? 85 : a.schools.within1000 >= 1 ? 72 : 58;
  const health = band(near(a.health.nearest), [[500, 85], [1000, 72], [1800, 62]], 55);
  return Math.round((green + sup + mkt + sch + health) / 5);
}

/**
 * Compute the pillars we can derive (omitting any we lack data for), then apply
 * the risk modifier to the weighted overall. Pillars stay untouched — the risk
 * outcome is returned separately so the caller can flag the verdict.
 */
export function computeScores(inp: ScoreInputs): {
  values: Partial<Record<ScoreKey, number>>;
  overall: number | null;
  risk: RiskOutcome;
} {
  const values: Partial<Record<ScoreKey, number>> = {};
  if (inp.yearBuilt) values.building = buildingScore(inp.yearBuilt);
  if (inp.energyClass) {
    const e = energyScore(inp.energyClass);
    if (e !== undefined) values.energy = e;
  }
  if (inp.amenities) {
    values.transport = transportScore(inp.amenities);
    values.location = locationScore(inp.amenities);
  }
  if (inp.deltaPct != null) values.price = priceScore(inp.deltaPct);

  const risk = assessRisk(inp.risk ?? {});

  const keys = Object.keys(values) as ScoreKey[];
  if (keys.length === 0) return { values, overall: null, risk };
  const totalW = keys.reduce((s, k) => s + scoreConfig[k].weight, 0);
  const base =
    keys.reduce((s, k) => s + values[k]! * scoreConfig[k].weight, 0) / totalW;
  // Apply the risk modifier: compounded factors, then the hard cap (override).
  let overall = Math.round(base * risk.factor);
  if (overall > risk.cap) overall = risk.cap;
  overall = Math.max(0, Math.min(100, overall));
  return { values, overall, risk };
}

/** Banding used for ring colour + pills (good / ok / low). */
export type Band = "good" | "ok" | "low";

export function bandFor(score: number): Band {
  if (score >= 70) return "good";
  if (score >= 50) return "ok";
  return "low";
}
