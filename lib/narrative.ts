import type { Report } from "@/types/report";

/**
 * Whether a report still needs the AI narrative. Fact-based prose fills the
 * same fields first, so "is the bottom line empty" no longer says whether the
 * AI has run; the `narrative.source` marker does. Older stored reports have no
 * marker: for them an empty bottom line means "not narrated yet".
 */
export function needsAiNarrative(data: Report | undefined | null): boolean {
  if (!data) return false;
  if (data.narrative) return data.narrative.source !== "ai";
  return !data.verdict?.headline?.en;
}
