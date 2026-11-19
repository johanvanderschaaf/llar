/**
 * Checks on a saved report: what a buyer would see as broken, missing,
 * inconsistent or badly worded. Shared by scripts/reliability-run.mts (the
 * pipeline) and scripts/ai-check.mts (the AI narrative). NOT part of the app.
 */
import type { Report } from "@/types/report";

/* ---------- checks on the saved report ---------- */

/** Walk any JSON value, calling `visit` with each node and its path. */
function walk(v: unknown, path: string, visit: (v: unknown, path: string) => void) {
  visit(v, path);
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, visit));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, visit);
}

export function checkReport(report: Report, flat: { asking?: number }): string[] {
  const problems: string[] = [];

  if (!report.hero?.title || !Object.values(report.hero.title).some(Boolean))
    problems.push("hero title is empty");
  if (!report.scores?.length) problems.push("no scores");
  for (const s of report.scores ?? [])
    if (!Number.isFinite(s.value) || s.value < 0 || s.value > 100)
      problems.push(`score ${s.key} out of range: ${s.value}`);
  if (!Number.isFinite(report.verdict?.overall) || report.verdict.overall <= 0)
    problems.push(`overall score missing: ${report.verdict?.overall}`);
  if (!report.urbanism?.items?.length) problems.push("planning section has no rows");
  // Sections that must exist in every report, AI or not (see pipeline/facts-narrative.ts).
  const empty = (l?: { en?: string }) => !l?.en?.trim();
  if (empty(report.verdict?.headline) || empty(report.verdict?.body)) problems.push("bottom line is empty");
  if (empty(report.hero?.sub)) problems.push("hero subtitle is empty");
  if (empty(report.neighbourhood?.lede)) problems.push("neighbourhood intro is empty");
  if (!report.negotiation?.items?.length) problems.push("negotiation playbook has no levers");
  if ((report.checklist?.length ?? 0) < 3) problems.push("checklist has fewer than 3 items");
  if (!report.urbanism?.items?.some((i) => i.key === "heritage")) problems.push("no heritage row");
  if (JSON.stringify(report).includes("—")) problems.push("em-dash in report text");

  problems.push(...checkConsistency(report, flat));

  walk(report, "", (v, path) => {
    // Text a buyer would read with a broken value in it.
    if (typeof v === "string" && /\b(undefined|NaN|null|Infinity)\b|\[object Object\]/.test(v))
      problems.push(`broken text at ${path}: "${v.slice(0, 80)}"`);
    if (typeof v === "number" && !Number.isFinite(v)) problems.push(`non-finite number at ${path}`);
    // Localized text present in one language but missing in the other.
    if (v && typeof v === "object" && !Array.isArray(v) && "en" in v && "es" in v) {
      const { en, es, ca } = v as { en: unknown; es: unknown; ca?: unknown };
      if (typeof en === "string" && typeof es === "string" && Boolean(en) !== Boolean(es))
        problems.push(`text in only one language at ${path} (en: "${en.slice(0, 40)}", es: "${es.slice(0, 40)}")`);
      if (typeof ca === "string" && typeof en === "string" && Boolean(en) !== Boolean(ca))
        problems.push(`Catalan missing at ${path}`);
      // Grammar: articles must contract ("de el" → "del", "a els" → "als").
      if (typeof es === "string" && /(^|\s)(de|a) el\s/.test(es)) problems.push(`Spanish "de el"/"a el" at ${path}: "${es.slice(0, 70)}"`);
      if (typeof ca === "string" && /(^|\s)(de|a|per) els?\s/.test(ca)) problems.push(`Catalan uncontracted article at ${path}: "${ca.slice(0, 70)}"`);
      for (const [lang, t] of [["en", en], ["es", es], ["ca", ca]] as const)
        if (typeof t === "string" && /\S {2,}\S| [.,;:](\s|$)|\.\.(?!\.)/.test(t))
          problems.push(`spacing/punctuation slip (${lang}) at ${path}: "${t.slice(0, 70)}"`);
    }
  });

  return problems;
}

/**
 * Does the report tell one story? Score, alerts, planning rows and the bottom
 * line must agree with each other and with the input.
 */
export function checkConsistency(report: Report, flat: { asking?: number }): string[] {
  const out: string[] = [];
  const alerts = report.alerts ?? [];
  const alertTitles = alerts.map((a) => a.title.en).join(" | ");
  const item = (key: string) => report.urbanism?.items?.find((i) => i.key === key);

  // Confirmed affectation: caution alert and the overall capped at 30.
  if (alerts.some((a) => a.title.en === "Planning affectation")) {
    if (report.verdict.overall > 30) out.push(`affectation A but overall is ${report.verdict.overall} (cap 30)`);
  }
  if (item("affectation")?.tone === "caution" && !/affectation/i.test(alertTitles))
    out.push("planning row is 'caution' but there is no affectation alert");

  // Heritage listing: a serious-risk alert with a preview line.
  const her = item("heritage");
  if (her && /Nivell [A-D]/.test(her.tag?.en ?? "")) {
    const a = alerts.find((x) => /Heritage-protected|Catalogued/.test(x.title.en));
    if (!a) out.push(`heritage-listed (${her.tag?.en}) but no heritage alert`);
    else if (!a.previewDetail) out.push("heritage alert has no preview line");
  } else if (alerts.some((x) => /Heritage-protected|Catalogued/.test(x.title.en))) {
    out.push("heritage alert without a listed heritage row");
  }

  // Flood zone: an alert with a preview line.
  const flood = report.risks?.find((r) => r.labelKey === "risk.flood");
  if (flood && /T10|T100/.test(flood.detail.en) && !alerts.some((a) => /flood/i.test(a.title.en)))
    out.push("in a flood zone but no flood alert");

  // Bottom line (fact-based) names the same barri as the property details.
  const hood = report.snapshot?.facts?.find((f) => f.labelKey === "snapshot.neighbourhood");
  const barri = report.price?.pricing?.barri?.name;
  const hoodText = typeof hood?.value === "string" ? hood.value : hood?.value?.en;
  if (barri && hoodText && !hoodText.toLowerCase().startsWith(barri.toLowerCase()))
    out.push(`barri mismatch: pricing "${barri}" vs snapshot "${hoodText}"`);
  const bottom = `${report.verdict.headline.en} ${report.verdict.body.en}`.toLowerCase();
  if (barri && !bottom.includes(barri.toLowerCase().replace(/^(el|la|les|els|l')\s?/, "")))
    out.push(`bottom line doesn't name the barri "${barri}"`);

  // Bottom line numbers match the input and the pricing.
  if (flat.asking) {
    const a = `€${flat.asking.toLocaleString("en-GB")}`;
    if (!report.verdict.body.en.includes(a)) out.push(`bottom line doesn't state the asking price ${a}`);
  }
  const delta = report.price?.pricing?.deltaPct;
  if (delta != null && Math.abs(delta) >= 3 && report.narrative?.source === "facts") {
    const pct = `${Math.abs(Math.round(delta))}%`;
    if (!report.verdict.body.en.includes(pct)) out.push(`bottom line says a different gap than pricing (${pct})`);
    const dir = delta < 0 ? "below" : "above";
    if (!report.verdict.body.en.includes(dir)) out.push(`bottom line direction isn't "${dir}"`);
  }
  return out;
}

