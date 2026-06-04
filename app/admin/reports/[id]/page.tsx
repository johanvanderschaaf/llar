import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireOperator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportView } from "@/components/report/ReportView";
import { ReportEditor } from "@/components/admin/ReportEditor";
import { AiNarrativeButton } from "@/components/admin/AiNarrativeButton";
import { setStatusAction } from "../../actions";
import type { ReportRow, SourceRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ReportEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOperator();
  const { id } = await params;
  // The preview uses ReportView, which reads translations; pin it to English.
  setRequestLocale("en");

  const db = createAdminClient();
  const { data: row } = await db
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const report = row as ReportRow;

  const { data: srcData } = await db
    .from("report_sources")
    .select("*")
    .eq("report_id", id);
  const sources = (srcData ?? []) as SourceRow[];

  const publish = setStatusAction.bind(null, id, "published");
  const unpublish = setStatusAction.bind(null, id, "in_review");

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link href="/admin" style={{ fontSize: 13, color: "var(--muted)" }}>
          ← All reports
        </Link>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <h1 className="serif" style={{ fontSize: 28 }}>
          {report.data?.hero?.title || "(untitled)"}{" "}
          <span style={{ fontSize: 14, color: "var(--muted)" }}>
            · {report.status}
          </span>
        </h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="lang-toggle" href={`/en/report/${id}`} target="_blank">
            Preview EN ↗
          </Link>
          <Link className="lang-toggle" href={`/es/report/${id}`} target="_blank">
            Preview ES ↗
          </Link>
          {report.status === "published" ? (
            <form action={unpublish}>
              <button className="lang-toggle" type="submit">
                Unpublish
              </button>
            </form>
          ) : (
            <form action={publish}>
              <button className="badge-plan" type="submit" style={{ cursor: "pointer" }}>
                Publish
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Provenance / sources */}
      <div className="panel" style={{ marginBottom: 22 }}>
        <h3 className="serif" style={{ fontSize: 16, marginBottom: 10 }}>
          Data sources
        </h3>
        {sources.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No source records.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sources.map((s) => (
              <div
                key={s.id}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span style={{ minWidth: 90, fontWeight: 600, fontSize: 13 }}>
                  {s.source}
                </span>
                <span
                  className={`pill ${
                    s.status === "ok" ? "good" : s.to_verify ? "ok" : "low"
                  }`}
                >
                  {s.status}
                </span>
                {s.to_verify ? (
                  <span style={{ fontSize: 12, color: "var(--accent-deep)" }}>
                    to verify
                  </span>
                ) : null}
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {s.note}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI narrative */}
      <div
        className="panel"
        style={{
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h3 className="serif" style={{ fontSize: 16, marginBottom: 2 }}>
            AI narrative
          </h3>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Generates the bilingual prose (verdict, building, legal,
            neighbourhood, negotiation…) grounded only in the sourced facts.
            Requires ANTHROPIC_API_KEY.
          </p>
        </div>
        <AiNarrativeButton id={id} />
      </div>

      {/* Editor */}
      <h3 className="serif" style={{ fontSize: 16, marginBottom: 10 }}>
        Report data (JSON)
      </h3>
      <ReportEditor
        key={report.updated_at}
        id={id}
        initialJson={JSON.stringify(report.data, null, 2)}
      />

      {/* Live preview */}
      <h3 className="serif" style={{ fontSize: 16, margin: "30px 0 6px" }}>
        Live preview (EN)
      </h3>
      <div
        style={{
          border: "1px solid var(--line-2)",
          borderRadius: 14,
          overflow: "hidden",
          background: "var(--paper)",
        }}
      >
        <ReportView report={report.data} locale="en" />
      </div>
    </div>
  );
}
