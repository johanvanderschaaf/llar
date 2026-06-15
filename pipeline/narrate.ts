import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createAnthropic } from "@/lib/anthropic";
import { aiConfig } from "@/config/ai";
import type { Report } from "@/types/report";
import type { ReportInput } from "@/types/db";
import { L } from "@/lib/localized";

/* ---------- output schema (strict JSON, trilingual) ---------- */

const Loc = z.object({ en: z.string(), es: z.string(), ca: z.string() });

const NarrativeSchema = z.object({
  verdictHeadline: Loc,
  verdictBody: Loc,
  verdictTag: Loc,
  snapshotNote: Loc,
  neighbourhoodLede: Loc,
  neighbourhoodNote: Loc,
  negotiationIntro: Loc,
  negotiationItems: z.array(Loc),
  negotiationTactic: Loc,
  priceLede: Loc,
  priceFairValue: Loc,
  checklist: z.array(Loc),
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
  };
}

const SYSTEM = `You are a property due-diligence analyst writing a trilingual (English + Spanish + Catalan) buyer dossier for a flat in Barcelona, aimed at local first-time buyers planning to live in the flat (not foreign investors, not short-let / tourist-home operators).

STRICT RULES, these are non-negotiable:
- Ground EVERY statement in the FACTS JSON the user provides. Do NOT invent prices, comparables, €/m² figures, scores, legal facts, dates, or citations.
- LOCATION: refer to the neighbourhood ONLY by the barri and district given in the FACTS (the "neighbourhood" snapshot fact and "barriClosing.barri"). NEVER infer, rename, or guess a barri / district / neighbourhood from the street address or your own knowledge. If the FACTS say the location is "la Vila de Gràcia · Gràcia", do not call it Eixample or anything else.
- PRICE ANCHOR: when "hasBarriBenchmark" is true, "barriClosing" is the authoritative price reference, the average €/m² that flats in this barri actually CLOSE at (registered notarial deeds, period "barriClosing.asOf"). Use it in priceLede/priceFairValue, clearly labelled as a CLOSING-price average (never call it asking), and compare the subject's asking €/m² to it only when "hasAskingPrice" is true. Frame as orientation, not a definitive valuation. State the closing nature of the figure ONCE; do not repeat "closing prices" in every sentence.
- BOTTOM LINE (verdictHeadline + verdictBody): lead with what the flat factually is (size, condition, floor, barri) and where its asking price sits versus the barri closing-price average. If the FACTS carry a serious finding (a planning affectation, heritage protection, or high flood risk), lead with that instead, then the price position. Then one or two facts that most affect the decision. Keep it to 3 to 4 sentences: do NOT recap every section (skip energy class, amenities, etc. unless decisive). State facts only: do NOT pass a verdict on the price (never "fair", "good", "a bargain", "reasonable", "overpriced", "solid buy"), and do NOT cite the numeric score.
- We do NOT ingest portal listings: never invent or mention idealista / Fotocasa / asking-price comparables. Never say comparable or closing data is "missing" or "to verify" when "hasBarriBenchmark" is true. Only if BOTH "hasBarriBenchmark" and "hasAskingPrice" are false may you say the price analysis is pending data ("por verificar" in Spanish, "per verificar" in Catalan).
- PERIOD: "barriClosing.asOf" arrives in Catalan (e.g. "gener 2025 - desembre 2025"). When you state the period, write the month names in the language you are writing (EN "January to December 2025", ES "enero a diciembre de 2025"), never leave Catalan months in the English or Spanish text.
- Where a fact is unknown, say it must be verified rather than guessing.
- FACTS-FIRST, in EVERY field: state facts and figures and let the buyer judge. Do NOT editorialise the flat or its price with verdict words in any language ("fair"/"justo"/"just", "good"/"bueno"/"bo", "great", "a bargain"/"chollo"/"ganga", "reasonable"/"razonable"/"raonable", "overpriced"/"sobrevalorado", "prime", "solid", "strong"). Describe instead (e.g. "9% below the barri closing average", "1965 building, ITE due"). Do not call the report or yourself "honest"; just be accurate.
- verdictTag: a short FACTUAL descriptor (max ~6 words), not a recommendation, e.g. "Asking below the barri average" or "Planning affectation on the finca", never "Solid buy" / "Worth a viewing".
- Tone: trustworthy proptech, concise, practical, no fluff. Distinguish asking vs closing prices when prices are discussed.
- PUNCTUATION: never use em-dashes (—) in any language. Use commas, colons, or parentheses instead.
- Spanish must be natural, native-quality Spanish (es-ES), not a literal translation.
- Catalan must be natural, native-quality Catalan (ca-ES, Central / Barcelona variant), not a literal translation from Spanish. Use proper Catalan terminology (e.g. "habitatge", "edifici", "cèdula d'habitabilitat", "fons de reserva", "derrama", "ITE") rather than Spanish loanwords.
- Keep each field tight: headline ≤ 14 words; body paragraphs 2–4 sentences; list items one sentence each.
- legalItems: the standard get-before-you-offer DOCUMENTS to request for a Catalonia resale (nota simple, cédula d'habitabilitat, división horizontal, valid ITE, community minutes/actas, pending derrama, updated energy certificate, surface check, up-to-date community-fee certificate). 5–8 items.
- checklist: 4–6 ON-SITE and PROCESS actions only (e.g. count mailboxes, inspect the roof, visit at different times, check reform permits, line up the mortgage decision-in-principle). Do NOT repeat the documents listed in legalItems; the checklist is what the buyer does, not what they request.
- negotiationItems: 2–3 legitimate, fact-based negotiation levers.
Return ONLY the structured JSON.`;

/* ---------- generate + merge ---------- */

export async function generateNarrative(
  report: Report,
  input: ReportInput,
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
  });

  const n = message.parsed_output;
  if (!n) {
    throw new Error("AI returned no structured narrative (possible refusal).");
  }
  return mergeNarrative(report, n);
}

/** Merge generated prose into the Report without touching sourced facts. */
function mergeNarrative(report: Report, n: Narrative): Report {
  const r: Report = structuredClone(report);

  r.verdict.headline = n.verdictHeadline;
  r.verdict.body = n.verdictBody;
  r.verdict.tag = n.verdictTag;
  r.snapshot.note = n.snapshotNote;

  r.neighbourhood.lede = n.neighbourhoodLede;
  r.neighbourhood.note = n.neighbourhoodNote;

  // Building, legal, urbanism, costs and tax/subsidies are intentionally NOT
  // AI-written, they carry verified/maintained facts set deterministically
  // (seedBuilding, seedLegal, seedUrbanism, seedCostsTaxes).

  r.negotiation.intro = n.negotiationIntro;
  r.negotiation.items = n.negotiationItems;
  r.negotiation.tactic = n.negotiationTactic;

  r.price.lede = n.priceLede;
  r.price.fairValue = n.priceFairValue;

  r.checklist = n.checklist;

  // Footer (sources & disclaimer) is deterministic, set by seedFooter.
  return r;
}
