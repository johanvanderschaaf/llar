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

export const scoreConfig: Record<ScoreKey, ScoreMeta> = {
  location: { weight: 0.25 },
  transport: { weight: 0.15 },
  building: { weight: 0.2 },
  price: { weight: 0.3 },
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

export interface ScoreInputs {
  yearBuilt?: number;
  /** Energy certificate letter A–G, if known. */
  energyClass?: string;
  amenities?: AmenityData;
}

/** Pick the first band whose threshold the value is below. */
function band(value: number, table: [number, number][], fallback: number) {
  for (const [limit, score] of table) if (value < limit) return score;
  return fallback;
}

function buildingScore(year: number): number {
  const age = new Date().getFullYear() - year;
  return band(
    age,
    [
      [10, 90],
      [25, 80],
      [45, 68],
      [65, 58],
      [85, 50],
    ],
    42,
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

/** Compute the scores we can derive; omit any we lack data for (e.g. price). */
export function computeScores(inp: ScoreInputs): {
  values: Partial<Record<ScoreKey, number>>;
  overall: number | null;
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

  const keys = Object.keys(values) as ScoreKey[];
  if (keys.length === 0) return { values, overall: null };
  const totalW = keys.reduce((s, k) => s + scoreConfig[k].weight, 0);
  const overall = Math.round(
    keys.reduce((s, k) => s + values[k]! * scoreConfig[k].weight, 0) / totalW,
  );
  return { values, overall };
}

/** Banding used for ring colour + pills (good / ok / low). */
export type Band = "good" | "ok" | "low";

export function bandFor(score: number): Band {
  if (score >= 70) return "good";
  if (score >= 50) return "ok";
  return "low";
}
