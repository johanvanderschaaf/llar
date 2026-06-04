import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchCatastro,
  normaliseRef,
  type CatastroData,
} from "@/adapters/catastro";
import type { AdapterResult } from "@/adapters/types";
import { geocodeRef } from "@/adapters/geo";
import { fetchAmenities, type AmenityData } from "@/adapters/amenities";
import { fetchUrbanism, type UrbanismData } from "@/adapters/urbanism";
import { fetchEnergy, type EnergyData } from "@/adapters/energy";
import { fetchComps, type CompListing } from "@/adapters/idealista";
import { fetchFlood, type FloodData } from "@/adapters/flood";
import { computeScores } from "@/config/scoring";
import { STATIC_RISK_AS_OF } from "@/config/static-risk";
import {
  emptyReport,
  seedAmenities,
  seedComps,
  seedEnergy,
  seedFromCatastro,
  seedPriceRefs,
  seedRisks,
  seedScores,
  seedUrbanism,
} from "./template";
import type { ReportInput } from "@/types/db";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
// Bump when the parsed CatastroData shape changes, to auto-invalidate old rows.
const CATASTRO_CACHE_VERSION = "v2";

/** Catastro lookup with a 30-day cache keyed by cadastral ref (cost control). */
async function cachedCatastro(
  ref: string,
): Promise<AdapterResult<CatastroData>> {
  const db = createAdminClient();
  const cacheKey = `${ref}#${CATASTRO_CACHE_VERSION}`;
  const { data: cached } = await db
    .from("source_cache")
    .select("payload, fetched_at")
    .eq("source", "catastro")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (
    cached &&
    Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS
  ) {
    return {
      source: "catastro",
      status: "ok",
      data: cached.payload as CatastroData,
      toVerify: false,
      fetchedAt: cached.fetched_at,
      note: "from cache",
    };
  }

  const result = await fetchCatastro(ref);
  if (result.status === "ok" && result.data) {
    await db.from("source_cache").upsert(
      {
        source: "catastro",
        cache_key: cacheKey,
        payload: result.data,
        fetched_at: result.fetchedAt,
      },
      { onConflict: "source,cache_key" },
    );
  }
  return result;
}

/**
 * Generate a new report from operator input. Runs the (Catastro-only, for now)
 * pipeline, seeds a draft Report, persists it as `in_review`, and logs source
 * provenance. Never throws on missing data — falls back to manual entry.
 * Returns the new report id.
 */
export async function generateReport(input: ReportInput): Promise<string> {
  const db = createAdminClient();
  const rawRef = (input.cadastralRef || input.addressOrRef || "").trim();
  const ref = normaliseRef(rawRef);

  const cat = await cachedCatastro(ref);
  const resolvedRef = cat.data?.unit.cadastralRef ?? ref;

  const { data: row, error } = await db
    .from("reports")
    .insert({
      cadastral_ref: resolvedRef,
      status: "in_review",
      input,
      data: {},
    })
    .select("id")
    .single();
  if (error || !row) {
    throw new Error(`Could not create report: ${error?.message}`);
  }
  const id = row.id as string;

  let report = emptyReport(id, resolvedRef);
  if (cat.status === "ok" && cat.data) {
    report = seedFromCatastro(report, input, cat.data);
  }
  report = seedPriceRefs(report);

  // Energy certificate (ICAEN) — keyed by cadastral reference.
  const energy = await fetchEnergy(resolvedRef);
  if (energy.status === "ok" && energy.data) {
    report = seedEnergy(report, energy.data);
  }

  // Geographic enrichment: coordinates → amenities + urbanism + comps + flood.
  let amenities: AdapterResult<AmenityData> | null = null;
  let urbanism: AdapterResult<UrbanismData> | null = null;
  let comps: AdapterResult<CompListing[]> | null = null;
  let flood: AdapterResult<FloodData> | null = null;
  const builtM2 = input.builtM2 ?? cat.data?.unit.builtAreaM2;
  if (cat.status === "ok") {
    const geo = await geocodeRef(resolvedRef);
    if (geo.status === "ok" && geo.data) {
      [amenities, urbanism, comps, flood] = await Promise.all([
        fetchAmenities(geo.data),
        fetchUrbanism(geo.data),
        fetchComps(geo.data, {
          minSize: builtM2 ? Math.round(builtM2 * 0.6) : undefined,
          maxSize: builtM2 ? Math.round(builtM2 * 1.6) : undefined,
        }),
        fetchFlood(geo.data),
      ]);
      if (amenities.status === "ok" && amenities.data) {
        report = seedAmenities(report, amenities.data);
      }
      if (urbanism.status === "ok" && urbanism.data) {
        report = seedUrbanism(report, urbanism.data);
      }
      if (comps.status === "ok" && comps.data && comps.data.length) {
        report = seedComps(report, {
          askingPriceEur: input.askingPriceEur,
          builtM2,
          comps: comps.data,
        });
      }
    }
  }

  // Risk & Safety: flood (if resolved) + static seismic/radon + district crime.
  report = seedRisks(report, {
    flood: flood?.data,
    districtCode: cat.data?.unit.districtCode,
  });

  // Deterministic scores from what we have (building age, amenities; energy
  // and price land once those adapters/comps exist).
  const yearBuilt = cat.data?.unit.yearBuilt;
  const energyClass = energy.data?.consumptionClass;
  const { values, overall } = computeScores({
    yearBuilt,
    energyClass,
    amenities: amenities?.data,
  });
  report = seedScores(report, values, overall, {
    year: yearBuilt,
    energyClass,
    amenities: amenities?.data,
  });

  await db.from("reports").update({ data: report }).eq("id", id);

  const sources: Array<{
    report_id: string;
    source: string;
    status: string;
    to_verify: boolean;
    payload: unknown;
    note: string | null;
    fetched_at: string;
  }> = [
    {
      report_id: id,
      source: "catastro",
      status: cat.status,
      to_verify: cat.toVerify,
      payload: cat.data ?? null,
      note: cat.note ?? null,
      fetched_at: cat.fetchedAt,
    },
  ];
  if (amenities) {
    sources.push({
      report_id: id,
      source: "amenities",
      status: amenities.status,
      to_verify: amenities.toVerify,
      payload: amenities.data ?? null,
      note: amenities.note ?? null,
      fetched_at: amenities.fetchedAt,
    });
  }
  if (urbanism) {
    sources.push({
      report_id: id,
      source: "urbanism",
      status: urbanism.status,
      to_verify: urbanism.toVerify,
      payload: urbanism.data ?? null,
      note: urbanism.note ?? null,
      fetched_at: urbanism.fetchedAt,
    });
  }
  sources.push({
    report_id: id,
    source: "energy",
    status: energy.status,
    to_verify: energy.toVerify,
    payload: energy.data ?? null,
    note: energy.note ?? null,
    fetched_at: energy.fetchedAt,
  });
  if (comps) {
    sources.push({
      report_id: id,
      source: "market",
      status: comps.status,
      to_verify: comps.toVerify,
      payload: comps.data ?? null,
      note: comps.note ?? null,
      fetched_at: comps.fetchedAt,
    });
  }
  if (flood) {
    sources.push({
      report_id: id,
      source: "flood",
      status: flood.status,
      to_verify: flood.toVerify,
      payload: flood.data ?? null,
      note: flood.note ?? null,
      fetched_at: flood.fetchedAt,
    });
  }
  // Static risk facts (seismic, radon) — recorded for provenance/date-stamp.
  for (const s of ["seismic", "radon"] as const) {
    sources.push({
      report_id: id,
      source: s,
      status: "ok",
      to_verify: false,
      payload: null,
      note: `Static (Barcelona), as of ${STATIC_RISK_AS_OF}`,
      fetched_at: new Date().toISOString(),
    });
  }
  sources.push({
    report_id: id,
    source: "crime",
    status: "ok",
    to_verify: false,
    payload: cat.data?.unit.districtCode ?? null,
    note: `District-level context, as of ${STATIC_RISK_AS_OF}`,
    fetched_at: new Date().toISOString(),
  });
  await db
    .from("report_sources")
    .upsert(sources, { onConflict: "report_id,source" });

  return id;
}
