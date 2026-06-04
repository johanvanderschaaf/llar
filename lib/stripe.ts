import "server-only";
import Stripe from "stripe";
import { pricing } from "@/config/brand";

/** Whether Stripe is configured (lets the UI hide the unlock CTA otherwise). */
export function hasStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  return new Stripe(key);
}

/** Report price in EUR — env override, else the config default. */
export function reportPriceEur(): number {
  const e = Number(process.env.REPORT_PRICE_EUR);
  return Number.isFinite(e) && e > 0 ? e : pricing.reportPriceEur;
}

export function reportPriceCents(): number {
  return Math.round(reportPriceEur() * 100);
}

/** Map our locales to Stripe Checkout locales (Catalan → Spanish). */
export function stripeLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  if (locale === "en") return "en";
  return "es";
}
