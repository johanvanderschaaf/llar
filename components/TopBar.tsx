import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Brand";
import { LocaleSwitcher } from "./LocaleSwitcher";

/**
 * Shared interior-page chrome (report + start). The topbar uses the 1180px
 * chrome width from the report design.
 *
 * `actions` is an optional pre-CTA slot for route-specific affordances (the
 * report passes a Save-PDF button here; /start passes nothing). Keeping it
 * a generic ReactNode prop avoids leaking report-specific logic into the
 * shared chrome.
 */
export async function TopBar({ actions }: { actions?: ReactNode } = {}) {
  const t = await getTranslations();
  return (
    <div className="topbar">
      <div className="wrap">
        <Logo />
        <div className="topbar-right">
          {actions}
          <LocaleSwitcher />
          <Link href="/start" className="nav-cta">
            {t("nav.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
