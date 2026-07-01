import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation helpers (Link, redirect, useRouter, usePathname).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/**
 * Where the primary "Check my flat" CTA points. TEMPORARY: while the live
 * report-generation flow is gated we route the whole funnel to the early-access
 * waitlist. Flip this back to "/start" (a single edit) when the report flow
 * ships. `/start` stays reachable by URL in the meantime.
 */
export const PRIMARY_CTA_HREF = "/early-access";
