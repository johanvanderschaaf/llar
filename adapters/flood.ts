import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
} from "./types";
import type { Coordinates } from "./geo";

/**
 * Flood risk via the national SNCZI / IDEE INSPIRE WMS (free, no key).
 * We point-query the fluvial flood-zone raster layers for return periods
 * T10 / T100 / T500. The raster returns GRAY_INDEX = 999 for "outside the
 * zone" (nodata); any other value means the point falls inside that
 * return-period flood zone. Verified live against Carrer de Sors 35 (clear).
 */
const WMS = "https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones";

export type FloodLevel = "high" | "medium" | "low";

export interface FloodData {
  /** Highest-frequency zone the point falls in (drives the risk level). */
  level: FloodLevel;
  inT10: boolean;
  inT100: boolean;
  inT500: boolean;
}

const LAYERS: Record<"t10" | "t100" | "t500", string> = {
  t10: "NZ.Flood.FluvialT10",
  t100: "NZ.Flood.FluvialT100",
  t500: "NZ.Flood.FluvialT500",
};

async function inZone(layer: string, coords: Coordinates): Promise<boolean> {
  const R = 6378137;
  const x = R * ((coords.lon * Math.PI) / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + (coords.lat * Math.PI) / 360));
  const half = 60; // tight box around the point
  const bbox = `${x - half},${y - half},${x + half},${y + half}`;
  const url =
    `${WMS}?service=WMS&version=1.3.0&request=GetFeatureInfo` +
    `&layers=${layer}&query_layers=${layer}&styles=` +
    `&crs=EPSG:3857&bbox=${bbox}&width=101&height=101&i=50&j=50` +
    `&info_format=application/json`;
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) throw new Error(`SNCZI HTTP ${res.status}`);
  const json = (await res.json()) as {
    features?: { properties?: { GRAY_INDEX?: number } }[];
  };
  const feats = json.features ?? [];
  // A real (non-999) GRAY_INDEX means the point is inside the flood polygon.
  return feats.some((f) => {
    const g = f.properties?.GRAY_INDEX;
    return typeof g === "number" && g !== 999;
  });
}

export async function fetchFlood(
  coords: Coordinates,
): Promise<AdapterResult<FloodData>> {
  try {
    const [inT10, inT100, inT500] = await Promise.all([
      inZone(LAYERS.t10, coords),
      inZone(LAYERS.t100, coords),
      inZone(LAYERS.t500, coords),
    ]);
    const level: FloodLevel = inT10
      ? "high"
      : inT100
        ? "medium"
        : "low";
    return ok<FloodData>("flood", { level, inT10, inT100, inT500 });
  } catch (e) {
    return failed<FloodData>("flood", `Flood lookup failed: ${(e as Error).message}`);
  }
}
