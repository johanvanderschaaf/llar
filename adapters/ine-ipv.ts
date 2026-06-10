import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
  unavailable,
} from "./types";

/**
 * INE — Índice de Precios de Vivienda (IPV), table 25171 (quarterly, by CCAA).
 * Free open-data JSON; no key. We return the latest year-on-year change for
 * Cataluña, second-hand homes (which is what a Barcelona buyer is actually
 * looking at), with the general index as a fallback for the rare case the
 * second-hand series is missing for the latest quarter.
 *
 * Source: https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/25171
 */
const URL = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/25171?nult=1";

export interface IpvData {
  /** Year-on-year % change in the IPV for Cataluña, latest quarter. */
  yoyPct: number;
  /** Which slice produced `yoyPct` — second-hand is the buyer-relevant one. */
  segment: "secondHand" | "general";
  /** Human-readable quarter label, e.g. "Q3 2025". */
  quarter: string;
  /** ISO date of the period the figure refers to (first day of the quarter). */
  periodStart: string;
}

interface IneSeries {
  Nombre?: string;
  Data?: { Fecha?: number; Anyo?: number; Valor?: number }[];
}

function quarterLabel(fechaMs: number): { label: string; iso: string } {
  const d = new Date(fechaMs);
  const m = d.getUTCMonth(); // 0-11
  const q = Math.floor(m / 3) + 1;
  const iso = `${d.getUTCFullYear()}-${String(m + 1).padStart(2, "0")}-01`;
  return { label: `Q${q} ${d.getUTCFullYear()}`, iso };
}

function pickLatest(
  rows: IneSeries[],
  match: (name: string) => boolean,
): { value: number; fechaMs: number } | null {
  for (const r of rows) {
    if (!r.Nombre || !match(r.Nombre)) continue;
    const d = r.Data?.[0];
    if (d?.Valor != null && d.Fecha != null) {
      return { value: d.Valor, fechaMs: d.Fecha };
    }
  }
  return null;
}

export async function fetchIpv(): Promise<AdapterResult<IpvData>> {
  try {
    const res = await fetchWithTimeout(URL, 15000);
    if (!res.ok) throw new Error(`INE HTTP ${res.status}`);
    const rows = (await res.json()) as IneSeries[];

    const sh = pickLatest(rows, (n) =>
      /^Cataluña\.\s*Vivienda segunda mano\.\s*Variación anual/.test(n),
    );
    const gen = pickLatest(rows, (n) =>
      /^Cataluña\.\s*General\.\s*Variación anual/.test(n),
    );
    const hit = sh ?? gen;
    if (!hit) {
      return unavailable<IpvData>(
        "ipv",
        "INE returned no Cataluña YoY series for the latest quarter.",
      );
    }
    const { label, iso } = quarterLabel(hit.fechaMs);
    return ok<IpvData>(
      "ipv",
      {
        yoyPct: hit.value,
        segment: sh ? "secondHand" : "general",
        quarter: label,
        periodStart: iso,
      },
      { note: sh ? undefined : "fell back to general IPV (no second-hand series)" },
    );
  } catch (e) {
    return failed<IpvData>("ipv", `INE IPV lookup failed: ${(e as Error).message}`);
  }
}
