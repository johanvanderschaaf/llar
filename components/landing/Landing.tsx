import { getTranslations } from "next-intl/server";
import { Link, PRIMARY_CTA_HREF } from "@/i18n/navigation";
import { brand, pricing } from "@/config/brand";
import { Mark, Wordmark } from "@/components/Brand";
import { LandingNav } from "./LandingNav";
import { RevealScript } from "./RevealScript";
import {
  ArrowIcon,
  ShieldCheckIcon,
  ScoresIcon,
  PlanningIcon,
  HeritageIcon,
  PriceTrendIcon,
  RisksIcon,
  PriceValueIcon,
  BuildingIcon,
  LegalIcon,
  NeighbourhoodIcon,
  EnergyIcon,
  PlusIcon,
  InfoIcon,
} from "./icons";

const SAMPLE = "/report/sample-sors35";
const PARTNERS = "/partners";
/** Source names are proper nouns — never translated. */
const SOURCES = ["Catastro", "ICAEN", "Mapa Urbanístic", "SNCZI", "Ajuntament BCN"];

/** Fixed tone + icon per proof card (structural, not translated). */
const PROOF_META = [
  { mod: "story--caution", Icon: PlanningIcon },
  { mod: "story--check", Icon: HeritageIcon },
  { mod: "story--neutral", Icon: PriceTrendIcon },
] as const;

/** Fixed modifier + icon per report card (the dark "5 scores" card is separate). */
const CARD_META = [
  { mod: "ct--feature", Icon: PlanningIcon },
  { mod: "ct--feature", Icon: RisksIcon },
  { mod: "ct--std", Icon: PriceValueIcon },
  { mod: "ct--std", Icon: BuildingIcon },
  { mod: "ct--std", Icon: LegalIcon },
  { mod: "ct--std", Icon: NeighbourhoodIcon },
  { mod: "ct--std", Icon: EnergyIcon },
] as const;

interface ProofItem {
  tag: string;
  h3: string;
  p: string;
}
interface Card {
  h4: string;
  p: string;
}
interface Step {
  n: string;
  h4: string;
  p: string;
}
interface Faq {
  q: string;
  a: string;
}

/**
 * Split the localized price into currency symbol + number in the locale's
 * own order (EN → €49, CA/ES → 49 €), plus the full formatted string for
 * interpolation. Keeps `config/brand.ts` the single source of price truth.
 */
function priceInfo(locale: string) {
  const tag = locale === "en" ? "en-IE" : locale === "ca" ? "ca-ES" : "es-ES";
  const fmt = new Intl.NumberFormat(tag, {
    style: "currency",
    currency: pricing.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const parts = fmt.formatToParts(pricing.reportPriceEur);
  const currency = parts.find((p) => p.type === "currency")?.value ?? "€";
  const number = parts
    .filter((p) => p.type === "integer" || p.type === "group" || p.type === "decimal")
    .map((p) => p.value)
    .join("");
  const curIdx = parts.findIndex((p) => p.type === "currency");
  const numIdx = parts.findIndex((p) => p.type === "integer");
  return { currency, number, currencyFirst: curIdx < numIdx, full: fmt.format(pricing.reportPriceEur) };
}

export async function Landing({ locale }: { locale: string }) {
  const t = await getTranslations("landing");
  const { currency, number, currencyFirst, full: price } = priceInfo(locale);
  const proof = t.raw("proof.items") as ProofItem[];
  const chips = t.raw("report.scores.chips") as string[];
  const cards = t.raw("report.cards") as Card[];
  const steps = t.raw("how.steps") as Step[];
  const faqs = t.raw("faq.items") as Faq[];
  const year = new Date().getFullYear();

  return (
    <div className="lp">
      <LandingNav />

      <main id="top">
        {/* 1 · HERO */}
        <section className="hero">
          <div className="wrap hero__grid">
            <div className="hero__content reveal in">
              <span className="eyebrow">
                <span className="dot" />
                {t("hero.eyebrow")}
              </span>
              <h1>{t.rich("hero.h1", { em: (c) => <em>{c}</em> })}</h1>
              <p className="hero__sub">{t("hero.sub")}</p>
              <div className="hero__cta">
                <Link href={PRIMARY_CTA_HREF} className="btn btn-primary">
                  {t("cta.check")}
                  <ArrowIcon />
                </Link>
                <Link href={SAMPLE} className="btn btn-ghost">
                  {t("cta.sample")}
                </Link>
              </div>
              <div className="trust">
                <div className="trust__label">
                  <ShieldCheckIcon />
                  {t("trust.label")}
                </div>
                <div className="trust__chips">
                  {SOURCES.map((s) => (
                    <span className="src-chip" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
                <p className="trust__note">{t("trust.note")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 · PROOF */}
        <section className="band" id="proof">
          <div className="wrap">
            <div className="band__head reveal">
              <span className="eyebrow">
                <span className="idx">02</span>
                <span className="dot" />
                {t("proof.eyebrow")}
              </span>
              <h2>{t("proof.h2")}</h2>
              <p className="band__note">{t("proof.note")}</p>
            </div>
            <div className="proof">
              {proof.map((item, i) => {
                const { mod, Icon } = PROOF_META[i];
                return (
                  <article className={`story ${mod} reveal`} key={item.h3}>
                    <div className="story__tag">
                      <span className="story__ic">
                        <Icon />
                      </span>
                      <span className="story__cat">{item.tag}</span>
                    </div>
                    <h3>{item.h3}</h3>
                    <p>{item.p}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3 · WHAT'S IN THE REPORT */}
        <section className="band" id="report">
          <div className="wrap">
            <div className="band__head reveal">
              <span className="eyebrow">
                <span className="idx">03</span>
                <span className="dot" />
                {t("report.eyebrow")}
              </span>
              <h2>{t("report.h2")}</h2>
              <p className="band__note">{t("report.note")}</p>
            </div>
            <div className="contents">
              <div className="ct ct--scores reveal">
                <div className="ct__ic">
                  <ScoresIcon />
                </div>
                <h4>{t("report.scores.h4")}</h4>
                <p>{t("report.scores.p")}</p>
                <div className="scores-mini">
                  {chips.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
              {cards.map((card, i) => {
                const { mod, Icon } = CARD_META[i];
                return (
                  <div className={`ct ${mod} reveal`} key={card.h4}>
                    <div className="ct__ic">
                      <Icon />
                    </div>
                    <h4>{card.h4}</h4>
                    <p>{card.p}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4 · HOW IT WORKS */}
        <section className="band" id="how">
          <div className="wrap">
            <div className="band__head reveal">
              <span className="eyebrow">
                <span className="idx">04</span>
                <span className="dot" />
                {t("how.eyebrow")}
              </span>
              <h2>{t("how.h2")}</h2>
            </div>
            <div className="steps">
              {steps.map((step, i) => (
                <div className={`step${i === 0 ? " is-1" : ""} reveal`} key={step.h4}>
                  <span className="step__n">{step.n}</span>
                  <h4>{step.h4}</h4>
                  <p>{step.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 · INDEPENDENCE */}
        <section className="band" id="independence">
          <div className="wrap statement reveal">
            <div className="statement__lead">{t("indep.lead")}</div>
            <div className="statement__body">
              <p>{t.rich("indep.body", { strong: (c) => <strong>{c}</strong> })}</p>
            </div>
          </div>
        </section>

        {/* 6 · NEVER INVENT A PRICE */}
        <section className="band" id="price-honesty">
          <div className="wrap statement reveal">
            <div className="statement__lead">{t("ph.lead")}</div>
            <div className="statement__body">
              <p>{t.rich("ph.body", { strong: (c) => <strong>{c}</strong> })}</p>
              <div className="rangeline" aria-hidden>
                <div className="rangeline__track">
                  <div className="rangeline__fill" />
                </div>
                <div className="rangeline__labs">
                  <span>{t("ph.range.low")}</span>
                  <span>{t("ph.range.mid")}</span>
                  <span>{t("ph.range.high")}</span>
                </div>
                <div className="rangeline__cap">
                  <InfoIcon />
                  <span>{t("ph.range.cap")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 · PARTNER */}
        <section className="band" id="partners">
          <div className="wrap">
            <div className="partner reveal">
              <div className="partner__c">
                <span className="eyebrow">
                  <span className="dot" />
                  {t("partner.eyebrow")}
                </span>
                <h2>{t("partner.h2")}</h2>
                <p>{t("partner.p")}</p>
              </div>
              <div className="partner__cta">
                <Link href={PARTNERS} className="btn">
                  {t("cta.partner")}
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 8 · PRICING */}
        <section className="band" id="pricing">
          <div className="wrap">
            <div className="band__head reveal" style={{ textAlign: "center", margin: "0 auto" }}>
              <span className="eyebrow" style={{ justifyContent: "center" }}>
                <span className="idx">08</span>
                <span className="dot" />
                {t("pricing.eyebrow")}
              </span>
            </div>
            <div className="pricing" style={{ marginTop: 24 }}>
              <div className="price-card reveal">
                <h2>{t("pricing.h2")}</h2>
                <div className="amount fig">
                  {currencyFirst ? (
                    <>
                      <span className="cur">{currency}</span>
                      <span className="num">{number}</span>
                    </>
                  ) : (
                    <>
                      <span className="num">{number}</span>
                      <span className="cur">{currency}</span>
                    </>
                  )}
                </div>
                <p className="desc">{t("pricing.desc", { price })}</p>
                <Link href={PRIMARY_CTA_HREF} className="btn btn-primary">
                  {t("cta.check")}
                  <ArrowIcon />
                </Link>
                <p className="free-note">{t("pricing.note")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 9 · FAQ */}
        <section className="band" id="faq">
          <div className="wrap">
            <div className="band__head reveal">
              <span className="eyebrow">
                <span className="idx">09</span>
                <span className="dot" />
                {t("faq.eyebrow")}
              </span>
              <h2>{t("faq.h2")}</h2>
            </div>
            <div className="faq-grid reveal">
              {faqs.map((f, i) => (
                <details className="faq" key={f.q}>
                  <summary>
                    <span>{f.q}</span>
                    <span className="faq__icon">
                      <PlusIcon />
                    </span>
                  </summary>
                  <p className="faq__body">
                    {t.rich(`faq.items.${i}.a`, {
                      strong: (c) => <strong>{c}</strong>,
                      price,
                    })}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 10 · FOOTER */}
      <footer className="footer">
        <div className="wrap">
          <div className="footer__grid">
            <Link href="/" className="pw-lockup" aria-label={brand.name}>
              <Mark size={28} />
              <Wordmark />
            </Link>
            <nav className="footer__links" aria-label="Footer">
              <a href="#">{t("footer.privacy")}</a>
              <a href="#">{t("footer.terms")}</a>
              <Link href={PARTNERS}>{t("footer.pros")}</Link>
            </nav>
          </div>
          <p className="footer__disc">{t("footer.disc")}</p>
          <p className="footer__copy">
            © {year} {brand.name}
          </p>
        </div>
      </footer>

      <RevealScript />
    </div>
  );
}
