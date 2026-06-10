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
import { fetchAffectation, type AffectationData } from "@/adapters/affectation";
import { fetchHeritage, type HeritageData } from "@/adapters/heritage";
import { fetchEnergy, type EnergyData } from "@/adapters/energy";
import { fetchIpv } from "@/adapters/ine-ipv";
import { fetchGencatBarri, type GencatBarriData } from "@/adapters/gencat-barri";
import { fetchComps, type CompListing } from "@/adapters/idealista";
import { fetchFlood, type FloodData } from "@/adapters/flood";
import { computeScores } from "@/config/scoring";
import { STATIC_RISK_AS_OF } from "@/config/static-risk";
import {
  emptyReport,
  seedAmenities,
  seedBuilding,
  seedComps,
  seedCostsTaxes,
  seedEnergy,
  seedFooter,
  seedFromCatastro,
  seedLegal,
  seedPriceRefs,
  seedRisks,
  seedScores,
  seedUrbanism,
  seedHeritage,
  seedBarriPricing,
  seedPricingUnavailable,
} from "./template";
import type { ReportInput } from "@/types/db";

// Minimal urbanism data so the AFH affectation alert can render even when the
// qualification map (geo-dependent) is unavailable.
const EMPTY_URBANISM: UrbanismData = {
  possibleAffectation: false,
  affectations: [],
  qualifications: [],
  method: "bcn-point",
  mapUrl: "https://ajuntament.barcelona.cat/informaciourbanistica/cerca/ca/",
};

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
  report = seedCostsTaxes(report, input.askingPriceEur);
  report = seedBuilding(report, cat.data?.unit.yearBuilt);
  report = seedLegal(report);

  // Energy certificate (ICAEN) + INE IPV (Catalan housing market context).
  // Independent of geocoding so they run in parallel with the cadastral step.
  const [energy, ipv] = await Promise.all([fetchEnergy(resolvedRef), fetchIpv()]);
  if (energy.status === "ok" && energy.data) {
    report = seedEnergy(report, energy.data);
  }
  // IPV trend is recorded for provenance but no longer rendered in section 03 —
  // a Catalonia-wide YoY index is too coarse to drive a Barcelona buyer's
  // price decision. seedIpvContext is kept available for future use elsewhere
  // (e.g. the Verdict section), so we just skip the call here.

  // Geographic enrichment: coordinates → amenities + urbanism + comps + flood
  // + heritage.
  let amenities: AdapterResult<AmenityData> | null = null;
  let urbanism: AdapterResult<UrbanismData> | null = null;
  let comps: AdapterResult<CompListing[]> | null = null;
  let flood: AdapterResult<FloodData> | null = null;
  let heritage: AdapterResult<HeritageData> | null = null;
  // Official affectation (AFH) — needs only the parcel ref, not coordinates.
  let affectation: AdapterResult<AffectationData> | null = null;
  let urbanismSeeded = false;
  // Barri-level closing prices (Generalitat Habitatge) — runs once we have
  // coordinates from geocoding; degrades to `unavailable` otherwise.
  let barri: AdapterResult<GencatBarriData> | null = null;
  const builtM2 = input.builtM2 ?? cat.data?.unit.builtAreaM2;
  if (cat.status === "ok") {
    const parcelRef = cat.data?.parcel.parcelRef ?? resolvedRef;
    const [geo, aff] = await Promise.all([
      geocodeRef(resolvedRef),
      fetchAffectation(parcelRef),
    ]);
    affectation = aff;
    const affData = aff.status === "ok" ? aff.data : undefined;
    if (geo.status === "ok" && geo.data) {
      [amenities, urbanism, comps, flood, heritage] = await Promise.all([
        fetchAmenities(geo.data),
        fetchUrbanism(geo.data, { parcelRef }),
        fetchComps(geo.data, {
          minSize: builtM2 ? Math.round(builtM2 * 0.6) : undefined,
          maxSize: builtM2 ? Math.round(builtM2 * 1.6) : undefined,
        }),
        fetchFlood(geo.data),
        fetchHeritage(geo.data),
      ]);
      if (amenities.status === "ok" && amenities.data) {
        report = seedAmenities(report, amenities.data);
      }
      // Always seed the urbanism section (with whatever qualification data we
      // have) before heritage, which appends to its body.
      const uData =
        urbanism.status === "ok" && urbanism.data ? urbanism.data : EMPTY_URBANISM;
      report = seedUrbanism(report, uData, affData);
      urbanismSeeded = true;
      if (heritage.status === "ok" && heritage.data) {
        report = seedHeritage(report, heritage.data);
      }
      if (comps.status === "ok" && comps.data && comps.data.length) {
        report = seedComps(report, {
          askingPriceEur: input.askingPriceEur,
          builtM2,
          comps: comps.data,
        });
      }
      // Barri-level real-sale prices: this is the pricing headline.
      barri = fetchGencatBarri(geo.data);
      if (barri.status === "ok" && barri.data) {
        report = seedBarriPricing(report, barri.data, {
          askingPriceEur: input.askingPriceEur,
          builtM2,
        });
      } else {
        // State 03: coords resolved but barri lookup unavailable (outside the
        // 73 BCN barris, or low-volume barri with no €/m² for the period).
        report = seedPricingUnavailable(report, {
          askingPriceEur: input.askingPriceEur,
          builtM2,
          ipv: ipv.status === "ok" ? ipv.data : undefined,
        });
      }
    } else {
      // State 03: no coordinates at all — geocoding failed.
      report = seedPricingUnavailable(report, {
        askingPriceEur: input.askingPriceEur,
        builtM2,
        ipv: ipv.status === "ok" ? ipv.data : undefined,
      });
    }
    // If geocoding failed but the AFH verdict came through, still surface the
    // affectation alert from the official source alone.
    if (!urbanismSeeded && affData) {
      report = seedUrbanism(report, EMPTY_URBANISM, affData);
    }
  }

  // Risk & Safety: flood (if resolved) + static seismic/radon + district crime.
  report = seedRisks(report, {
    flood: flood?.data,
    districtCode: cat.data?.unit.districtCode,
    yearBuilt: cat.data?.unit.yearBuilt,
  });

  // Deterministic "Sources & method" + disclaimer (reflects comps presence).
  report = seedFooter(report);

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
  if (affectation) {
    sources.push({
      report_id: id,
      source: "affectation",
      status: affectation.status,
      to_verify: affectation.toVerify,
      payload: affectation.data ?? null,
      note: affectation.note ?? null,
      fetched_at: affectation.fetchedAt,
    });
  }
  if (heritage) {
    sources.push({
      report_id: id,
      source: "heritage",
      status: heritage.status,
      to_verify: heritage.toVerify,
      payload: heritage.data ?? null,
      note: heritage.note ?? null,
      fetched_at: heritage.fetchedAt,
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
  sources.push({
    report_id: id,
    source: "ipv",
    status: ipv.status,
    to_verify: ipv.toVerify,
    payload: ipv.data ?? null,
    note: ipv.note ?? null,
    fetched_at: ipv.fetchedAt,
  });
  if (barri) {
    sources.push({
      report_id: id,
      source: "gencat-barri",
      status: barri.status,
      to_verify: barri.toVerify,
      payload: barri.data ?? null,
      note: barri.note ?? null,
      fetched_at: barri.fetchedAt,
    });
  }
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
