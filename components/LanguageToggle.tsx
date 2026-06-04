"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Visible EN/ES toggle. Switches the active locale while preserving the
 * current path (next-intl rewrites the locale prefix).
 */
export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === "es" ? "en" : "es";

  return (
    <button
      type="button"
      className="lang-toggle"
      aria-label={`Switch language to ${next}`}
      onClick={() => router.replace(pathname, { locale: next })}
    >
      {t("switchTo")}
    </button>
  );
}
