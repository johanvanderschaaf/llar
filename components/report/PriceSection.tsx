import type { getTranslations } from "next-intl/server";
import type { Pricing, Localized } from "@/types/report";
import { L } from "@/lib/localized";
import { localizePeriod } from "@/lib/period";
import styles from "./PriceSection.module.css";

type T = Awaited<ReturnType<typeof getTranslations>>;
type Locale = Parameters<typeof L>[1];

interface Props {
  pricing: Pricing;
  locale: Locale;
  t: T;
}

const EUR = (n: number) => `€${Math.round(n).toLocaleString("en-GB")}`;

/**
 * Section 03 — "Price & value". Three data-conditional states:
 *  - `asking-known`         → verdict + number line + compare + evidence panel
 *  - `asking-unknown`       → verdict + number line (barri avg marker) + big-stat + evidence panel
 *  - `barri-unavailable`    → ⚠ alert + facts row + how-to-read + optional INE footnote
 *
 * Verdict and evidence strings come from the pipeline already localised
 * (CA/ES/EN) with inline `<span class="num">` / `<strong class="pct">`
 * markers, so the renderer pipes them through `dangerouslySetInnerHTML`.
 * That HTML is generated server-side from typed values — no user input.
 */
export function PriceSection({ pricing, locale, t }: Props) {
  return (
    <section className={styles.root}>
      <header className={styles.top}>
        <div className={styles.heading}>
          <span className={styles.num}>03</span>
          <span className={styles.title}>{t("sections.price")}</span>
        </div>
        <span className={styles.kicker}>{t("price.kicker")}</span>
      </header>

      {pricing.state === "barri-unavailable" ? (
        <UnavailableLayout pricing={pricing} locale={locale} t={t} />
      ) : (
        <MainLayout pricing={pricing} locale={locale} t={t} />
      )}
    </section>
  );
}

/* ---------------- State 01 + 02 ---------------- */

function MainLayout({ pricing: p, locale, t }: Props) {
  const chipClass =
    p.chip.tone === "clear"
      ? styles.chipClear
      : p.chip.tone === "check"
        ? styles.chipCheck
        : styles.chipNeutral;

  return (
    <div className={styles.grid}>
      {/* ---------- LEFT COLUMN ---------- */}
      <div className={styles.left}>
        <span className={`${styles.chip} ${chipClass}`}>
          {L(p.chip.text, locale)}
        </span>

        <div
          className={styles.verdict}
          dangerouslySetInnerHTML={{ __html: L(p.verdict, locale) }}
        />

        {p.range && p.markerPct != null && p.marker ? (
          <NumberLine
            range={p.range}
            markerPct={p.markerPct}
            marker={p.marker}
            barriImplied={p.barri?.impliedValue}
            t={t}
            showBarriAvg={p.state === "asking-known"}
          />
        ) : null}

        <div className={styles.humility}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 11v5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
          </svg>
          <div>
            <b>{t("price.humility.lead")}</b> {t("price.humility.body")}
          </div>
        </div>
      </div>

      {/* ---------- RIGHT COLUMN ---------- */}
      <div>
        {p.state === "asking-known" && p.asking && p.barri ? (
          <CompareGrid
            askingPerM2={p.asking.pricePerM2}
            barriPerM2={p.barri.pricePerM2}
            deltaPct={p.deltaPct ?? 0}
            t={t}
          />
        ) : null}

        {p.state === "asking-unknown" && p.barri ? (
          <BigStat
            barriName={p.barri.name}
            pricePerM2={p.barri.pricePerM2}
            implied={p.barri.impliedValue}
            builtM2={p.builtM2}
            locale={locale}
            t={t}
          />
        ) : null}

        {p.barri ? (
          <EvidencePanel barri={p.barri} locale={locale} t={t} />
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- The Number Line ---------------- */

function NumberLine({
  range,
  markerPct,
  marker,
  barriImplied,
  showBarriAvg,
  t,
}: {
  range: { lo: number; hi: number };
  markerPct: number;
  marker: { kind: "asking" | "barri-avg"; value: number };
  barriImplied?: number;
  showBarriAvg: boolean;
  t: T;
}) {
  const left = `${(markerPct * 100).toFixed(1)}%`;
  const isAsking = marker.kind === "asking";
  return (
    <div className={styles.scale}>
      <div className={styles.pinSlot}>
        <div className={styles.pinWrap} style={{ left }}>
          <div
            className={`${styles.pinLabel} ${isAsking ? styles.pinLabelAsking : styles.pinLabelBarri}`}
          >
            {isAsking ? t("price.pin.asking") : t("price.pin.barriAvg")}
          </div>
          <div
            className={`${styles.pinValue} ${isAsking ? styles.pinValueAsking : styles.pinValueBarri} ${styles.fig}`}
          >
            {EUR(marker.value)}
          </div>
        </div>
      </div>

      <div className={styles.track}>
        <div className={styles.avgTick} />
        <div
          className={`${styles.marker} ${isAsking ? styles.markerAsking : styles.markerBarri}`}
          style={{ left }}
        />
        {showBarriAvg && barriImplied != null ? (
          <div className={styles.avgLabel}>
            <div className="k">{t("price.barriAvgLabel")}</div>
            <div className={`v ${styles.fig}`}>{EUR(barriImplied)}</div>
          </div>
        ) : null}
      </div>

      <div className={styles.ends}>
        <div className={styles.end}>
          <span className="k">{t("price.rangeLow")}</span>
          <span className={`v ${styles.fig}`}>{EUR(range.lo)}</span>
        </div>
        <div className={`${styles.end} ${styles.endRight}`}>
          <span className="k">{t("price.rangeHigh")}</span>
          <span className={`v ${styles.fig}`}>{EUR(range.hi)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Compare grid (state 01) ---------------- */

function CompareGrid({
  askingPerM2,
  barriPerM2,
  deltaPct,
  t,
}: {
  askingPerM2: number;
  barriPerM2: number;
  deltaPct: number;
  t: T;
}) {
  const pillClass =
    Math.abs(deltaPct) < 5
      ? styles.pillClear
      : deltaPct < 0
        ? styles.pillClear
        : Math.abs(deltaPct) < 15
          ? styles.pillNeutral
          : styles.pillCheck;
  const arrowDown = deltaPct < 0;
  const abs = Math.abs(deltaPct).toFixed(0);
  const label = arrowDown
    ? t("price.delta.below", { n: abs })
    : Math.abs(deltaPct) < 1
      ? t("price.delta.equal")
      : t("price.delta.above", { n: abs });

  return (
    <div className={styles.compare}>
      <div className={`${styles.cmpKl} ${styles.cmpK}`}>
        {t("price.compare.askingLabel")}
      </div>
      <div className={`${styles.cmpKr} ${styles.cmpK}`}>
        {t("price.compare.barriLabel")}
      </div>
      <div className={`${styles.cmpVl} ${styles.cmpV} ${styles.fig}`}>
        €{Math.round(askingPerM2).toLocaleString("en-GB")}
        <small> /m²</small>
      </div>
      <div className={styles.cmpDelta}>
        <span className={`${styles.pill} ${pillClass} ${styles.fig}`}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{
              transform: arrowDown ? "none" : "rotate(180deg)",
            }}
            aria-hidden
          >
            <path
              d="M12 5v14M6 13l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {label}
        </span>
      </div>
      <div className={`${styles.cmpVr} ${styles.cmpV} ${styles.fig}`}>
        €{Math.round(barriPerM2).toLocaleString("en-GB")}
        <small> /m²</small>
      </div>
    </div>
  );
}

/* ---------------- Big-stat block (state 02) ---------------- */

function BigStat({
  barriName,
  pricePerM2,
  implied,
  builtM2,
  locale,
  t,
}: {
  barriName: string;
  pricePerM2: number;
  implied: number;
  builtM2?: number;
  locale: Locale;
  t: T;
}) {
  const sub: Localized = builtM2
    ? {
        en: `≈ ${EUR(implied)} for a ${builtM2} m² flat · registered at the notary, not asking prices`,
        es: `≈ ${EUR(implied)} para un piso de ${builtM2} m² · registrado en notaría, no precios de oferta`,
        ca: `≈ ${EUR(implied)} per a un pis de ${builtM2} m² · registrat al notari, no preus d'oferta`,
      }
    : {
        en: `Registered at the notary, not asking prices`,
        es: `Registrado en notaría, no precios de oferta`,
        ca: `Registrat al notari, no preus d'oferta`,
      };
  return (
    <div className={styles.bigStat}>
      <h4>
        {barriName} · {t("price.barriClosingAvg")}
      </h4>
      <div className={`${styles.big} ${styles.fig}`}>
        €{pricePerM2.toLocaleString("en-GB")}
        <small> /m²</small>
      </div>
      <p className={styles.bigSub}>{L(sub, locale)}</p>
    </div>
  );
}

/* ---------------- Evidence panel (states 01 + 02) ---------------- */

function EvidencePanel({
  barri,
  locale,
  t,
}: {
  barri: NonNullable<Pricing["barri"]>;
  locale: Locale;
  t: T;
}) {
  return (
    <div className={styles.evidence}>
      <h4>
        {barri.name} · {t("price.evidence.title")}
      </h4>
      <p className="sub">{t("price.evidence.sub")}</p>
      <div className={styles.evidenceRow}>
        <span className="lbl">{t("price.evidence.avgPerM2")}</span>
        <span className={`val ${styles.fig}`}>
          €{barri.pricePerM2.toLocaleString("en-GB")} /m²
        </span>
      </div>
      {barri.transactions != null ? (
        <div className={styles.evidenceRow}>
          <span className="lbl">{t("price.evidence.sales")}</span>
          <span className={`val ${styles.fig}`}>{barri.transactions}</span>
        </div>
      ) : null}
      {barri.avgSurfaceM2 != null ? (
        <div className={styles.evidenceRow}>
          <span className="lbl">{t("price.evidence.avgFlat")}</span>
          <span className={`val ${styles.fig}`}>{barri.avgSurfaceM2} m²</span>
        </div>
      ) : null}
      <div className={styles.evidenceRow}>
        <span className="lbl">{t("price.evidence.period")}</span>
        <span className={`val ${styles.fig}`}>
          {localizePeriod(barri.asOf, locale)}
        </span>
      </div>
      <p className={styles.source}>
        <b>{t("price.evidence.sourceLead")}</b> {t("price.evidence.sourceBody")}
      </p>
    </div>
  );
}

/* ---------------- State 03: barri unavailable ---------------- */

function UnavailableLayout({ pricing: p, locale, t }: Props) {
  return (
    <div className={styles.single}>
      <span className={`${styles.chip} ${styles.chipCheck}`}>
        {L(p.chip.text, locale)}
      </span>

      <div className={styles.alert}>
        <span className={styles.glyph}>⚠</span>
        <div>
          <h3>{L(p.verdict, locale)}</h3>
          <p>{t("price.unavailable.body")}</p>
        </div>
      </div>

      <div className={styles.facts}>
        {p.asking ? (
          <div className={styles.fact}>
            <div className="k">{t("price.facts.asking")}</div>
            <div className={`v ${styles.fig}`}>{EUR(p.asking.price)}</div>
          </div>
        ) : null}
        {p.builtM2 ? (
          <div className={styles.fact}>
            <div className="k">{t("price.facts.builtArea")}</div>
            <div className={`v ${styles.fig}`}>
              {p.builtM2} <small>m²</small>
            </div>
          </div>
        ) : null}
        {p.asking ? (
          <div className={styles.fact}>
            <div className="k">{t("price.facts.askingPerM2")}</div>
            <div className={`v ${styles.fig}`}>
              €{p.asking.pricePerM2.toLocaleString("en-GB")} <small>/m²</small>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.howTo}>
        <div className="h">{t("price.howTo.heading")}</div>
        <div className="step">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m16 16 4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div>{t("price.howTo.portals")}</div>
        </div>
        <div className="step">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m4 12 5 5L20 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>{t("price.howTo.askAgent")}</div>
        </div>
      </div>

      {p.ipvFootnote ? (
        <p className={styles.footnote}>{L(p.ipvFootnote, locale)}</p>
      ) : null}
    </div>
  );
}
