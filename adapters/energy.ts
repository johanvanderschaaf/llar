import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
  unavailable,
} from "./types";

/**
 * ICAEN energy-certificate registry via the Catalan open-data portal (Socrata
 * dataset j6ii-t3w2). Free, no key. Looked up by full cadastral reference;
 * returns the most recent certificate. This is how the energy class + date are
 * obtained. Verified live against 9648812DF2894H0013RQ (Class E, 2022).
 */
const RESOURCE =
  "https://analisi.transparenciacatalunya.cat/resource/j6ii-t3w2.json";

export interface EnergyData {
  /** Primary-energy consumption rating A–G (the headline EPC letter). */
  consumptionClass?: string;
  /** CO₂ emissions rating A–G. */
  emissionsClass?: string;
  /** Non-renewable primary energy, kWh/m²·year. */
  primaryEnergyKwh?: number;
  /** CO₂ emissions, kg/m²·year. */
  co2?: number;
  /** Registration date (ISO), if present. */
  dateRegistered?: string;
}

interface Row {
  qualificaci_de_consum_d?: string;
  qualificacio_d_emissions?: string;
  energia_prim_ria_no_renovable?: string;
  emissions_de_co2?: string;
  data_entrada?: string;
}

export async function fetchEnergy(
  cadastralRef: string,
): Promise<AdapterResult<EnergyData>> {
  const ref = cadastralRef.replace(/\s+/g, "").toUpperCase();
  const url =
    `${RESOURCE}?referencia_cadastral=${encodeURIComponent(ref)}` +
    `&$order=data_entrada%20DESC&$limit=1`;
  try {
    const res = await fetchWithTimeout(url, 20000, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ICAEN HTTP ${res.status}`);
    const rows = (await res.json()) as Row[];
    if (!rows.length) {
      return unavailable<EnergyData>(
        "energy",
        "No registered energy certificate for this reference (ICAEN).",
      );
    }
    const r = rows[0];
    const num = (v?: string) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return ok<EnergyData>("energy", {
      consumptionClass: r.qualificaci_de_consum_d?.trim().toUpperCase(),
      emissionsClass: r.qualificacio_d_emissions?.trim().toUpperCase(),
      primaryEnergyKwh: num(r.energia_prim_ria_no_renovable),
      co2: num(r.emissions_de_co2),
      dateRegistered: r.data_entrada,
    });
  } catch (e) {
    return failed<EnergyData>("energy", `ICAEN lookup failed: ${(e as Error).message}`);
  }
}
