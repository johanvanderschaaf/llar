import { type AdapterResult, ok, unavailable } from "./types";
import dataset from "@/data/notariado-cp-bcn.json";

/**
 * Postcode-level housing statistics from the official Portal Estadístico del
 * Notariado (notarised sale prices). The portal has no public API so we ship
 * the figures as a committed JSON file refreshed manually each month — see
 * `data/README-notariado.md`. The adapter is a pure lookup against that file.
 */
export interface NotariadoCpRow {
  /** Average €/m² for the postcode in the reference period. */
  pricePerM2: number;
  /** Closed sales counted in the period, when the portal exposes it. */
  transactions?: number;
  /** Average flat size in m², when the portal exposes it. */
  avgSurfaceM2?: number;
}

export interface NotariadoData extends NotariadoCpRow {
  postalCode: string;
  /** Period the figure covers, e.g. "2026-Q1". */
  asOf: string;
}

interface Dataset {
  asOf: string | null;
  source: string;
  sourceUrl: string;
  byCp: Record<string, NotariadoCpRow>;
}

const DS = dataset as Dataset;

export function fetchNotariado(postalCode?: string): AdapterResult<NotariadoData> {
  if (!postalCode) {
    return unavailable<NotariadoData>(
      "notariado",
      "No postal code on the cadastral record — Notariado lookup skipped.",
    );
  }
  const cp = postalCode.trim();
  if (!DS.asOf || Object.keys(DS.byCp).length === 0) {
    return unavailable<NotariadoData>(
      "notariado",
      "Notariado dataset not yet populated — see data/README-notariado.md.",
    );
  }
  const row = DS.byCp[cp];
  if (!row) {
    return unavailable<NotariadoData>(
      "notariado",
      `Postal code ${cp} not present in the ${DS.asOf} Notariado export.`,
    );
  }
  return ok<NotariadoData>(
    "notariado",
    { ...row, postalCode: cp, asOf: DS.asOf },
  );
}
