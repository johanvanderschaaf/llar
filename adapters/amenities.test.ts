import { describe, expect, it } from "vitest";
import { fetchAmenities } from "./amenities";

/*
 * Runs against the real data/bcn-amenities.json, using landmarks whose
 * surroundings are well known, so a broken refresh (shifted coordinates,
 * empty categories) fails here before it reaches a report.
 */

describe("fetchAmenities (local Barcelona dataset)", () => {
  it("Plaça de Catalunya: metro on the doorstep, market and shops close", async () => {
    const r = await fetchAmenities({ lat: 41.387, lon: 2.17 });
    expect(r.status).toBe("ok");
    const a = r.data!;
    expect(a.metro.nearest!.distanceM).toBeLessThan(250);
    expect(a.metro.names).toContain("Catalunya");
    expect(a.metro.within800).toBeGreaterThanOrEqual(4);
    // La Boqueria (Mercat de Sant Josep) is ~600 m down the Rambla.
    expect(a.market.nearest!.distanceM).toBeLessThan(900);
    expect(a.supermarket.nearest!.distanceM).toBeLessThan(400);
    expect(a.health.nearest!.distanceM).toBeLessThan(1500);
    expect(a.schools.within1000).toBeGreaterThan(0);
    expect(a.green.nearest!.distanceM).toBeLessThan(1500);
    expect(r.note).toMatch(/Ajuntament de Barcelona open data, as of \d{4}-\d{2}-\d{2}/);
  });

  it("inside Parc de la Ciutadella: the park is 0 m away", async () => {
    const r = await fetchAmenities({ lat: 41.3883, lon: 2.1874 });
    expect(r.data!.green.nearest!.distanceM).toBe(0);
    expect(r.data!.green.nearest!.name).toMatch(/Ciutadella/i);
  });

  it("walking minutes follow distance", async () => {
    const r = await fetchAmenities({ lat: 41.4036, lon: 2.1744 }); // Sagrada Família
    const m = r.data!.metro.nearest!;
    expect(m.walkMin).toBe(Math.max(1, Math.round(m.distanceM / 75)));
  });

  it("says unavailable outside Barcelona instead of inventing distances", async () => {
    const r = await fetchAmenities({ lat: 40.4168, lon: -3.7038 }); // Madrid
    expect(r.status).toBe("unavailable");
    expect(r.toVerify).toBe(true);
  });
});
