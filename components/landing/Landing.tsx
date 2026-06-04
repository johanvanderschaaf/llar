import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { brand, pricing } from "@/config/brand";
import { Mark, Wordmark } from "@/components/Brand";

interface Item {
  title: string;
  desc: string;
}
interface Faq {
  q: string;
  a: string;
}

const SAMPLE = "/report/sample-sors35";
const SOURCES = ["Catastro", "ICAEN", "Mapa Urbanístic", "SNCZI", "Ajuntament BCN"];

function formatPrice(locale: string): string {
  const tag = locale === "en" ? "en-IE" : locale === "ca" ? "ca-ES" : "es-ES";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: pricing.currency,
  }).format(pricing.reportPriceEur);
}

export async function Landing({ locale }: { locale: string }) {
  const t = await getTranslations("landing");
  const price = formatPrice(locale);
  const what = t.raw("what.items") as Item[];
  const steps = t.raw("how.steps") as Item[];
  const why = t.raw("why.items") as Item[];
  const faqs = t.raw("faq.items") as Faq[];
  const year = new Date().getFullYear();

  return (
    <main>
      {/* HERO */}
      <section className="lp-hero">
        <div className="wrap">
          <div className="eyebrow">{t("hero.eyebrow")}</div>
          <h1 className="serif lp-h1">{t("hero.title")}</h1>
          <p className="lp-sub">{t("hero.sub")}</p>
          <div className="lp-cta-row">
            <Link href={SAMPLE} className="btn btn-primary">
              {t("hero.ctaPrimary")}
            </Link>
            <a href="#how" className="btn btn-ghost">
              {t("hero.ctaSecondary")}
            </a>
          </div>
          <div className="lp-trust">
            <span className="lp-trust-title">{t("trust.title")}</span>
            <div className="lp-sources">
              {SOURCES.map((s) => (
                <span key={s} className="lp-source">
                  {s}
                </span>
              ))}
            </div>
            <p className="lp-trust-note">{t("trust.note")}</p>
          </div>
        </div>
      </section>

      {/* WHAT'S IN THE REPORT */}
      <section className="lp-section">
        <div className="wrap">
          <h2 className="serif lp-h2">{t("what.title")}</h2>
          <div className="lp-grid">
            {what.map((it) => (
              <div className="panel lp-card" key={it.title}>
                <h3 className="serif">{it.title}</h3>
                <p>{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-section lp-alt" id="how">
        <div className="wrap">
          <h2 className="serif lp-h2">{t("how.title")}</h2>
          <div className="lp-steps">
            {steps.map((s, i) => (
              <div className="lp-step" key={s.title}>
                <div className="lp-step-num">{i + 1}</div>
                <h3 className="serif">{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="lp-section">
        <div className="wrap">
          <h2 className="serif lp-h2">{t("why.title", { brand: brand.name })}</h2>
          <div className="lp-why">
            {why.map((w) => (
              <div className="lp-why-item" key={w.title}>
                <h3 className="serif">{w.title}</h3>
                <p>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-section lp-alt">
        <div className="wrap">
          <div className="lp-price-card">
            <h2 className="serif lp-h2" style={{ marginBottom: 6 }}>
              {t("pricing.title")}
            </h2>
            <div className="lp-price">{price}</div>
            <p className="lp-price-desc">{t("pricing.desc", { price })}</p>
            <Link href={SAMPLE} className="btn btn-primary">
              {t("pricing.cta")}
            </Link>
            <p className="lp-price-note">{t("pricing.note")}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <h2 className="serif lp-h2">{t("faq.title")}</h2>
          <div className="lp-faq">
            {faqs.map((f) => (
              <div className="lp-faq-item" key={f.q}>
                <h3 className="serif">{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="wrap">
          <div className="lp-foot-top">
            <span className="pw-lockup">
              <Mark size={26} />
              <Wordmark />
            </span>
            <div className="lp-foot-links">
              <a href="#">{t("footer.privacy")}</a>
              <a href="#">{t("footer.terms")}</a>
            </div>
          </div>
          <p className="lp-foot-disclaimer">{t("footer.disclaimer")}</p>
          <p className="lp-foot-rights">
            {t("footer.rights", { year, brand: brand.name })}
          </p>
        </div>
      </footer>
    </main>
  );
}
