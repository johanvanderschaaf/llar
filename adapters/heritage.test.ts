import { describe, expect, it } from "vitest";
import { classifyHeritage, type RawFeature } from "./heritage";

const A = "Poligon_de_bé_cultural_d_interès_nacional__A_";
const B = "Poligon_de_bé_cultural_d_interès_local__B_";
const C = "Poligon_de_bé_d_interès_urbanístic__C_";

/** The service returns one listing on all three building layers. */
const onAllLayers = (denomin: string, nivell: string): RawFeature[] =>
  [A, B, C].map((layer) => ({ layer, denomin, nivell }));

describe("classifyHeritage", () => {
  it("takes the level from NIVELL, not from the layer name", () => {
    // A level C block of flats in Sants, returned on the A, B and C layers.
    const h = classifyHeritage(onAllLayers("EDIFICI D'HABITATGES", "C"));
    expect(h.level).toBe("C");
    expect(h.name).toBe("EDIFICI D'HABITATGES");
  });

  it("does not read the Ciutat Vella district sheet as a listing", () => {
    const h = classifyHeritage(onAllLayers("Fitxa 0 de Ciutat Vella", "D"));
    expect(h.level).toBeUndefined();
    expect(h.inEnsemble).toBe(true);
    expect(h.ensembleName).toBe("Ciutat Vella");
  });

  it("keeps a real listing inside Ciutat Vella", () => {
    const h = classifyHeritage([
      ...onAllLayers("Fitxa 0 de Ciutat Vella", "D"),
      ...onAllLayers("PALAU AGUILAR", "A"),
    ]);
    expect(h.level).toBe("A");
    expect(h.name).toBe("PALAU AGUILAR");
  });

  it("does not take a level from a conjunt or entorn", () => {
    const h = classifyHeritage([
      { layer: "Polígon_de_conjunt_protegit", denomin: "CONJUNT DE LA MURALLA ROMANA", nivell: "A" },
      { layer: "Polígon_d_entorn_de_protecció_A", denomin: "ENTORN B, C.PALLA 10", nivell: "B" },
    ]);
    expect(h.level).toBeUndefined();
    expect(h.ensembleName).toBe("CONJUNT DE LA MURALLA ROMANA");
  });

  it("takes the highest listed level when several are found", () => {
    const h = classifyHeritage([...onAllLayers("CASA X", "C"), ...onAllLayers("CASA ANTONI ROGER", "B")]);
    expect(h.level).toBe("B");
    expect(h.name).toBe("CASA ANTONI ROGER");
  });
});
