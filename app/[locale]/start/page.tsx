import { setRequestLocale, getTranslations } from "next-intl/server";
import { BuyerForm } from "@/components/BuyerForm";
import { TopBar } from "@/components/TopBar";

// startAnalysisAction runs generateReport, which fans out to several external
// sources (Catastro, OSM/Overpass, ICAEN, Ajuntament BCN). Per the Next docs,
// a Server Action's timeout is governed by the *page's* maxDuration — without
// this, Vercel's ~10s default kills the action mid-pipeline and the report is
// saved nearly empty. See .claude/skills/onboard/PIPELINE_FLOW.md.
export const maxDuration = 60;

export default async function StartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("form");

  return (
    <>
      <TopBar />
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
      {error === "generation" ? (
        <div
          className="panel"
          style={{
            marginBottom: 24,
            borderColor: "var(--pw-caution)",
            background: "var(--pw-caution-soft)",
            color: "var(--pw-caution-700)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {t("genError")}
        </div>
      ) : null}
      <BuyerForm />
      </div>
    </>
  );
}
