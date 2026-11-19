/**
 * Report reliability harness — NOT part of the app.
 *
 * Runs the real `generateReport` pipeline (real sources, real Supabase writes)
 * for a set of flats, times each run, reads the saved report back and checks it
 * for problems a buyer would see. Used for the iterative test rounds.
 *
 * Every report it creates is tagged with the email TEST_EMAIL below, so test
 * reports can be told apart from real ones and deleted with --cleanup.
 *
 * Usage (needs .env.local with the Supabase keys):
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/reliability-run.mts
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/reliability-run.mts --runs 2
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/reliability-run.mts "<ref>[=askingEur]" ...
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/reliability-run.mts --cleanup
 *
 * By default each flat's cached Catastro data is cleared first, so every run
 * exercises the live sources; pass --keep-cache to test repeat lookups.
 *
 * `--conditions=react-server` lets the pipeline's `import "server-only"` load
 * outside Next.js.
 */
import { generateReport } from "@/pipeline/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Report } from "@/types/report";
import { checkReport } from "./report-checks.mjs";

/** Tag on every test report. `.invalid` addresses can never receive mail. */
const TEST_EMAIL = "reliability-test@pisowise.invalid";

/** The pass mark for one run: anything slower risks Vercel's 60s limit. */
const MAX_SECONDS = 50;

/**
 * The fixed test set: one flat per hard case, kept the same between rounds so
 * results are comparable. Found with scripts/scout-test-flats.mts (the notes
 * say what the official sources returned when the set was picked). No
 * Barcelona flat found in a SNCZI flood zone; flood alerts are unit-tested.
 */
const DEFAULT_FLATS: Array<{ label: string; ref: string; asking?: number }> = [
  { label: "Baseline (Gràcia, Sors 35)", ref: "9648812DF2894H0013RQ", asking: 450_000 },
  { label: "Affectation A (Eixample, Mallorca 191)", ref: "9525410DF2892F0012UJ", asking: 500_000 },
  { label: "Upper Sant Gervasi (Calvet 50)", ref: "8432701DF2883A0007QY", asking: 650_000 },
  { label: "No asking price (Les Corts, Av. Madrid 26)", ref: "6810528DF2861B0025PI" },
  { label: "Vallcarca (Gomis 72)", ref: "8351816DF2885A0012RL", asking: 400_000 },
  { label: "Raval, district heritage sheet (Joaquín Costa 30)", ref: "0417831DF3801E0010XA", asking: 280_000 },
  { label: "Barceloneta, affectation C (Sant Carles 20)", ref: "2313701DF3821C0010RQ", asking: 320_000 },
  { label: "Heritage A flats (Casp 48)", ref: "0926604DF3802F0009TH", asking: 900_000 },
  { label: "Heritage B flats (Diagonal 332)", ref: "1037606DF3813G0025BP", asking: 600_000 },
  { label: "Eixample protected area (Aribau 100)", ref: "9626420DF2892F0009ZJ", asking: 520_000 },
  { label: "Affectation C + Eixample (Sardenya 300)", ref: "1139320DF3813G0011WX", asking: 420_000 },
  { label: "Poble-sec (Blai 20)", ref: "0208614DF3800G0003SI", asking: 300_000 },
  { label: "Nou Barris (Fabra i Puig 300)", ref: "0771707DF3807B0107LB", asking: 250_000 },
  { label: "Few sales + affectation C (Baró de Viver, Pg. Santa Coloma 100)", ref: "3189612DF3838G0011OM", asking: 160_000 },
  { label: "Few sales, ground floor (Torre Baró, Vallbona 20)", ref: "1802911DF3910B0002MJ", asking: 150_000 },
  { label: "Newer block (Diagonal Mar, Llull 400)", ref: "4649602DF3844H0089BW", asking: 550_000 },
  { label: "Poblenou (Pujades 150)", ref: "3135303DF3833E0009WD", asking: 480_000 },
  { label: "No asking price (El Clot, Bilbao 200)", ref: "2748322DF3824H0179XD" },
  { label: "El Coll, few sales (Mare de Déu del Coll 50)", ref: "8855903DF2885F0007AH", asking: 350_000 },
  { label: "Sant Gervasi - la Bonanova (Muntaner 500)", ref: "7941502DF2874B0008EY", asking: 750_000 },
];

/** Dev server for the free-preview check; skipped (and said so) if it isn't up. */
const PREVIEW_BASE = process.env.PREVIEW_BASE ?? "http://localhost:3000";

interface RunResult {
  label: string;
  ref: string;
  seconds: number;
  outcome: "saved" | "refused" | "crashed";
  error?: string;
  problems: string[];
  sources: Array<{ source: string; status: string; note: string | null }>;
}

/**
 * The free preview (no login, no payment) must not contain the price answer:
 * not the barri €/m², not the gap, not the vs-market pill or the price score.
 */
async function checkPreview(id: string, report: Report): Promise<string[] | null> {
  let html: string;
  try {
    const res = await fetch(`${PREVIEW_BASE}/en/report/${id}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [`preview page HTTP ${res.status}`];
    html = await res.text();
  } catch {
    return null; // dev server not running
  }
  const out: string[] = [];
  const p = report.price?.pricing;
  if (p?.barri) {
    const ppm = Math.round(p.barri.pricePerM2);
    for (const s of [ppm.toLocaleString("en-GB"), String(ppm).replace(/\B(?=(\d{3})+(?!\d))/g, ".")])
      if (html.includes(s)) out.push(`preview leaks the barri €/m² (${s})`);
  }
  if (p?.deltaPct != null && html.includes(`${p.deltaPct > 0 ? "+" : ""}${p.deltaPct.toFixed(1)}%`))
    out.push("preview leaks the vs-market pill");
  if (/\b(below|above) the neighbourhood average/.test(html)) out.push("preview leaks the price direction");
  if (html.includes("verdict__ring")) out.push("preview shows the overall score (it hints at the price)");
  if (/rng__txt"><b class="fig"/.test(html)) out.push("preview shows a score number");
  if (report.scores?.some((s) => s.key === "price") && !html.includes("scorecard--locked"))
    out.push("preview shows the price score");
  return out;
}

/* ---------- one run ---------- */

async function runOne(flat: { label: string; ref: string; asking?: number }): Promise<RunResult> {
  const db = createAdminClient();
  if (!KEEP_CACHE) {
    // Test the live sources, not the cache: drop this flat's cached Catastro
    // data, coordinates and parcel outline (the run writes them back).
    const parcel = flat.ref.slice(0, 14);
    await db
      .from("source_cache")
      .delete()
      .or(`cache_key.like.${flat.ref}#*,cache_key.like.${parcel}#*`);
  }
  const t0 = Date.now();
  const base = { label: flat.label, ref: flat.ref, problems: [] as string[], sources: [] as RunResult["sources"] };
  let id: string;
  try {
    id = await generateReport({
      addressOrRef: flat.ref,
      cadastralRef: flat.ref,
      askingPriceEur: flat.asking,
      email: TEST_EMAIL,
      source: "buyer",
    });
  } catch (e) {
    const seconds = (Date.now() - t0) / 1000;
    const msg = (e as Error).message;
    // generateReport throws on purpose when Catastro is down: the buyer gets a
    // "try again" message. Anything else is a crash.
    const outcome = /Catastro unavailable/.test(msg) ? "refused" : "crashed";
    return { ...base, seconds, outcome, error: msg };
  }
  const seconds = (Date.now() - t0) / 1000;

  const [{ data: row, error: rowErr }, { data: sources }] = await Promise.all([
    db.from("reports").select("data").eq("id", id).maybeSingle(),
    db.from("report_sources").select("source,status,note").eq("report_id", id),
  ]);
  const problems: string[] = [];
  if (rowErr || !row) problems.push(`report ${id} not found after saving: ${rowErr?.message ?? ""}`);
  else {
    problems.push(...checkReport(row.data as Report, flat));
    const preview = await checkPreview(id, row.data as Report);
    if (preview === null) previewSkipped = true;
    else problems.push(...preview);
  }
  if (seconds > MAX_SECONDS) problems.push(`took ${seconds.toFixed(1)}s (limit ${MAX_SECONDS}s)`);

  return { ...base, seconds, outcome: "saved", problems, sources: sources ?? [] };
}

let previewSkipped = false;

/* ---------- output ---------- */

function print(results: RunResult[]) {
  for (const r of results) {
    const head = r.outcome === "saved" ? (r.problems.length ? "PROBLEMS" : "OK") : r.outcome.toUpperCase();
    console.log(`\n── ${head.padEnd(8)} ${r.seconds.toFixed(1).padStart(5)}s  ${r.label}  (${r.ref})`);
    if (r.error) console.log(`   error: ${r.error}`);
    for (const p of r.problems) console.log(`   ✗ ${p}`);
    for (const s of r.sources.filter((s) => s.status !== "ok" && s.source !== "market"))
      console.log(`   · ${s.source} ${s.status}: ${s.note ?? ""}`);
    const slow = r.sources
      .map((s) => ({ s: s.source, t: Number(s.note?.match(/\[(\d+(?:\.\d+)?)s\]/)?.[1]) }))
      .filter((x) => x.t >= 5)
      .map((x) => `${x.s} ${x.t}s`);
    if (slow.length) console.log(`   slow: ${slow.join(", ")}`);
  }

  const saved = results.filter((r) => r.outcome === "saved");
  const clean = saved.filter((r) => !r.problems.length);
  const times = saved.map((r) => r.seconds).sort((a, b) => a - b);
  const failures: Record<string, number> = {};
  for (const r of results)
    for (const s of r.sources)
      if (s.status !== "ok" && s.source !== "market") failures[s.source] = (failures[s.source] ?? 0) + 1;

  console.log(`\n════ ${results.length} runs: ${clean.length} clean, ${saved.length - clean.length} with problems, ` +
    `${results.filter((r) => r.outcome === "refused").length} refused (Catastro down), ` +
    `${results.filter((r) => r.outcome === "crashed").length} crashed`);
  if (times.length)
    console.log(`     time: fastest ${times[0].toFixed(1)}s, median ${times[Math.floor(times.length / 2)].toFixed(1)}s, slowest ${times[times.length - 1].toFixed(1)}s`);
  if (Object.keys(failures).length)
    console.log(`     sources not ok: ${Object.entries(failures).map(([k, v]) => `${k} ×${v}`).join(", ")}`);
  if (previewSkipped) console.log(`     free-preview check skipped: no dev server at ${PREVIEW_BASE}`);
}

/* ---------- main ---------- */

const args = process.argv.slice(2);

if (args.includes("--cleanup")) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("reports")
    .delete()
    .eq("input->>email", TEST_EMAIL)
    .select("id");
  if (error) throw new Error(`cleanup failed: ${error.message}`);
  console.log(`Deleted ${data?.length ?? 0} test reports (and their source logs).`);
  process.exit(0);
}

/** `--keep-cache`: use cached Catastro data like a repeat lookup would. */
const KEEP_CACHE = args.includes("--keep-cache");
const runsIdx = args.indexOf("--runs");
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) || 1 : 1;
const flatArgs = args.filter((a, i) => !a.startsWith("--") && !(runsIdx >= 0 && i === runsIdx + 1));
const flats = flatArgs.length
  ? flatArgs.map((a) => {
      const [ref, asking] = a.split("=");
      return { label: ref, ref: ref.trim(), asking: asking ? Number(asking) : undefined };
    })
  : DEFAULT_FLATS;

const results: RunResult[] = [];
for (let i = 0; i < runs; i++) {
  // One at a time, like real buyers arriving; concurrency would distort timings.
  for (const flat of flats) {
    process.stdout.write(`run ${i + 1}/${runs}: ${flat.label} … `);
    const r = await runOne(flat);
    console.log(`${r.outcome} in ${r.seconds.toFixed(1)}s`);
    results.push(r);
  }
}
print(results);
