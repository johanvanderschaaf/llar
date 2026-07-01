import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { TopBar } from "@/components/TopBar";
import { Link } from "@/i18n/navigation";
import { EarlyAccessPage } from "@/components/EarlyAccessPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "earlyAccess" });
  return {
    title: `PisoWise · ${t("eyebrow")}`,
    description: t("sub"),
  };
}

export default async function EarlyAccessRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("earlyAccess");

  return (
    <>
      <TopBar
        actions={
          <Link href={`/report/sample-sors35`} className="ea-nav-btn">
            {t("navSample")}
          </Link>
        }
      />
      <EarlyAccessPage />
    </>
  );
}
