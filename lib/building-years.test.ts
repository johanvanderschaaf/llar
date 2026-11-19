import { describe, expect, it } from "vitest";
import { buildingYears } from "./building-years";

describe("buildingYears", () => {
  it("reads an older catalogue epoch as the build date and Catastro's year as a renovation", () => {
    expect(buildingYears(2017, "1898-1900 ")).toEqual({ effective: 2017, original: 1898, originalLabel: "1898–1900", ageYear: 1898 });
  });
  it("keeps Catastro's year when the epoch is close or missing", () => {
    expect(buildingYears(1965, "1960-1965")).toEqual({ effective: 1965, ageYear: 1965 });
    expect(buildingYears(1965, undefined)).toEqual({ effective: 1965, ageYear: 1965 });
    expect(buildingYears(1965, "Modernista")).toEqual({ effective: 1965, ageYear: 1965 });
  });
  it("handles a missing Catastro year", () => {
    expect(buildingYears(undefined, "1898")).toEqual({ effective: undefined, ageYear: undefined });
  });
});
