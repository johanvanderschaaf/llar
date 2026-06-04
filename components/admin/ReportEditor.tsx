"use client";

import { useState, useTransition } from "react";
import { saveReportAction } from "@/app/admin/actions";

/**
 * Phase 2 editor: a JSON editor over the full Report object (the render
 * contract). Powerful and complete; structured per-field forms can be layered
 * on later. Save validates JSON server-side and persists; the preview below
 * re-renders from the saved data.
 */
export function ReportEditor({
  id,
  initialJson,
}: {
  id: string;
  initialJson: string;
}) {
  const [json, setJson] = useState(initialJson);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = json !== initialJson;

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveReportAction(id, json);
      if (res.ok) {
        setMsg({ ok: true, text: "Saved. Preview updated below." });
      } else {
        setMsg({ ok: false, text: res.error ?? "Save failed." });
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: 360,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12.5,
          lineHeight: 1.5,
          padding: 14,
          border: "1px solid var(--line-2)",
          borderRadius: 12,
          background: "#fff",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="badge-plan"
          onClick={save}
          disabled={pending || !dirty}
          style={{ cursor: dirty ? "pointer" : "default", padding: "9px 16px" }}
        >
          {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        {msg ? (
          <span
            style={{
              fontSize: 13,
              color: msg.ok ? "var(--good)" : "var(--low)",
            }}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
