/**
 * Process "email me my report when the registry is back" requests — NOT part
 * of the app.
 *
 * Buyers who hit a Catastro outage can leave their email (see
 * RegistryDownNotice); those requests sit in `waitlist` with
 * reason = 'registry_down'. Run this once Catastro is back: it generates a
 * report for every request that names a flat, marks the request processed,
 * and prints who to send which link to.
 *
 * Sending is manual for now: lib/email.ts is still a stub (no email provider).
 *
 * Usage (needs .env.local with the Supabase keys; migration 0003 applied):
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/process-pending.mts
 *   ... scripts/process-pending.mts --base https://your-domain
 */
import { generateReport } from "@/pipeline/generate";
import { CatastroDownError } from "@/adapters/catastro-outage";
import { createAdminClient } from "@/lib/supabase/admin";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : "https://llar.vercel.app").replace(/\/$/, "");

const db = createAdminClient();
const { data: rows, error } = await db
  .from("waitlist")
  .select("id, email, address, locale, cadastral_ref, asking_price_eur, created_at")
  .eq("reason", "registry_down")
  .is("processed_at", null)
  .order("created_at");
if (error) throw new Error(`Could not read requests: ${error.message}`);
if (!rows?.length) {
  console.log("No pending requests.");
  process.exit(0);
}

const toSend: string[] = [];
const toPick: string[] = [];
for (const r of rows) {
  if (!r.cadastral_ref) {
    // The outage hit during the address search, so no flat was picked yet.
    toPick.push(`${r.email}  (${r.locale ?? "?"})  typed: "${r.address ?? ""}"`);
    continue;
  }
  try {
    const id = await generateReport({
      addressOrRef: r.address || r.cadastral_ref,
      cadastralRef: r.cadastral_ref,
      askingPriceEur: r.asking_price_eur ?? undefined,
      email: r.email,
      source: "buyer",
    });
    const { error: upErr } = await db
      .from("waitlist")
      .update({ report_id: id, processed_at: new Date().toISOString() })
      .eq("id", r.id);
    if (upErr) console.log(`  ! report ${id} made but request not marked: ${upErr.message}`);
    toSend.push(`${r.email}  →  ${BASE}/${r.locale ?? "es"}/report/${id}`);
  } catch (e) {
    if (e instanceof CatastroDownError) {
      console.log("Catastro is still down. Nothing more processed; try again later.");
      break;
    }
    console.log(`  ! ${r.email} (${r.cadastral_ref}): ${(e as Error).message}`);
  }
}

if (toSend.length) console.log(`\nReports ready, send these links:\n  ${toSend.join("\n  ")}`);
if (toPick.length)
  console.log(`\nNo flat picked yet, ask them to pick it (or look it up and run again):\n  ${toPick.join("\n  ")}`);
