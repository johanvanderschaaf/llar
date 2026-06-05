"use client";

import { useEffect } from "react";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap" style={{ maxWidth: 520, padding: "80px 28px" }}>
      <div className="panel" style={{ textAlign: "center", padding: 36 }}>
        <h1 className="serif" style={{ fontSize: 24, marginBottom: 10 }}>
          Algo ha fallado
        </h1>
        <p style={{ color: "var(--ink-soft)", marginBottom: 22 }}>
          No hemos podido cargar esta página. Vuelve a intentarlo.
          <br />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Something went wrong — please try again.
          </span>
        </p>
        <button className="btn btn-primary" onClick={() => reset()}>
          Reintentar / Retry
        </button>
      </div>
    </div>
  );
}
