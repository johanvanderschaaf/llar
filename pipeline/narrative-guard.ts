import type { Localized, NegReason } from "@/types/report";

/**
 * Checks the AI narrative before it replaces the fact-based prose.
 *
 * Why: in testing the AI did its own arithmetic and got it wrong ("32% above"
 * for a flat 36% below the barri average), contradicted itself between fields,
 * invented ratios, and once returned an empty checklist. The fact-based prose
 * (pipeline/facts-narrative.ts) is already in the report and is correct, so a
 * field that fails a check simply keeps it. Pure function, no side-effects.
 *
 * A field is rejected (in all languages, so they stay consistent) when any
 * language:
 * - contains a number that isn't in the FACTS sent to the AI,
 * - states the price gap in the opposite direction to the facts,
 * - uses a verdict word the prompt forbids ("bargain", "fair price", …).
 */

export type GapDirection = "below" | "above" | "in line";

export interface GuardFacts {
  /** Every number the AI was given (from the FACTS JSON). */
  known: number[];
  gapDirection?: GapDirection;
}

/** Verdict words the prompt forbids, all three languages. */
export const VERDICT_WORDS =
  /\b(bargain|good deal|great deal|fair price|fairly priced|reasonabl[ey] priced|overpriced|underpriced|a steal|chollo|ganga|precio (justo|razonable)|sobrevalorad[oa]|preu (just|raonable)|sobrevalorat|una ganga)\b/i;

/** "455.000" / "455,000" / "5,1" → number (thousands vs decimals by shape). */
export function parseNum(s: string): number {
  const t = s.replace(/[.,]$/, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  return Number(t.replace(",", "."));
}

/** All numbers found in any JSON-able value (numbers and digits inside strings). */
export function numbersIn(v: unknown, out: Set<number> = new Set()): Set<number> {
  if (typeof v === "number" && Number.isFinite(v)) out.add(Math.abs(v));
  else if (typeof v === "string") for (const m of v.matchAll(/\d[\d.,]*/g)) out.add(parseNum(m[0]));
  else if (Array.isArray(v)) v.forEach((x) => numbersIn(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => numbersIn(x, out));
  return out;
}

/** Numbers below this are counts, minutes, floors: too common to police. */
const MIN_CHECKED = 20;

function untraced(text: string, known: number[]): string | null {
  for (const m of text.matchAll(/\d[\d.,]*/g)) {
    const n = parseNum(m[0]);
    if (!Number.isFinite(n) || n < MIN_CHECKED) continue;
    if (!known.some((k) => Math.abs(k - n) <= Math.max(0.5, k * 0.005))) return m[0];
  }
  return null;
}

const ABOVE = /%[^.;:]{0,40}?\b(above|higher than|por encima|más caro|per sobre|més car)/i;
const BELOW = /%[^.;:]{0,40}?\b(below|lower than|por debajo|más barato|per sota|més barat)/i;

function wrongDirection(text: string, dir?: GapDirection): boolean {
  if (dir === "below") return ABOVE.test(text);
  if (dir === "above") return BELOW.test(text);
  return false;
}

/** Why a localized field fails, or null when it passes. */
export function fieldProblem(l: Localized | undefined, f: GuardFacts): string | null {
  if (!l) return "missing";
  if (!l.en?.trim() || !l.es?.trim() || (l.ca != null && !l.ca.trim())) return "empty";
  for (const text of [l.en, l.es, l.ca ?? ""]) {
    const n = untraced(text, f.known);
    if (n) return `number ${n} is not in the facts`;
    if (wrongDirection(text, f.gapDirection)) return "price gap in the wrong direction";
    const v = text.match(VERDICT_WORDS);
    if (v) return `verdict word "${v[0]}"`;
  }
  return null;
}

/**
 * Spanish/Catalan articles before barri names must contract: "de el Raval" →
 * "del Raval", "a els" → "als", "per el" → "pel". Lowercase "el"/"els" only,
 * so names like "El Salvador" are untouched.
 */
export function contractArticles(text: string, lang: "es" | "ca"): string {
  let t = text.replace(/(^|[\s(])de el\s/g, "$1del ").replace(/(^|[\s(])a el\s/g, "$1al ");
  if (lang === "ca") {
    t = t
      .replace(/(^|[\s(])de els\s/g, "$1dels ")
      .replace(/(^|[\s(])a els\s/g, "$1als ")
      .replace(/(^|[\s(])per el\s/g, "$1pel ")
      .replace(/(^|[\s(])per els\s/g, "$1pels ");
  }
  return t;
}

/** Contractions in es/ca, em-dashes out (the prompt forbids them). */
export function tidy<T extends Localized>(l: T): T {
  const dash = (s: string) => s.replace(/\s*—\s*/g, ", ");
  return {
    ...l,
    en: dash(l.en),
    es: contractArticles(dash(l.es), "es"),
    ...(l.ca != null ? { ca: contractArticles(dash(l.ca), "ca") } : {}),
  };
}

/** Keep the list items that pass; null when too few are left to use. */
export function guardList<T>(
  items: T[] | undefined,
  fields: (item: T) => Array<Localized | undefined>,
  f: GuardFacts,
  min: number,
): { kept: T[] | null; dropped: string[] } {
  const dropped: string[] = [];
  const kept = (items ?? []).filter((it) => {
    for (const l of fields(it)) {
      const p = fieldProblem(l, f);
      if (p) {
        dropped.push(p);
        return false;
      }
    }
    return true;
  });
  return { kept: kept.length >= min ? kept : null, dropped };
}

export type { NegReason };
