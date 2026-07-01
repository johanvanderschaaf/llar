"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, PRIMARY_CTA_HREF } from "@/i18n/navigation";
import { Logo } from "@/components/Brand";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ArrowIcon } from "./icons";

const SAMPLE = "/report/sample-sors35";

const LINKS = [
  { href: "#proof", key: "find" },
  { href: "#report", key: "report" },
  { href: "#how", key: "how" },
  { href: "#pricing", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const;

/**
 * Marketing sticky nav. Client-only for the scroll-shadow state (adds a
 * hairline + raises bg opacity past 8px), mirroring the handoff prototype.
 */
export function LandingNav() {
  const t = useTranslations("landing");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => el.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="nav" ref={ref}>
      <div className="wrap nav__in">
        <Logo size={30} />
        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {t(`nav.${l.key}`)}
            </a>
          ))}
        </nav>
        <div className="nav__cta">
          <LocaleSwitcher />
          <Link href={SAMPLE} className="btn btn-ghost">
            {t("cta.sample")}
          </Link>
          <Link href={PRIMARY_CTA_HREF} className="btn btn-primary">
            {t("cta.check")}
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}
