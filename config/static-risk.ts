import type { Localized } from "@/types/report";

/**
 * Operator-maintained static risk facts that don't vary meaningfully within
 * Barcelona city (seismic, radon) plus light district-level crime context.
 * Date-stamped and sourced — review periodically. These are deliberately NOT
 * AI-generated (safety/legal facts).
 */

export const STATIC_RISK_AS_OF = "2026-06";

/** Seismic hazard — Barcelona municipality, NCSE-02 basic acceleration. */
export const SEISMIC = {
  pga: "0.04 g",
  tone: "good" as const,
  detail: {
    en: "PGA ≈ 0.04 g (NCSE-02) — low, standard for Barcelona.",
    es: "PGA ≈ 0,04 g (NCSE-02) — bajo, estándar para Barcelona.",
  } satisfies Localized,
};

/** Radon — Barcelona city, CTE DB-HS6 radon-zone classification. */
export const RADON = {
  tone: "good" as const,
  detail: {
    en: "Barcelona city is a low-radon area (CTE DB-HS6); upper floors reduce exposure further. Confirm the municipal zone if at ground level.",
    es: "La ciudad de Barcelona es zona de radón bajo (CTE DB-HS6); las plantas altas reducen aún más la exposición. Confirma la zona municipal si es planta baja.",
  } satisfies Localized,
};

/** Barcelona's 10 municipal districts (Catastro lourb.dm code → name). */
export const BCN_DISTRICTS: Record<number, string> = {
  1: "Ciutat Vella",
  2: "Eixample",
  3: "Sants-Montjuïc",
  4: "Les Corts",
  5: "Sarrià-Sant Gervasi",
  6: "Gràcia",
  7: "Horta-Guinardó",
  8: "Nou Barris",
  9: "Sant Andreu",
  10: "Sant Martí",
};

/**
 * District-level crime context (operator-maintained, date-stamped). This is
 * NEIGHBOURHOOD context, never a building-specific claim. Ciutat Vella carries
 * the city's highest tourist-area petty crime; the rest are calmer residential
 * districts. Buyers should check current Ajuntament / Mossos figures.
 */
export function crimeContext(districtCode?: number): {
  districtName?: string;
  tone: "good" | "ok" | "low";
  detail: Localized;
} {
  const name = districtCode ? BCN_DISTRICTS[districtCode] : undefined;
  const elevated = districtCode === 1; // Ciutat Vella
  const tone: "good" | "ok" = elevated ? "ok" : "good";

  if (!name) {
    return {
      tone: "good",
      detail: {
        en: "Barcelona is a generally safe city; reported crime fell across 2025. Check the district's current figures in the Ajuntament open data.",
        es: "Barcelona es en general una ciudad segura; la delincuencia denunciada bajó durante 2025. Consulta las cifras actuales del distrito en los datos abiertos del Ayuntamiento.",
      },
    };
  }
  return {
    districtName: name,
    tone,
    detail: elevated
      ? {
          en: `${name} is central and lively, with the city's highest tourist-area petty crime — watch for pickpocketing. District-level context, not building-specific; check current Ajuntament figures.`,
          es: `${name} es céntrico y animado, con la mayor delincuencia menor de zona turística de la ciudad — atención a los carteristas. Contexto de distrito, no específico del edificio; consulta las cifras actuales del Ayuntamiento.`,
        }
      : {
          en: `${name} is a calmer, largely residential district; city-wide reported crime fell across 2025. District-level context, not building-specific — check current Ajuntament figures.`,
          es: `${name} es un distrito más tranquilo y mayormente residencial; la delincuencia denunciada en la ciudad bajó durante 2025. Contexto de distrito, no específico del edificio: consulta las cifras actuales del Ayuntamiento.`,
        },
  };
}
