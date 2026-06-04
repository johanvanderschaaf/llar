import Link from "next/link";
import { requireOperator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportRow } from "@/types/db";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "var(--muted)",
  in_review: "var(--ok)",
  published: "var(--good)",
};

export default async function AdminHome() {
  await requireOperator();
  const db = createAdminClient();
  const { data } = await db
    .from("reports")
    .select("id, cadastral_ref, status, data, created_at")
    .order("created_at", { ascending: false });
  const reports = (data ?? []) as Pick<
    ReportRow,
    "id" | "cadastral_ref" | "status" | "data" | "created_at"
  >[];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <h1 className="serif" style={{ fontSize: 30 }}>
          Reports
        </h1>
        <Link className="badge-plan" href="/admin/new">
          + New report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="panel">
          <p style={{ color: "var(--ink-soft)" }}>
            No reports yet. Create one from a cadastral reference to see the
            Catastro pipeline in action.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Cadastral ref</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link
                    href={`/admin/reports/${r.id}`}
                    style={{ color: "var(--accent-deep)", fontWeight: 600 }}
                  >
                    {r.data?.hero?.title || "(untitled)"}
                  </Link>
                </td>
                <td style={{ fontSize: 13 }}>{r.cadastral_ref ?? "—"}</td>
                <td>
                  <span
                    className="pill"
                    style={{
                      color: STATUS_TONE[r.status],
                      background: "var(--paper-2)",
                    }}
                  >
                    {r.status}
                  </span>
                </td>
                <td style={{ fontSize: 13, color: "var(--muted)" }}>
                  {new Date(r.created_at).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
