import { brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";

/**
 * PisoWise mark: an ink tile containing a rising signal line that resolves to
 * a single point (per brand guidelines). Stroke in Signal Blue.
 */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <span className="pw-mark" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M3 17 L9 10 L13 14 L21 4.5"
          stroke="var(--pw-blue)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="4.5" r="2.4" fill="#fff" />
      </svg>
    </span>
  );
}

/** Two-tone wordmark: Piso (ink) + Wise (blue). */
export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={`pw-wordmark${onDark ? " on-dark" : ""}`}>
      {brand.wordmark.primary}
      <span>{brand.wordmark.accent}</span>
    </span>
  );
}

/** Horizontal lockup, linking home. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="pw-lockup" aria-label={brand.name}>
      <Mark size={size} />
      <Wordmark />
    </Link>
  );
}
