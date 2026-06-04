import { getTranslations } from "next-intl/server";
import { brand } from "@/config/brand";
import { LanguageToggle } from "./LanguageToggle";

export async function TopBar() {
  const t = await getTranslations("brand");
  return (
    <div className="topbar">
      <div className="wrap">
        <div className="brand">
          <span className="glyph">{brand.glyph}</span>
          {brand.name}
          <small>{t("tagline")}</small>
        </div>
        <div className="topbar-right">
          <span className="badge-plan">{t("badge")}</span>
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}
