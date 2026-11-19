/**
 * Telling a Catastro outage apart from "no such property".
 *
 * During maintenance the OVC services still answer HTTP 200, but with an error
 * element such as "problemas tecnicos. Tiempo estimado desde las 15.15H hasta
 * las 19.00.H." (seen 2026-11-18). Without this check that looked exactly like
 * an unknown reference: the buyer saw "no records" and nothing was retried.
 */
const OUTAGE_RE =
  /problemas\s+t[eé]cnicos|servicio\s+(temporalmente\s+)?no\s+disponible|mantenimiento|tiempo\s+estimado/i;

/** True when a Catastro error description means the service itself is down. */
export function isCatastroOutage(description: unknown): boolean {
  return typeof description === "string" && OUTAGE_RE.test(description);
}

/**
 * Thrown when Catastro is down (maintenance, network failure, HTTP error), as
 * opposed to answering that a property doesn't exist. Callers show the buyer
 * the "registry temporarily down" message and offer to email the report later.
 */
export class CatastroDownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatastroDownError";
  }
}
