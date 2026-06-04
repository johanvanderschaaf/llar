"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateNarrativeAction } from "@/app/admin/actions";

/**
 * Triggers AI bilingual narrative generation for a report, then refreshes the
 * page so the editor + preview show the new prose.
 */
export function AiNarrativeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await generateNarrativeAction(id);
      if (res.ok) {
        setMsg({ ok: true, text: "Narrative generated." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Generation failed." });
      }
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button
        className="badge-plan"
        type="button"
        onClick={run}
        disabled={pending}
        style={{ cursor: "pointer" }}
      >
        {pending ? "Generating…" : "✦ Generate AI narrative"}
      </button>
      {msg ? (
        <span
          style={{ fontSize: 13, color: msg.ok ? "var(--good)" : "var(--low)" }}
        >
          {msg.text}
        </span>
      ) : null}
    </span>
  );
}
