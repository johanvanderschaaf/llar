import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createAnthropic } from "@/lib/anthropic";
import { aiConfig } from "@/config/ai";
import type { Report } from "@/types/report";
import type { ReportInput } from "@/types/db";
import { L } from "@/lib/localized";
import { guardList, fieldProblem, numbersIn, tidy, type GapDirection, type GuardFacts } from "./narrative-guard";

/* ---------- output schema (strict JSON, trilingual) ---------- */

const Loc = z.object({ en: z.string(), es: z.string(), ca: z.string() });

// The checklist is five required fields, not an array: as an array it came
// back empty in 2 of 5 reports (and in 5 of 5 when moved earlier), and the API
// does not enforce minimum array lengths, but it does enforce required fields.
const Checklist = z.object({ first: Loc, second: Loc, third: Loc, fourth: Loc, fifth: Loc });

const NarrativeSchema = z.object({
  verdictHeadline: Loc,
  verdictBody: Loc,
  snapshotNote: Loc,
  neighbourhoodLede: Loc,
  neighbourhoodNote: Loc,
  negotiationIntro: Loc,
  negotiationItems: z.array(z.object({ title: Loc, desc: Loc })),
  negotiationTactic: Loc,
  priceLede: Loc,
  priceFairValue: Loc,
  checklist: Checklist,
});

export type Narrative = z.infer<typeof NarrativeSchema>;

/* ---------- grounding payload ---------- */

function buildFacts(report: Report, input: ReportInput) {
  return {
    cadastralRef: report.cadastralRef,
    title: report.hero.title,
    input: {
      askingPriceEur: input.askingPriceEur ?? null,
      listingUrl: input.listingUrl ?? null,
      builtM2: input.builtM2 ?? null,
      usableM2: input.usableM2 ?? null,
    },
    snapshotFacts: report.snapshot.facts.map((f) => ({
      key: f.labelKey,
      value: typeof f.value === "string" ? f.value : f.value.en,
    })),
    scores: report.scores.map((s) => ({ key: s.key, value: s.value })),
    neighbourhood: report.neighbourhood.facts.map((f) => ({
      key: f.labelKey,
      value: typeof f.value === "string" ? f.value : f.value.en,
    })),
    hasAskingPrice: Boolean(input.askingPriceEur),
    // Authoritative barri-level CLOSING-price benchmark (Generalitat Habitatge,
    // registered notarial deeds) — the single price anchor for Section 03. We do
    // not ingest portal listings, so there is no asking-price comparables set.
    // Present in pricing states 01/02; absent in state 03.
    barriClosing: report.price.pricing?.barri
      ? {
          barri: report.price.pricing.barri.name,
          pricePerM2: report.price.pricing.barri.pricePerM2,
          asOf: report.price.pricing.barri.asOf,
          transactions: report.price.pricing.barri.transactions ?? null,
          avgSurfaceM2: report.price.pricing.barri.avgSurfaceM2 ?? null,
        }
      : null,
    hasBarriBenchmark: Boolean(report.price.pricing?.barri),
    // Computed here so the AI never does arithmetic (it got the gap and its
    // direction wrong in testing). Copy these figures; don't derive new ones.
    priceComparison: priceComparison(report),
    // Building dates, age and obligations, as the building section states them.
    building: report.building?.facts?.map((f) => ({ term: f.term.en, fact: f.def.en })) ?? [],
    // Serious findings shown at the top of the report (affectation, heritage,
    // flood, unverified checks). Lead with these.
    alerts: (report.alerts ?? []).map((a) => ({ tone: a.tone, title: a.title.en, detail: a.detail.en })),
    planning: report.urbanism?.items?.map((i) => ({ topic: i.label.en, status: i.tag?.en ?? null, text: i.text.en })) ?? [],
    risks: report.risks?.map((r) => ({ key: r.labelKey, detail: r.detail.en })) ?? [],
    buildingNote: report.snapshot.note?.en ?? null,
  };
}

function gapDirection(delta?: number): GapDirection | undefined {
  if (delta == null) return undefined;
  return Math.abs(delta) < 3 ? "in line" : delta < 0 ? "below" : "above";
}

function priceComparison(report: Report) {
  const p = report.price.pricing;
  if (!p?.barri) return null;
  return {
    askingPerM2Built: p.asking?.pricePerM2 ?? null,
    barriClosingPerM2: p.barri.pricePerM2,
    gapPercent: p.deltaPct != null ? Math.abs(Math.round(p.deltaPct)) : null,
    gapDirection: gapDirection(p.deltaPct) ?? null,
    typicalRangeForThisSize: p.range ? { low: p.range.lo, high: p.range.hi } : null,
    salesInAverage: p.barri.transactions ?? null,
    fewSales: (p.barri.transactions ?? 0) < 30,
  };
}

const SYSTEM = `You are a property due-diligence analyst writing a trilingual (English + Spanish + Catalan) buyer dossier for a flat in Barcelona, aimed at local first-time buyers planning to live in the flat (not foreign investors, not short-let / tourist-home operators).

STRICT RULES, these are non-negotiable:
- Ground EVERY statement in the FACTS JSON the user provides. Do NOT invent prices, comparables, €/m² figures, scores, legal facts, dates, or citations.
- NUMBERS: copy every figure exactly from the FACTS. NEVER calculate a new number: no percentages, ratios, differences, ages or per-m² figures of your own. For the price position use "priceComparison.gapPercent" and "priceComparison.gapDirection" word for word (e.g. gapPercent 36 + gapDirection "below" → "about 36% below"); for ages and obligations use the "building" facts. Any number not in the FACTS makes the field unusable.
- FINDINGS: "alerts" are the serious findings shown at the top of the report (planning affectation, heritage listing, flood zone, checks that could not be completed). If there are any, the bottom line leads with them, in plain words, and keeps the "verify with a certificat urbanístic" advice for planning findings. "planning" and "risks" give the context; never contradict them, and never say "no affectation" or "not listed" unless they say so.
- If "priceComparison.fewSales" is true, say the barri average rests on few sales and is a rough guide.
- LISTING DATA: the FACTS come from official sources (Catastro, ICAEN, planning, flood, Ajuntament BCN open data, Gencat) plus the buyer-entered asking price. We do NOT ingest the property listing, so you have NO data on interior condition or renovation ("reformed"/"reformado"), bed/bath count, fixtures (lift, terrace, A/C, heating, parking), or the seller. NEVER state any of these as fact; if one matters, say it must be confirmed on a viewing.
- LOCATION: refer to the neighbourhood ONLY by the barri and district given in the FACTS (the "neighbourhood" snapshot fact and "barriClosing.barri"). NEVER infer, rename, or guess a barri / district / neighbourhood from the street address or your own knowledge. If the FACTS say the location is "la Vila de Gràcia · Gràcia", do not call it Eixample or anything else.
- MONEY FORMAT: English "€280,000" and "€2,917/m²"; Spanish and Catalan "280.000 €" and "2.917 €/m²". Never "EUR", never "280,000 €" in English.
- SPANISH/CATALAN ARTICLES: barri names keep their article ("el Raval", "la Vila de Gràcia") and contract after a preposition: Spanish "del Raval", "al Raval"; Catalan "del Raval", "al Raval", "dels …", "pel …". Never write "de el" or "a el".
- PRICE ANCHOR: when "hasBarriBenchmark" is true, "barriClosing" is the authoritative price reference, the average €/m² that flats in this barri actually CLOSE at (registered notarial deeds, period "barriClosing.asOf"). Use it in priceLede/priceFairValue, clearly labelled as a CLOSING-price average (never call it asking), and compare the subject's asking €/m² to it only when "hasAskingPrice" is true. Frame as orientation, not a definitive valuation. State the closing nature of the figure ONCE; do not repeat "closing prices" in every sentence.
- BOTTOM LINE (verdictHeadline + verdictBody): lead with what the flat factually is (built m², year built, barri/district) and where its asking price sits versus the barri closing-price average. If the FACTS carry a serious finding (a planning affectation, heritage protection, or high flood risk), lead with that instead, then the price position. Then one or two facts that most affect the decision. Keep it to 3 to 4 sentences: do NOT recap every section (skip energy class, amenities, etc. unless decisive). State facts only: do NOT pass a verdict on the price (never "fair", "good", "a bargain", "reasonable", "overpriced", "solid buy"), and do NOT cite the numeric score.
- We do NOT ingest portal listings: never invent or mention idealista / Fotocasa / asking-price comparables. Never say comparable or closing data is "missing" or "to verify" when "hasBarriBenchmark" is true. Only if BOTH "hasBarriBenchmark" and "hasAskingPrice" are false may you say the price analysis is pending data ("por verificar" in Spanish, "per verificar" in Catalan).
- PERIOD: "barriClosing.asOf" arrives in Catalan (e.g. "gener 2025 - desembre 2025"). When you state the period, write the month names in the language you are writing (EN "January to December 2025", ES "enero a diciembre de 2025"), never leave Catalan months in the English or Spanish text.
- Where a fact is unknown, say it must be verified rather than guessing.
- BUILDING YEAR: the "snapshot.yearBuilt" fact is Catastro's year, which is the year the building was built OR last fully renovated. When it reads "X, renovated Y", the building dates from X: give both dates and never call it a Y building. Otherwise write "a 1965 building" or "Catastro dates it to 1965", not "it was completed in 1965".
- FACTS-FIRST, in EVERY field: state facts and figures and let the buyer judge. Do NOT editorialise the flat or its price with verdict words in any language ("fair"/"justo"/"just", "good"/"bueno"/"bo", "great", "a bargain"/"chollo"/"ganga", "reasonable"/"razonable"/"raonable", "overpriced"/"sobrevalorado", "prime", "solid", "strong"). Describe instead (e.g. "9% below the barri closing average", "1965 building, ITE due"). Do not call the report or yourself "honest"; just be accurate.
- Tone: trustworthy proptech, concise, practical, no fluff. Distinguish asking vs closing prices when prices are discussed.
- PUNCTUATION: never use em-dashes (—) in any language. Use commas, colons, or parentheses instead.
- Spanish must be natural, native-quality Spanish (es-ES), not a literal translation.
- Catalan must be natural, native-quality Catalan (ca-ES, Central / Barcelona variant), not a literal translation from Spanish. Use proper Catalan terminology (e.g. "habitatge", "edifici", "cèdula d'habitabilitat", "fons de reserva", "derrama", "ITE") rather than Spanish loanwords.
- Keep each field tight: headline ≤ 14 words; body paragraphs 2–4 sentences; list items one sentence each.
- checklist: exactly 5 ON-SITE and PROCESS actions (fields first to fifth) (e.g. count mailboxes, inspect the roof, visit at different times, check reform permits, line up the mortgage decision-in-principle), including one for each finding in "alerts". The report already lists the documents to request (nota simple, cèdula, ITE, community minutes, …), so the checklist is what the buyer does, not what they request. Never return it empty.
- negotiationItems: 2–3 legitimate, fact-based reasons to negotiate the price down (e.g. building age/ITE obligations, asking-vs-closing gap). Each item is an object with two fields: "title" = a short bold label (3–6 words, e.g. "Asking above the area average"); "desc" = one sentence explaining the ground from the record. Do NOT put a € amount or % discount target in either field.
- negotiationTactic: explain HOW to use those levers (conditions to attach to the offer, what justifies a lower price). NEVER propose a specific opening offer or target € amount, a percentage discount, or a "settle near" figure, we cannot know a sound number from this data; the buyer sets it after a viewing.
Return ONLY the structured JSON.`;

/* ---------- generate + merge ---------- */

export async function generateNarrative(
  report: Report,
  input: ReportInput,
  /** Optional: receives token usage (used by scripts/ai-check.mts to measure cost). */
  onUsage?: (usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) => void,
): Promise<Report> {
  const client = createAnthropic();
  const facts = buildFacts(report, input);

  const message = await client.messages.parse({
    model: aiConfig.model,
    max_tokens: aiConfig.maxTokens,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `FACTS:\n${JSON.stringify(facts, null, 2)}`,
      },
    ],
    output_config: { format: zodOutputFormat(NarrativeSchema) },
  }, {
    // No SDK retries: one retry would double the buyer's wait past the
    // function time limit. A failed narrative falls back to the report
    // without AI prose, and is tried again on the next visit.
    timeout: aiConfig.timeoutMs,
    maxRetries: 0,
  });

  onUsage?.(message.usage);
  const n = message.parsed_output;
  if (!n) {
    throw new Error("AI returned no structured narrative (possible refusal).");
  }
  return mergeNarrative(report, n, facts);
}

/**
 * Merge generated prose into the Report without touching sourced facts.
 *
 * Each AI field is checked first (pipeline/narrative-guard.ts); a field that
 * fails keeps the fact-based text the report already has. The bottom line's
 * headline and body go together, so they never disagree.
 */
function mergeNarrative(report: Report, raw: Narrative, facts: unknown): Report {
  const r: Report = structuredClone(report);
  const g: GuardFacts = {
    known: [...numbersIn(facts), new Date().getFullYear(), 2002, 45],
    gapDirection: gapDirection(report.price.pricing?.deltaPct),
  };
  const kept: string[] = [];
  const use = (name: string, l: Narrative["verdictBody"], apply: (v: Narrative["verdictBody"]) => void) => {
    const problem = fieldProblem(l, g);
    if (problem) kept.push(`${name} (${problem})`);
    else apply(tidy(l));
  };

  // Bottom line: both or neither.
  const vp = fieldProblem(raw.verdictHeadline, g) ?? fieldProblem(raw.verdictBody, g);
  if (vp) kept.push(`verdict (${vp})`);
  else {
    r.verdict.headline = tidy(raw.verdictHeadline);
    r.verdict.body = tidy(raw.verdictBody);
  }
  use("snapshotNote", raw.snapshotNote, (v) => (r.snapshot.note = v));
  use("neighbourhoodLede", raw.neighbourhoodLede, (v) => (r.neighbourhood.lede = v));
  use("neighbourhoodNote", raw.neighbourhoodNote, (v) => (r.neighbourhood.note = v));

  // Building, legal, urbanism, costs and tax/subsidies are intentionally NOT
  // AI-written, they carry verified/maintained facts set deterministically
  // (seedBuilding, seedLegal, seedUrbanism, seedCostsTaxes).

  // Playbook: intro, levers and tactic go together.
  const levers = guardList(raw.negotiationItems, (i) => [i.title, i.desc], g, 2);
  const np = fieldProblem(raw.negotiationIntro, g) ?? fieldProblem(raw.negotiationTactic, g);
  if (np || !levers.kept) kept.push(`negotiation (${np ?? `too few usable levers: ${levers.dropped.join("; ") || "none returned"}`})`);
  else {
    r.negotiation.intro = tidy(raw.negotiationIntro);
    r.negotiation.items = levers.kept.map((i) => ({ title: tidy(i.title), desc: tidy(i.desc) }));
    r.negotiation.tactic = tidy(raw.negotiationTactic);
  }

  use("priceLede", raw.priceLede, (v) => (r.price.lede = v));
  use("priceFairValue", raw.priceFairValue, (v) => (r.price.fairValue = v));

  const c = raw.checklist;
  const checks = guardList(c ? [c.first, c.second, c.third, c.fourth, c.fifth] : [], (x) => [x], g, 4);
  if (!checks.kept) kept.push(`checklist (too few usable items: ${checks.dropped.join("; ") || "none returned"})`);
  else r.checklist = checks.kept.map(tidy);

  r.narrative = { source: "ai", ...(kept.length ? { factsKept: kept } : {}) };
  // Footer (sources & disclaimer) is deterministic, set by seedFooter.
  return r;
}
