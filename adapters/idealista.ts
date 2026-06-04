import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
  unavailable,
} from "./types";
import type { Coordinates } from "./geo";

/**
 * idealista OFFICIAL API (partner) — comparable on-sale listings near a point.
 * This is the legal route to real comparables (we never scrape idealista or
 * Fotocasa). Requires IDEALISTA_API_KEY + IDEALISTA_API_SECRET; degrades to
 * "not configured" without them. OAuth2 client-credentials → /3.5/es/search.
 */
const TOKEN_URL = "https://api.idealista.com/oauth/token";
const SEARCH_URL = "https://api.idealista.com/3.5/es/search";

export interface CompListing {
  url: string;
  price: number;
  size?: number;
  rooms?: number;
  bathrooms?: number;
  pricePerM2?: number;
  address?: string;
  neighborhood?: string;
  district?: string;
}

interface IdealistaElement {
  url?: string;
  price?: number;
  size?: number;
  rooms?: number;
  bathrooms?: number;
  priceByArea?: number;
  address?: string;
  neighborhood?: string;
  district?: string;
}

async function getToken(key: string, secret: string): Promise<string> {
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetchWithTimeout(TOKEN_URL, 15000, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=read",
  });
  if (!res.ok) throw new Error(`idealista token HTTP ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("idealista token missing");
  return json.access_token;
}

export async function fetchComps(
  coords: Coordinates,
  opts: { distanceM?: number; maxItems?: number; minSize?: number; maxSize?: number } = {},
): Promise<AdapterResult<CompListing[]>> {
  const key = process.env.IDEALISTA_API_KEY;
  const secret = process.env.IDEALISTA_API_SECRET;
  if (!key || !secret) {
    return unavailable<CompListing[]>(
      "market",
      "idealista API key not configured — add IDEALISTA_API_KEY/SECRET to enable comparables.",
    );
  }
  try {
    const token = await getToken(key, secret);
    const params = new URLSearchParams({
      operation: "sale",
      propertyType: "homes",
      center: `${coords.lat},${coords.lon}`,
      distance: String(opts.distanceM ?? 1500),
      maxItems: String(opts.maxItems ?? 8),
      numPage: "1",
      order: "distance",
      sort: "asc",
      locale: "es",
    });
    if (opts.minSize) params.set("minSize", String(opts.minSize));
    if (opts.maxSize) params.set("maxSize", String(opts.maxSize));

    const res = await fetchWithTimeout(SEARCH_URL, 20000, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(`idealista search HTTP ${res.status}`);
    const json = (await res.json()) as { elementList?: IdealistaElement[] };
    const list: CompListing[] = (json.elementList ?? [])
      .filter((e) => e.url && e.price)
      .map((e) => ({
        url: e.url!,
        price: e.price!,
        size: e.size,
        rooms: e.rooms,
        bathrooms: e.bathrooms,
        pricePerM2: e.priceByArea,
        address: e.address,
        neighborhood: e.neighborhood,
        district: e.district,
      }));
    return ok<CompListing[]>("market", list);
  } catch (e) {
    return failed<CompListing[]>(
      "market",
      `idealista lookup failed: ${(e as Error).message}`,
    );
  }
}
