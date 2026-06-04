import { XMLParser } from "fast-xml-parser";
import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
} from "./types";
import type { Coordinates } from "./geo";

/**
 * Mapa Urbanístic de Catalunya (MUC) — planning qualification + land
 * classification for a point, via the official Generalitat WMS GetFeatureInfo.
 * Free, no key. Tells us whether the parcel sits in a buildable zone or a
 * "sistema" (possible afectació urbanística — earmarked for road / green /
 * facility). A point-in-polygon read is a strong SIGNAL, not a legal
 * certificate — the report always flags it "verify with a certificat
 * urbanístic". Verified live against Carrer de Sors 35 (clau R1, sòl urbà).
 */
const MUC = "https://dtes.gencat.cat/webmap/MUC/service.svc/get";

export interface UrbanismData {
  /** Land classification, e.g. "Sòl urbà consolidat". */
  classification?: string;
  /** Planning qualification description (Ajuntament wording preferred). */
  qualification?: string;
  /** MUC synthetic code, e.g. "R1". */
  qualCode?: string;
  /** True when the qualification is a system (possible afectació). */
  possibleAffectation: boolean;
  /** Official map to inspect the parcel in context. */
  mapUrl: string;
}

// Parser that KEEPS attributes (we need Attribute Name="...").
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
});

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function deaccent(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Catalan keywords that mark a "sistema" qualification (→ possible afectació).
const SYSTEM_HINTS = [
  "sistema",
  "viari",
  "vial",
  "vialitat",
  "equipament",
  "zona verda",
  "espai lliure",
  "ferroviari",
  "portuari",
  "hidraulic",
  "servei tecnic",
  "infraestructura",
];

function isSystem(desc: string | undefined, code: string | undefined): boolean {
  const d = deaccent(desc ?? "");
  if (SYSTEM_HINTS.some((h) => d.includes(h))) return true;
  // MUC synthetic system codes typically start with these letters.
  const c = (code ?? "").trim().toUpperCase();
  return /^(X|V|C|E|H|S|T|F|P)/.test(c) && !/^(R|A)/.test(c);
}

export async function fetchUrbanism(
  coords: Coordinates,
): Promise<AdapterResult<UrbanismData>> {
  const R = 6378137;
  const x = R * ((coords.lon * Math.PI) / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + (coords.lat * Math.PI) / 360));
  const half = 285; // ~570 m box → scale ~1:8000 (within QUAL's queryable range)
  const bbox = `${x - half},${y - half},${x + half},${y + half}`;
  const url =
    `${MUC}?service=WMS&version=1.3.0&request=GetFeatureInfo` +
    `&layers=QUAL,CLAS&query_layers=QUAL,CLAS&styles=` +
    `&crs=EPSG:3857&bbox=${bbox}&width=256&height=256&i=128&j=128` +
    `&info_format=text/xml`;
  const mapUrl = `https://dtes.gencat.cat/muc-visor/?long=${coords.lon}&lat=${coords.lat}&zoom=18`;

  try {
    const res = await fetchWithTimeout(url, 20000);
    if (!res.ok) throw new Error(`MUC HTTP ${res.status}`);
    const root = parser.parse(await res.text()) as Record<string, unknown>;
    const members = toArray(
      (root.FeatureCollection as Record<string, unknown>)?.featureMember,
    ) as Record<string, unknown>[];

    const byLayer: Record<string, Record<string, string>> = {};
    for (const m of members) {
      const layer = m.Layer as Record<string, unknown> | undefined;
      if (!layer) continue;
      const name = String(layer["@_Name"] ?? "");
      const attrs: Record<string, string> = {};
      for (const a of toArray(layer.Attribute) as Record<string, unknown>[]) {
        attrs[String(a["@_Name"])] = String(a["#text"] ?? "");
      }
      byLayer[name] = attrs;
    }

    const qual = byLayer.QUAL ?? {};
    const clas = byLayer.CLAS ?? {};
    const qualDesc =
      qual.DESC_QUAL_AJUNT || qual.DESC_QUAL_MUC || undefined;
    const qualCode = qual.CODI_QUAL_MUC || undefined;

    if (!qualDesc && !clas.DESC_CLAS_MUC) {
      return ok<UrbanismData>(
        "urbanism",
        { possibleAffectation: false, mapUrl },
        { toVerify: true, note: "MUC returned no qualification at this point." },
      );
    }

    return ok<UrbanismData>("urbanism", {
      classification: clas.DESC_CLAS_AJUNT || clas.DESC_CLAS_MUC || undefined,
      qualification: qualDesc,
      qualCode,
      possibleAffectation: isSystem(qualDesc, qualCode),
      mapUrl,
    });
  } catch (e) {
    return failed<UrbanismData>(
      "urbanism",
      `MUC lookup failed: ${(e as Error).message}`,
    );
  }
}
