import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Landing } from "@/components/landing/Landing";
import { brand } from "@/config/brand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: `${brand.name} · ${t("hero.titlePlain")}`,
    description: t("hero.sub"),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Landing locale={locale} />;
}
