import { type AdapterResult, ok, unavailable } from "./types";
import type { Coordinates } from "./geo";
import amenities from "@/data/bcn-amenities.json";

/**
 * Neighbourhood amenities around the property, from a local Barcelona dataset.
 *
 * `data/bcn-amenities.json` is built by `scripts/refresh-bcn-amenities.py` from
 * official Ajuntament de Barcelona Open Data (CC BY 4.0): metro + urban FGC
 * entrances, hospitals/CAPs, schools, municipal markets, chain supermarkets
 * (shop census) and public parks. Returns the nearest place per category plus
 * counts within walking distance, which feed both the Neighbourhood section
 * and the Location/Transport scores.
 *
 * This replaced the live OpenStreetMap (Overpass) lookup, which failed in
 * about 1 in 5 reports and, by November 2026, in every one. A local lookup is
 * instant and cannot fail; the trade-off is freshness, handled by refreshing
 * the file on a schedule.
 */

export interface NearestPlace {
  name?: string;
  distanceM: number;
  walkMin: number;
}
export interface AmenityData {
  metro: { nearest?: NearestPlace; within800: number; names: string[] };
  health: { nearest?: NearestPlace };
  green: { nearest?: NearestPlace };
  schools: { nearest?: NearestPlace; within1000: number };
  market: { nearest?: NearestPlace };
  supermarket: { nearest?: NearestPlace };
}

/** [lat, lon, name] */
type Point = [number, number, string];
/** An outline as [lat, lon] vertices; an empty entry ends a ring. */
type Park = { name: string; ring: number[][] };

const DATA = amenities as unknown as {
  asOf: string;
  metro: Point[];
  health: Point[];
  schools: Point[];
  market: Point[];
  supermarket: Point[];
  green: Park[];
};

/** Barcelona with a margin: outside it the dataset says nothing useful. */
const inBarcelona = ({ lat, lon }: Coordinates) =>
  lat > 41.3 && lat < 41.5 && lon > 2.0 && lon < 2.3;

const walkMin = (m: number) => Math.max(1, Math.round(m / 75));
const place = (distanceM: number, name?: string): NearestPlace => ({
  name: name || undefined,
  distanceM: Math.round(distanceM),
  walkMin: walkMin(distanceM),
});

/**
 * Local metres projection around the property. Within a few km the error is
 * well under 1%, and it makes distances to park edges simple geometry.
 */
function projector(origin: Coordinates) {
  const kx = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  const ky = 110574;
  return (lat: number, lon: number): [number, number] => [
    (lon - origin.lon) * kx,
    (lat - origin.lat) * ky,
  ];
}

function nearestPoint(points: Point[], proj: ReturnType<typeof projector>) {
  let best: { d: number; name: string } | undefined;
  for (const [lat, lon, name] of points) {
    const [x, y] = proj(lat, lon);
    const d = Math.hypot(x, y);
    if (!best || d < best.d) best = { d, name };
  }
  return best;
}

/** Distance from the origin (0,0) to segment a–b. */
function segDist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Distance to a park's edge, or 0 when the property is inside it. */
function parkDistance(park: Park, proj: ReturnType<typeof projector>): number {
  let min = Infinity;
  let inside = false;
  let ring: Array<[number, number]> = [];
  const close = () => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      min = Math.min(min, segDist(ax, ay, bx, by));
      // Even-odd ray cast from the origin along +x.
      if (ay > 0 !== by > 0 && ax + ((0 - ay) * (bx - ax)) / (by - ay) > 0) inside = !inside;
    }
    ring = [];
  };
  for (const v of park.ring) {
    if (v.length < 2) close();
    else ring.push(proj(v[0], v[1]));
  }
  if (ring.length) close();
  return inside ? 0 : min;
}

export async function fetchAmenities(
  coords: Coordinates,
): Promise<AdapterResult<AmenityData>> {
  if (!inBarcelona(coords)) {
    return unavailable<AmenityData>(
      "amenities",
      "Outside Barcelona: the local amenities dataset covers the city only.",
    );
  }
  const proj = projector(coords);

  // Metro: the dataset lists entrances; a station is as near as its nearest
  // entrance.
  const stations = new Map<string, number>();
  for (const [lat, lon, name] of DATA.metro) {
    const [x, y] = proj(lat, lon);
    const d = Math.hypot(x, y);
    if (d < (stations.get(name) ?? Infinity)) stations.set(name, d);
  }
  const byDistance = [...stations.entries()].sort((a, b) => a[1] - b[1]);
  const within800 = byDistance.filter(([, d]) => d <= 800);

  let schoolsWithin1000 = 0;
  for (const [lat, lon] of DATA.schools) {
    const [x, y] = proj(lat, lon);
    if (Math.hypot(x, y) <= 1000) schoolsWithin1000 += 1;
  }

  let green: { d: number; name: string } | undefined;
  for (const park of DATA.green) {
    const d = parkDistance(park, proj);
    if (!green || d < green.d) green = { d, name: park.name };
  }

  const near = (p?: { d: number; name: string }) => (p ? place(p.d, p.name) : undefined);
  const data: AmenityData = {
    metro: {
      nearest: byDistance[0] ? place(byDistance[0][1], byDistance[0][0]) : undefined,
      within800: within800.length,
      names: within800.map(([name]) => name),
    },
    health: { nearest: near(nearestPoint(DATA.health, proj)) },
    green: { nearest: near(green) },
    schools: { nearest: near(nearestPoint(DATA.schools, proj)), within1000: schoolsWithin1000 },
    market: { nearest: near(nearestPoint(DATA.market, proj)) },
    supermarket: { nearest: near(nearestPoint(DATA.supermarket, proj)) },
  };

  return ok<AmenityData>("amenities", data, {
    note: `Ajuntament de Barcelona open data, as of ${DATA.asOf}.`,
  });
}
