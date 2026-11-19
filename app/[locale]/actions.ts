"use server";

import { redirect } from "next/navigation";
import { generateReport } from "@/pipeline/generate";
import { CatastroDownError } from "@/adapters/catastro-outage";
import { generateNarrative } from "@/pipeline/narrate";
import { routing } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPaidOrder } from "@/lib/orders";
import { hasAnthropicKey } from "@/lib/anthropic";
import { needsAiNarrative } from "@/lib/narrative";
import { getStripe, hasStripe, reportPriceCents, stripeLocale } from "@/lib/stripe";
import type { ReportInput, ReportRow } from "@/types/db";

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Public buyer entry point: creates a report from the buyer's input, runs the
 * (deterministic, free) pipeline, and redirects to its preview. No auth — the
 * report lands in the operator queue (status in_review) for review; the AI
 * narrative + full unlock happen later. Guest email is captured for delivery.
 */
export async function startAnalysisAction(formData: FormData) {
  const localeRaw = String(formData.get("locale") ?? routing.defaultLocale);
  const locale = (routing.locales as readonly string[]).includes(localeRaw)
    ? localeRaw
    : routing.defaultLocale;

  const input: ReportInput = {
    addressOrRef: String(formData.get("addressOrRef") ?? "").trim(),
    cadastralRef:
      String(formData.get("cadastralRef") ?? "").trim() || undefined,
    askingPriceEur: numOrUndef(formData.get("askingPriceEur")),
    email: String(formData.get("email") ?? "").trim() || undefined,
    source: "buyer",
  };

  if (!input.cadastralRef && !input.addressOrRef) {
    redirect(`/${locale}/start?error=missing`);
  }

  let id: string;
  try {
    id = await generateReport(input);
  } catch (e) {
    // Never show the buyer a raw 500 — bounce back with a retry message.
    console.error("[startAnalysis] generation failed:", (e as Error)?.message);
    if (e instanceof CatastroDownError) {
      // Registry down: offer to email the report when it's back, keeping the
      // flat they picked (reference + label + asking price, never the email).
      const q = new URLSearchParams({ error: "registry_down" });
      if (input.cadastralRef) q.set("ref", input.cadastralRef);
      if (input.addressOrRef) q.set("label", input.addressOrRef);
      if (input.askingPriceEur) q.set("ask", String(input.askingPriceEur));
      redirect(`/${locale}/start?${q}`);
    }
    redirect(`/${locale}/start?error=generation`);
  }
  redirect(`/${locale}/report/${id}`);
}

/**
 * Generate the AI narrative for an unlocked report (operator or paid), if not
 * already present. Access-checked server-side. Returns when done so the client
 * can refresh into the complete report; `ok: false` means narration failed and
 * the client should show the report without AI prose instead of waiting.
 */
export async function ensureNarrativeAction(
  reportId: string,
): Promise<{ ok: boolean }> {
  if (!hasAnthropicKey()) return { ok: true };
  const db = createAdminClient();
  const { data: row } = await db
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (!row) return { ok: false };
  const report = row as ReportRow;
  if (!needsAiNarrative(report.data)) return { ok: true }; // already generated

  // Access gate: operator or a paid order.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const paid = await hasPaidOrder(reportId);
  if (!user && !paid) return { ok: false };

  try {
    const next = await generateNarrative(report.data, report.input);
    const { error } = await db
      .from("reports")
      .update({ data: next })
      .eq("id", reportId);
    if (error) throw new Error(`could not save narrative: ${error.message}`);
    return { ok: true };
  } catch (e) {
    // Keep the deterministic report; the buyer sees it without AI prose.
    console.error(
      `[ensureNarrative] report ${reportId}: ${(e as Error)?.message ?? e}`,
    );
    return { ok: false };
  }
}

/**
 * Start Stripe Checkout to unlock a report's full analysis + PDF.
 * Only available once the operator has published the report (AI/review done).
 * Records an order, then redirects to Stripe's hosted checkout.
 */
export async function createCheckoutAction(reportId: string, locale: string) {
  // No Stripe keys yet → bounce back gracefully (the paywall still shows).
  if (!hasStripe()) {
    redirect(`/${locale}/report/${reportId}?checkout=unconfigured`);
  }
  const db = createAdminClient();
  const { data: row } = await db
    .from("reports")
    .select("id, status, input, data")
    .eq("id", reportId)
    .maybeSingle();
  const report = row as Pick<ReportRow, "id" | "status" | "input" | "data"> | null;
  if (!report) {
    redirect(`/${locale}`);
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const title = report.data?.hero?.title ?? "Informe";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: reportPriceCents(),
          product_data: { name: `PisoWise — ${title}` },
        },
      },
    ],
    metadata: { reportId },
    customer_email: report.input?.email || undefined,
    locale: stripeLocale(locale),
    success_url: `${base}/${locale}/report/${reportId}?paid=1`,
    cancel_url: `${base}/${locale}/report/${reportId}`,
  });

  await db.from("orders").insert({
    report_id: reportId,
    buyer_email: report.input?.email ?? null,
    status: "checkout",
    stripe_session_id: session.id,
    amount_eur: reportPriceCents() / 100,
  });

  redirect(session.url!);
}
