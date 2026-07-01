"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/i18n/routing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type JoinWaitlistResult =
  | { ok: true }
  | { ok: false; error: "email" | "server" };

/**
 * Capture an early-access signup. Called from the client form (returns a
 * result rather than redirecting, because the page swaps to a success state
 * in place). Writes via the admin client — server-only, bypasses RLS.
 *
 * No silent fallback if Supabase is unconfigured: the insert throws, we log it
 * and return `error: "server"` so the buyer is told to retry rather than shown
 * a fake success. (Per AGENTS.md — never hide a misconfiguration.)
 */
export async function joinWaitlistAction(input: {
  email: string;
  address?: string;
  floor?: string;
  door?: string;
  locale?: string;
}): Promise<JoinWaitlistResult> {
  const email = (input.email ?? "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email" };

  const locale = (routing.locales as readonly string[]).includes(
    input.locale ?? "",
  )
    ? input.locale
    : undefined;

  try {
    const db = createAdminClient();
    const { error } = await db.from("waitlist").insert({
      email,
      address: input.address?.trim() || null,
      floor: input.floor?.trim() || null,
      door: input.door?.trim() || null,
      locale: locale ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[joinWaitlist] insert failed:", (e as Error)?.message);
    return { ok: false, error: "server" };
  }

  return { ok: true };
}
