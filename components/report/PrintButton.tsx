"use client";

/** Triggers the browser's print-to-PDF on the report (print stylesheet). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost no-print"
      onClick={() => window.print()}
    >
      {label} ↓
    </button>
  );
}
