"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Native language names — stay untranslated across locales. */
const NAMES: Record<string, string> = { ca: "Català", es: "Español", en: "English" };
const CODES: Record<string, string> = { ca: "CA", es: "ES", en: "EN" };

function GlobeIcon() {
  return (
    <svg className="globe" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 12h18M12 3c2.5 2.4 3.8 5.7 3.8 9S14.5 18.6 12 21M12 3C9.5 5.4 8.2 8.7 8.2 12s1.3 6.6 3.8 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Branded language dropdown (per design_handoff_homepage_language_toggle).
 * Trigger = secondary-button shell showing the active locale (globe + code +
 * chevron); menu = a listbox of native language names that navigate to the
 * locale path. Replaces the old segmented pills / native select.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const locales = routing.locales;

  // Outside-click closes the menu.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  // On open, move focus to the selected option (or the first).
  useEffect(() => {
    if (!open) return;
    const opts = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    const idx = Math.max(0, (locales as readonly string[]).indexOf(active));
    opts?.[idx]?.focus();
  }, [open, active, locales]);

  const focusOption = (i: number) => {
    const opts = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    if (!opts || opts.length === 0) return;
    const n = opts.length;
    opts[((i % n) + n) % n]?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onOptionKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOption(idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusOption(idx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusOption(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusOption(locales.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    }
    // Enter / Space fall through to the link's native activation (navigation).
  };

  return (
    <div className="langdd" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="langdd__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change language, current language ${NAMES[active] ?? active}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <GlobeIcon />
        <span className="code">{CODES[active] ?? active.toUpperCase()}</span>
        <svg className="chev" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 9l7 7 7-7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="langdd__menu" role="listbox" aria-label="Select language" ref={menuRef}>
          <div className="langdd__head" aria-hidden>
            Language
          </div>
          {locales.map((loc, idx) => (
            <button
              key={loc}
              type="button"
              role="option"
              aria-selected={loc === active}
              className="langdd__item"
              onClick={() => {
                setOpen(false);
                router.replace(pathname, { locale: loc });
              }}
              onKeyDown={(e) => onOptionKeyDown(e, idx)}
            >
              <span className="name">{NAMES[loc] ?? loc}</span>
              <span className="tag">{CODES[loc] ?? loc.toUpperCase()}</span>
              <svg className="check" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 13l4 4 10-10"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
