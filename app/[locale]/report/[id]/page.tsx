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
import { needsAiNarrative } from "@/lib/narrative";
import { PreparingFullReport } from "@/components/report/PreparingFullReport";
import type { ReportRow } from "@/types/db";

export const dynamic = "force-dynamic";

// ensureNarrativeAction (the AI narrative, ~90s) runs as a Server Action on this
// page, so its time limit is this page's maxDuration. Kept above
// aiConfig.timeoutMs (120s) so the call times out cleanly before Vercel kills
// the function. Needs Fluid compute on Vercel (on); without it Hobby caps at 60s.
export const maxDuration = 150;

type Resolved =
  | { kind: "full"; report: ReportRow["data"]; reportId: string }
  | { kind: "preview"; report: ReportRow["data"]; reportId: string }
  | { kind: "preparing"; id: string }
  | { kind: "notfound" };

/**
 * Public report route. Serves the demo sample, plus reports from the database:
 * - signed-in operator or a paid order → full report.
 * - everyone else → free PREVIEW (premium sections locked).
 * - `?preview` → the free preview for anyone, to check the paywall.
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
  searchParams: Promise<{ preview?: string; narrative?: string }>;
}) {
  const { locale, id } = await params;
  const { preview, narrative } = await searchParams;
  setRequestLocale(locale);

  const resolved = await resolveReport(id, preview != null, narrative === "skip");
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
  skipNarrative = false,
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
  // `?preview` shows the free version to anyone, operator included, so the
  // paywall can be checked while signed in. It only ever shows less.
  const full = !forcePreview && (Boolean(user) || paid);

  // Full + AI not generated yet → show the progress screen, which generates the
  // narrative and refreshes into the complete report (no blocking 90s render).
  // `skipNarrative` is set by that screen when generation failed, so the buyer
  // gets the report without AI prose instead of the progress screen again.
  if (
    full &&
    !skipNarrative &&
    hasAnthropicKey() &&
    needsAiNarrative(report.data)
  ) {
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
