import type { getTranslations } from "next-intl/server";
import type { Pricing } from "@/types/report";
import { L } from "@/lib/localized";
import { localizePeriod } from "@/lib/period";

type T = Awaited<ReturnType<typeof getTranslations>>;
type Locale = Parameters<typeof L>[1];

interface Props {
  pricing: Pricing;
  locale: Locale;
  t: T;
}

/** Locale-aware EUR (symbol-after + dot thousands in CA/ES; € before in EN). */
function eur(n: number, locale: Locale): string {
  const tag = locale === "en" ? "en-IE" : locale === "ca" ? "ca-ES" : "es-ES";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}
function eurM2(n: number, locale: Locale): string {
  return `${eur(n, locale)} / m²`;
}

/**
 * Section 03 — "Price & value", rendered in the redesigned `.rp` document
 * language (number-line + compare + evidence). Returns the section's inner
 * content (sec-head + body); the caller wraps it in the `.r-sec` shell.
 *
 * Three data-conditional states:
 *  - `asking-known`      → verdict + number-line (asking arrow) + compare + evidence
 *  - `asking-unknown`    → verdict + number-line (barri-avg marker) + evidence
 *  - `barri-unavailable` → ⚠ verdict + asking facts + how-to-read
 *
 * The number-line axis is total € (range.lo/hi, markerPct, barri.impliedValue);
 * €/m² figures appear in the compare cells and evidence. `verdict` is pipeline
 * HTML built server-side from typed values, piped through dangerouslySetInnerHTML.
 */
export function PriceSection({ pricing: p, locale, t }: Props) {
  return (
    <>
      <div className="sec-head">
        <p className="r-eyebrow">
          <span className="idx">03</span>
          <span className="dot" />
          <span>{t("sections.price")}</span>
        </p>
        <h2>{t("rep.priceHead")}</h2>
        <p className="lede measure">{t("rep.priceLede")}</p>
      </div>

      {p.state === "barri-unavailable" ? (
        <Unavailable p={p} locale={locale} t={t} />
      ) : (
        <Main p={p} locale={locale} t={t} />
      )}
    </>
  );
}

/* ---------------- States 01 + 02 ---------------- */

function Main({ p, locale, t }: { p: Pricing; locale: Locale; t: T }) {
  const askingKnown = p.state === "asking-known";
  return (
    <>
      <div className="panel">
        <p
          className="price-verdict"
          dangerouslySetInnerHTML={{ __html: L(p.verdict, locale) }}
        />
        {p.verdictSub ? (
          <p
            className="price-sub"
            dangerouslySetInnerHTML={{ __html: L(p.verdictSub, locale) }}
          />
        ) : null}

        {p.range && p.markerPct != null ? (
          <div className="numline">
            <div className="numline__scale">
              <div className="numline__base" />
              <div className="numline__range" style={{ left: 0, right: 0 }} />
              <div className="numline__avg" style={{ left: "50%" }} />
              {askingKnown ? (
                <div
                  className="numline__ask"
                  style={{ left: `${(p.markerPct * 100).toFixed(1)}%` }}
                />
              ) : null}
            </div>
            <div className="numline__labels">
              {p.barri ? (
                <div className="nl-lab" style={{ left: "50%" }}>
                  <div className="v fig">{eur(p.barri.impliedValue, locale)}</div>
                  <div className="k">{t("price.barriAvgLabel")}</div>
                </div>
              ) : null}
              {askingKnown && p.asking ? (
                <div
                  className="nl-lab nl-lab--ask"
                  style={{ left: `${(p.markerPct * 100).toFixed(1)}%` }}
                >
                  <div className="v fig">{eur(p.asking.price, locale)}</div>
                  <div className="k">{t("price.compare.askingLabel")}</div>
                </div>
              ) : null}
            </div>
            <div className="numline__foot">
              <span className="fig">
                {eur(p.range.lo, locale)} · {t("price.rangeLow")}
              </span>
              <span className="fig">
                {eur(p.range.hi, locale)} · {t("price.rangeHigh")}
              </span>
            </div>
          </div>
        ) : null}

        {askingKnown && p.asking && p.barri ? (
          <div className="compare">
            <div className="compare__cell">
              <div className="compare__k">{t("price.compare.askingLabel")}</div>
              <div className="compare__v fig">{eur(p.asking.price, locale)}</div>
              <div className="compare__d fig">
                {eurM2(p.asking.pricePerM2, locale)}
                {p.builtM2 ? ` · ${p.builtM2} m²` : ""}
              </div>
            </div>
            <div className="compare__cell compare__cell--delta">
              <div className="compare__k">{t("price.compare.barriLabel")}</div>
              <div className="compare__v fig">{deltaLabel(p.deltaPct ?? 0, t)}</div>
              <div className="compare__d fig">
                ≈ {eur(Math.abs(p.asking.price - p.barri.impliedValue), locale)} ·{" "}
                {eur(p.barri.impliedValue, locale)}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {p.barri ? (
        <div className="evidence">
          <div className="facts">
            <div className="fact">
              <div className="fact__k">{t("price.evidence.avgPerM2")}</div>
              <div className="fact__v fig">{eurM2(p.barri.pricePerM2, locale)}</div>
            </div>
            {p.barri.transactions != null ? (
              <div className="fact">
                <div className="fact__k">{t("price.evidence.sales")}</div>
                <div className="fact__v fig">{p.barri.transactions}</div>
              </div>
            ) : null}
            <div className="fact">
              <div className="fact__k">{t("price.evidence.period")}</div>
              <div className="fact__v fig">
                {localizePeriod(p.barri.asOf, locale)}
              </div>
            </div>
            <div className="fact fact--wide">
              <div className="fact__k">{t("price.evidence.sourceLead")}</div>
              <div
                className="fact__v"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--pw-ink-700)",
                }}
              >
                {t("price.evidence.sourceBody")}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function deltaLabel(deltaPct: number, t: T): string {
  const abs = Math.abs(deltaPct).toFixed(0);
  if (Math.abs(deltaPct) < 1) return t("price.delta.equal");
  return deltaPct < 0
    ? t("price.delta.below", { n: abs })
    : t("price.delta.above", { n: abs });
}

/* ---------------- State 03: barri unavailable ---------------- */

function Unavailable({ p, locale, t }: { p: Pricing; locale: Locale; t: T }) {
  return (
    <div className="panel">
      <p className="price-verdict">⚠ {L(p.verdict, locale)}</p>
      <p className="price-sub">{t("price.unavailable.body")}</p>

      {p.asking || p.builtM2 ? (
        <div className="facts" style={{ marginTop: 8 }}>
          {p.asking ? (
            <div className="fact">
              <div className="fact__k">{t("price.facts.asking")}</div>
              <div className="fact__v fig">{eur(p.asking.price, locale)}</div>
            </div>
          ) : null}
          {p.builtM2 ? (
            <div className="fact">
              <div className="fact__k">{t("price.facts.builtArea")}</div>
              <div className="fact__v fig">
                {p.builtM2} <small>m²</small>
              </div>
            </div>
          ) : null}
          {p.asking ? (
            <div className="fact">
              <div className="fact__k">{t("price.facts.askingPerM2")}</div>
              <div className="fact__v fig">
                {eurM2(p.asking.pricePerM2, locale)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="keyline measure">
        <b>{t("price.howTo.heading")}.</b> {t("price.howTo.portals")}{" "}
        {t("price.howTo.askAgent")}
      </p>
      {p.ipvFootnote ? (
        <p className="note measure" style={{ marginTop: 12 }}>
          {L(p.ipvFootnote, locale)}
        </p>
      ) : null}
    </div>
  );
}
