import { setRequestLocale } from "next-intl/server";
import { ReportView } from "@/components/report/ReportView";
import { sampleSors35 } from "@/data/sample-sors35";

/**
 * Phase 1: the home route renders the sample dossier so the design can be
 * reviewed in EN + ES. In later phases this becomes the landing page and
 * reports move under /report/[id].
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReportView report={sampleSors35} locale={locale} />;
}
