import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
} from "./types";
import { pointInRing, type Coordinates, type ParcelPolygon } from "./geo";

/**
 * Architectural heritage protection for a Barcelona building, from the
 * Ajuntament's urbanism WMS (`Catàleg_de_patrimoni`) — the same service we use
 * for qualifications. Free, no key.
 *
 * Protection level is the feature's NIVELL attribute:
 *   A — Bé Cultural d'Interès Nacional (BCIN)  — strictest
 *   B — Bé Cultural d'Interès Local (BCIL)
 *   C — Bé d'Interès Urbanístic
 *   D — Bé d'Interès Documental                — lightest
 * Plus area-wide "conjunt / entorn protegit" (e.g. the whole Eixample), which
 * is reported as context, not a building-specific protection.
 *
 * The sublayer names (…__A_, …__B_, …__C_) do NOT give the level: the service
 * returns every listed building on all three, so reading the layer name made
 * every listing a national monument (A). Only the layer's kind (building vs
 * conjunt/entorn) comes from the name.
 *
 * Heritage protection constrains renovation (protected façade / interior, no
 * demolition, special permits, higher cost & longer timelines) — a major buyer
 * concern. Verified live: Casa Batlló → A (BCIN); Mallorca 191 → ensemble only.
 */
const BCN_WMS = "http://w133.bcn.cat/WMSURBANISME/service.svc/get";
const HERITAGE_LAYER = "Catàleg_de_patrimoni";

export type HeritageLevel = "A" | "B" | "C" | "D";

export interface HeritageData {
  /** Building-specific catalog protection (highest level found), if any. */
  level?: HeritageLevel;
  /** Catalog name, e.g. "CASA BATLLÓ". */
  name?: string;
  author?: string;
  epoch?: string;
  style?: string;
  /** True when the building sits inside a protected ensemble. */
  inEnsemble: boolean;
  /** Ensemble name, e.g. "CONJUNT ESPECIAL DE L'EIXAMPLE". */
  ensembleName?: string;
}

const LEVEL_RANK: Record<HeritageLevel, number> = { A: 4, B: 3, C: 2, D: 1 };

export interface RawFeature {
  layer: string;
  /** Official protection level (A–D) of this catalogue entry. */
  nivell?: string;
  denomin?: string;
  author?: string;
  epoch?: string;
  style?: string;
}

/** Building listing (with its NIVELL level), area protection, or neither. */
function levelOf(f: RawFeature): HeritageLevel | "ensemble" | null {
  const l = f.layer.toLowerCase();
  if (/conjunt|entorn/.test(l)) return "ensemble";
  if (!/^pol[ií]gon_de_b[ée]/.test(l)) return null;
  const n = f.nivell?.trim().toUpperCase();
  return n === "A" || n === "B" || n === "C" || n === "D" ? n : null;
}

function parseFeatures(xml: string): RawFeature[] {
  const out: RawFeature[] = [];
  for (const block of xml.split("featureMember").slice(1)) {
    const layer = block.match(/Layer Name="([^"]+)"/i)?.[1];
    if (!layer) continue;
    const attr = (n: string) =>
      block.match(new RegExp(`Name="${n}">([^<]*)<`, "i"))?.[1]?.trim() ||
      undefined;
    out.push({
      layer,
      nivell: attr("NIVELL"),
      denomin: attr("DENOMIN"),
      author: attr("AUTOR"),
      epoch: attr("EPOCA"),
      style: attr("ESTIL"),
    });
  }
  return out;
}

async function featuresAt(x: number, y: number): Promise<RawFeature[]> {
  const half = 4; // ~8 m probe box
  const bbox = `${x - half},${y - half},${x + half},${y + half}`;
  const url =
    `${BCN_WMS}?service=WMS&version=1.3.0&request=GetFeatureInfo` +
    `&layers=${encodeURIComponent(HERITAGE_LAYER)}&query_layers=${encodeURIComponent(HERITAGE_LAYER)}` +
    `&styles=&crs=EPSG:3857&bbox=${bbox}&width=32&height=32&i=16&j=16` +
    `&info_format=text/xml&feature_count=10`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) throw new Error(`BCN WMS HTTP ${res.status}`);
  return parseFeatures(await res.text());
}

/**
 * "Fitxa 0 de Ciutat Vella" is the district-wide sheet of a district's heritage
 * plan, not a listing of one building. The service returns it on the A, B and C
 * layers for every point in the district, so read literally it flagged every
 * Ciutat Vella flat as a national monument. It is treated as area context.
 */
const DISTRICT_SHEET = /^fitxa\s*0\s+de\s+(.+)$/i;

/** Pick the building's highest individual listing and any protected area. */
export function classifyHeritage(features: RawFeature[]): HeritageData {
  let best: { level: HeritageLevel; f: RawFeature } | null = null;
  let conjunt: RawFeature | null = null;
  let districtSheet: string | undefined;
  for (const f of features) {
    const sheet = f.denomin?.match(DISTRICT_SHEET);
    if (sheet) {
      districtSheet ??= sheet[1].trim();
      continue;
    }
    const lvl = levelOf(f);
    if (lvl === "ensemble") conjunt ??= f;
    else if (lvl && (!best || LEVEL_RANK[lvl] > LEVEL_RANK[best.level])) best = { level: lvl, f };
  }
  return {
    level: best?.level,
    name: best?.f.denomin,
    author: best?.f.author,
    epoch: best?.f.epoch,
    style: best?.f.style,
    inEnsemble: Boolean(conjunt || districtSheet),
    // A named conjunt is more specific than the district sheet.
    ensembleName: conjunt?.denomin ?? districtSheet,
  };
}

/** Probe offsets (m) around the centre, to catch a listing the centre misses. */
const RING = [6, 10];

/**
 * Points to query: with the parcel outline, the centre plus nearby points that
 * fall INSIDE this parcel (a fixed ring used to land on the building next door
 * and report its listing as this flat's); without it, the centre plus a tight
 * 4 m ring, which stays inside all but the narrowest parcels.
 */
function probePoints(coords: Coordinates, polygon?: ParcelPolygon | null): Array<[number, number]> {
  const R = 6378137;
  const geoCentre: [number, number] = [
    R * ((coords.lon * Math.PI) / 180),
    R * Math.log(Math.tan(Math.PI / 4 + (coords.lat * Math.PI) / 360)),
  ];
  const around = ([x, y]: [number, number], d: number): Array<[number, number]> => [
    [x + d, y],
    [x - d, y],
    [x, y + d],
    [x, y - d],
  ];
  if (!polygon) return [geoCentre, ...around(geoCentre, 4)];
  const centre = pointInRing(polygon.centroid, polygon.ring) ? polygon.centroid : geoCentre;
  const ring = RING.flatMap((d) => around(centre, d)).filter((p) => pointInRing(p, polygon.ring));
  return [centre, ...ring];
}

export async function fetchHeritage(
  coords: Coordinates,
  opts: { polygon?: ParcelPolygon | null } = {},
): Promise<AdapterResult<HeritageData>> {
  const pts = probePoints(coords, opts.polygon);

  try {
    const results = await Promise.all(
      pts.map((p) => featuresAt(p[0], p[1]).catch(() => [] as RawFeature[])),
    );
    const features = results.flat();
    if (!features.length) {
      return ok<HeritageData>("heritage", { inEnsemble: false });
    }

    const data = classifyHeritage(features);
    return ok<HeritageData>("heritage", data, data.level ? { toVerify: true } : {});
  } catch (e) {
    return failed<HeritageData>(
      "heritage",
      `Heritage lookup failed: ${(e as Error).message}`,
    );
  }
}
