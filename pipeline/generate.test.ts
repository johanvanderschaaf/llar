import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failed, ok, unavailable, type AdapterResult } from "@/adapters/types";
import type { CatastroData } from "@/adapters/catastro";

/*
 * Pipeline-level reliability tests: every external source and the database are
 * faked, so these check how generateReport behaves when sources are slow, down
 * or broken — without touching the network.
 */

vi.mock("server-only", () => ({}));

// ── fake database ───────────────────────────────────────────────────────────
const db = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  upserts: [] as Array<{ table: string; rows: unknown }>,
  insertError: null as null | { message: string },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return {
        ...query,
        insert: async (row: Record<string, unknown>) => {
          db.inserts.push({ table, row });
          return { error: db.insertError };
        },
        upsert: async (rows: unknown) => {
          db.upserts.push({ table, rows });
          return { error: null };
        },
      };
    },
  }),
}));

// ── fake sources ────────────────────────────────────────────────────────────
const src = vi.hoisted(() => ({
  catastro: vi.fn(),
  geocode: vi.fn(),
  energy: vi.fn(),
  ipv: vi.fn(),
  affectation: vi.fn(),
  amenities: vi.fn(),
  urbanism: vi.fn(),
  comps: vi.fn(),
  flood: vi.fn(),
  heritage: vi.fn(),
  barri: vi.fn(),
}));

vi.mock("@/adapters/catastro", async (orig) => ({
  ...(await orig<typeof import("@/adapters/catastro")>()),
  fetchCatastro: src.catastro,
}));
vi.mock("@/adapters/geo", () => ({ geocodeRef: src.geocode }));
vi.mock("@/adapters/energy", () => ({ fetchEnergy: src.energy }));
vi.mock("@/adapters/ine-ipv", () => ({ fetchIpv: src.ipv }));
vi.mock("@/adapters/affectation", () => ({ fetchAffectation: src.affectation }));
vi.mock("@/adapters/amenities", () => ({ fetchAmenities: src.amenities }));
vi.mock("@/adapters/urbanism", () => ({ fetchUrbanism: src.urbanism }));
vi.mock("@/adapters/idealista", () => ({ fetchComps: src.comps }));
vi.mock("@/adapters/flood", () => ({ fetchFlood: src.flood }));
vi.mock("@/adapters/heritage", () => ({ fetchHeritage: src.heritage }));
vi.mock("@/adapters/gencat-barri", () => ({ fetchGencatBarri: src.barri }));

import { generateReport } from "./generate";

const REF = "9648812DF2894H0013RQ";
const CATASTRO: CatastroData = {
  unit: {
    cadastralRef: REF,
    use: "Residencial",
    builtAreaM2: 80,
    yearBuilt: 1965,
    addressLabel: "CL SORS 35 BARCELONA",
    districtCode: 6,
  },
  parcel: { parcelRef: REF.slice(0, 14), unitCount: 12, units: [] },
};

const hang = <T,>() => new Promise<AdapterResult<T>>(() => {});

/** Every secondary source down: the report must still be saved. */
function allSecondarySourcesDown() {
  src.geocode.mockResolvedValue(failed("catastro", "Geocode failed: fetch failed"));
  src.energy.mockResolvedValue(unavailable("energy", "no certificate"));
  src.ipv.mockResolvedValue(failed("ipv", "INE down"));
  src.affectation.mockResolvedValue(failed("affectation", "AFH down"));
  src.barri.mockReturnValue(unavailable("gencat-barri", "outside the barris"));
}

const savedReport = () => db.inserts.find((i) => i.table === "reports");

beforeEach(() => {
  db.inserts.length = 0;
  db.upserts.length = 0;
  db.insertError = null;
  for (const fn of Object.values(src)) fn.mockReset();
  src.catastro.mockResolvedValue(ok("catastro", CATASTRO));
  allSecondarySourcesDown();
});

afterEach(() => vi.useRealTimers());

describe("generateReport — reliability", () => {
  it("saves a complete report even when every secondary source is down", async () => {
    const id = await generateReport({ addressOrRef: REF, source: "buyer" });

    const saved = savedReport();
    expect(saved?.row.id).toBe(id);
    expect(saved?.row.status).toBe("in_review");
    const data = saved?.row.data as { scores: unknown[]; urbanism: { items: unknown[] } };
    expect(data.scores.length).toBeGreaterThan(0);
    // Unverified planning data must be flagged to the buyer, not skipped.
    expect(data.urbanism.items.length).toBeGreaterThan(0);
    // A failing geocoder is retried once, not hammered until the deadline.
    expect(src.geocode).toHaveBeenCalledTimes(2);
  });

  it("saves nothing when Catastro is down, after retrying", async () => {
    src.catastro.mockResolvedValue(failed("catastro", "Catastro request failed: fetch failed"));

    await expect(generateReport({ addressOrRef: REF, source: "buyer" })).rejects.toThrow(
      /Catastro unavailable/,
    );
    expect(src.catastro).toHaveBeenCalledTimes(3);
    expect(savedReport()).toBeUndefined();
  });

  it("does not retry a reference Catastro says doesn't exist", async () => {
    src.catastro.mockResolvedValue(unavailable("catastro", "no record"));

    await expect(generateReport({ addressOrRef: REF, source: "buyer" })).rejects.toThrow();
    expect(src.catastro).toHaveBeenCalledTimes(1);
  });

  it("throws (instead of returning an id) when the report can't be saved", async () => {
    db.insertError = { message: "connection reset" };
    await expect(generateReport({ addressOrRef: REF, source: "buyer" })).rejects.toThrow(
      /Could not save report: connection reset/,
    );
  });

  it("finishes within the time budget when sources hang", async () => {
    vi.useFakeTimers();
    src.geocode.mockResolvedValue(ok("catastro", { lat: 41.4, lon: 2.16 }));
    src.energy.mockImplementation(() => hang());
    src.affectation.mockImplementation(() => hang());
    src.amenities.mockImplementation(() => hang());
    src.urbanism.mockImplementation(() => hang());
    src.comps.mockResolvedValue(unavailable("market", "no key"));
    src.flood.mockImplementation(() => hang());
    src.heritage.mockImplementation(() => hang());

    let settled = false;
    const run = generateReport({ addressOrRef: REF, source: "buyer" }).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(44_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(settled).toBe(true);
    await run;

    const sources = db.upserts.find((u) => u.table === "report_sources")?.rows as Array<{
      source: string;
      status: string;
      note: string;
    }>;
    const energy = sources.find((s) => s.source === "energy");
    expect(energy?.status).toBe("error");
    expect(energy?.note).toMatch(/Timed out/);
  });

  it("stops retrying Catastro when the budget runs out", async () => {
    vi.useFakeTimers();
    // Each attempt hangs until its own timeout, like a dead server would.
    src.catastro.mockImplementation(
      (_ref: string, opts: { timeoutMs: number }) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(failed("catastro", "aborted")), opts.timeoutMs),
        ),
    );

    const run = generateReport({ addressOrRef: REF, source: "buyer" });
    const assertion = expect(run).rejects.toThrow(/Catastro unavailable/);
    await vi.advanceTimersByTimeAsync(25_000);
    await assertion;
    // 10s + 10s + the remaining 4s: all three attempts fit inside 24s.
    const timeouts = src.catastro.mock.calls.map((c) => c[1].timeoutMs);
    expect(timeouts).toEqual([10_000, 10_000, 4_000]);
  });
});
