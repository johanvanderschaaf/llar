/**
 * Single source of truth for brand + pricing.
 *
 * Rebranding the product (name, wordmark, tagline) or repricing the paid report
 * should require editing ONLY this file. The price can also be overridden at
 * runtime via the REPORT_PRICE_EUR env var (read server-side; see config/pricing.ts
 * once monetization lands in Phase 4).
 */
export const brand = {
  /** Full wordmark (metadata, emails). */
  name: "PisoWise",
  /** Two-tone wordmark parts: primary (ink) + accent (blue). */
  wordmark: { primary: "Piso", accent: "Wise" },
  /** Short tagline (optional; not shown in the compact lockup). */
  tagline: "Barcelona",
  /** Market the product currently serves. */
  market: "Barcelona",
} as const;

export const pricing = {
  /**
   * One-off price to unlock the full report + PDF, in EUR.
   * Kept trivially changeable per the brief (e.g. 14.90, 16.90, 17.90).
   * In later phases this can be sourced from process.env.REPORT_PRICE_EUR.
   */
  reportPriceEur: 35,
  currency: "EUR" as const,
} as const;
