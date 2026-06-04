import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ReportView } from "@/components/report/ReportView";
import { sampleSors35 } from "@/data/sample-sors35";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPaidOrder } from "@/lib/orders";
import { hasAnthropicKey } from "@/lib/anthropic";
import { generateNarrative } from "@/pipeline/narrate";
import type { ReportRow } from "@/types/db";

export const dynamic = "force-dynamic";

/**
 * Public report route. Serves the demo sample, plus reports from the database:
 * - published → full report (public).
 * - unpublished → free PREVIEW for anyone with the link (premium sections
 *   locked); the operator sees the full report.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  if (id === sampleSors35.id) {
    return <ReportView report={sampleSors35} locale={locale} />;
  }

  const db = createAdminClient();
  const { data: row } = await db
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const report = row as ReportRow;

  // Full access for the operator or anyone who has paid; everyone else gets the
  // free preview (premium sections locked behind the paywall).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const paid = await hasPaidOrder(id);
  const full = Boolean(user) || paid;

  // Lazily generate the AI narrative the first time the FULL report is viewed
  // (no operator step needed). Cost is only ever paid for unlocked reports.
  let data = report.data;
  if (full && hasAnthropicKey() && !data.verdict?.headline?.en) {
    try {
      data = await generateNarrative(data, report.input);
      await db.from("reports").update({ data }).eq("id", id);
    } catch {
      // Leave the deterministic data if narration fails; don't block the report.
    }
  }

  return (
    <ReportView
      report={data}
      locale={locale}
      mode={full ? "full" : "preview"}
      reportId={id}
    />
  );
}
