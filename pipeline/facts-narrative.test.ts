import { describe, expect, it } from "vitest";
import { emptyReport } from "./template";
import { buildPreviewTeaser, seedFactsNarrative, type FactsContext } from "./facts-narrative";
import { needsAiNarrative } from "@/lib/narrative";
import type { Report } from "@/types/report";

function withPricing(deltaPct?: number, barri = "la Vila de Gràcia"): Report {
  const r = emptyReport("t", "9648812DF2894H0013RQ");
  r.price.pricing = {
    state: deltaPct == null ? "no-asking" : "asking-known",
    barri: { name: barri, pricePerM2: 5584, transactions: 1312, asOf: "gener 2025 - desembre 2025", impliedValue: 502560 },
    asking: deltaPct == null ? undefined : { price: 455000, pricePerM2: 5056 },
    deltaPct,
  } as unknown as Report["price"]["pricing"];
  return r;
}

const base: FactsContext = {
  builtM2: 90,
  yearBuilt: 1965,
  barri: "la Vila de Gràcia",
  district: "Gràcia",
  askingPriceEur: 455000,
  energyClass: "E",
  energyChecked: true,
  affectation: { checked: true, category: "B" },
  heritage: { checked: true },
  flood: { checked: true, level: "low" },
  amenities: {
    metro: { nearest: { name: "Joanic", distanceM: 240, walkMin: 3 }, within800: 3, names: ["Joanic", "Fontana", "Verdaguer"] },
    health: { nearest: { name: "CAP Vila de Gràcia", distanceM: 400, walkMin: 5 } },
    green: { nearest: { name: "Jardins de la Rambla de Sant Just", distanceM: 0, walkMin: 1 } },
    schools: { within1000: 12 },
    market: { nearest: { name: "Mercat de l'Abaceria", distanceM: 500, walkMin: 7 } },
    supermarket: { nearest: { name: "Sorli", distanceM: 200, walkMin: 3 } },
  },
};

/** Every Localized string in the prose fields, all languages. */
function allText(r: Report): string[] {
  const out: string[] = [];
  const add = (l?: { en: string; es: string; ca?: string }) => {
    if (l) out.push(l.en, l.es, l.ca ?? "");
  };
  add(r.hero.sub);
  add(r.verdict.headline);
  add(r.verdict.body);
  add(r.neighbourhood.lede);
  add(r.neighbourhood.note);
  add(r.negotiation.intro);
  add(r.negotiation.tactic);
  r.negotiation.items.forEach((i) => { add(i.title); add(i.desc); });
  r.checklist.forEach(add);
  return out;
}

describe("seedFactsNarrative", () => {
  it("writes the sample's bottom line from the facts", () => {
    const r = seedFactsNarrative(withPricing(-9.4), base);
    expect(r.verdict.headline.en).toBe("90 m² flat in La Vila de Gràcia, asking about 9% below the neighbourhood average.");
    expect(r.verdict.body.en).toMatch(/The asking €455,000 \(€5,056\/m²\) is about 9% below the €5,584\/m²/);
    expect(r.verdict.body.es).toMatch(/455\.000 € \(5\.056 €\/m²\)/);
    expect(r.verdict.body.en).toMatch(/ITE technical inspection is due/);
    expect(r.verdict.body.en).toMatch(/No planning affectation or heritage listing limits its use as a home/);
    expect(r.narrative?.source).toBe("facts");
  });

  it("fills every prose field in all three languages, without em-dashes", () => {
    const r = seedFactsNarrative(withPricing(-9.4), base);
    const text = allText(r);
    expect(text.every((t) => t.trim().length > 0)).toBe(true);
    expect(text.join("\n")).not.toMatch(/—/);
    expect(r.negotiation.items.length).toBeGreaterThan(0);
    expect(r.negotiation.items.length).toBeLessThanOrEqual(4);
    expect(r.checklist.length).toBeGreaterThanOrEqual(5);
  });

  it("contracts barri articles in Spanish and Catalan", () => {
    const r = seedFactsNarrative(withPricing(-9.4, "el Raval"), { ...base, barri: "el Raval" });
    expect(r.verdict.headline.ca).toMatch(/^Pis de 90 m² al Raval/);
    expect(r.verdict.headline.es).toMatch(/^Piso de 90 m² en el Raval/);
    expect(r.verdict.body.es).toMatch(/pisos de segunda mano del Raval/);
    expect(r.verdict.body.ca).toMatch(/pisos de segona mà del Raval/);
    expect(r.verdict.headline.en).toMatch(/in El Raval/);
  });

  it("leads with a serious finding and drops the all-clear", () => {
    const r = seedFactsNarrative(withPricing(-9.4), { ...base, affectation: { checked: true, category: "A" } });
    expect(r.verdict.headline.en).toMatch(/planning affectation/);
    expect(r.verdict.body.en).not.toMatch(/No planning affectation/);
    expect(r.negotiation.items[0].title.en).toBe("Planning affectation");
    expect(r.checklist.map((c) => c.en).join(" ")).toMatch(/certificat urbanístic/);
  });

  it("says when checks couldn't run instead of giving an all-clear", () => {
    const r = seedFactsNarrative(withPricing(-9.4), {
      ...base,
      heritage: { checked: false },
      flood: { checked: false },
    });
    expect(r.verdict.body.en).toMatch(/heritage listing and flood zone check could not be completed/);
    expect(r.verdict.body.en).not.toMatch(/No planning affectation or heritage listing/);
    const checklist = r.checklist.map((c) => c.en).join(" ");
    expect(checklist).toMatch(/heritage status/);
    expect(checklist).toMatch(/covers flooding/);
  });

  it("handles a missing asking price", () => {
    const r = seedFactsNarrative(withPricing(undefined), { ...base, askingPriceEur: undefined });
    expect(r.verdict.headline.en).toBe("90 m² flat in La Vila de Gràcia in a 1965 building.");
    expect(r.verdict.body.en).toMatch(/Add the asking price/);
    expect(r.negotiation.intro.en).toMatch(/^Without an asking price/);
    expect(r.negotiation.items.map((i) => i.title.en)).not.toContain("Asking is not closing");
  });

  it("uses the premium as the first lever when asking is above average", () => {
    const r = seedFactsNarrative(withPricing(12), base);
    expect(r.negotiation.intro.en).toMatch(/above the neighbourhood average/);
    expect(r.negotiation.items[0].title.en).toBe("Above the neighbourhood average");
  });

  it("flags a missing energy certificate as a lever", () => {
    const r = seedFactsNarrative(withPricing(-9.4), { ...base, energyClass: undefined });
    expect(r.negotiation.items.map((i) => i.title.en)).toContain("No registered energy certificate");
  });

  it("writes the neighbourhood from the amenity distances", () => {
    const r = seedFactsNarrative(withPricing(-9.4), base);
    expect(r.neighbourhood.lede.en).toBe(
      "La Vila de Gràcia: 3 metro stations within 800 m (nearest Joanic, ~3 min walk), a supermarket ~3 min away and 12 schools within a 10-minute walk.",
    );
    expect(r.neighbourhood.note.en).toMatch(/right by Jardins de la Rambla de Sant Just/);
  });
});

describe("needsAiNarrative", () => {
  it("is true for fact-based prose and for old un-narrated reports", () => {
    const facts = seedFactsNarrative(withPricing(-9.4), base);
    expect(needsAiNarrative(facts)).toBe(true);
    expect(needsAiNarrative(emptyReport("t", "x"))).toBe(true);
  });
  it("is false once the AI has written it, or for old narrated reports", () => {
    const ai = { ...seedFactsNarrative(withPricing(-9.4), base), narrative: { source: "ai" as const } };
    expect(needsAiNarrative(ai)).toBe(false);
    const old = emptyReport("t", "x");
    old.verdict.headline = { en: "AI headline", es: "x", ca: "x" };
    expect(needsAiNarrative(old)).toBe(false);
  });
});

describe("wording details", () => {
  it("uses 'An' before 8x ages and contracts Catalan 'de els'", () => {
    const year = new Date().getFullYear() - 86;
    const r = seedFactsNarrative(withPricing(-39), { ...base, yearBuilt: year });
    expect(r.negotiation.items.map((i) => i.desc.en).join(" ")).toMatch(/An 86-year-old building/);
    expect(r.verdict.body.ca).toMatch(/per sota dels 5\.584 €\/m²/);
    expect(r.verdict.body.ca).not.toMatch(/de els/);
  });
  it("doesn't say 'before offering' twice in a row", () => {
    const r = seedFactsNarrative(withPricing(-9.4), { ...base, affectation: { checked: true, category: "A" }, flood: { checked: true, level: "high" } });
    expect(r.verdict.body.en.match(/before offering/gi)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});


describe("buildPreviewTeaser", () => {
  const all = (t: ReturnType<typeof buildPreviewTeaser>) =>
    [t.question, t.proof].flatMap((l) => [l.en, l.es, l.ca ?? ""]).join("\n");

  it("proves the price answer exists without giving it away", () => {
    for (const delta of [-9.4, 0.5, 12]) {
      const text = all(buildPreviewTeaser(withPricing(delta)));
      // No barri €/m², no gap, no direction, in any language.
      expect(text).not.toMatch(/5[.,]?584|5[.,]?056|%/);
      expect(text).not.toMatch(/below|above|in line|por debajo|por encima|per sota|per sobre/i);
    }
    const t = buildPreviewTeaser(withPricing(-9.4));
    expect(t.question.en).toBe("How does the asking €455,000 compare with what flats here actually sell for?");
    expect(t.proof.en).toMatch(/^We compared it with 1,312 second-hand sales registered at the notary in La Vila de Gràcia \(/);
    expect(t.proof.es).toMatch(/1\.312 ventas de segunda mano registradas ante notario en la Vila de Gràcia/);
    expect(t.proof.ca).toMatch(/1\.312 vendes de segona mà registrades a la notaria a la Vila de Gràcia/);
    expect(t.proof.en).not.toMatch(/gener|desembre/);
  });

  it("contracts the barri article in Catalan", () => {
    const t = buildPreviewTeaser(withPricing(-9.4, "el Raval"));
    expect(t.proof.ca).toMatch(/a la notaria al Raval/);
    expect(t.proof.en).toMatch(/in El Raval/);
  });

  it("asks a barri question when there is no asking price", () => {
    const t = buildPreviewTeaser(withPricing(undefined));
    expect(t.question.en).toBe("What do flats like this one actually sell for in La Vila de Gràcia?");
    expect(t.proof.en).toMatch(/^We have the closing prices of 1,312 second-hand sales/);
    expect(all(t)).not.toMatch(/5[.,]?584/);
  });

  it("falls back to the registers when there is no price data", () => {
    const r = emptyReport("t", "x");
    const t = buildPreviewTeaser(r);
    expect(t.question.en).toBe("What should you know about this flat before you offer?");
    expect(t.proof.en).toMatch(/official registers/);
  });
});

describe("small samples", () => {
  it("warns when the barri average rests on few sales", () => {
    const r = withPricing(-9.4);
    r.price.pricing!.barri!.transactions = 12;
    const out = seedFactsNarrative(r, base);
    expect(out.verdict.body.en).toMatch(/based on only 12 sales/);
    expect(out.verdict.body.ca).toMatch(/només 12 vendes/);
    expect(seedFactsNarrative(withPricing(-9.4), base).verdict.body.en).not.toMatch(/based on only/);
  });
  it("never leaves the negotiation playbook empty", () => {
    const r = seedFactsNarrative(withPricing(undefined), {
      ...base, askingPriceEur: undefined, yearBuilt: 2015, energyClass: "B",
    });
    expect(r.negotiation.items.length).toBeGreaterThan(0);
    expect(r.negotiation.intro.en).not.toMatch(/\b0 fact-based/);
  });
});

describe("renovated listed buildings", () => {
  it("gives the original date and the renovation, not 'dates from 2017'", () => {
    const r = seedFactsNarrative(withPricing(-9.4), {
      ...base, yearBuilt: 1898, renovatedYear: 2017, yearLabel: "1898–1900",
      heritage: { checked: true, level: "A" },
    });
    expect(r.verdict.body.en).toMatch(/dates from 1898–1900, and Catastro records a full renovation in 2017/);
    expect(r.verdict.body.en).not.toMatch(/dates from 2017/);
    // Age-based levers follow the original date.
    expect(r.negotiation.items.map((i) => i.title.en)).toContain("Building age and ITE");
  });
});
