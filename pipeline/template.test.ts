import { describe, it, expect } from "vitest";
import { emptyReport, seedUrbanism, seedEnergyMissing } from "./template";
import type { UrbanismData } from "@/adapters/urbanism";
import type { AffectationData } from "@/adapters/affectation";

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
