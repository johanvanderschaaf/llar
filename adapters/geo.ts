import { XMLParser } from "fast-xml-parser";
import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
  unavailable,
} from "./types";

/**
 * Catastro Consulta_CPMRC — coordinates (lat/lon, EPSG:4326) from a parcel
 * cadastral reference. Free, official, no key. Coordinates feed the amenity
 * and natural-risk lookups (which are geographic).
 */
const OVC =
  "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_CPMRC";

export interface Coordinates {
  lat: number;
  lon: number;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
});

/** A cadastral parcel boundary in EPSG:3857 (Web Mercator), for spatial queries. */
export interface ParcelPolygon {
  /** Exterior ring vertices as [x, y] in EPSG:3857 (metres). */
  ring: Array<[number, number]>;
  /** Polygon centroid [x, y] in EPSG:3857. */
  centroid: [number, number];
}

/** Area-weighted polygon centroid; falls back to the vertex mean if degenerate. */
function polygonCentroid(ring: Array<[number, number]>): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const f = xj * yi - xi * yj;
    a += f;
    cx += (xi + xj) * f;
    cy += (yi + yj) * f;
  }
  if (Math.abs(a) < 1e-6) {
    const n = ring.length || 1;
    return [
      ring.reduce((s, p) => s + p[0], 0) / n,
      ring.reduce((s, p) => s + p[1], 0) / n,
    ];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/**
 * Parcel boundary from the Catastro INSPIRE Cadastral-Parcel WFS, in EPSG:3857.
 * Free, official, no key. Lets us query planning qualifications across the WHOLE
 * finca (not just its centroid) so partial affectations — a strip qualified as
 * system / equipament / viari — are not missed. Returns null on any failure;
 * the caller degrades to a single-point query.
 */
const INSPIRE_CP = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx";

export async function fetchParcelPolygon(
  parcelRef: string,
): Promise<ParcelPolygon | null> {
  const ref = parcelRef.replace(/\s+/g, "").toUpperCase().slice(0, 14);
  if (ref.length < 14) return null;
  const url =
    `${INSPIRE_CP}?service=wfs&version=2.0.0&request=getfeature` +
    `&STOREDQUERIE_ID=GETPARCEL&REFCAT=${encodeURIComponent(ref)}&SRSNAME=EPSG::3857`;
  try {
    const res = await fetchWithTimeout(url, 12000);
    if (!res.ok) return null;
    const xml = await res.text();
    // Exterior ring = the gml:posList block with the most coordinates.
    const blocks = [
      ...xml.matchAll(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/gi),
    ].map((m) => m[1].trim());
    let best: number[] = [];
    for (const b of blocks) {
      const nums = b.split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
      if (nums.length > best.length) best = nums;
    }
    const ring: Array<[number, number]> = [];
    for (let i = 0; i + 1 < best.length; i += 2) ring.push([best[i], best[i + 1]]);
    if (ring.length < 3) return null;
    return { ring, centroid: polygonCentroid(ring) };
  } catch {
    return null;
  }
}

export async function geocodeRef(
  cadastralRef: string,
): Promise<AdapterResult<Coordinates>> {
  const parcelRef = cadastralRef.replace(/\s+/g, "").toUpperCase().slice(0, 14);
  try {
    const res = await fetchWithTimeout(
      `${OVC}?Provincia=&Municipio=&SRS=EPSG:4326&RC=${encodeURIComponent(parcelRef)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const root = (parser.parse(await res.text()) as Record<string, unknown>)
      .consulta_coordenadas as Record<string, unknown> | undefined;
    const coord = (
      (root?.coordenadas as Record<string, unknown>)?.coord as
        | Record<string, unknown>
        | Record<string, unknown>[]
    );
    const first = Array.isArray(coord) ? coord[0] : coord;
    const geo = first?.geo as Record<string, unknown> | undefined;
    const lon = Number(geo?.xcen);
    const lat = Number(geo?.ycen);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return unavailable<Coordinates>(
        "catastro",
        "Catastro returned no coordinates for this reference.",
      );
    }
    return ok<Coordinates>("catastro", { lat, lon });
  } catch (e) {
    return failed<Coordinates>("catastro", `Geocode failed: ${(e as Error).message}`);
  }
}
