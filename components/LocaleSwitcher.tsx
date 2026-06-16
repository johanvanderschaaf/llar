"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { es: "ES", ca: "CA", en: "EN" };

/**
 * ES / CA / EN switcher that preserves the current path. Renders two controls:
 * the segmented pill (default) and a compact native `<select>` that shows the
 * current locale (e.g. "CA ▾"). The select is hidden by default; the landing
 * swaps it in on phones (≤520px) where the full segmented control overflows
 * the header. Native `<select>` keeps the active language always legible.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <div className="locale-switch" role="group" aria-label="Language">
        {routing.locales.map((loc) => (
          <button
            key={loc}
            type="button"
            aria-current={loc === active ? "true" : undefined}
            className={loc === active ? "is-active" : undefined}
            onClick={() => router.replace(pathname, { locale: loc })}
          >
            {LABELS[loc] ?? loc.toUpperCase()}
          </button>
        ))}
      </div>
      <span className="locale-select-wrap">
        <select
          className="locale-select"
          aria-label="Language"
          value={active}
          onChange={(e) => router.replace(pathname, { locale: e.target.value })}
        >
          {routing.locales.map((loc) => (
            <option key={loc} value={loc}>
              {LABELS[loc] ?? loc.toUpperCase()}
            </option>
          ))}
        </select>
        <span className="locale-select__caret" aria-hidden>
          ▾
        </span>
      </span>
    </>
  );
}
