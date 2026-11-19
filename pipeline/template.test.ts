import { describe, it, expect } from "vitest";
import {
  emptyReport,
  seedUrbanism,
  seedEnergyMissing,
  seedBarriPricing,
  seedRisks,
  seedHeritage,
} from "./template";
import type { UrbanismData } from "@/adapters/urbanism";
import type { AffectationData } from "@/adapters/affectation";
import type { GencatBarriData } from "@/adapters/gencat-barri";

const EMPTY_URBANISM = {
  possibleAffectation: false,
  affectations: [],
  qualifications: [],
  method: "bcn-point",
  mapUrl: "",
} as unknown as UrbanismData;

const affErr = () => emptyReport("test-id", "0000000000000000000A");

const findAffItem = (r: ReturnType<typeof seedUrbanism>) =>
  r.urbanism.items.find((i) => i.key === "affectation")!;

describe("seedUrbanism — affectation flagging (no operator review)", () => {
  it("confirmed clear (AFH category B): clear tone, no alert", () => {
    const a = { category: "B", affected: false } as AffectationData;
    const r = seedUrbanism(affErr(), EMPTY_URBANISM, a);
    expect(findAffItem(r).tone).toBe("clear");
    expect(r.alerts ?? []).toHaveLength(0);
  });

  it("AFH unavailable + nothing inferred: flags as unverified with a check alert", () => {
    const r = seedUrbanism(affErr(), EMPTY_URBANISM, undefined);
    expect(findAffItem(r).tone).toBe("check");
    const alerts = r.alerts ?? [];
    expect(alerts).toHaveLength(1);
    expect(alerts[0].tone).toBe("check");
    // Must read as provisional, not a confirmed all-clear.
    expect(alerts[0].title.en.toLowerCase()).toContain("not confirmed");
  });

  it("AFH category A: caution tone + caution alert (the override case)", () => {
    const a = { category: "A", affected: true } as AffectationData;
    const r = seedUrbanism(affErr(), EMPTY_URBANISM, a);
    expect(findAffItem(r).tone).toBe("caution");
    const alerts = r.alerts ?? [];
    expect(alerts).toHaveLength(1);
    expect(alerts[0].tone).toBe("caution");
  });
});

describe("seedBarriPricing — single authoritative location", () => {
  const barri = {
    barriCode: "31",
    name: "la Vila de Gràcia",
    districtCode: "06",
    pricePerM2: 5584,
    asOf: "gen – des 2025",
  } as GencatBarriData;

  it("adds a snapshot fact with barri + district from the same lookup", () => {
    const r = seedBarriPricing(emptyReport("id", "ref"), barri, {
      askingPriceEur: 500000,
      builtM2: 90,
    });
    const loc = r.snapshot.facts.find(
      (f) => f.labelKey === "snapshot.neighbourhood",
    );
    expect(loc).toBeTruthy();
    // District derived from the barri's own districtCode → always agrees.
    expect(loc!.value).toBe("la Vila de Gràcia · Gràcia");
  });
});

describe("seedEnergyMissing", () => {
  it("states 'not certified' where energy would appear", () => {
    const r = seedEnergyMissing(emptyReport("id", "ref"));
    const meta = r.hero.meta.find((m) => m.labelKey === "meta.energy");
    expect(meta).toBeTruthy();
    expect((meta!.value as { en: string }).en).toBe("Not certified");
    const risk = r.risks.find((x) => x.labelKey === "risk.energy");
    expect(risk?.detail.en.toLowerCase()).toContain("no energy performance certificate");
  });
});

describe("seedRisks — flood", () => {
  const base = () => emptyReport("test-id", "0000000000000000000A");

  it("tells the buyer when the flood map couldn't be checked", () => {
    const r = seedRisks(base(), { floodUnchecked: true });
    const flood = r.risks.find((x) => x.labelKey === "risk.flood");
    expect(flood?.tone).toBe("ok");
    expect(flood?.detail.en).toMatch(/couldn't be checked/);
    expect(flood?.detail.es).toBeTruthy();
    expect(flood?.detail.ca).toBeTruthy();
  });

  it("shows the real result when the check worked", () => {
    const r = seedRisks(base(), {
      flood: { level: "low", inT10: false, inT100: false, inT500: false },
      floodUnchecked: false,
    });
    const rows = r.risks.filter((x) => x.labelKey === "risk.flood");
    expect(rows).toHaveLength(1);
    expect(rows[0].tone).toBe("good");
  });
});

describe("serious-risk alerts in the free preview", () => {
  const base = () => emptyReport("test-id", "0000000000000000000A");

  it("raises a flood alert with a general preview line for T10 and T100 zones", () => {
    const high = seedRisks(base(), { flood: { level: "high", inT10: true, inT100: true, inT500: true } });
    expect(high.alerts?.[0].tone).toBe("caution");
    expect(high.alerts?.[0].detail.en).toMatch(/T10/);
    expect(high.alerts?.[0].previewDetail?.en).not.toMatch(/T10|T100/);

    const medium = seedRisks(base(), { flood: { level: "medium", inT10: false, inT100: true, inT500: true } });
    expect(medium.alerts?.[0].tone).toBe("check");
    expect(medium.alerts?.[0].previewDetail?.es).toBeTruthy();

    const low = seedRisks(base(), { flood: { level: "low", inT10: false, inT100: false, inT500: false } });
    expect(low.alerts ?? []).toHaveLength(0);
  });

  it("gives the heritage alert a general preview line without the level", () => {
    const r = seedHeritage(base(), { level: "B", name: "Casa Test", inEnsemble: false } as Parameters<typeof seedHeritage>[1]);
    const a = r.alerts?.find((x) => /Heritage|Catalogued/.test(x.title.en));
    expect(a?.previewDetail?.en).toMatch(/heritage catalogue/);
    expect(a?.previewDetail?.en).not.toMatch(/Casa Test|level|B\b/);
    expect(a?.detail.en).toMatch(/Casa Test/);
  });
});

describe("price section wording", () => {
  const barri = (name: string, transactions = 400) => ({
    barriCode: "01", name, pricePerM2: 3645, transactions, asOf: "gener 2025 - desembre 2025",
  });
  it("contracts articles and uses local number formats", () => {
    const r = seedBarriPricing(emptyReport("t", "0000000000000000000A"), barri("el Raval"), { askingPriceEur: 280_000, builtM2: 96 });
    const all = [r.price.lede, r.price.fairValue, r.price.pricing!.verdictSub!].flatMap((l) => [l.es, l.ca ?? ""]).join("\n");
    expect(all).not.toMatch(/\b(de|a) el\s/);
    expect(r.price.lede.ca).toMatch(/al Raval/);
    expect(r.price.pricing!.verdictSub!.es).toMatch(/del Raval/);
    expect(r.price.lede.es).toMatch(/3\.645 €\/m²/);
    expect(r.price.lede.en).toMatch(/in El Raval/);
    expect(r.price.pricing!.verdictSub!.en).not.toMatch(/\+/);
  });
  it("adds a few-sales caveat to the price section", () => {
    const r = seedBarriPricing(emptyReport("t", "0000000000000000000A"), barri("Vallbona", 10), { askingPriceEur: 200_000, builtM2: 80 });
    expect(r.price.pricing!.verdictSub!.en).toMatch(/only 10 sales/);
  });
});
