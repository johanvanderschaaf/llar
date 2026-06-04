import type { ReactNode } from "react";

/**
 * Wraps a premium block in the free preview: blurs the real content and shows
 * an unlock overlay. Built now as part of the design system; the paywall that
 * decides when to lock arrives in Phase 4. Render `locked={false}` to pass
 * content straight through (the paid/full-report state).
 */
export function LockedSection({
  locked,
  eyebrow,
  title,
  cta,
  children,
}: {
  locked: boolean;
  eyebrow: string;
  title: string;
  cta: string;
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className="locked">
      <div className="locked-inner" aria-hidden>
        {children}
      </div>
      <div className="locked-overlay">
        <div className="locked-card">
          <div className="lock-eyebrow">{eyebrow}</div>
          <h3 className="serif">{title}</h3>
          <p>{cta}</p>
        </div>
      </div>
    </div>
  );
}
