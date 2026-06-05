import type { Localized } from "@/types/report";

/**
 * Resolve a Localized pair (or plain string) for the active locale.
 * Catalan content is being rolled out incrementally: when `ca` is missing on a
 * given Localized value, fall back to `es` (closest neighbour).
 */
export function L(value: Localized | string, locale: string): string {
  if (typeof value === "string") return value;
  if (locale === "ca") return value.ca ?? value.es;
  if (locale === "es") return value.es;
  return value.en;
}
