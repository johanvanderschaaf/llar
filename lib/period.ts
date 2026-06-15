/**
 * Localise a barri-pricing period label.
 *
 * The Gencat dataset (`bcn-barri-prices.json`) stores `asOf` in Catalan, e.g.
 * "gener 2025 - desembre 2025". Rendering that verbatim in the EN/ES reports
 * leaks Catalan month names, so we parse the two endpoints and reformat them in
 * the active locale. Falls back to the raw string if the shape is unexpected.
 */
const CAT_MONTHS = [
  "gener",
  "febrer",
  "març",
  "abril",
  "maig",
  "juny",
  "juliol",
  "agost",
  "setembre",
  "octubre",
  "novembre",
  "desembre",
];

const INTL_LOCALE: Record<string, string> = {
  en: "en-GB",
  es: "es-ES",
  ca: "ca-ES",
};

export function localizePeriod(asOf: string, locale: string): string {
  const m = asOf.match(
    /([\p{L}]+)\s+(\d{4})\s*[-–—]\s*([\p{L}]+)\s+(\d{4})/u,
  );
  if (!m) return asOf;
  const from = CAT_MONTHS.indexOf(m[1].toLowerCase());
  const to = CAT_MONTHS.indexOf(m[3].toLowerCase());
  if (from < 0 || to < 0) return asOf;

  const intlLocale = INTL_LOCALE[locale] ?? "en-GB";
  const fmt = (monthIdx: number, year: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      month: "long",
      year: "numeric",
    }).format(new Date(Number(year), monthIdx, 1));

  return `${fmt(from, m[2])} – ${fmt(to, m[4])}`;
}
