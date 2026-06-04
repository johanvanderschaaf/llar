"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { es: "ES", ca: "CA", en: "EN" };

/** Compact ES / CA / EN switcher that preserves the current path. */
export function LocaleSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
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
  );
}
