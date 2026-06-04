import { setRequestLocale, getTranslations } from "next-intl/server";
import { BuyerForm } from "@/components/BuyerForm";

export default async function StartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("form");

  return (
    <div className="wrap" style={{ maxWidth: 620, padding: "56px 28px 80px" }}>
      <h1 className="serif" style={{ fontSize: "clamp(30px,5vw,40px)", marginBottom: 12 }}>
        {t("title")}
      </h1>
      <p
        style={{
          fontSize: 18,
          color: "var(--ink-soft)",
          marginBottom: 32,
          lineHeight: 1.6,
        }}
      >
        {t("sub")}
      </p>
      <BuyerForm />
    </div>
  );
}
