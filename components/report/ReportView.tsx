import type { CSSProperties, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Report, Fact, Localized, NegReason, TermDef } from "@/types/report";
import { bandFor } from "@/config/scoring";
import { pricing } from "@/config/brand";
import { L } from "@/lib/localized";
import { reportPriceEur } from "@/lib/stripe";
import { brand } from "@/config/brand";
import { UnlockButton } from "./UnlockButton";
import { PriceSection } from "./PriceSection";
import { Ring } from "./Ring";

/* ---------- icons (inline 24×24 strokes, no library) ---------- */

const stroke = {
  fill: "none" as const,
};

function IcTriangle() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3 2 20h20L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4M12 17.5v.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IcInfo() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 8v5M12 16.5v.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IcCheck() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M5 13l4 4 10-11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcLock() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IcDisc() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5M12 8v.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IcFile() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M7 3h7l5 5v13H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function IcUpload() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Severity-icon kind for a status row / alert. */
type IconKind = "triangle" | "info" | "check";
function ToneIcon({ kind }: { kind: IconKind }) {
  if (kind === "triangle") return <IcTriangle />;
  if (kind === "check") return <IcCheck />;
  return <IcInfo />;
}

// Planning row tone (caution/check/clear/info) → severity order + icon.
const PLAN_ORDER: Record<string, number> = { caution: 0, check: 1, clear: 2, info: 3 };
const PLAN_ICON: Record<string, IconKind> = {
  caution: "triangle",
  check: "info",
  clear: "check",
  info: "info",
};
// Risk row tone (good/ok/low) → icon.
const RISK_ICON: Record<string, IconKind> = { good: "check", ok: "info", low: "triangle" };

const PANEL_BODY: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--pw-ink-700)",
  margin: "12px 0 0",
};

/* ---------- small presentational helpers ---------- */

function SectionHead({
  idx,
  label,
  head,
  lede,
  children,
}: {
  idx?: string;
  label: string;
  head: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="sec-head">
      <p className="r-eyebrow">
        {idx ? <span className="idx">{idx}</span> : null}
        <span className="dot" />
        <span>{label}</span>
      </p>
      <h2>{head}</h2>
      {lede ? <p className="lede measure">{lede}</p> : null}
      {children}
    </div>
  );
}

/** Render a fact value, optionally splitting on " · " so the tail renders as
 *  the design's `<small>` annotation (neighbourhood distances, cost subtexts).
 *  Defensive: if there's no " · " the value renders unchanged. */
function FactValue({
  value,
  splitSubtext,
}: {
  value: string;
  splitSubtext?: boolean;
}) {
  if (!splitSubtext) return <>{value}</>;
  const idx = value.indexOf(" · ");
  if (idx === -1) return <>{value}</>;
  return (
    <>
      {value.slice(0, idx)}{" "}
      <small className="fig">· {value.slice(idx + 3)}</small>
    </>
  );
}

function FactGrid({
  facts,
  locale,
  label,
  verifyLabel,
  splitSubtext,
  wideNote,
  wideNoteLabel,
}: {
  facts: Fact[];
  locale: string;
  label: (key: string) => string;
  verifyLabel: string;
  /** Split " · ..." tails into `<small>` annotations (neighbourhood, costs). */
  splitSubtext?: boolean;
  /** Optional note rendered as a wide `fact--wide` row inside the grid
   *  (snapshot's building note pattern). */
  wideNote?: Localized;
  wideNoteLabel?: string;
}) {
  return (
    <div className="facts fx">
      {facts.map((f, i) => (
        <div
          className={`fact${f.accent ? " fact--em" : ""}`}
          key={`${f.labelKey}-${i}`}
        >
          <div className="fact__k">
            {label(f.labelKey)}
            {f.toVerify ? <span className="toverify">{verifyLabel}</span> : null}
          </div>
          <div className="fact__v">
            <FactValue value={L(f.value, locale)} splitSubtext={splitSubtext} />
          </div>
        </div>
      ))}
      {wideNote ? (
        <div className="fact fact--wide">
          {wideNoteLabel ? (
            <div className="fact__k">{wideNoteLabel}</div>
          ) : null}
          <div
            className="fact__v"
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: "var(--pw-ink-700)",
              lineHeight: 1.5,
              marginTop: wideNoteLabel ? 6 : 0,
            }}
          >
            {L(wideNote, locale)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Definition-list rendered inside a `.panel`. Used by the building "The
 *  building" panel and both subsidies panels. */
function DefList({ items, locale }: { items: TermDef[]; locale: string }) {
  return (
    <dl className="deflist">
      {items.map((it, i) => (
        <div key={i}>
          <dt>{L(it.term, locale)}</dt>
          <dd>{L(it.def, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Bulleted check-list with the design's blue checkmarks. */
function ChecksList({
  items,
  locale,
}: {
  items: Localized[];
  locale: string;
}) {
  return (
    <ul className="checklist">
      {items.map((it, i) => (
        <li key={i}>
          <IcCheck />
          <span>{L(it, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Legacy renderer: a pair of prose panels (older stored reports written
 *  before the Package-3 reshape). Tolerant of `panels` being undefined. */
function PanelPair({
  panels,
  locale,
}: {
  panels: Report["building"]["panels"];
  locale: string;
}) {
  if (!panels || panels.length === 0) return null;
  return (
    <div className="panels2 fx">
      {panels.map((p, i) => (
        <div className="panel" key={i}>
          <p className="panel__h">
            <span className="k">{L(p.heading, locale)}</span>
          </p>
          <p style={PANEL_BODY}>{L(p.body, locale)}</p>
        </div>
      ))}
    </div>
  );
}

/** A negotiation ground tolerates both the new `{title,desc}` shape and the
 *  legacy flat `Localized` shape stored on older reports. */
function reasonParts(r: NegReason | Localized): { title?: Localized; desc: Localized } {
  if (r && typeof r === "object" && "desc" in r && "title" in r) {
    return { title: r.title, desc: r.desc };
  }
  return { desc: r as Localized };
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
  const overall = report.verdict.overall;

  const priceLabel = new Intl.NumberFormat(
    locale === "en" ? "en-IE" : locale === "ca" ? "ca-ES" : "es-ES",
    { style: "currency", currency: pricing.currency, maximumFractionDigits: 0 },
  ).format(reportPriceEur());

  const dateFmt = new Intl.DateTimeFormat(
    locale === "es" ? "es-ES" : locale === "ca" ? "ca-ES" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" },
  ).format(new Date(report.generatedAt));

  const sourceChips = t.raw("rep.sourceChips") as string[];

  return (
    <div className="rp">
      {/* print-only brand header (shown only in the PDF) */}
      <div className="print-only print-brand">
        {brand.wordmark.primary}
        <b>{brand.wordmark.accent}</b>
        <span style={{ fontWeight: 500, color: "var(--pw-ink-500)", marginLeft: 6 }}>
          · {t("report.eyebrow")} · {report.hero.title} · {dateFmt}
        </span>
      </div>

      {/* Save PDF lives in the topbar (route-level), not in the body. */}

      <main className="doc">
        {/* ===================== HERO ===================== */}
        <section className="r-main r-hero">
          <p className="r-hero__eyebrow">
            <span className="dot" />
            <span className="full">{t("report.eyebrow")} · {dateFmt}</span>
            <span className="short">{dateFmt}</span>
          </p>
          <h1>{report.hero.title}</h1>
          <p className="r-hero__floor fig">{L(report.hero.floorLabel, locale)}</p>
          <p className="r-hero__sub">{L(report.hero.sub, locale)}</p>
          <div className="metastrip">
            {report.hero.meta.map((m) => (
              <div className="metastrip__cell" key={m.labelKey}>
                <div className="metastrip__k">{t(m.labelKey)}</div>
                <div className="metastrip__v fig">{L(m.value, locale)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ===================== ALERTS (both states) ===================== */}
        {report.alerts && report.alerts.length > 0 ? (
          <section className="r-main r-sec r-sec--flush" aria-label={t("alerts.label")}>
            <div className="alerts fx">
              {report.alerts.map((a, i) => (
                <div className={`alert alert--${a.tone}`} key={i}>
                  <span className="alert__ic">
                    <ToneIcon kind={a.tone === "caution" ? "triangle" : "info"} />
                  </span>
                  <div>
                    <p className="alert__t">{L(a.title, locale)}</p>
                    <p className={preview ? "alert__found" : "alert__full"}>
                      {L(preview && a.previewDetail ? a.previewDetail : a.detail, locale)}
                    </p>
                    {preview ? (
                      <p className="alert__locked">
                        <IcLock />
                        {t("rep.alertLocked")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ===================== BOTTOM LINE ===================== */}
        <section className="r-main r-sec">
          <div className="verdict fx">
            <div className="verdict__body measure">
              <p className="r-eyebrow">
                <span className="dot" />
                <span>{t("rep.verdictEyebrow")}</span>
              </p>
              <h2>{L(report.verdict.headline, locale)}</h2>
              <p>{L(report.verdict.body, locale)}</p>
              {preview ? (
                <p className="verdict-note">{t("rep.verdictPreviewNote")}</p>
              ) : null}
            </div>
            <div className="verdict__ring">
              <Ring value={overall} size="lg" suffix={t("rep.ringOf")} />
              <p className="verdict__caption">{t("rep.overallCaption")}</p>
            </div>
          </div>
        </section>

        {/* ===================== 01 SCORES ===================== */}
        <section className="r-main r-sec">
          <SectionHead
            idx="01"
            label={t("sections.scores")}
            head={t("rep.scoresHead")}
            lede={t("rep.scoresLede")}
          />
          <div className="scores fx">
            {report.scores.map((s) => {
              const band = bandFor(s.value);
              const cap = band === "good" ? "Good" : band === "ok" ? "Ok" : "Low";
              return (
                <div className="scorecard" key={s.key}>
                  <Ring value={s.value} size="sm" />
                  <div className="scorecard__label">{t(`scoreNames.${s.key}`)}</div>
                  <span className={`scoreband scoreband--${band}`}>
                    <span className="pip" />
                    {t(`rep.bandShort${cap}`)}
                  </span>
                  {preview ? null : (
                    <p className="scorecard__cap">{L(s.caption, locale)}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="bandlegend fx">
            <span>
              <span className="pip" style={{ background: "var(--pw-clear)" }} />
              {t("rep.bandGood")}
            </span>
            <span>
              <span className="pip" style={{ background: "var(--pw-check)" }} />
              {t("rep.bandOk")}
            </span>
            <span>
              <span className="pip" style={{ background: "var(--pw-caution)" }} />
              {t("rep.bandLow")}
            </span>
          </div>
        </section>

        {/* ===================== 02 SNAPSHOT ===================== */}
        <section className="r-main r-sec">
          <SectionHead idx="02" label={t("sections.snapshot")} head={t("rep.snapshotHead")} />
          <FactGrid
            facts={report.snapshot.facts}
            locale={locale}
            label={(k) => t(k)}
            verifyLabel={t("common.toVerify")}
            wideNote={report.snapshot.note}
            wideNoteLabel={t("rep.buildingNoteLabel")}
          />
        </section>

        {/* ===================== GATE (preview only) ===================== */}
        {preview ? (
          <section className="r-main r-sec gate" aria-label={t("rep.gate.head")}>
            <div className="gate__card">
              <span className="gate__lock">
                <IcLock />
              </span>
              <p className="gate__eyebrow">{t("rep.gate.eyebrow")}</p>
              <h2>{t("rep.gate.head")}</h2>
              <p className="gate__sub">{t("rep.gate.sub")}</p>
              <div className="gate__locked">
                <p className="gate__locked-h">{t("rep.gate.lockedH")}</p>
                <ul className="gate__list">
                  {(t.raw("rep.gate.items") as string[]).map((it, i) => (
                    <li key={i}>
                      <IcCheck />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="gate__buy">
                <div className="gate__price fig">
                  {priceLabel} <small>{t("rep.gate.priceSuffix")}</small>
                </div>
                {reportId ? (
                  <UnlockButton
                    reportId={reportId}
                    locale={locale}
                    label={t("rep.gate.cta")}
                    pendingLabel="…"
                  />
                ) : null}
              </div>
              <p className="gate__note">{t("rep.gate.note")}</p>
            </div>
          </section>
        ) : null}

        {/* ===================== FULL REPORT (below the gate) ===================== */}
        {!preview ? (
          <>
            {/* 03 PRICE & VALUE */}
            <section className="r-main r-sec fx">
              {report.price.pricing ? (
                <PriceSection pricing={report.price.pricing} locale={locale} t={t} />
              ) : (
                <>
                  <SectionHead idx="03" label={t("sections.price")} head={t("rep.priceHead")} />
                  <p className="lede measure">{L(report.price.lede, locale)}</p>
                </>
              )}
            </section>

            {/* 04 PLANNING & RESTRICTIONS */}
            <section className="r-main r-sec fx">
              <SectionHead
                idx="04"
                label={t("sections.urbanism")}
                head={t("rep.planningHead")}
                lede={t("rep.planningLede")}
              >
                <div className="bandlegend" style={{ marginTop: 18 }}>
                  <span>
                    <span className="pip" style={{ background: "var(--pw-caution)" }} />
                    {t("rep.planKeyAffected")}
                  </span>
                  <span>
                    <span className="pip" style={{ background: "var(--pw-check)" }} />
                    {t("rep.planKeyRestriction")}
                  </span>
                  <span>
                    <span className="pip" style={{ background: "var(--pw-clear)" }} />
                    {t("rep.planKeyClear")}
                  </span>
                </div>
              </SectionHead>
              <div className="statuslist">
                {[...report.urbanism.items]
                  .sort((a, b) => PLAN_ORDER[a.tone] - PLAN_ORDER[b.tone])
                  .map((it) => (
                    <div className={`srow srow--${it.tone}`} key={it.key}>
                      <span className="srow__ic">
                        <ToneIcon kind={PLAN_ICON[it.tone]} />
                      </span>
                      <div className="srow__main">
                        <div className="srow__top">
                          <p className="srow__t">{L(it.label, locale)}</p>
                          <span className="srow__tag">
                            {it.tag ? L(it.tag, locale) : t(`planTone.${it.tone}`)}
                          </span>
                        </div>
                        <p className="srow__d">{L(it.text, locale)}</p>
                      </div>
                    </div>
                  ))}
              </div>
              <p className="disclaimer">
                <IcDisc />
                <span>{t("rep.planDisclaimer")}</span>
              </p>
            </section>

            {/* 05 BUILDING & CONDITION */}
            <section className="r-main r-sec fx">
              <SectionHead idx="05" label={t("sections.building")} head={t("rep.buildingHead")} />
              {report.building.facts && report.building.checks ? (
                <div className="panels2 fx">
                  <div className="panel">
                    <p className="panel__h">
                      <span className="k">{t("rep.theBuildingLabel")}</span>
                    </p>
                    <DefList items={report.building.facts} locale={locale} />
                  </div>
                  <div className="panel">
                    <p className="panel__h">
                      <span className="k">{t("rep.whatToCheckLabel")}</span>
                    </p>
                    <ChecksList items={report.building.checks} locale={locale} />
                  </div>
                </div>
              ) : (
                <PanelPair panels={report.building.panels} locale={locale} />
              )}
              <p className="keyline measure">{L(report.building.keyline, locale)}</p>
            </section>

            {/* 06 RISK & SAFETY */}
            <section className="r-main r-sec fx">
              <SectionHead idx="06" label={t("sections.risks")} head={t("rep.riskHead")} />
              <div className="statuslist">
                {report.risks.map((r) => (
                  <div className={`srow srow--${r.tone}`} key={r.labelKey}>
                    <span className="srow__ic">
                      <ToneIcon kind={RISK_ICON[r.tone]} />
                    </span>
                    <div className="srow__main">
                      <div className="srow__top">
                        <p className="srow__t">{t(r.labelKey)}</p>
                        <span className="srow__tag">{t(`riskPill.${r.tone}`)}</span>
                      </div>
                      <p className="srow__d">{L(r.detail, locale)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 07 NEIGHBOURHOOD */}
            <section className="r-main r-sec fx">
              <SectionHead
                idx="07"
                label={t("sections.neighbourhood")}
                head={t("rep.neighbourhoodHead")}
                lede={L(report.neighbourhood.lede, locale)}
              />
              <FactGrid
                facts={report.neighbourhood.facts}
                locale={locale}
                label={(k) => t(k)}
                verifyLabel={t("common.toVerify")}
                splitSubtext
              />
              <p className="note measure" style={{ marginTop: 16 }}>
                {L(report.neighbourhood.note, locale)}
              </p>
            </section>

            {/* 08 COSTS & TAXES */}
            <section className="r-main r-sec fx">
              <SectionHead
                idx="08"
                label={t("sections.costs")}
                head={t("rep.costsHead")}
                lede={L(report.costs.intro, locale)}
              />
              <FactGrid
                facts={report.costs.facts}
                locale={locale}
                label={(k) => t(k)}
                verifyLabel={t("common.toVerify")}
                splitSubtext
              />
              <p className="note measure" style={{ marginTop: 16 }}>
                {L(report.costs.footnote, locale)}
              </p>
            </section>

            {/* 09 TAX & SUBSIDIES */}
            <section className="r-main r-sec fx">
              <SectionHead idx="09" label={t("sections.subsidies")} head={t("rep.subsidiesHead")} />
              {report.subsidies.deductions && report.subsidies.takeOn ? (
                <div className="panels2 fx">
                  <div className="panel">
                    <p className="panel__h">
                      <span className="k">{t("rep.deductionsLabel")}</span>
                    </p>
                    <DefList items={report.subsidies.deductions} locale={locale} />
                  </div>
                  <div className="panel">
                    <p className="panel__h">
                      <span className="k">{t("rep.takeOnLabel")}</span>
                    </p>
                    <DefList items={report.subsidies.takeOn} locale={locale} />
                  </div>
                </div>
              ) : (
                <PanelPair panels={report.subsidies.panels} locale={locale} />
              )}
            </section>

            {/* 10 NEGOTIATION PLAYBOOK */}
            <section className="r-main r-sec fx">
              <SectionHead
                idx="10"
                label={t("sections.negotiation")}
                head={t("rep.negotiationHead")}
                lede={L(report.negotiation.intro, locale)}
              />
              <div className="reasons">
                {(report.negotiation.items as (NegReason | Localized)[]).map((raw, i) => {
                  const { title, desc } = reasonParts(raw);
                  return (
                    <div className="reason" key={i}>
                      <span className="reason__n fig" />
                      <div>
                        {title ? <p className="reason__t">{L(title, locale)}</p> : null}
                        <p className="reason__d">{L(desc, locale)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="tactic">
                <p className="tactic__k">{t("rep.tacticLabel")}</p>
                <p>{L(report.negotiation.tactic, locale)}</p>
              </div>
            </section>

            {/* 11 BEFORE YOU OFFER (hub) */}
            <section className="r-main r-sec fx">
              <SectionHead idx="11" label={t("sections.checklist")} head={t("rep.beforeHead")} />
              <div className="hub">
                <div className="panel">
                  <p className="panel__h">
                    <span className="k">{t("rep.onSiteLabel")}</span>
                  </p>
                  <ul className="actions">
                    {report.checklist.map((item, i) => (
                      <li key={i}>
                        <span className="n fig">{i + 1}</span>
                        <span>{L(item, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="panel docs">
                  <p className="panel__h">
                    <span className="k">{t("rep.docsLabel")}</span>
                  </p>
                  <ul className="doclist">
                    {(t.raw("rep.docs") as { term: string; gloss: string }[]).map((d, i) => (
                      <li key={i}>
                        <IcFile />
                        <span>
                          <span className="dl-term term">{d.term}</span>{" "}
                          <span className="dl-gloss">{d.gloss}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="docs__future">
                    <IcUpload />
                    <span>{t("rep.docsFuture")}</span>
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {/* ===================== FOOTER (both states) ===================== */}
        <footer className="r-main r-foot">
          <p className="r-eyebrow">
            <span className="dot" />
            <span>{t("rep.footSources")}</span>
          </p>
          <div className="r-foot__sources">
            {sourceChips.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <p className="r-foot__disc">{L(report.footer.disclaimer, locale)}</p>
          <div className="r-foot__meta">
            <span style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
              {brand.wordmark.primary}
              <span style={{ color: "var(--pw-blue)" }}>{brand.wordmark.accent}</span>
            </span>
            <span className="fig">{t("footer.generated", { date: dateFmt })}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
