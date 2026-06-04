"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReport } from "@/pipeline/generate";
import { generateNarrative } from "@/pipeline/narrate";
import type { ReportInput, ReportRow, ReportStatus } from "@/types/db";

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function createReportAction(formData: FormData) {
  await requireOperator();
  const input: ReportInput = {
    addressOrRef: String(formData.get("addressOrRef") ?? "").trim(),
    cadastralRef:
      String(formData.get("cadastralRef") ?? "").trim() || undefined,
    listingUrl: String(formData.get("listingUrl") ?? "").trim() || undefined,
    askingPriceEur: numOrUndef(formData.get("askingPriceEur")),
    builtM2: numOrUndef(formData.get("builtM2")),
    usableM2: numOrUndef(formData.get("usableM2")),
  };
  const id = await generateReport(input);
  redirect(`/admin/reports/${id}`);
}

export async function saveReportAction(
  id: string,
  dataJson: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireOperator();
  let data: unknown;
  try {
    data = JSON.parse(dataJson);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const db = createAdminClient();
  const { error } = await db.from("reports").update({ data }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/reports/${id}`);
  return { ok: true };
}

export async function setStatusAction(id: string, status: ReportStatus) {
  await requireOperator();
  const db = createAdminClient();
  await db
    .from("reports")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  revalidatePath(`/admin/reports/${id}`);
  revalidatePath("/admin");
}

export async function generateNarrativeAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireOperator();
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return { ok: false, error: error?.message ?? "Not found" };
  const report = row as ReportRow;

  try {
    const next = await generateNarrative(report.data, report.input);
    await db.from("reports").update({ data: next }).eq("id", id);
    await db.from("report_sources").upsert(
      {
        report_id: id,
        source: "ai",
        status: "ok",
        to_verify: false,
        payload: null,
        note: "Bilingual narrative generated",
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "report_id,source" },
    );
    revalidatePath(`/admin/reports/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
