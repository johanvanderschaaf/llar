import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Locals-focused: Catalan first, then Spanish, then English.
  locales: ["ca", "es", "en"],
  defaultLocale: "es",
  // Always show the locale prefix (/es, /ca, /en) in the URL.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
