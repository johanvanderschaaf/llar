import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { TopBar } from "@/components/TopBar";
import { ReportView } from "@/components/report/ReportView";
import { sampleSors35 } from "@/data/sample-sors35";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPaidOrder } from "@/lib/orders";
import { hasAnthropicKey } from "@/lib/anthropic";
import { PreparingFullReport } from "@/components/report/PreparingFullReport";
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

  const content = await reportContent(locale, id);
  return (
    <>
      <TopBar />
      {content}
    </>
  );
}

async function reportContent(locale: string, id: string): Promise<ReactNode> {
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

  // Full + AI not generated yet → show the progress screen, which generates the
  // narrative and refreshes into the complete report (no blocking 90s render).
  if (full && hasAnthropicKey() && !report.data.verdict?.headline?.en) {
    return <PreparingFullReport id={id} />;
  }

  return (
    <ReportView
      report={report.data}
      locale={locale}
      mode={full ? "full" : "preview"}
      reportId={id}
    />
  );
}
