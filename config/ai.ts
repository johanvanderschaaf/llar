/**
 * AI synthesis configuration (single source).
 *
 * Per the product brief we default to a cost-effective current model
 * (Sonnet tier) for bilingual narrative generation. Change `model` here to
 * upgrade/downgrade in one place. Model IDs verified against the Anthropic
 * docs (claude-api skill, cached 2026-05).
 */
export const aiConfig = {
  /** Cost-effective current generation model (Sonnet tier). */
  model: "claude-sonnet-4-6",
  /** Generous ceiling — bilingual JSON output is sizeable. */
  maxTokens: 8000,
} as const;
