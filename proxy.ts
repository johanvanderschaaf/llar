import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the `middleware` convention to `proxy`. We delegate to
// next-intl's middleware to detect the locale and handle locale-prefixed routing.
export default createMiddleware(routing);

export const config = {
  // Match all paths except API routes, the (non-localized) admin + auth areas,
  // Next internals, and files with an extension.
  matcher: "/((?!api|admin|auth|_next|_vercel|.*\\..*).*)",
};
