/**
 * AI narrative check — NOT part of the app. Costs money (Anthropic API).
 *
 * For each flat, takes its latest test report (from scripts/reliability-run.mts),
 * generates the AI narrative exactly as an unlock would, saves it to that test
 * report (so it can be read in the browser), and checks the AI's text:
 * - the shared report checks (broken text, languages, grammar, consistency)
 * - no verdict words ("bargain", "fair price", …) in any language
 * - every number in the prose traces back to the facts
 * - case-specific traps (renovation year, no barri price, …)
 * It prints the token usage and cost per report.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/ai-check.mts
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/ai-check.mts <ref> ...
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { generateNarrative } from "@/pipeline/narrate";
import { aiConfig } from "@/config/ai";
import type { Report } from "@/types/report";
import type { ReportRow } from "@/types/db";
import { checkReport } from "./report-checks.mjs";
import { VERDICT_WORDS as VERDICT } from "@/pipeline/narrative-guard";

const TEST_EMAIL = "reliability-test@pisowise.invalid";

/** The five hardest cases for the AI (see the reliability-run set). */
const FLATS: Array<{ label: string; ref: string; traps?: (text: string) => string[] }> = [
  {
    label: "Casa Calvet, renovated listed building (Casp 48)",
    ref: "0926604DF3802F0009TH",
    traps: (t) =>
      /\b(2017 building|built in 2017|dates? from 2017|completed in 2017|edificio de 2017|edifici de 2017)\b/i.test(t)
        ? ["calls it a 2017 building (2017 is the renovation)"]
        : [],
  },
  { label: "Affectation A (Mallorca 191)", ref: "9525410DF2892F0012UJ" },
  {
    label: "No barri price (Baró de Viver)",
    ref: "3189612DF3838G0011OM",
    traps: (t) =>
      /\b\d+(\.\d+)?% (above|below)|neighbourhood average of|closing average of/i.test(t)
        ? ["compares with a neighbourhood average that doesn't exist"]
        : [],
  },
  { label: "No asking price (El Clot, Bilbao 200)", ref: "2748322DF3824H0179XD" },
  { label: "Raval, 20% below (Joaquín Costa 30)", ref: "0417831DF3801E0010XA" },
];

/** Sonnet 4.6 list prices, $ per million tokens (claude-api skill, models.md). */
const PRICE = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };


/** Every prose field the AI writes, all languages. */
function aiText(r: Report): Array<{ path: string; lang: string; text: string }> {
  const out: Array<{ path: string; lang: string; text: string }> = [];
  const add = (path: string, l?: { en: string; es: string; ca?: string }) => {
    if (!l) return;
    for (const lang of ["en", "es", "ca"] as const) out.push({ path, lang, text: (l as Record<string, string>)[lang] ?? "" });
  };
  add("verdict.headline", r.verdict.headline);
  add("verdict.body", r.verdict.body);
  add("snapshot.note", r.snapshot.note);
  add("neighbourhood.lede", r.neighbourhood.lede);
  add("neighbourhood.note", r.neighbourhood.note);
  add("negotiation.intro", r.negotiation.intro);
  add("negotiation.tactic", r.negotiation.tactic);
  r.negotiation.items.forEach((i, k) => { add(`negotiation.items[${k}].title`, i.title); add(`negotiation.items[${k}].desc`, i.desc); });
  add("price.lede", r.price.lede);
  add("price.fairValue", r.price.fairValue);
  r.checklist.forEach((c, k) => add(`checklist[${k}]`, c));
  return out;
}

/** Numbers the AI may legitimately use: everything in the facts. */
function knownNumbers(r: Report, before: Report): number[] {
  const nums = new Set<number>();
  const visit = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) nums.add(Math.abs(v));
    else if (typeof v === "string") for (const m of v.matchAll(/\d[\d.,]*/g)) nums.add(parseNum(m[0]));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  // Facts only: the pre-AI report minus prose the AI replaces.
  visit({ ...before, verdict: { overall: before.verdict.overall }, negotiation: null, checklist: null });
  const d = r.price.pricing?.deltaPct;
  if (d != null) [Math.round(d), Math.round(Math.abs(d)), Number(Math.abs(d).toFixed(1))].forEach((x) => nums.add(Math.abs(x)));
  const year = new Date().getFullYear();
  [year, 2002, 45, 10, 100, 500, 15].forEach((x) => nums.add(x));
  return [...nums];
}

/** "455.000" / "455,000" / "5,1" → number (thousands vs decimals by position). */
function parseNum(s: string): number {
  const t = s.replace(/[.,]$/, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  return Number(t.replace(",", "."));
}

function untracedNumbers(text: string, known: number[]): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d[\d.,]*/g)) {
    const n = parseNum(m[0]);
    if (!Number.isFinite(n) || n < 20) continue; // small counts/minutes are noise
    const ok = known.some((k) => Math.abs(k - n) <= Math.max(1, k * 0.01));
    if (!ok) out.push(m[0].replace(/[.,]$/, ""));
  }
  return out;
}

const db = createAdminClient();
const refs = process.argv.slice(2);
const flats = refs.length ? refs.map((ref) => ({ label: ref, ref })) as typeof FLATS : FLATS;

let total = 0;
const results = await Promise.all(
  flats.map(async (flat) => {
    const { data: rows } = await db
      .from("reports")
      .select("*")
      .eq("input->>email", TEST_EMAIL)
      .eq("data->>cadastralRef", flat.ref)
      // Only reports without AI text: a previous run's AI prose would pollute
      // both the fallback text and the numbers the guard accepts.
      .eq("data->narrative->>source", "facts")
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0] as ReportRow | undefined;
    if (!row) return { flat, error: "no fresh test report: run reliability-run for this ref first" };

    let usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | undefined;
    const t0 = Date.now();
    let next: Report;
    try {
      next = await generateNarrative(row.data, row.input, (u) => (usage = u));
    } catch (e) {
      return { flat, error: (e as Error).message, seconds: (Date.now() - t0) / 1000 };
    }
    const seconds = (Date.now() - t0) / 1000;
    await db.from("reports").update({ data: next }).eq("id", row.id);

    const cost = usage
      ? (usage.input_tokens * PRICE.input +
          usage.output_tokens * PRICE.output +
          (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
          (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead) / 1e6
      : 0;
    total += cost;

    const problems = checkReport(next, { asking: row.input.askingPriceEur })
      // Fact-based-prose checks; the AI may phrase these differently.
      .filter((p) => !/different gap than pricing|direction isn't|doesn't state the asking price/.test(p));
    const known = knownNumbers(next, row.data);
    const words = Math.round(next.verdict.headline.en.split(/\s+/).length);
    if (words > 14) problems.push(`headline is ${words} words (limit 14)`);
    for (const { path, lang, text } of aiText(next)) {
      const v = text.match(VERDICT);
      if (v) problems.push(`verdict word "${v[0]}" (${lang}) at ${path}`);
      for (const n of untracedNumbers(text, known)) problems.push(`number ${n} not in the facts (${lang}) at ${path}`);
      if (/—/.test(text)) problems.push(`em-dash (${lang}) at ${path}`);
      if (lang === "en" && /\d[\d,.]* ?(€|EUR\b)|\bEUR\b/.test(text)) problems.push(`money format (en) at ${path}: "${text.match(/[^.]*(€|EUR)[^.]*/)?.[0].slice(0, 60)}"`);
      if (lang !== "en" && /€\s?\d/.test(text)) problems.push(`money format (${lang}) at ${path}`);
    }
    const all = aiText(next).map((x) => x.text).join("\n");
    problems.push(...(flat.traps?.(all) ?? []));
    return { flat, id: row.id, seconds, usage, cost, problems: [...new Set(problems)], next };
  }),
);

for (const r of results) {
  if ("error" in r && r.error) {
    console.log(`\n── FAILED  ${r.flat.label}: ${r.error}`);
    continue;
  }
  const ok = r as Extract<typeof r, { next: Report }>;
  console.log(`\n── ${ok.problems.length ? "PROBLEMS" : "OK      "} ${ok.seconds.toFixed(0)}s  $${ok.cost.toFixed(3)}  ${ok.flat.label}  (report ${ok.id})`);
  console.log(`   tokens: ${ok.usage?.input_tokens} in, ${ok.usage?.output_tokens} out, cache ${ok.usage?.cache_creation_input_tokens ?? 0} written / ${ok.usage?.cache_read_input_tokens ?? 0} read`);
  for (const k of ok.next.narrative?.factsKept ?? []) console.log(`   ↺ kept fact-based ${k}`);
  for (const p of ok.problems) console.log(`   ✗ ${p}`);
  console.log(`   headline: ${ok.next.verdict.headline.en}`);
  console.log(`   body: ${ok.next.verdict.body.en}`);
}
console.log(`\n════ ${results.length} narratives, model ${aiConfig.model}, total cost $${total.toFixed(2)}`);
