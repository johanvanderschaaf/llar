import { type AdapterResult, ok, unavailable } from "./types";
import type { Coordinates } from "./geo";
import prices from "@/data/bcn-barri-prices.json";
import polygonsRaw from "@/data/bcn-barris.json";

/**
 * Barri-level closing-price statistics for Barcelona.
 *
 * Combines two committed open-data files refreshed quarterly via
 * `scripts/refresh-bcn-pricing.py`:
 *
 * - `data/bcn-barri-prices.json`  — Generalitat Habitatge, registered
 *   second-hand compraventa, rolling 12 months, per barri.
 * - `data/bcn-barris.json`     — official Ajuntament BCN barri polygons
 *   (WGS84), used to resolve coordinates → barri code 01–73.
 *
 * Adapter is a pure synchronous lookup. Degrades to `unavailable` when:
 * - no coordinates (geocoding failed upstream), or
 * - the point lands outside any barri polygon (cadastral ref not in BCN
 *   city), or
 * - the matched barri has a blank value ("n.d.") for the period (low
 *   transaction volume).
 */
export interface GencatBarriData {
  /** Two-digit barri code, e.g. "31" for la Vila de Gràcia. */
  barriCode: string;
  /** Official Catalan name of the barri. */
  name: string;
  /** Two-digit district code, "01"–"10". */
  districtCode?: string;
  /** Average €/m² built area, rolling 12 months, second-hand only. */
  pricePerM2: number;
  /** Registered compraventa count in the same window. */
  transactions?: number;
  /** Average built surface (m²) of flats sold in the window. */
  avgSurfaceM2?: number;
  /** Human-readable period label, e.g. "gener 2025 - desembre 2025". */
  asOf: string;
}

interface PriceRow {
  name: string;
  pricePerM2: number | null;
  transactions: number | null;
  avgSurfaceM2: number | null;
}
interface PriceFile {
  asOf: string;
  source: string;
  sourceUrl: string;
  byBarri: Record<string, PriceRow>;
}
interface BarriFeature {
  type: "Feature";
  properties: { code: string; name: string; districtCode?: string };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}
interface BarriFC {
  type: "FeatureCollection";
  features: BarriFeature[];
}

const PRICES = prices as PriceFile;
const POLYGONS = polygonsRaw as unknown as BarriFC;

/** Ray-casting point-in-polygon. Coords are [lng, lat]. */
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Point-in-polygon for a (Multi)Polygon with holes. Outer rings positive, holes invert. */
function pointInFeature(lng: number, lat: number, f: BarriFeature): boolean {
  const polys =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
  for (const poly of polys) {
    const [outer, ...holes] = poly;
    if (!outer || !pointInRing(lng, lat, outer)) continue;
    let inHole = false;
    for (const h of holes) {
      if (pointInRing(lng, lat, h)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function fetchGencatBarri(
  coords: Coordinates | undefined,
): AdapterResult<GencatBarriData> {
  if (!coords) {
    return unavailable<GencatBarriData>(
      "gencat-barri",
      "No coordinates resolved upstream — barri lookup skipped.",
    );
  }
  const { lat, lon } = coords;
  const hit = POLYGONS.features.find((f) => pointInFeature(lon, lat, f));
  if (!hit) {
    return unavailable<GencatBarriData>(
      "gencat-barri",
      "Coordinates fall outside the 73 Barcelona-city barris (likely outside the municipal boundary).",
    );
  }
  const code = hit.properties.code;
  const row = PRICES.byBarri[code];
  if (!row || row.pricePerM2 == null) {
    return unavailable<GencatBarriData>(
      "gencat-barri",
      `Barri ${code} (${hit.properties.name}) has no €/m² figure for ${PRICES.asOf} — low transaction volume.`,
    );
  }
  return ok<GencatBarriData>(
    "gencat-barri",
    {
      barriCode: code,
      name: row.name,
      districtCode: hit.properties.districtCode,
      pricePerM2: row.pricePerM2,
      transactions: row.transactions ?? undefined,
      avgSurfaceM2: row.avgSurfaceM2 ?? undefined,
      asOf: PRICES.asOf,
    },
  );
}
