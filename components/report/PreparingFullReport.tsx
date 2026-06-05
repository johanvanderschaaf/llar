"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensureNarrativeAction } from "@/app/[locale]/actions";
import { AnalyzingScreen } from "@/components/AnalyzingScreen";

/**
 * Shown after unlock when the AI narrative isn't generated yet. Triggers
 * generation, then refreshes into the complete full report.
 */
export function PreparingFullReport({ id }: { id: string }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      await ensureNarrativeAction(id);
      router.refresh();
    })();
  }, [id, router]);

  return <AnalyzingScreen variant="full" />;
}
