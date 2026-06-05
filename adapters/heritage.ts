import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
} from "./types";
import type { Coordinates } from "./geo";

/**
 * Architectural heritage protection for a Barcelona building, from the
 * Ajuntament's urbanism WMS (`Catàleg_de_patrimoni`) — the same service we use
 * for qualifications. Free, no key.
 *
 * Protection level lives in the catalog sublayer name:
 *   A — Bé Cultural d'Interès Nacional (BCIN)  — strictest
 *   B — Bé Cultural d'Interès Local (BCIL)
 *   C — Bé d'Interès Urbanístic
 *   D — Bé d'Interès Documental                — lightest
 * Plus area-wide "conjunt / entorn protegit" (e.g. the whole Eixample), which
 * is reported as context, not a building-specific protection.
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

interface RawFeature {
  layer: string;
  denomin?: string;
  author?: string;
  epoch?: string;
  style?: string;
}

/** Derive the protection level (or "ensemble") from a catalog sublayer name. */
function levelOf(layer: string): HeritageLevel | "ensemble" | null {
  const l = layer.toLowerCase();
  if (/conjunt|entorn/.test(l)) return "ensemble";
  if (/nacional|__a_|_a_\b/.test(l)) return "A";
  if (/local|__b_/.test(l)) return "B";
  if (/urban[íi]stic|__c_/.test(l)) return "C";
  if (/documental|__d_/.test(l)) return "D";
  return null;
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

export async function fetchHeritage(
  coords: Coordinates,
): Promise<AdapterResult<HeritageData>> {
  const R = 6378137;
  const cx = R * ((coords.lon * Math.PI) / 180);
  const cy = R * Math.log(Math.tan(Math.PI / 4 + (coords.lat * Math.PI) / 360));
  // Centroid + a small ring, to catch a building cataloged just off the point.
  const pts: Array<[number, number]> = [
    [cx, cy],
    [cx + 9, cy],
    [cx - 9, cy],
    [cx, cy + 9],
    [cx, cy - 9],
  ];

  try {
    const results = await Promise.all(
      pts.map((p) => featuresAt(p[0], p[1]).catch(() => [] as RawFeature[])),
    );
    const features = results.flat();
    if (!features.length) {
      return ok<HeritageData>("heritage", { inEnsemble: false });
    }

    let best: { level: HeritageLevel; f: RawFeature } | null = null;
    let ensemble: RawFeature | null = null;
    for (const f of features) {
      const lvl = levelOf(f.layer);
      if (lvl === "ensemble") {
        ensemble ??= f;
      } else if (lvl) {
        if (!best || LEVEL_RANK[lvl] > LEVEL_RANK[best.level]) {
          best = { level: lvl, f };
        }
      }
    }

    return ok<HeritageData>(
      "heritage",
      {
        level: best?.level,
        name: best?.f.denomin,
        author: best?.f.author,
        epoch: best?.f.epoch,
        style: best?.f.style,
        inEnsemble: Boolean(ensemble),
        ensembleName: ensemble?.denomin,
      },
      best ? { toVerify: true } : {},
    );
  } catch (e) {
    return failed<HeritageData>(
      "heritage",
      `Heritage lookup failed: ${(e as Error).message}`,
    );
  }
}
