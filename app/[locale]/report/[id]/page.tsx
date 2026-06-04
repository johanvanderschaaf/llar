import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ReportView } from "@/components/report/ReportView";
import { sampleSors35 } from "@/data/sample-sors35";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ReportRow } from "@/types/db";

export const dynamic = "force-dynamic";

/**
 * Public report route. Serves the Phase 1 demo sample, plus reports from the
 * database: published reports are public; unpublished ones are visible only to
 * a signed-in operator (preview).
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

  if (report.status !== "published") {
    // Gate unpublished previews to the operator.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();
  }

  return <ReportView report={report.data} locale={locale} />;
}
