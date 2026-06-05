import { XMLParser } from "fast-xml-parser";
import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
  unavailable,
} from "./types";

/**
 * Official "Afectacions de finques per a ús d'habitatge existent" (AFH) from the
 * Ajuntament de Barcelona's Portal d'Informació Urbanística — the authoritative
 * source behind the portal's "La finca té una afectació urbanística" verdict.
 * Public, no key (reverse-engineered from the PIU client). Returns a category:
 *
 *   A — the finca HAS an urbanistic affectation                 → caution
 *   B — planning allows housing; no impeding affectation         → clear
 *   C — "specific": plan in progress / management area / licence
 *       suspension / court ruling / interior-of-block            → check
 *   D — indeterminate; refer to district technical services      → check
 *
 * Queried at PARCEL level (`/pa`) for a conservative, building-wide answer: if
 * any part of the finca is affected, the flat is flagged. This is the primary
 * affectation signal; the qualification inference in `urbanism.ts` is a fallback
 * used only when this service is unavailable.
 *
 * Verified live: Carrer de Mallorca 191 parcel 9525410DF2892F → category A.
 * NOTE: undocumented internal endpoint — may change without notice; always
 * degrades gracefully and keeps the "verify with a certificat urbanístic" line.
 */
const AFH =
  "https://ajuntament.barcelona.cat/informaciourbanistica/cerca/service/AfectacionsHabitatge";

export type AffectationCategory = "A" | "B" | "C" | "D";

export interface AffectationData {
  category: AffectationCategory;
  /** True only for category A (an actual affectation). */
  affected: boolean;
  /** Official Catalan description string from the service (for provenance). */
  officialCa?: string;
  /** "More info" citation URL when the service provides one. */
  citeUrl?: string;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
});

export async function fetchAffectation(
  parcelRef: string,
): Promise<AdapterResult<AffectationData>> {
  const ref = parcelRef.replace(/\s+/g, "").toUpperCase().slice(0, 14);
  if (ref.length < 14) {
    return unavailable<AffectationData>(
      "affectation",
      "No 14-char parcel reference for affectation lookup.",
    );
  }
  const url = `${AFH}/${encodeURIComponent(ref)}/--/--/pa?idioma=ca`;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`AFH HTTP ${res.status}`);
    const afh = (
      (parser.parse(await res.text()) as Record<string, unknown>)
        .root as Record<string, unknown>
    )?.afh as Record<string, unknown> | undefined;
    const category = String(afh?.resultat ?? "").trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(category)) {
      return unavailable<AffectationData>(
        "affectation",
        "AFH service returned no recognisable category.",
      );
    }
    const citeUrl = String(afh?.url_cita ?? "").trim() || undefined;
    return ok<AffectationData>(
      "affectation",
      {
        category: category as AffectationCategory,
        affected: category === "A",
        officialCa: String(afh?.descripcio ?? "").trim() || undefined,
        citeUrl,
      },
      // A/C/D warrant a human check before relying on it.
      category === "B" ? {} : { toVerify: true },
    );
  } catch (e) {
    return failed<AffectationData>(
      "affectation",
      `AFH lookup failed: ${(e as Error).message}`,
    );
  }
}
