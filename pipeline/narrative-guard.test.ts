import { describe, expect, it } from "vitest";
import { contractArticles, fieldProblem, guardList, numbersIn, tidy, type GuardFacts } from "./narrative-guard";

const facts = {
  asking: 900000,
  priceComparison: { askingPerM2Built: 4369, barriClosingPerM2: 6831, gapPercent: 36, gapDirection: "below" },
  building: [{ fact: "Built 1898–1900 (heritage catalogue), so about 128 years old." }],
  period: "gener 2025 - desembre 2025",
};
const g: GuardFacts = { known: [...numbersIn(facts), 2026], gapDirection: "below" };
const L = (en: string, es = en, ca = en) => ({ en, es, ca });

describe("narrative guard", () => {
  it("rejects the gap stated in the wrong direction (seen in testing)", () => {
    expect(fieldProblem(L("Asking 32% above barri closing average"), g)).toMatch(/number 32|wrong direction/);
    expect(fieldProblem(L("Asking about 36% above the barri average"), g)).toBe("price gap in the wrong direction");
    expect(fieldProblem(L("Asking about 36% below the barri average"), g)).toBeNull();
    expect(fieldProblem(L("x", "un 36% por encima de la media", "x"), g)).toBe("price gap in the wrong direction");
  });

  it("rejects numbers the AI calculated itself", () => {
    expect(fieldProblem(L("The usable-to-built ratio is approximately 92%."), g)).toBe("number 92 is not in the facts");
    expect(fieldProblem(L("At €900,000 (€4,369/m²) against €6,831/m² in 2025."), g)).toBeNull();
    expect(fieldProblem(L("x", "900.000 € (4.369 €/m²)", "6.831 €/m²"), g)).toBeNull();
  });

  it("rejects verdict words and empty text", () => {
    expect(fieldProblem(L("A bargain for the area."), g)).toMatch(/verdict word/);
    expect(fieldProblem(L("Un precio razonable."), g)).toMatch(/verdict word/);
    expect(fieldProblem(L("ok", ""), g)).toBe("empty");
  });

  it("keeps a list only when enough items pass", () => {
    const items = [L("Visit twice."), L("Count the mailboxes."), L("Ratio is 92%.")];
    expect(guardList(items, (c) => [c], g, 2).kept).toHaveLength(2);
    expect(guardList(items, (c) => [c], g, 3).kept).toBeNull();
    expect(guardList([], (c) => [c], g, 1).kept).toBeNull();
  });

  it("contracts articles and removes em-dashes", () => {
    expect(contractArticles("la media de el Raval y a el Clot", "es")).toBe("la media del Raval y al Clot");
    expect(contractArticles("a els Penitents, per el Poblenou, de el Coll", "ca")).toBe("als Penitents, pel Poblenou, del Coll");
    expect(contractArticles("El Salvador", "es")).toBe("El Salvador");
    expect(tidy(L("A — B")).en).toBe("A, B");
  });
});
