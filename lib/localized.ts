import type { Localized } from "@/types/report";

/** Resolve a Localized pair (or plain string) for the active locale. */
export function L(value: Localized | string, locale: string): string {
  if (typeof value === "string") return value;
  return locale === "es" ? value.es : value.en;
}
