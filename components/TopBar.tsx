import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Brand";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function TopBar() {
  const t = await getTranslations();
  return (
    <div className="topbar">
      <div className="wrap">
        <Logo />
        <div className="topbar-right">
          <LocaleSwitcher />
          <Link href="/start" className="nav-cta">
            {t("nav.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
