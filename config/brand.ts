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
   * Kept trivially changeable per the brief. Can be overridden at runtime via
   * the REPORT_PRICE_EUR env var (see lib/stripe.ts) — keep that in sync.
   */
  reportPriceEur: 49,
  currency: "EUR" as const,
} as const;
