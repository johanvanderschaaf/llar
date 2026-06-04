import { XMLParser } from "fast-xml-parser";
import { fetchWithTimeout } from "./types";

/**
 * Catastro address-search services (OVCCallejero), Barcelona-scoped.
 * Free, official, no key. Two steps:
 *   1) searchStreets(q)        → ConsultaVia: streets matching a partial name.
 *   2) locateUnits(tv, nv, n)  → Consulta_DNPLOC: the unit(s) at a street + number,
 *      each with its full cadastral reference.
 * Verified live against "CL SORS 35".
 */

const BASE =
  "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx";
const PROV = "BARCELONA";
const MUNI = "BARCELONA";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
});

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export interface StreetMatch {
  /** Via type, e.g. "CL", "AV", "PG". */
  tipo: string;
  /** Street name, e.g. "SORS". */
  nombre: string;
}

// Leading words people type that are NOT part of the Catastro street name.
const VIA_WORDS = new Set([
  "calle",
  "carrer",
  "c",
  "avinguda",
  "avenida",
  "av",
  "passeig",
  "paseo",
  "pg",
  "placa",
  "plaça",
  "plaza",
  "pl",
  "ronda",
  "rambla",
  "rbla",
  "via",
  "travessera",
  "travesera",
  "cami",
  "camino",
  "passatge",
  "pasaje",
  "ptge",
  "baixada",
  "bajada",
]);
const CONNECTORS = new Set(["de", "del", "la", "les", "los", "las", "el", "els", "d"]);

/**
 * Turn free-typed input ("calle de Mallorca", "carrer Sors") into the bare
 * street name Catastro's ConsultaVia expects ("MALLORCA", "SORS").
 */
export function streetNameQuery(raw: string): string {
  let tokens = raw
    .trim()
    .toLowerCase()
    .replace(/[./]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length > 1 && VIA_WORDS.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && CONNECTORS.has(tokens[0])) tokens.shift();
  return tokens.join(" ");
}

export interface UnitMatch {
  /** Full 20-char cadastral reference. */
  ref: string;
  /** Human-readable address label. */
  label: string;
  floor?: string;
  door?: string;
}

export async function searchStreets(q: string): Promise<StreetMatch[]> {
  const term = streetNameQuery(q);
  if (term.length < 2) return [];
  const url = `${BASE}/ConsultaVia?Provincia=${encodeURIComponent(
    PROV,
  )}&Municipio=${encodeURIComponent(MUNI)}&TipoVia=&NombreVia=${encodeURIComponent(
    term,
  )}`;
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) return [];
  const root = parser.parse(await res.text()) as Record<string, unknown>;
  const cj = (root.consulta_callejero as Record<string, unknown>)?.callejero as
    | Record<string, unknown>
    | undefined;
  const calles = toArray(cj?.calle) as Record<string, unknown>[];
  const seen = new Set<string>();
  return calles
    .map((c) => {
      const dir = c.dir as Record<string, unknown> | undefined;
      return {
        tipo: String(dir?.tv ?? "").trim(),
        nombre: String(dir?.nv ?? "").trim(),
      };
    })
    // A via type is required to locate the property; drop noise entries.
    .filter((s) => {
      if (!s.tipo || !s.nombre) return false;
      const key = `${s.tipo} ${s.nombre}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export async function locateUnits(
  tipo: string,
  nombre: string,
  numero: string,
): Promise<UnitMatch[]> {
  const url =
    `${BASE}/Consulta_DNPLOC?Provincia=${encodeURIComponent(PROV)}` +
    `&Municipio=${encodeURIComponent(MUNI)}` +
    `&Sigla=${encodeURIComponent(tipo)}` +
    `&Calle=${encodeURIComponent(nombre)}` +
    `&Numero=${encodeURIComponent(numero)}` +
    `&Bloque=&Escalera=&Planta=&Puerta=`;
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) return [];
  const root = (
    parser.parse(await res.text()) as Record<string, unknown>
  ).consulta_dnp as Record<string, unknown> | undefined;
  if (!root) return [];

  // Catastro error (e.g. no record at that number).
  if (root.lerr) return [];

  const refFromRc = (rc: Record<string, unknown> | undefined) =>
    rc ? `${rc.pc1}${rc.pc2}${rc.car}${rc.cc1}${rc.cc2}` : "";

  // Shape A: a single matched unit under bico/bi.
  const bi = (root.bico as Record<string, unknown>)?.bi as
    | Record<string, unknown>
    | undefined;
  if (bi) {
    const rc = (bi.idbi as Record<string, unknown>)?.rc as
      | Record<string, unknown>
      | undefined;
    const loint = (
      (
        ((bi.dt as Record<string, unknown>)?.locs as Record<string, unknown>)
          ?.lous as Record<string, unknown>
      )?.lourb as Record<string, unknown>
    )?.loint as Record<string, unknown> | undefined;
    return [
      {
        ref: refFromRc(rc),
        label: String(bi.ldt ?? "").trim(),
        floor: loint?.pt as string | undefined,
        door: loint?.pu as string | undefined,
      },
    ];
  }

  // Shape B: multiple units under lrcdnp/rcdnp.
  const rcdnp = toArray(
    (root.lrcdnp as Record<string, unknown>)?.rcdnp,
  ) as Record<string, unknown>[];
  return rcdnp.map((r) => {
    const rc = r.rc as Record<string, unknown> | undefined;
    const lourb = (
      ((r.dt as Record<string, unknown>)?.locs as Record<string, unknown>)
        ?.lous as Record<string, unknown>
    )?.lourb as Record<string, unknown> | undefined;
    const loint = lourb?.loint as Record<string, unknown> | undefined;
    const floor = loint?.pt as string | undefined;
    const door = loint?.pu as string | undefined;
    const label =
      String(r.ldt ?? "").trim() ||
      `${tipo} ${nombre} ${numero}${floor ? ` Pl:${floor}` : ""}${
        door ? ` Pt:${door}` : ""
      }`;
    return { ref: refFromRc(rc), label, floor, door };
  });
}
