import type { Localized } from "@/types/report";

/**
 * Small wording helpers shared by every piece of generated report text, so
 * numbers and place names read correctly in each language:
 * - money: "€455,000" (en) / "455.000 €" (es, ca)
 * - barri names keep their Catalan article ("el Raval", "la Vila de Gràcia");
 *   English capitalises it ("El Raval"), Spanish and Catalan contract it after
 *   a preposition ("del Raval", "al Raval", "dels …").
 */

export type L3 = Localized & { ca: string };
export const L = (en: string, es: string, ca: string): L3 => ({ en, es, ca });

/** 1234 → "1.234". es-ES/ca-ES Intl leaves 4-digit numbers ungrouped. */
export const dotted = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "455000" → "€455,000" (en) / "455.000 €" (es, ca). */
export function money(n: number): L3 {
  const r = Math.round(n);
  const dots = dotted(r);
  return L(`€${r.toLocaleString("en-GB")}`, `${dots} €`, `${dots} €`);
}

/** "€5,584/m²" (en) / "5.584 €/m²" (es, ca). */
export function perM2(n: number): L3 {
  const m = money(n);
  return L(`${m.en}/m²`, `${m.es.replace(" €", "")} €/m²`, `${m.ca.replace(" €", "")} €/m²`);
}

/** Whole-number percentage, unsigned: "9%", in every language (as in the sample report). */
export function pct(n: number): L3 {
  const v = `${Math.abs(Math.round(n))}%`;
  return L(v, v, v);
}

/** Below this many registered sales, a barri average is a rough guide only. */
export const FEW_SALES = 30;

/** " Based on only 10 sales, …" or "" when the sample is large enough. */
export function fewSalesNote(transactions?: number): L3 {
  if (transactions == null || transactions >= FEW_SALES) return L("", "", "");
  return L(
    ` This average is based on only ${transactions} sales, so treat it as a rough guide.`,
    ` Esta media se basa en solo ${transactions} ventas, así que tómala como una referencia aproximada.`,
    ` Aquesta mitjana es basa en només ${transactions} vendes, així que pren-la com una referència aproximada.`,
  );
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Preposition + barri name with Spanish/Catalan article contraction. */
export function prep(word: "de" | "a" | "en" | "per", name: string): string {
  const m = name.match(/^(el|els)\s+(.*)$/);
  if (m && word !== "en") return `${word === "per" ? "pe" : word}${m[1] === "el" ? "l" : "ls"} ${m[2]}`;
  return `${word} ${name}`;
}

/** "in El Raval" / "en el Raval" / "al Raval". */
export const inPlace = (name: string): L3 => L(`in ${cap(name)}`, prep("en", name), prep("a", name));
/** "in El Raval" / "del Raval" / "del Raval" (for "the average of …"). */
export const ofPlace = (name: string): L3 => L(`in ${cap(name)}`, prep("de", name), prep("de", name));
