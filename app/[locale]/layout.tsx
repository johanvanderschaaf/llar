import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { routing } from "@/i18n/routing";
import { brand } from "@/config/brand";
import { TopBar } from "@/components/TopBar";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${brand.name} · Property Intelligence`,
  description: `Independent due-diligence dossiers for buying property in ${brand.market}.`,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${fraunces.variable} ${hanken.variable}`}>
      <body>
        <NextIntlClientProvider>
          <TopBar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
