import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TopBar } from "@/components/TopBar";
import { ReportView } from "@/components/report/ReportView";
import { PrintButton } from "@/components/report/PrintButton";
import { sampleSors35 } from "@/data/sample-sors35";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPaidOrder } from "@/lib/orders";
import { hasAnthropicKey } from "@/lib/anthropic";
import { PreparingFullReport } from "@/components/report/PreparingFullReport";
import type { ReportRow } from "@/types/db";

export const dynamic = "force-dynamic";

type Resolved =
  | { kind: "full"; report: ReportRow["data"]; reportId: string }
  | { kind: "preview"; report: ReportRow["data"]; reportId: string }
  | { kind: "preparing"; id: string }
  | { kind: "notfound" };

/**
 * Public report route. Serves the demo sample, plus reports from the database:
 * - published → full report (public).
 * - unpublished → free PREVIEW for anyone with the link (premium sections
 *   locked); the operator sees the full report.
 *
 * The Save-PDF affordance lives in the topbar, so we resolve the report's
 * mode BEFORE rendering the topbar — and pass `<PrintButton>` to it only when
 * the buyer is actually looking at a full report.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { locale, id } = await params;
  const { preview } = await searchParams;
  setRequestLocale(locale);

  const resolved = await resolveReport(id, preview != null);
  if (resolved.kind === "notfound") notFound();

  const t = await getTranslations();
  const topbarActions =
    resolved.kind === "full" ? (
      <PrintButton label={t("report.downloadPdf")} />
    ) : null;

  return (
    <>
      <TopBar actions={topbarActions} />
      {renderResolved(resolved, locale)}
    </>
  );
}

async function resolveReport(
  id: string,
  forcePreview: boolean,
): Promise<Resolved> {
  if (id === sampleSors35.id) {
    return forcePreview
      ? { kind: "preview", report: sampleSors35, reportId: sampleSors35.id }
      : { kind: "full", report: sampleSors35, reportId: sampleSors35.id };
  }

  const db = createAdminClient();
  const { data: row } = await db
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { kind: "notfound" };
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
    return { kind: "preparing", id };
  }

  return full
    ? { kind: "full", report: report.data, reportId: id }
    : { kind: "preview", report: report.data, reportId: id };
}

function renderResolved(r: Resolved, locale: string): ReactNode {
  if (r.kind === "preparing") return <PreparingFullReport id={r.id} />;
  if (r.kind === "notfound") return null;
  return (
    <ReportView
      report={r.report}
      locale={locale}
      mode={r.kind}
      reportId={r.reportId}
    />
  );
}
