/**
 * Inline stroke icons lifted verbatim from the homepage design handoff
 * (Homepage.html). 24×24, currentColor stroke — sized by their container CSS.
 * No icon-library dependency, per the brand spec.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
} as const;

/** Right arrow — primary CTA affordance. */
export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shield-check — "official sources only" trust mark. */
export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** House/roof — urban planning. */
export function PlanningIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 11l9-7 9 7M5 10v9h14v-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Building — heritage protection. */
export function HeritageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5 21V8l7-4 7 4v13M9 21v-6h6v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Line chart — price reality. */
export function PriceTrendIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M4 19V5M4 19h16M8 16l3-4 3 2 4-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Clock-ring — the "5 scores, one verdict" card. */
export function ScoresIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Warning triangle — natural risks. */
export function RisksIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 3l9 16H3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Document-with-check — price & value. */
export function PriceValueIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M19 13v6a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9 12l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Building (flat-roof) — building & condition. */
export function BuildingIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 21h18M6 21V8l6-4 6 4v13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Document — legal & documents. */
export function LegalIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M7 3h7l5 5v13H7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** House with pin — neighbourhood. */
export function NeighbourhoodIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5 21V10l7-6 7 6v11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="2.4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Lightning bolt — energy. */
export function EnergyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M13 2L5 13h6l-1 9 8-11h-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Plus — FAQ accordion affordance (rotates to × via CSS when open). */
export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Info circle — range-line caption. */
export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
