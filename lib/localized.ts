import type { Localized } from "@/types/report";

/**
 * Resolve a Localized pair (or plain string) for the active locale.
 * AI narrative is stored EN/ES only for now, so Catalan ("ca") falls back to
 * Spanish (closest) until per-report Catalan narrative is added.
 */
export function L(value: Localized | string, locale: string): string {
  if (typeof value === "string") return value;
  return locale === "es" || locale === "ca" ? value.es : value.en;
}
