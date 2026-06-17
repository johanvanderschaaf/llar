import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Report, Fact, Localized } from "@/types/report";
import { bandFor } from "@/config/scoring";
import { pricing } from "@/config/brand";
import { L } from "@/lib/localized";
import { reportPriceEur } from "@/lib/stripe";
import { brand } from "@/config/brand";
import { LockedSection } from "./LockedSection";
import { UnlockButton } from "./UnlockButton";
import { PrintButton } from "./PrintButton";
import { PriceSection } from "./PriceSection";

/* ---------- small presentational helpers ---------- */

// Planning-row tone → severity order (caution first) and pill colour class.
const PLAN_ORDER: Record<string, number> = {
  caution: 0,
  check: 1,
  clear: 2,
  info: 3,
};
const PLAN_PILL: Record<string, string> = {
  caution: "low",
  check: "ok",
  clear: "good",
  info: "info",
};

function SectionHead({
  num,
  title,
  note,
}: {
  num: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="sec-head">
      <span className="sec-num">{num}</span>
      <h2 className="serif">{title}</h2>
      {note ? <span className="note">{note}</span> : null}
    </div>
  );
}

function FactGrid({
  facts,
  locale,
  label,
  verifyLabel,
}: {
  facts: Fact[];
  locale: string;
  label: (key: string) => string;
  verifyLabel: string;
}) {
  return (
    <div className="facts">
      {facts.map((f) => (
        <div className="fact" key={f.labelKey}>
          <span className="k">{label(f.labelKey)}</span>
          <span className="v">
            {L(f.value, locale)}
            {f.toVerify ? <span className="verify">{verifyLabel}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function Checklist({ items, locale }: { items: Localized[]; locale: string }) {
  return (
    <ul className="check">
      {items.map((it, i) => (
        <li key={i}>{L(it, locale)}</li>
      ))}
    </ul>
  );
}

/* ---------- main view ---------- */

export async function ReportView({
  report,
  locale,
  mode = "full",
  reportId,
}: {
  report: Report;
  locale: string;
  mode?: "full" | "preview";
  reportId?: string;
}) {
  const t = await getTranslations();
  const preview = mode === "preview";
  const priceLabel = new Intl.NumberFormat(
    locale === "en" ? "en-IE" : locale === "ca" ? "ca-ES" : "es-ES",
    { style: "currency", currency: pricing.currency },
  ).format(reportPriceEur());
  const overall = report.verdict.overall;
  const previewTag =
    overall >= 70
      ? t("preview.tagGood")
      : overall >= 50
        ? t("preview.tagOk")
        : t("preview.tagLow");
  // Wrap a premium section behind the paywall teaser in preview mode.
  const lock = (children: ReactNode) =>
    preview ? (
      <LockedSection
        locked
        eyebrow={t("preview.free")}
        title={t("preview.lockTitle")}
        cta={t("preview.lockCta")}
      >
        {children}
      </LockedSection>
    ) : (
      children
    );
  const dateFmt = new Intl.DateTimeFormat(
    locale === "es" ? "es-ES" : locale === "ca" ? "ca-ES" : "en-GB",
    {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(report.generatedAt));

  return (
    <div className="wrap">
      {/* PDF-only brand header */}
      <div className="print-only print-brand">
        {brand.wordmark.primary}
        <b>{brand.wordmark.accent}</b>
        <span style={{ fontWeight: 500, color: "var(--muted)" }}>
          · {brand.market}
        </span>
      </div>

      {/* Download PDF (full report only) */}
      {!preview ? (
        <div className="report-actions">
          <PrintButton label={t("report.downloadPdf")} />
        </div>
      ) : null}

      {/* HERO */}
      <header className="hero fx">
        <div className="eyebrow">
          {t("report.eyebrow")} · {dateFmt}
        </div>
        <h1 className="serif">
          {report.hero.title}, {L(report.hero.floorLabel, locale)}
        </h1>
        <p className="sub">{L(report.hero.sub, locale)}</p>
        <div className="meta-row">
          {report.hero.meta.map((m) => (
            <div className="meta" key={m.labelKey}>
              <span className="k">{t(m.labelKey)}</span>
              <span className={`v${m.accent ? " accent" : ""}`}>
                {L(m.value, locale)}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* VERDICT */}
      <div className="verdict fx" style={{ animationDelay: ".05s" }}>
        <div className="lab">
          {preview ? t("preview.free") : t("verdict.label")}
        </div>
        {preview ? (
          <p style={{ marginBottom: 4 }}>{t("preview.note")}</p>
        ) : (
          <>
            <h2 className="serif">{L(report.verdict.headline, locale)}</h2>
            <p>{L(report.verdict.body, locale)}</p>
          </>
        )}
        <div className="vscore">
          <b>{overall}</b>
          <span>{t("verdict.overallSuffix")}</span>
        </div>
        {preview ? (
          <div>
            <span className="vtag">{previewTag}</span>
          </div>
        ) : null}
      </div>

      {/* ALERTS — serious issues surfaced above the fold (e.g. affectation) */}
      {report.alerts && report.alerts.length > 0 ? (
        <div className="alerts fx">
          {report.alerts.map((a, i) => (
            <div className={`alert ${a.tone}`} key={i}>
              <div className="alert-cap">{t("alerts.label")}</div>
              <div className="alert-title">{L(a.title, locale)}</div>
              <div className="alert-body">{L(a.detail, locale)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* PREVIEW — paywall banner (always visible until unlocked) */}
      {preview && reportId ? (
        <div className="unlock-banner fx">
          <div>
            <div className="unlock-title">{t("preview.unlockTitle")}</div>
            <div className="unlock-sub">{t("preview.note")}</div>
          </div>
          <UnlockButton
            reportId={reportId}
            locale={locale}
            label={t("preview.unlockCta", { price: priceLabel })}
            pendingLabel="…"
          />
        </div>
      ) : null}

      {/* 01 SCORES */}
      <section className="fx">
        <SectionHead
          num="01"
          title={t("sections.scores")}
          note={t("sections.scoresNote")}
        />
        <div className="scores">
          {report.scores.map((s) => {
            const color = `var(--${bandFor(s.value)})`;
            return (
              <div className="score" key={s.key}>
                <div
                  className="ring"
                  style={{
                    background: `conic-gradient(${color} ${s.value}%, var(--paper-2) 0)`,
                  }}
                >
                  <b>{s.value}</b>
                </div>
                <div className="name">{t(`scoreNames.${s.key}`)}</div>
                <div className="micro">{L(s.caption, locale)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 02 SNAPSHOT */}
      <section className="fx">
        <SectionHead num="02" title={t("sections.snapshot")} />
        <FactGrid
          facts={report.snapshot.facts}
          locale={locale}
          label={(k) => t(k)}
          verifyLabel={t("common.toVerify")}
        />
        <p className="body" style={{ marginTop: 22 }}>
          {L(report.snapshot.note, locale)}
        </p>
      </section>

      {/* 03 PRICE & VALUE (premium) — "Number Line" design, driven entirely by
          the structured `pricing` payload (one of three states). The barri
          closing-price benchmark is the single price anchor; we do not ingest
          portal listings, so there is no comparables table. */}
      {lock(
      <section className="fx">
        {report.price.pricing ? (
          <PriceSection
            pricing={report.price.pricing}
            locale={locale}
            t={t}
          />
        ) : (
          <>
            <SectionHead
              num="03"
              title={t("sections.price")}
              note={t("sections.priceNote")}
            />
            <p className="lede">{L(report.price.lede, locale)}</p>
          </>
        )}
      </section>
      )}

      {/* 04 BUILDING & CONDITION (premium) */}
      {lock(
      <section className="fx">
        <SectionHead num="04" title={t("sections.building")} />
        <div className="grid-2">
          {report.building.panels.map((p, i) => (
            <div className="panel" key={i}>
              <h3 className="serif">{L(p.heading, locale)}</h3>
              <p>{L(p.body, locale)}</p>
            </div>
          ))}
        </div>
        <div className="keyline" style={{ marginTop: 22 }}>
          {L(report.building.keyline, locale)}
        </div>
      </section>
      )}

      {/* 05 RISK & SAFETY */}
      <section className="fx">
        <SectionHead num="05" title={t("sections.risks")} />
        {report.risks.map((r) => (
          <div className="risk" key={r.labelKey}>
            <span className="rk">{t(r.labelKey)}</span>
            <span className={`pill ${r.tone}`}>{t(`riskPill.${r.tone}`)}</span>
            <span className="rt">{L(r.detail, locale)}</span>
          </div>
        ))}
      </section>

      {/* 06 LEGAL (premium) */}
      {lock(
      <section className="fx">
        <SectionHead num="06" title={t("sections.legal")} />
        <p className="body">{L(report.legal.intro, locale)}</p>
        <Checklist items={report.legal.items} locale={locale} />
      </section>
      )}

      {/* 07 NEIGHBOURHOOD */}
      <section className="fx">
        <SectionHead num="07" title={t("sections.neighbourhood")} />
        <p className="lede">{L(report.neighbourhood.lede, locale)}</p>
        <FactGrid
          facts={report.neighbourhood.facts}
          locale={locale}
          label={(k) => t(k)}
          verifyLabel={t("common.toVerify")}
        />
        <p className="body" style={{ marginTop: 20 }}>
          {L(report.neighbourhood.note, locale)}
        </p>
      </section>

      {/* 08 URBANISM */}
      <section className="fx">
        <SectionHead num="08" title={t("sections.urbanism")} />
        {[...report.urbanism.items]
          .sort((a, b) => PLAN_ORDER[a.tone] - PLAN_ORDER[b.tone])
          .map((it) => (
            <div className="plan-item" key={it.key}>
              <span className={`pill ${PLAN_PILL[it.tone]}`}>
                {t(`planTone.${it.tone}`)}
              </span>
              <div className="plan-body">
                <div className="plan-label">{L(it.label, locale)}</div>
                <div className="plan-text">{L(it.text, locale)}</div>
              </div>
            </div>
          ))}
      </section>

      {/* 09 COSTS */}
      <section className="fx">
        <SectionHead num="09" title={t("sections.costs")} />
        <p className="body">{L(report.costs.intro, locale)}</p>
        <FactGrid
          facts={report.costs.facts}
          locale={locale}
          label={(k) => t(k)}
          verifyLabel={t("common.toVerify")}
        />
        <p
          className="body"
          style={{ marginTop: 18, fontSize: 14, color: "var(--muted)" }}
        >
          {L(report.costs.footnote, locale)}
        </p>
      </section>

      {/* 10 SUBSIDIES */}
      <section className="fx">
        <SectionHead num="10" title={t("sections.subsidies")} />
        <div className="grid-2">
          {report.subsidies.panels.map((p, i) => (
            <div className="panel" key={i}>
              <h3 className="serif">{L(p.heading, locale)}</h3>
              <p>{L(p.body, locale)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 11 NEGOTIATION (premium) */}
      {lock(
      <section className="fx">
        <SectionHead num="11" title={t("sections.negotiation")} />
        <p className="body">{L(report.negotiation.intro, locale)}</p>
        <Checklist items={report.negotiation.items} locale={locale} />
        <div className="keyline" style={{ marginTop: 20 }}>
          {L(report.negotiation.tactic, locale)}
        </div>
      </section>
      )}

      {/* 12 CHECKLIST (premium) */}
      {lock(
      <section className="fx">
        <SectionHead num="12" title={t("sections.checklist")} />
        <Checklist items={report.checklist} locale={locale} />
      </section>
      )}

      {/* FOOTER */}
      <footer className="fx">
        <div className="src">{L(report.footer.sources, locale)}</div>
        <div>
          {L(report.footer.disclaimer, locale)} · {t("footer.generated", { date: dateFmt })}
        </div>
      </footer>
    </div>
  );
}
