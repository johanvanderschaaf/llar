import { getTranslations } from "next-intl/server";
import type { Report, Fact, Localized } from "@/types/report";
import { bandFor } from "@/config/scoring";
import { L } from "@/lib/localized";

/* ---------- small presentational helpers ---------- */

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
}: {
  report: Report;
  locale: string;
}) {
  const t = await getTranslations();
  const dateFmt = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(report.generatedAt));

  return (
    <div className="wrap">
      {/* HERO */}
      <header className="hero fx">
        <div className="eyebrow">{t("hero.eyebrow")}</div>
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
        <div className="lab">{t("verdict.label")}</div>
        <h2 className="serif">{L(report.verdict.headline, locale)}</h2>
        <p>{L(report.verdict.body, locale)}</p>
        <div className="vscore">
          <b>{report.verdict.overall}</b>
          <span>{t("verdict.overallSuffix")}</span>
        </div>
        <div>
          <span className="vtag">{L(report.verdict.tag, locale)}</span>
        </div>
      </div>

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

      {/* 03 PRICE & VALUE */}
      <section className="fx">
        <SectionHead
          num="03"
          title={t("sections.price")}
          note={t("sections.priceNote")}
        />
        <p className="lede">{L(report.price.lede, locale)}</p>
        <div className="grid-2" style={{ marginBottom: 24 }}>
          {report.price.panels.map((p, i) => (
            <div className="panel" key={i}>
              <h3 className="serif">{L(p.heading, locale)}</h3>
              <p>{L(p.body, locale)}</p>
            </div>
          ))}
        </div>

        <h3 className="serif" style={{ fontSize: 17, margin: "6px 0 2px" }}>
          {t("price.benchHeading")}
        </h3>
        <table>
          <thead>
            <tr>
              <th>{t("price.table.reference")}</th>
              <th className="num">{t("price.table.price")}</th>
              <th className="num">{t("price.table.size")}</th>
              <th className="num">{t("price.table.perM2")}</th>
              <th>{t("price.table.note")}</th>
            </tr>
          </thead>
          <tbody>
            {report.price.comps.map((c, i) => (
              <tr key={i} className={c.highlight ? "highlight" : undefined}>
                <td>
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent-deep)", fontWeight: 600 }}
                    >
                      {L(c.reference, locale)} ↗
                    </a>
                  ) : (
                    L(c.reference, locale)
                  )}
                </td>
                <td className="num">{c.price ?? "—"}</td>
                <td className="num">{c.size ?? "—"}</td>
                <td className="num">{c.pricePerM2 ?? "—"}</td>
                <td>{L(c.note, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="keyline">{L(report.price.fairValue, locale)}</div>

        <h3 className="serif" style={{ fontSize: 17, margin: "22px 0 6px" }}>
          {t("price.ladderHeading")}
        </h3>
        <div className="ladder">
          {report.price.ladder.map((r) => (
            <div
              className={`rung${r.kind === "target" ? " target" : ""}`}
              key={r.kind}
            >
              <div className="lab">{t(`price.ladder.${r.kind}`)}</div>
              <div className="amt">{r.amount}</div>
              <div className="pm">{L(r.rationale, locale)}</div>
            </div>
          ))}
        </div>

        {report.price.references && report.price.references.length > 0 ? (
          <>
            <h3 className="serif" style={{ fontSize: 17, margin: "22px 0 2px" }}>
              {t("price.referencesHeading")}
            </h3>
            <p
              className="body"
              style={{ fontSize: 14, color: "var(--muted)", marginBottom: 10 }}
            >
              {t("price.referencesNote")}
            </p>
            <ul className="check" style={{ gap: 8 }}>
              {report.price.references.map((ref, i) => (
                <li key={i} style={{ paddingLeft: 22 }}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent-deep)", fontWeight: 600 }}
                  >
                    {L(ref.label, locale)}
                  </a>{" "}
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    · {t(`price.refKind.${ref.kind}`)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {/* 04 BUILDING & CONDITION */}
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

      {/* 06 LEGAL */}
      <section className="fx">
        <SectionHead num="06" title={t("sections.legal")} />
        <p className="body">{L(report.legal.intro, locale)}</p>
        <Checklist items={report.legal.items} locale={locale} />
      </section>

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
        <p className="body">{L(report.urbanism.body, locale)}</p>
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

      {/* 11 NEGOTIATION */}
      <section className="fx">
        <SectionHead num="11" title={t("sections.negotiation")} />
        <p className="body">{L(report.negotiation.intro, locale)}</p>
        <Checklist items={report.negotiation.items} locale={locale} />
        <div className="keyline" style={{ marginTop: 20 }}>
          {L(report.negotiation.tactic, locale)}
        </div>
      </section>

      {/* 12 CHECKLIST */}
      <section className="fx">
        <SectionHead num="12" title={t("sections.checklist")} />
        <Checklist items={report.checklist} locale={locale} />
      </section>

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
