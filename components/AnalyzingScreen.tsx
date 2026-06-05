"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Mark } from "./Brand";

/**
 * Calm progress screen shown while a report is generated. Lists the real
 * sources being pulled (per the brand: a progress state, not a spinner). The
 * tick-off is time-based and cosmetic — the actual completion is driven by the
 * server (a redirect after data generation, or a router.refresh after AI).
 */
export function AnalyzingScreen({ variant = "data" }: { variant?: "data" | "full" }) {
  const t = useTranslations("analyzing");
  const steps = t.raw(variant === "full" ? "fullSteps" : "steps") as string[];
  const [done, setDone] = useState(0);

  useEffect(() => {
    // Advance through the steps, but hold the last one (server finishes it).
    const interval = variant === "full" ? 4000 : 2200;
    const id = setInterval(() => {
      setDone((d) => Math.min(d + 1, steps.length - 1));
    }, interval);
    return () => clearInterval(id);
  }, [steps.length, variant]);

  return (
    <div className="analyzing">
      <div className="analyzing-card">
        <Mark size={40} />
        <h1 className="serif analyzing-title">
          {t(variant === "full" ? "fullTitle" : "title")}
        </h1>
        <ul className="analyzing-steps">
          {steps.map((s, i) => {
            const state = i < done ? "done" : i === done ? "active" : "pending";
            return (
              <li key={s} className={`analyzing-step is-${state}`}>
                <span className="analyzing-dot" aria-hidden>
                  {state === "done" ? "✓" : ""}
                </span>
                {s}
              </li>
            );
          })}
        </ul>
        <p className="analyzing-wait">{t("wait")}</p>
      </div>
    </div>
  );
}
