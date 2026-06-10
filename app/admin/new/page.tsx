import { requireOperator } from "@/lib/auth";
import { NewReportForm } from "@/components/admin/NewReportForm";

// createReportAction runs generateReport (multi-source pipeline). Server Action
// timeout follows the page's maxDuration; without it Vercel's ~10s default can
// kill generation before the report is written. See start/page.tsx.
export const maxDuration = 60;

export default async function NewReportPage() {
  await requireOperator();
  return (
    <div style={{ maxWidth: 620 }}>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 6 }}>
        New report
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
        Search a Barcelona street, pick the exact unit, and we pull its Catastro
        record (year, surface, use, and the number of units in the building).
        Only properties Catastro can find are selectable — so generation never
        starts on data we can&apos;t access.
      </p>
      <NewReportForm />
    </div>
  );
}
