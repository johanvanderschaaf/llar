import "server-only";

/**
 * Send the buyer their unlocked-report link. Stub for now — logs to the server.
 * Wire to Resend/SMTP later (RESEND_API_KEY). Never throws (must not fail the
 * Stripe webhook).
 */
export async function sendReportEmail(to: string, url: string): Promise<void> {
  try {
    // TODO: integrate Resend or another provider.
    console.log(`[email] report link for ${to}: ${url}`);
  } catch (e) {
    console.error("[email] failed:", (e as Error).message);
  }
}
