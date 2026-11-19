import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchCatastro,
  normaliseRef,
  type CatastroData,
} from "@/adapters/catastro";
import type { AdapterResult, SourceKey } from "@/adapters/types";
import { createBudget, timed, withDeadline, type Budget } from "./budget";
import {
  fetchParcelPolygon,
  geocodeRef,
  type Coordinates,
  type ParcelPolygon,
} from "@/adapters/geo";
import { CatastroDownError } from "@/adapters/catastro-outage";
import { fetchAmenities, type AmenityData } from "@/adapters/amenities";
import { fetchUrbanism, type UrbanismData } from "@/adapters/urbanism";
import { fetchAffectation, type AffectationData } from "@/adapters/affectation";
import { fetchHeritage, type HeritageData } from "@/adapters/heritage";
import { buildingYears } from "@/lib/building-years";
import { fetchEnergy, type EnergyData } from "@/adapters/energy";
import { fetchIpv } from "@/adapters/ine-ipv";
import { fetchGencatBarri, type GencatBarriData } from "@/adapters/gencat-barri";
import { fetchComps, type CompListing } from "@/adapters/idealista";
import { fetchFlood, type FloodData } from "@/adapters/flood";
import { computeScores } from "@/config/scoring";
import { STATIC_RISK_AS_OF, BCN_DISTRICTS } from "@/config/static-risk";
import { seedFactsNarrative } from "./facts-narrative";
import {
  emptyReport,
  seedAmenities,
  seedBuilding,
  seedComps,
  seedCostsTaxes,
  seedEnergy,
  seedEnergyMissing,
  seedFooter,
  seedFromCatastro,
  seedLegal,
  seedPriceRefs,
  seedRisks,
  seedScores,
  seedUrbanism,
  seedHeritage,
  seedHeritageUnchecked,
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

/*
 * Time budget (ms from the start of the run). /start runs this inside a Server
 * Action with maxDuration = 60s. Every stage has a deadline so the run always
 * finishes inside the limit, leaving ~15s for cold start, the database writes
 * and the redirect. Before this, chained retries could take 100s+ and Vercel
 * killed the function mid-run.
 */
/** Catastro (the spine) must be resolved by now, retries included. */
const CATASTRO_DEADLINE_MS = 24_000;
/** Geocoding (coordinates for the geo-dependent sources) must be resolved by now. */
const GEO_DEADLINE_MS = 34_000;
/** Every remaining source must be resolved by now, or it is marked unavailable. */
const SOURCES_DEADLINE_MS = 45_000;
/** Longest single Catastro / geocode attempt, so a hung request leaves room to retry. */
const ATTEMPT_TIMEOUT_MS = 10_000;
/** Don't start another attempt with less time than this left. */
const MIN_ATTEMPT_MS = 3_000;
/** Most geocode attempts (1 try + retries), if the time budget allows. */
const GEOCODE_ATTEMPTS = 2;

/**
 * Geocoding (Catastro CPMRC) is the spine of all geo-dependent adapters
 * (amenities, urbanism, flood, heritage, barri pricing). It fails transiently
 * often enough to leave reports with thin scores, so retry while the time
 * budget allows.
 */
async function geocodeWithRetry(
  ref: string,
  budget: Budget,
): Promise<Awaited<ReturnType<typeof geocodeRef>>> {
  let last = await geocodeRef(
    ref,
    Math.min(ATTEMPT_TIMEOUT_MS, budget.until(GEO_DEADLINE_MS)),
  );
  for (
    let i = 1;
    i < GEOCODE_ATTEMPTS &&
    last.status !== "ok" &&
    budget.until(GEO_DEADLINE_MS) >= MIN_ATTEMPT_MS;
    i++
  ) {
    last = await geocodeRef(
      ref,
      Math.min(ATTEMPT_TIMEOUT_MS, budget.until(GEO_DEADLINE_MS)),
    );
  }
  return last;
}

/*
 * Cache of Catastro data (source_cache table). Cadastral facts, coordinates and
 * parcel outlines almost never change, so entries are reused for a year — and
 * when Catastro is down, an entry of any age is used rather than refusing the
 * report. Only flats looked up before are covered.
 */
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 365; // 1 year
// Bump when the parsed CatastroData shape changes, to auto-invalidate old rows.
const CATASTRO_CACHE_VERSION = "v2";
const GEOCODE_CACHE_VERSION = "v1";
const POLYGON_CACHE_VERSION = "v1";
// Most Catastro fetch attempts (1 try + retries), if the time budget allows.
const CATASTRO_ATTEMPTS = 3;

interface CacheEntry<T> {
  payload: T;
  fetchedAt: string;
  fresh: boolean;
}

/** Read a cache entry of any age; `fresh` says whether it is within the TTL. */
async function readCache<T>(source: string, key: string): Promise<CacheEntry<T> | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("source_cache")
    .select("payload, fetched_at")
    .eq("source", source)
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  return {
    payload: data.payload as T,
    fetchedAt: data.fetched_at,
    fresh: Date.now() - new Date(data.fetched_at).getTime() < CACHE_TTL_MS,
  };
}

/** Caching is an optimisation: a failed write must not fail the report. */
async function writeCache(source: string, key: string, payload: unknown, fetchedAt: string) {
  const db = createAdminClient();
  await db
    .from("source_cache")
    .upsert(
      { source, cache_key: key, payload, fetched_at: fetchedAt },
      { onConflict: "source,cache_key" },
    );
}

/** A cached copy used because the live source failed, marked for the operator. */
function fromStaleCache<T>(
  source: SourceKey,
  entry: CacheEntry<T>,
  liveNote: string | undefined,
): AdapterResult<T> {
  return {
    source,
    status: "ok",
    data: entry.payload,
    toVerify: !entry.fresh,
    fetchedAt: entry.fetchedAt,
    note: `from cache saved ${entry.fetchedAt.slice(0, 10)}; live lookup failed (${liveNote ?? "error"})`,
  };
}

/** Catastro lookup with a 1-year cache keyed by cadastral ref (cost control). */
async function cachedCatastro(
  ref: string,
  budget: Budget,
): Promise<AdapterResult<CatastroData>> {
  const cacheKey = `${ref}#${CATASTRO_CACHE_VERSION}`;
  const cached = await readCache<CatastroData>("catastro", cacheKey);

  if (cached?.fresh) {
    return {
      source: "catastro",
      status: "ok",
      data: cached.payload,
      toVerify: false,
      fetchedAt: cached.fetchedAt,
      note: "from cache",
    };
  }

  // Catastro is the spine of the whole report — when it fails, every
  // surface/year/location/pricing section degrades to "key data missing". A
  // bare "fetch failed" is almost always a transient network blip, so retry a
  // couple of times before giving up (same rationale as geocodeWithRetry).
  // Only retry the transient `error` status; `unavailable` means the ref has no
  // cadastral record, which retrying won't fix.
  // Each attempt is capped so one hung request can't eat the whole budget.
  const attemptMs = () =>
    Math.min(ATTEMPT_TIMEOUT_MS, budget.until(CATASTRO_DEADLINE_MS));
  let result = await fetchCatastro(ref, { timeoutMs: attemptMs() });
  for (
    let i = 1;
    i < CATASTRO_ATTEMPTS &&
    result.status === "error" &&
    budget.until(CATASTRO_DEADLINE_MS) >= MIN_ATTEMPT_MS;
    i++
  ) {
    result = await fetchCatastro(ref, { timeoutMs: attemptMs() });
  }
  if (result.status === "ok" && result.data) {
    await writeCache("catastro", cacheKey, result.data, result.fetchedAt);
    return result;
  }
  // Catastro down (not "no such record"): an old copy beats refusing the report.
  if (result.status === "error" && cached) {
    return fromStaleCache("catastro", cached, result.note);
  }
  return result;
}

/** Coordinates for a parcel, cached like Catastro (they never move). */
async function cachedGeocode(
  ref: string,
  budget: Budget,
): Promise<AdapterResult<Coordinates>> {
  const parcel = ref.slice(0, 14);
  const key = `${parcel}#${GEOCODE_CACHE_VERSION}`;
  const cached = await readCache<Coordinates>("geocode", key);
  if (cached?.fresh) {
    return { source: "catastro", status: "ok", data: cached.payload, toVerify: false, fetchedAt: cached.fetchedAt, note: "from cache" };
  }
  const result = await geocodeWithRetry(ref, budget);
  if (result.status === "ok" && result.data) {
    await writeCache("geocode", key, result.data, result.fetchedAt);
    return result;
  }
  return cached ? fromStaleCache("catastro", cached, result.note) : result;
}

/**
 * Parcel outline (for whole-parcel planning checks), cached like Catastro.
 * `null` means no outline: urbanism then checks the single reference point.
 */
async function cachedPolygon(parcelRef: string, budget: Budget): Promise<ParcelPolygon | null> {
  const key = `${parcelRef.slice(0, 14)}#${POLYGON_CACHE_VERSION}`;
  const cached = await readCache<ParcelPolygon>("parcel-polygon", key);
  if (cached?.fresh) return cached.payload;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const live = await Promise.race([
    fetchParcelPolygon(parcelRef),
    new Promise<null>((r) => {
      timer = setTimeout(() => r(null), budget.until(GEO_DEADLINE_MS));
    }),
  ]).finally(() => clearTimeout(timer));
  if (live) {
    await writeCache("parcel-polygon", key, live, new Date().toISOString());
    return live;
  }
  return cached?.payload ?? null;
}

/**
 * Generate a new report from operator input. Runs the pipeline within a fixed
 * time budget, seeds the Report, persists it as `in_review`, and logs source
 * provenance. Degrades gracefully on any *secondary* source failure (manual
 * entry), but **throws if Catastro itself is unavailable** — without the
 * cadastral spine the report is an empty "key data missing" shell, and with no
 * operator gate at MVP it would ship straight to the buyer. The caller catches
 * this and shows a retry prompt instead. Returns the new report id.
 *
 * The report row is written once, at the end, with its full data. If the run
 * is killed part-way nothing is saved, so an empty report can never exist.
 */
export async function generateReport(input: ReportInput): Promise<string> {
  const db = createAdminClient();
  const budget = createBudget();
  const rawRef = (input.cadastralRef || input.addressOrRef || "").trim();
  const ref = normaliseRef(rawRef);

  const cat = await timed(() => cachedCatastro(ref, budget));
  // Spine check: never persist (and bill for) a report with no cadastral data.
  // An outage (status "error", no cached copy) is told apart from an unknown
  // reference, so the buyer can be offered "we'll email it when it's back".
  if (cat.status !== "ok" || !cat.data) {
    const msg = `Catastro unavailable for "${ref}": ${cat.note ?? cat.status}`;
    throw cat.status === "error" ? new CatastroDownError(msg) : new Error(msg);
  }
  const resolvedRef = cat.data.unit.cadastralRef;
  const id = crypto.randomUUID();

  let report = emptyReport(id, resolvedRef);
  if (cat.status === "ok" && cat.data) {
    report = seedFromCatastro(report, input, cat.data);
  }
  report = seedPriceRefs(report);
  report = seedCostsTaxes(report, input.askingPriceEur);
  report = seedLegal(report);

  // Every source after Catastro must resolve by SOURCES_DEADLINE_MS, or it is
  // recorded as timed out and the report says the data is unavailable.
  const bounded = <T,>(source: SourceKey, run: () => Promise<AdapterResult<T>>) =>
    timed(() => withDeadline(source, run(), budget.until(SOURCES_DEADLINE_MS)));

  // Energy certificate (ICAEN) + INE IPV (Catalan housing market context) need
  // neither coordinates nor each other: start them now, together with
  // affectation and geocoding below, so they run alongside instead of before.
  const energyP = bounded("energy", () => fetchEnergy(resolvedRef));
  const ipvP = bounded("ipv", () => fetchIpv());
  // Official affectation (AFH) needs only the parcel ref; geocoding has its own
  // retry loop and earlier deadline, since the geo-dependent sources wait on it.
  const parcelRef = cat.data.parcel.parcelRef ?? resolvedRef;
  const affP = bounded("affectation", () => fetchAffectation(parcelRef));
  const geoP = timed(() => cachedGeocode(resolvedRef, budget));
  const polygonP = cachedPolygon(parcelRef, budget);

  const [energy, ipv] = await Promise.all([energyP, ipvP]);
  if (energy.status === "ok" && energy.data) {
    report = seedEnergy(report, energy.data);
  } else {
    // No ICAEN certificate — state it where energy would appear (it still drops
    // out of the score via re-normalisation).
    report = seedEnergyMissing(report);
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
  {
    const [geo, aff, polygon] = await Promise.all([geoP, affP, polygonP]);
    affectation = aff;
    const affData = aff.status === "ok" ? aff.data : undefined;
    if (geo.status === "ok" && geo.data) {
      const coords = geo.data;
      [amenities, urbanism, comps, flood, heritage] = await Promise.all([
        bounded("amenities", () => fetchAmenities(coords)),
        bounded("urbanism", () => fetchUrbanism(coords, { parcelRef, polygon })),
        bounded("market", () =>
          fetchComps(coords, {
            minSize: builtM2 ? Math.round(builtM2 * 0.6) : undefined,
            maxSize: builtM2 ? Math.round(builtM2 * 1.6) : undefined,
          }),
        ),
        bounded("flood", () => fetchFlood(coords)),
        bounded("heritage", () => fetchHeritage(coords, { polygon })),
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
      } else {
        report = seedHeritageUnchecked(report);
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
    // Always seed the urbanism section once. If geo failed but AFH came through,
    // surface the affectation from the official source alone; if neither
    // resolved, seedUrbanism flags the affectation as unverified (no operator
    // review backstops this, so the buyer must be told).
    if (!urbanismSeeded) {
      report = seedUrbanism(report, EMPTY_URBANISM, affData);
      // No coordinates, so the heritage catalogue was never queried.
      report = seedHeritageUnchecked(report);
    }
  }

  // Building section, now that the heritage catalogue may have given the
  // original build date (Catastro's year can be a full renovation).
  const years = buildingYears(
    cat.data?.unit.yearBuilt,
    heritage?.status === "ok" ? heritage.data?.epoch : undefined,
  );
  report = seedBuilding(report, years);

  // Risk & Safety: flood (if resolved) + static seismic/radon + district crime.
  report = seedRisks(report, {
    flood: flood?.status === "ok" ? flood.data : undefined,
    floodUnchecked: flood?.status !== "ok",
    districtCode: cat.data?.unit.districtCode,
    yearBuilt: years.ageYear,
  });

  // Deterministic "Sources & method" + disclaimer (reflects comps presence).
  report = seedFooter(report);

  // Deterministic scores: the five quality pillars (building age, amenities,
  // energy, asking-vs-barri price) plus the risk modifier that can override the
  // weighted average for a serious affectation/flood/heritage finding.
  const yearBuilt = cat.data?.unit.yearBuilt;
  const energyClass = energy.data?.consumptionClass;
  const deltaPct = report.price.pricing?.deltaPct;
  const risk = {
    affectation:
      affectation?.status === "ok" ? affectation.data?.category : undefined,
    flood: flood?.status === "ok" ? flood.data?.level : undefined,
    heritageLevel: heritage?.status === "ok" ? heritage.data?.level : undefined,
  };
  const { values, overall } = computeScores({
    yearBuilt,
    energyClass,
    amenities: amenities?.data,
    deltaPct,
    risk,
  });
  report = seedScores(
    report,
    values,
    overall,
    { year: yearBuilt, energyClass, amenities: amenities?.data, deltaPct },
  );

  // Fact-based bottom line, subtitle, neighbourhood prose, negotiation
  // playbook and checklist, so they exist in every report (free preview
  // included). The AI narrative, when it runs after unlock, overwrites them.
  report = seedFactsNarrative(report, {
    builtM2,
    // Original build year when the catalogue has one; Catastro's otherwise.
    yearBuilt: years.ageYear,
    renovatedYear: years.original ? years.effective : undefined,
    yearLabel: years.originalLabel,
    barri: report.price.pricing?.barri?.name,
    district: cat.data.unit.districtCode ? BCN_DISTRICTS[cat.data.unit.districtCode] : undefined,
    askingPriceEur: input.askingPriceEur,
    energyClass,
    // "unavailable" = ICAEN answered: no certificate is registered.
    energyChecked: energy.status !== "error",
    affectation: {
      checked: affectation?.status === "ok",
      category: affectation?.status === "ok" ? affectation.data?.category : undefined,
    },
    heritage: {
      checked: heritage?.status === "ok",
      level: heritage?.status === "ok" ? heritage.data?.level : undefined,
      inEnsemble: heritage?.status === "ok" ? heritage.data?.inEnsemble : undefined,
    },
    flood: {
      checked: flood?.status === "ok",
      level: flood?.status === "ok" ? flood.data?.level : undefined,
    },
    amenities: amenities?.status === "ok" ? amenities.data : undefined,
  });

  // Single write, with the complete data. Checked: a silent failure here used to
  // leave the buyer on a report page with nothing in it.
  const { error: insertError } = await db.from("reports").insert({
    id,
    cadastral_ref: resolvedRef,
    status: "in_review",
    input,
    data: report,
  });
  if (insertError) {
    throw new Error(`Could not save report: ${insertError.message}`);
  }

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
  // Provenance is for the operator, not the buyer: a failed write is reported
  // but doesn't fail a report that has already been saved.
  const { error: sourcesError } = await db
    .from("report_sources")
    .upsert(sources, { onConflict: "report_id,source" });
  if (sourcesError) {
    console.error(
      `[generateReport] report ${id} saved, but its source log failed: ${sourcesError.message}`,
    );
  }

  return id;
}
