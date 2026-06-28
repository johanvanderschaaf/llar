import { bandFor } from "@/config/scoring";

/** Circle circumference for r=54: 2·π·54 ≈ 339.29 (verified in the design). */
const CIRCUMFERENCE = 339.29;

/**
 * Radial score gauge (0–100), banded good/ok/low. Two sizes:
 *  - `lg` (140px) for the overall verdict rng, with a "/ 100" suffix.
 *  - `sm` (92px) for the five pillar score cards.
 *
 * Pure/server-safe. Styling lives in `app/globals.css` under the `.rp` scope
 * (`.rng`, `.rng--lg|sm`, `.rng--good|ok|low`); the rendered element carries
 * the bare `rng` classes and is always mounted inside the `.rp` report root.
 */
export function Ring({
  value,
  size,
  suffix,
}: {
  value: number;
  size: "lg" | "sm";
  /** When set, rendered as the small "/ 100" line under the number (lg rng). */
  suffix?: string;
}) {
  const band = bandFor(value);
  const offset = (CIRCUMFERENCE * (1 - value / 100)).toFixed(2);
  const px = size === "lg" ? 140 : 92;
  return (
    <div
      className={`rng rng--${size} rng--${band}`}
      style={{ width: px, height: px }}
    >
      <svg viewBox="0 0 120 120">
        <circle
          className="rng__track"
          cx="60"
          cy="60"
          r="54"
          fill="none"
          strokeWidth="8"
        />
        <circle
          className="rng__bar"
          cx="60"
          cy="60"
          r="54"
          fill="none"
          strokeWidth="8"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="rng__txt">
        <b className="fig">{value}</b>
        {suffix ? <span className="of">{suffix}</span> : null}
      </div>
    </div>
  );
}
