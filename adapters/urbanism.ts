import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
} from "./types";
import type { Coordinates, ParcelPolygon } from "./geo";
import { fetchParcelPolygon } from "./geo";

/**
 * Planning qualification + affectations for a Barcelona flat, from the
 * Ajuntament de Barcelona's own urbanism WMS (WMSURBANISME) — the same source
 * behind the official Portal d'Informació Urbanística. Free, no key.
 *
 * Crucially, we query the WHOLE parcel polygon, not just its centroid: an
 * affectation often touches only PART of a finca (a strip qualified as
 * viari / equipament / zona verda). The authoritative system/zone flag is the
 * WMS `DESTI` attribute (`"Sistema"` vs `"Zona"`) — no keyword heuristics.
 *
 * A point-in-polygon read is a strong SIGNAL, not a legal certificate; the
 * report always tells the buyer to confirm with a certificat urbanístic.
 * Verified live: Carrer de Mallorca 191 → 13E (Zona) + 7a Equipament (Sistema)
 * + viari (Sistema), matching the Ajuntament portal's "afectació urbanística".
 */
const BCN_WMS = "http://w133.bcn.cat/WMSURBANISME/service.svc/get";
const QUAL_LAYER = "Qualificació_urbanística";

// How densely to probe the parcel, and the cost ceiling on WMS calls.
const GRID = 5; // (GRID+1)^2 candidate points before the inside-polygon filter
const MAX_POINTS = 14; // hard cap on WMS GetFeatureInfo calls per report
const POOL = 6; // concurrent WMS calls

export interface UrbanismQual {
  /** Plan qualification key, e.g. "7a", "13E", "vial". */
  clau: string;
  /** PGM-assimilated key, e.g. "7a", "13a", "5". */
  clauAssim?: string;
  /** Human name, e.g. "Equipaments actuals", "Xarxa viària". */
  name?: string;
  /** Group label, e.g. "2 Equipaments", "5 Xarxa viària". */
  group?: string;
  /** Family label, e.g. "Equipaments comunitaris i dotacions (7)". */
  family?: string;
  /** Plan that sets the qualification, e.g. "PGM", "BE201A". */
  plan?: string;
  /** True when DESTI === "Sistema" → a possible afectació urbanística. */
  isSystem: boolean;
}

export interface UrbanismData {
  /** Land classification, e.g. "Sòl urbà consolidat". */
  classification?: string;
  /** Main (dwelling-zone) qualification name. */
  qualification?: string;
  /** Main qualification key, e.g. "13E". */
  qualCode?: string;
  /** True when any part of the finca carries a system qualification. */
  possibleAffectation: boolean;
  /** Distinct system qualifications touching the finca (the affectations). */
  affectations: UrbanismQual[];
  /** Every distinct qualification touching the finca (systems + zones). */
  qualifications: UrbanismQual[];
  /** How the data was obtained (whole-parcel vs single-point vs fallback). */
  method: "bcn-parcel" | "bcn-point";
  /** Official map to inspect the parcel in context. */
  mapUrl: string;
}

const CLASS_LABELS: Record<string, string> = {
  SUC: "Sòl urbà consolidat",
  SUNC: "Sòl urbà no consolidat",
  SUD: "Sòl urbanitzable delimitat",
  SUND: "Sòl urbanitzable no delimitat",
  SNU: "Sòl no urbanitzable",
};

interface RawQual {
  clau: string;
  clauAssim?: string;
  name?: string;
  group?: string;
  family?: string;
  plan?: string;
  classific?: string;
  desti?: string;
}

/** Parse all qualification features from a WMS GetFeatureInfo XML response. */
function parseQuals(xml: string): RawQual[] {
  const out: RawQual[] = [];
  for (const block of xml.split("featureMember").slice(1)) {
    const attr = (name: string): string | undefined => {
      const m = block.match(
        new RegExp(`Name="${name}">([^<]*)<`, "i"),
      );
      const v = m?.[1]?.trim();
      return v ? v : undefined;
    };
    const clau = attr("CLAU");
    if (!clau) continue;
    out.push({
      clau,
      clauAssim: attr("CLAU_ASSIM"),
      name: attr("NOM_CLAU"),
      group: attr("GRUP"),
      family: attr("FAMILIA"),
      plan: attr("CODI_PLA"),
      classific: attr("CLASSIFIC"),
      desti: attr("DESTI"),
    });
  }
  return out;
}

/** Ray-casting point-in-polygon test (ring in the same CRS as the point). */
function inside(pt: [number, number], ring: Array<[number, number]>): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    ) {
      c = !c;
    }
  }
  return c;
}

/** Sample points strictly inside the parcel: centroid first, then a grid. */
function samplePoints(poly: ParcelPolygon): Array<[number, number]> {
  const xs = poly.ring.map((p) => p[0]);
  const ys = poly.ring.map((p) => p[1]);
  const minx = Math.min(...xs);
  const maxx = Math.max(...xs);
  const miny = Math.min(...ys);
  const maxy = Math.max(...ys);
  const pts: Array<[number, number]> = [];
  if (inside(poly.centroid, poly.ring)) pts.push(poly.centroid);
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const p: [number, number] = [
        minx + ((maxx - minx) * i) / GRID,
        miny + ((maxy - miny) * j) / GRID,
      ];
      if (inside(p, poly.ring)) pts.push(p);
    }
  }
  return pts.slice(0, MAX_POINTS);
}

/** GetFeatureInfo at one EPSG:3857 point, returning its qualification features. */
async function qualsAtPoint(
  x: number,
  y: number,
): Promise<RawQual[]> {
  const half = 3; // ~6 m probe box
  const bbox = `${x - half},${y - half},${x + half},${y + half}`;
  const url =
    `${BCN_WMS}?service=WMS&version=1.3.0&request=GetFeatureInfo` +
    `&layers=${encodeURIComponent(QUAL_LAYER)}&query_layers=${encodeURIComponent(QUAL_LAYER)}` +
    `&styles=&crs=EPSG:3857&bbox=${bbox}&width=32&height=32&i=16&j=16` +
    `&info_format=text/xml&feature_count=5`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) throw new Error(`BCN WMS HTTP ${res.status}`);
  return parseQuals(await res.text());
}

/** Run an async mapper over items with bounded concurrency. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch {
        out[i] = null;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

function toQual(r: RawQual): UrbanismQual {
  return {
    clau: r.clau,
    clauAssim: r.clauAssim,
    name: r.name,
    group: r.group,
    family: r.family,
    plan: r.plan,
    isSystem: (r.desti ?? "").toLowerCase().startsWith("sistema"),
  };
}

function classificationOf(quals: RawQual[]): string | undefined {
  const code = quals.find((q) => q.classific)?.classific;
  if (!code) return undefined;
  return CLASS_LABELS[code.toUpperCase()] ?? code;
}

export async function fetchUrbanism(
  coords: Coordinates,
  opts: { parcelRef?: string } = {},
): Promise<AdapterResult<UrbanismData>> {
  // Ajuntament de Barcelona's Portal d'Informació Urbanística — the same source
  // as our data. It has no public coordinate deep-link, so we link the search
  // page; the buyer enters their address to inspect the finca in context.
  const mapUrl = "https://ajuntament.barcelona.cat/informaciourbanistica/cerca/ca/";

  // Build the list of EPSG:3857 sample points: the whole parcel if we can get
  // its geometry, otherwise just the dwelling's coordinates.
  const R = 6378137;
  const cx = R * ((coords.lon * Math.PI) / 180);
  const cy = R * Math.log(Math.tan(Math.PI / 4 + (coords.lat * Math.PI) / 360));

  // points[0] is always the dwelling's reference point (parcel centroid, or the
  // raw coordinates) — used below to pick the "main" qualification.
  let method: UrbanismData["method"] = "bcn-point";
  let points: Array<[number, number]> = [[cx, cy]];

  if (opts.parcelRef) {
    const poly = await fetchParcelPolygon(opts.parcelRef);
    if (poly) {
      const sampled = samplePoints(poly);
      if (sampled.length) {
        method = "bcn-parcel";
        points = sampled;
      }
    }
  }

  try {
    const results = await mapPool(points, POOL, ([x, y]) => qualsAtPoint(x, y));
    const all = results.filter((r): r is RawQual[] => r !== null).flat();
    if (!all.length) {
      return ok<UrbanismData>(
        "urbanism",
        {
          possibleAffectation: false,
          affectations: [],
          qualifications: [],
          method,
          mapUrl,
        },
        { toVerify: true, note: "BCN WMS returned no qualification for this parcel." },
      );
    }

    // Distinct qualifications keyed by clau.
    const byClau = new Map<string, UrbanismQual>();
    for (const r of all) {
      if (!byClau.has(r.clau)) byClau.set(r.clau, toQual(r));
    }
    const qualifications = [...byClau.values()];
    const affectations = qualifications.filter((q) => q.isSystem);

    // Main qualification = the dwelling-zone clau at the reference point (reuse
    // the first sweep result). Prefer a Zona, since the flat sits in a zone.
    const centroidQuals = (results[0] ?? []).map(toQual);
    const main =
      centroidQuals.find((q) => !q.isSystem) ??
      centroidQuals[0] ??
      qualifications.find((q) => !q.isSystem) ??
      qualifications[0];

    return ok<UrbanismData>(
      "urbanism",
      {
        classification: classificationOf(all),
        qualification: main?.name,
        qualCode: main?.clau,
        possibleAffectation: affectations.length > 0,
        affectations,
        qualifications,
        method,
        mapUrl,
      },
      affectations.length > 0
        ? { toVerify: true, note: "Possible affectation — verify with a certificat urbanístic." }
        : {},
    );
  } catch (e) {
    return failed<UrbanismData>(
      "urbanism",
      `BCN urbanism lookup failed: ${(e as Error).message}`,
    );
  }
}
