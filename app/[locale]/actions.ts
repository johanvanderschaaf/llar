"use server";

import { redirect } from "next/navigation";
import { generateReport } from "@/pipeline/generate";
import { routing } from "@/i18n/routing";
import type { ReportInput } from "@/types/db";

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

  const id = await generateReport(input);
  redirect(`/${locale}/report/${id}`);
}
