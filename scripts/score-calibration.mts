/**
 * Scoring calibration harness — NOT part of the app.
 *
 * Runs the real adapter chain for one or more cadastral references (no Supabase,
 * no DB writes) and prints the five pillars + the risk modifier + the final
 * overall, so we can sanity-check the thresholds in config/scoring.ts against
 * real Barcelona flats before shipping.
 *
 * Accepts either a cadastral reference or a Barcelona street address (resolved
 * via the Catastro address-search adapter). Append `=<askingPriceEur>` to either
 * so the price pillar fires.
 *
 * Usage:
 *   npx tsx scripts/score-calibration.mts "<ref|address>[=askingEur]" [...]
 *
 * Examples:
 *   npx tsx scripts/score-calibration.mts 9648812DF2894H0013RQ=420000
 *   npx tsx scripts/score-calibration.mts "Mallorca 191" "Verdi 50=500000"
 *
 * Most sources are public/no-key; this needs only outbound network access.
 */
import { normaliseRef, fetchCatastro } from "@/adapters/catastro";
import {
  searchStreets,
  locateUnits,
  streetNameQuery,
} from "@/adapters/catastro-search";
import { geocodeRef } from "@/adapters/geo";
import { fetchAmenities } from "@/adapters/amenities";
import { fetchAffectation } from "@/adapters/affectation";
import { fetchHeritage } from "@/adapters/heritage";
import { fetchFlood } from "@/adapters/flood";
import { fetchEnergy } from "@/adapters/energy";
import { fetchGencatBarri } from "@/adapters/gencat-barri";
import { computeScores } from "@/config/scoring";

function parseArg(arg: string): { input: string; asking?: number } {
  const [input, asking] = arg.split("=");
  return { input: input.trim(), asking: asking ? Number(asking) : undefined };
}

/** A cadastral ref is ~14-20 chars, no spaces, alphanumeric. */
const looksLikeRef = (s: string) => !s.includes(" ") && /^[0-9A-Za-z]{14,20}$/.test(s);

/** Resolve a "Street Name 123" address to a unit's cadastral reference. */
async function resolveAddress(addr: string): Promise<string | null> {
  const m = addr.match(/^(.*?)[\s,]+(\d+)\s*$/);
  const name = m ? m[1] : addr;
  const num = m ? m[2] : "1";
  const streets = await searchStreets(name);
  if (!streets.length) return null;
  const q = streetNameQuery(name).toUpperCase();
  const ranked = [...streets].sort((a, b) => {
    const ax = a.nombre.toUpperCase() === q ? 0 : 1;
    const bx = b.nombre.toUpperCase() === q ? 0 : 1;
    if (ax !== bx) return ax - bx;
    return (a.tipo === "CL" ? 0 : 1) - (b.tipo === "CL" ? 0 : 1);
  });
  for (const s of ranked.slice(0, 3)) {
    for (const n of [num, "100", "50", "30", "20", "10"]) {
      const units = await locateUnits(s.tipo, s.nombre, n);
      if (units.length && units[0].ref) return units[0].ref;
    }
  }
  return null;
}

async function run(input: string, asking?: number) {
  const ref = looksLikeRef(input)
    ? normaliseRef(input)
    : (await resolveAddress(input)) ?? "";
  const head = looksLikeRef(input) ? ref : `${input} → ${ref || "UNRESOLVED"}`;
  console.log(`\n${"=".repeat(64)}\n${head}${asking ? ` · asking €${asking.toLocaleString()}` : " · no asking price"}`);
  if (!ref) {
    console.log("  could not resolve a cadastral reference.");
    return;
  }

  const cat = await fetchCatastro(ref);
  if (cat.status !== "ok" || !cat.data) {
    console.log(`  catastro: ${cat.status} — ${cat.note ?? ""}. Skipping.`);
    return;
  }
  const yearBuilt = cat.data.unit.yearBuilt;
  const builtM2 = cat.data.unit.builtAreaM2;
  const parcelRef = cat.data.parcel.parcelRef ?? ref;

  const energy = await fetchEnergy(ref);
  const [geo, aff] = await Promise.all([geocodeRef(ref), fetchAffectation(parcelRef)]);

  let amenities, flood, heritage, deltaPct: number | undefined;
  let barriPerM2: number | undefined;
  if (geo.status === "ok" && geo.data) {
    [amenities, flood, heritage] = await Promise.all([
      fetchAmenities(geo.data),
      fetchFlood(geo.data),
      fetchHeritage(geo.data),
    ]);
    const barri = fetchGencatBarri(geo.data);
    barriPerM2 = barri.status === "ok" ? barri.data?.pricePerM2 : undefined;
    if (asking && builtM2 && barriPerM2) {
      deltaPct = (asking / builtM2 / barriPerM2 - 1) * 100;
    }
  }

  const risk = {
    affectation: aff.status === "ok" ? aff.data?.category : undefined,
    flood: flood?.status === "ok" ? flood.data?.level : undefined,
    heritageLevel: heritage?.status === "ok" ? heritage.data?.level : undefined,
  };

  const { values, overall, risk: r } = computeScores({
    yearBuilt,
    energyClass: energy.data?.consumptionClass,
    amenities: amenities?.status === "ok" ? amenities.data : undefined,
    deltaPct,
    risk,
  });

  const px = (v?: number) => (v == null ? "  — " : String(v).padStart(3));
  console.log(`  built ${builtM2 ?? "?"}m²  year ${yearBuilt ?? "?"}  barri €/m² ${barriPerM2 ?? "?"}  Δ ${deltaPct != null ? deltaPct.toFixed(1) + "%" : "—"}`);
  console.log(`  pillars  price ${px(values.price)} | location ${px(values.location)} | building ${px(values.building)} | transport ${px(values.transport)} | energy ${px(values.energy)}`);
  console.log(`  risk     affectation=${risk.affectation ?? (aff.status + " → FLAGGED unverified")}  flood=${risk.flood ?? "—"}  heritage=${risk.heritageLevel ?? "—"}  ⇒ severity=${r.severity} factor=${r.factor.toFixed(3)} cap=${r.cap}`);
  console.log(`  OVERALL  ${overall}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/score-calibration.mts "<ref|address>[=askingEur]" [...]');
  process.exit(1);
}
for (const a of args) {
  const { input, asking } = parseArg(a);
  try {
    await run(input, asking);
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}
