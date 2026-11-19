/**
 * What a building's "year" really is.
 *
 * Catastro's year (`unit.yearBuilt`, the `ant` field) is the year the building
 * was built OR last fully renovated (reforma integral). So Casa Calvet, built
 * 1898–1900, reads "2017" in Catastro. When the heritage catalogue gives an
 * epoch that is clearly older, that is the real build date and Catastro's year
 * is the renovation.
 *
 * Which year drives what:
 * - `ageYear` (the original date when known) drives the cautious checks: ITE
 *   inspection, pre-2002 asbestos, the 1955–1980 structure era. A renovation
 *   doesn't prove old installations were replaced, so the buyer still asks.
 * - `effective` (Catastro) drives the building score: a full renovation does
 *   improve the building's condition.
 */
export interface BuildingYears {
  /** Catastro's year: built or last fully renovated. */
  effective?: number;
  /** Original build year from the heritage catalogue, when clearly older. */
  original?: number;
  /** Catalogue epoch as written, e.g. "1898–1900". */
  originalLabel?: string;
  /** The year the age-based checks use. */
  ageYear?: number;
}

/** A catalogue epoch this much older than Catastro's year means a renovation. */
const RENOVATION_GAP = 10;

export function buildingYears(catastroYear?: number, heritageEpoch?: string): BuildingYears {
  const effective = catastroYear || undefined;
  const now = new Date().getFullYear();
  const years = [...(heritageEpoch ?? "").matchAll(/\b(1[2-9]\d{2}|20\d{2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y <= now);
  const first = years[0];
  if (effective && first && effective - first > RENOVATION_GAP) {
    const label = years.length > 1 && years.at(-1) !== first ? `${first}–${years.at(-1)}` : String(first);
    return { effective, original: first, originalLabel: label, ageYear: first };
  }
  return { effective, ageYear: effective };
}
