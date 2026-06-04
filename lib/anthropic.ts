import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Server-only Anthropic client. Throws a clear error if the key is missing. */
export function createAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to generate AI narrative.",
    );
  }
  return new Anthropic({ apiKey });
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
