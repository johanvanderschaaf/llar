import { XMLParser } from "fast-xml-parser";
import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
  unavailable,
} from "./types";

/**
 * Dirección General del Catastro — OVC web service (Consulta_DNPRC).
 * Official, free, no key. Two calls:
 *   1) full unit RC  → the flat's year / surface / use / address.
 *   2) 14-char parcel RC → every unit in the parcel (answers "how many flats
 *      are in the building", a known buyer pain point).
 *
 * Verified live against ref 9648812DF2894H0013RQ (Carrer de Sors 35).
 */

const OVC =
  "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC";

export interface CatastroUnit {
  /** Full reference as queried (normalised, no spaces, upper-case). */
  cadastralRef: string;
  use?: string; // luso, e.g. "Residencial"
  builtAreaM2?: number; // sfc
  usableAreaM2?: number; // Σ dwelling stl
  yearBuilt?: number; // ant
  addressLabel?: string; // ldt
  postalCode?: string; // dp
  floor?: string; // pt
  door?: string; // pu
  /** Barcelona municipal district code 1–10 (lourb.dm). */
  districtCode?: number; // dm
}

export interface CatastroParcelUnit {
  ref: string;
  addressLabel?: string;
  floor?: string;
  door?: string;
}

export interface CatastroParcel {
  parcelRef: string; // 14-char pc1+pc2
  unitCount: number; // control.cudnp
  units: CatastroParcelUnit[];
}

export interface CatastroData {
  unit: CatastroUnit;
  parcel: CatastroParcel;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
});

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Normalise a cadastral reference: strip spaces, upper-case. */
export function normaliseRef(ref: string): string {
  return ref.replace(/\s+/g, "").toUpperCase();
}

interface ParsedError {
  cod?: string;
  des?: string;
}

function readError(root: Record<string, unknown>): ParsedError | undefined {
  const errNode = (root.lerr as Record<string, unknown>)?.err;
  if (!errNode) return undefined;
  const err = toArray(errNode)[0] as Record<string, unknown>;
  return { cod: err?.cod as string, des: err?.des as string };
}

function buildLabel(loint?: Record<string, unknown>): {
  floor?: string;
  door?: string;
} {
  return {
    floor: loint?.pt as string | undefined,
    door: loint?.pu as string | undefined,
  };
}

async function callOVC(rc: string): Promise<Record<string, unknown>> {
  const res = await fetchWithTimeout(
    `${OVC}?Provincia=&Municipio=&RC=${encodeURIComponent(rc)}`,
  );
  if (!res.ok) throw new Error(`Catastro HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = parser.parse(xml) as Record<string, unknown>;
  return (parsed.consulta_dnp as Record<string, unknown>) ?? parsed;
}

function parseUnit(root: Record<string, unknown>, ref: string): CatastroUnit {
  const bi = (root.bico as Record<string, unknown>)?.bi as
    | Record<string, unknown>
    | undefined;
  const debi = bi?.debi as Record<string, unknown> | undefined;
  const dt = bi?.dt as Record<string, unknown> | undefined;
  const lourb = (
    (dt?.locs as Record<string, unknown>)?.lous as Record<string, unknown>
  )?.lourb as Record<string, unknown> | undefined;
  const loint = lourb?.loint as Record<string, unknown> | undefined;

  // Useful area = Σ of dwelling (VIVIENDA) construction surfaces.
  const consList = toArray(
    (root.bico as Record<string, unknown>)?.lcons
      ? ((root.bico as Record<string, unknown>).lcons as Record<string, unknown>)
          .cons
      : undefined,
  ) as Record<string, unknown>[];
  let usable: number | undefined;
  for (const c of consList) {
    if (String(c.lcd ?? "").toUpperCase().includes("VIVIENDA")) {
      const stl = num((c.dfcons as Record<string, unknown>)?.stl);
      if (stl !== undefined) usable = (usable ?? 0) + stl;
    }
  }

  return {
    cadastralRef: ref,
    use: debi?.luso as string | undefined,
    builtAreaM2: num(debi?.sfc),
    usableAreaM2: usable,
    yearBuilt: num(debi?.ant),
    addressLabel: bi?.ldt as string | undefined,
    postalCode: lourb?.dp as string | undefined,
    floor: loint?.pt as string | undefined,
    door: loint?.pu as string | undefined,
    districtCode: num(lourb?.dm),
  };
}

function parseParcel(
  root: Record<string, unknown>,
  parcelRef: string,
): CatastroParcel {
  const control = root.control as Record<string, unknown> | undefined;
  const rcdnp = toArray(
    (root.lrcdnp as Record<string, unknown>)?.rcdnp,
  ) as Record<string, unknown>[];

  const units: CatastroParcelUnit[] = rcdnp.map((r) => {
    const rc = r.rc as Record<string, unknown> | undefined;
    const ref = rc
      ? `${rc.pc1}${rc.pc2}${rc.car}${rc.cc1}${rc.cc2}`
      : parcelRef;
    const dt = r.dt as Record<string, unknown> | undefined;
    const lourb = (
      (dt?.locs as Record<string, unknown>)?.lous as Record<string, unknown>
    )?.lourb as Record<string, unknown> | undefined;
    const { floor, door } = buildLabel(
      lourb?.loint as Record<string, unknown> | undefined,
    );
    return { ref, floor, door };
  });

  return {
    parcelRef,
    unitCount: num(control?.cudnp) ?? units.length,
    units,
  };
}

export async function fetchCatastro(
  rawRef: string,
): Promise<AdapterResult<CatastroData>> {
  const ref = normaliseRef(rawRef);
  if (ref.length < 14) {
    return unavailable<CatastroData>(
      "catastro",
      `Cadastral reference "${rawRef}" is too short (need ≥14 chars).`,
    );
  }
  const parcelRef = ref.slice(0, 14);

  try {
    const [unitRoot, parcelRoot] = await Promise.all([
      callOVC(ref),
      callOVC(parcelRef),
    ]);

    const unitErr = readError(unitRoot);
    if (unitErr) {
      return unavailable<CatastroData>(
        "catastro",
        `Catastro: ${unitErr.des ?? unitErr.cod ?? "no record for this reference"}.`,
      );
    }

    const unit = parseUnit(unitRoot, ref);
    const parcel = parseParcel(parcelRoot, parcelRef);

    return ok<CatastroData>("catastro", { unit, parcel });
  } catch (e) {
    return failed<CatastroData>(
      "catastro",
      `Catastro request failed: ${(e as Error).message}`,
    );
  }
}
