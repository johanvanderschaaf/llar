import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
} from "./types";
import type { Coordinates } from "./geo";

/**
 * OpenStreetMap Overpass API — neighbourhood amenities around the property.
 * Free, no key. Returns the nearest place per category plus counts within
 * walking distance, which feed both the Neighbourhood section and the
 * Location/Transport scores.
 */
// Public Overpass instances are flaky/rate-limited; try mirrors in order.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

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

interface OverpassEl {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function haversineM(
  a: Coordinates,
  b: { lat: number; lon: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const walkMin = (m: number) => Math.max(1, Math.round(m / 75));

function place(distanceM: number, name?: string): NearestPlace {
  return { name, distanceM, walkMin: walkMin(distanceM) };
}

type Cat = keyof AmenityData;
function classify(tags: Record<string, string>): Cat | null {
  if (tags.station === "subway" || tags.subway === "yes") return "metro";
  if (tags.amenity === "hospital" || tags.amenity === "clinic") return "health";
  if (tags.leisure === "park") return "green";
  if (tags.amenity === "school") return "schools";
  if (tags.amenity === "marketplace") return "market";
  if (tags.shop === "supermarket") return "supermarket";
  return null;
}

export async function fetchAmenities(
  coords: Coordinates,
): Promise<AdapterResult<AmenityData>> {
  const { lat, lon } = coords;
  const query = `[out:json][timeout:25];(
    nwr["station"="subway"](around:1000,${lat},${lon});
    nwr["railway"="station"]["subway"="yes"](around:1000,${lat},${lon});
    nwr["amenity"="hospital"](around:1800,${lat},${lon});
    nwr["amenity"="clinic"](around:1200,${lat},${lon});
    nwr["leisure"="park"](around:1200,${lat},${lon});
    nwr["amenity"="school"](around:1000,${lat},${lon});
    nwr["amenity"="marketplace"](around:1500,${lat},${lon});
    nwr["shop"="supermarket"](around:800,${lat},${lon});
  );out center tags;`;

  let json: { elements: OverpassEl[] } | null = null;
  let lastErr = "";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint, 30000, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "pisowise/1.0 (property due-diligence)",
        },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        lastErr = `Overpass HTTP ${res.status}`;
        continue;
      }
      json = (await res.json()) as { elements: OverpassEl[] };
      break;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  if (!json) {
    return failed<AmenityData>("amenities", `Amenities lookup failed: ${lastErr}`);
  }

  try {
    const data: AmenityData = {
      metro: { within800: 0, names: [] },
      health: {},
      green: {},
      schools: { within1000: 0 },
      market: {},
      supermarket: {},
    };
    const metroSeen = new Set<string>();

    for (const el of json.elements) {
      const tags = el.tags ?? {};
      const cat = classify(tags);
      if (!cat) continue;
      const pos = el.center ?? (el.lat != null ? { lat: el.lat, lon: el.lon! } : null);
      if (!pos) continue;
      const dist = haversineM(coords, pos);
      const name = tags.name;

      if (cat === "metro") {
        const key = name ?? `${pos.lat},${pos.lon}`;
        if (!metroSeen.has(key)) {
          metroSeen.add(key);
          if (dist <= 800) {
            data.metro.within800 += 1;
            if (name && !data.metro.names.includes(name))
              data.metro.names.push(name);
          }
        }
      }
      if (cat === "schools" && dist <= 1000) data.schools.within1000 += 1;

      const slot = data[cat] as { nearest?: NearestPlace };
      if (!slot.nearest || dist < slot.nearest.distanceM) {
        slot.nearest = place(dist, name);
      }
    }

    return ok<AmenityData>("amenities", data);
  } catch (e) {
    return failed<AmenityData>(
      "amenities",
      `Amenities lookup failed: ${(e as Error).message}`,
    );
  }
}
