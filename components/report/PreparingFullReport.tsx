"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensureNarrativeAction } from "@/app/[locale]/actions";
import { AnalyzingScreen } from "@/components/AnalyzingScreen";

/**
 * Shown after unlock when the AI narrative isn't generated yet. Triggers
 * generation, then refreshes into the complete full report, or into the full
 * report without AI prose if generation fails.
 */
export function PreparingFullReport({ id }: { id: string }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      let ok = false;
      try {
        ok = (await ensureNarrativeAction(id)).ok;
      } catch {
        // The action itself failed (e.g. the function hit its time limit).
      }
      if (ok) {
        router.refresh();
      } else {
        // Show the full report without AI prose rather than spinning forever.
        // Without the flag the page would render this screen again. A later
        // visit to the plain URL tries the narrative again.
        router.replace("?narrative=skip");
      }
    })();
  }, [id, router]);

  return <AnalyzingScreen variant="full" />;
}
