import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReportEmail } from "@/lib/email";

/**
 * Stripe webhook: marks the order paid (which unlocks the report) and emails
 * the buyer their link. Requires STRIPE_WEBHOOK_SECRET. Reads the RAW body for
 * signature verification — do not parse as JSON first.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return new Response("Webhook not configured", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return new Response(`Webhook signature error: ${(e as Error).message}`, {
      status: 400,
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const reportId = session.metadata?.reportId;
    const email =
      session.customer_details?.email ?? session.customer_email ?? null;

    const db = createAdminClient();
    // Mark the order paid (unlocks the report).
    await db
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        buyer_email: email,
      })
      .eq("stripe_session_id", session.id);

    if (reportId && email) {
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
      await sendReportEmail(email, `${base}/es/report/${reportId}`);
    }
  }

  return new Response("ok", { status: 200 });
}
