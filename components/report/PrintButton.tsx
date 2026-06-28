"use client";

/**
 * Save-PDF icon button for the topbar. Triggers the browser's print-to-PDF
 * (the `.rp` print stylesheet hides chrome and forces the full report).
 * Styled per the report-page handoff's `.iconbtn`.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="iconbtn no-print"
      onClick={() => window.print()}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M6 14h12v7H6z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
