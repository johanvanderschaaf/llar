import { describe, it, expect } from "vitest";
import {
  computeScores,
  assessRisk,
  bandFor,
  CRITICAL_CAP,
  type ScoreInputs,
} from "./scoring";
import type { AmenityData } from "@/adapters/amenities";

// A strong amenities profile so the non-price pillars land high — lets us prove
// the risk modifier overrides an otherwise-excellent flat.
const strongAmenities = {
  metro: { nearest: { distanceM: 200 }, within800: 4 },
  green: { nearest: { distanceM: 250, walkMin: 3 } },
  supermarket: { nearest: { distanceM: 150 } },
  market: { nearest: { distanceM: 300 } },
  schools: { within1000: 3 },
  health: { nearest: { distanceM: 400 } },
} as unknown as AmenityData;

const strong: ScoreInputs = {
  yearBuilt: 2015,
  energyClass: "B",
  amenities: strongAmenities,
  deltaPct: -10,
};

describe("priceScore bands", () => {
  const cases: [number, number][] = [
    [-25, 90],
    [-10, 82],
    [0, 74],
    [8, 74],
    [12, 60],
    [25, 44],
  ];
  for (const [delta, expected] of cases) {
    it(`deltaPct ${delta} -> ${expected}`, () => {
      expect(computeScores({ deltaPct: delta }).values.price).toBe(expected);
    });
  }

  it("omits the price pillar entirely when asking is unknown", () => {
    const r = computeScores({ amenities: strongAmenities });
    expect(r.values.price).toBeUndefined();
  });
});

describe("risk modifier", () => {
  it("does nothing for a clean flat", () => {
    const r = computeScores(strong);
    expect(r.risk.severity).toBe("none");
    expect(r.overall).toBe(85);
  });

  it("affectation A hard-caps the overall at CRITICAL_CAP, overriding green pillars", () => {
    const r = computeScores({ ...strong, risk: { affectation: "A" } });
    expect(r.risk.severity).toBe("critical");
    expect(r.overall).toBe(CRITICAL_CAP);
    expect(r.overall).toBeLessThanOrEqual(30);
  });

  it("the cap dominates even when another risk also applies", () => {
    const r = computeScores({
      ...strong,
      risk: { affectation: "A", flood: "high" },
    });
    expect(r.overall).toBe(CRITICAL_CAP);
    expect(r.risk.severity).toBe("critical");
  });

  it("affectation C/D applies a multiplicative caution, not a cap", () => {
    const r = computeScores({ ...strong, risk: { affectation: "C" } });
    expect(r.risk.severity).toBe("serious");
    expect(r.overall).toBe(72); // round(85 * 0.85)
  });

  it("flood severity is frequency-weighted; T500 (low) is not penalised", () => {
    expect(computeScores({ ...strong, risk: { flood: "high" } }).overall).toBe(68);
    expect(computeScores({ ...strong, risk: { flood: "medium" } }).overall).toBe(77);
    const low = computeScores({ ...strong, risk: { flood: "low" } });
    expect(low.overall).toBe(85); // unchanged from the clean base
    expect(low.risk.severity).toBe("none");
  });

  it("heritage is only a mild negative", () => {
    const r = computeScores({ ...strong, risk: { heritageLevel: "A" } });
    expect(r.risk.severity).toBe("mild");
    expect(r.overall).toBe(81); // round(85 * 0.95)
  });

  it("compounds multiple non-critical factors", () => {
    const r = assessRisk({ flood: "medium", heritageLevel: "A" });
    expect(r.factor).toBeCloseTo(0.9 * 0.95, 5);
    expect(r.cap).toBe(Infinity);
    expect(r.severity).toBe("moderate"); // most severe of moderate + mild
  });

  it("category B is treated as clean (no penalty, no cap)", () => {
    const r = assessRisk({ affectation: "B" });
    expect(r.factor).toBe(1);
    expect(r.cap).toBe(Infinity);
    expect(r.severity).toBe("none");
  });
});

describe("re-normalization with missing pillars", () => {
  it("computes an overall from the pillars present (no price, no energy)", () => {
    const r = computeScores({ yearBuilt: 2015, amenities: strongAmenities });
    expect(r.values.price).toBeUndefined();
    expect(r.values.energy).toBeUndefined();
    expect(r.overall).not.toBeNull();
    expect(r.overall!).toBeGreaterThan(0);
  });

  it("returns a null overall when no pillar has data", () => {
    const r = computeScores({});
    expect(r.overall).toBeNull();
    expect(Object.keys(r.values)).toHaveLength(0);
  });
});

describe("bandFor", () => {
  it("maps to good/ok/low at the 70/50 thresholds", () => {
    expect(bandFor(70)).toBe("good");
    expect(bandFor(69)).toBe("ok");
    expect(bandFor(50)).toBe("ok");
    expect(bandFor(49)).toBe("low");
    expect(bandFor(CRITICAL_CAP)).toBe("low"); // a capped flat reads as a caution
  });
});
