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
    comps: report.price.comps
      .filter((c) => !c.highlight)
      .map((c) => ({
        area: typeof c.reference === "string" ? c.reference : c.reference.en,
        price: c.price,
        size: c.size,
        pricePerM2: c.pricePerM2,
      })),
    hasMarketData: report.price.comps.some((c) => !c.highlight),
    hasAskingPrice: Boolean(input.askingPriceEur),
    // Authoritative barri-level CLOSING-price benchmark (Generalitat Habitatge,
    // registered notarial deeds) — the primary price anchor for Section 03. This
    // is distinct from `comps` (idealista ASKING listings). Present in pricing
    // states 01/02; absent in state 03.
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

STRICT RULES — these are non-negotiable:
- Ground EVERY statement in the FACTS JSON the user provides. Do NOT invent prices, comparables, €/m² figures, scores, legal facts, dates, or citations.
- LOCATION: refer to the neighbourhood ONLY by the barri and district given in the FACTS (the "neighbourhood" snapshot fact and "barriClosing.barri"). NEVER infer, rename, or guess a barri / district / neighbourhood from the street address or your own knowledge. If the FACTS say the location is "la Vila de Gràcia · Gràcia", do not call it Eixample or anything else.
- PRICE ANCHOR: when "hasBarriBenchmark" is true, "barriClosing" is the authoritative price reference — the average €/m² that flats in this barri actually CLOSE at (registered notarial deeds, period "barriClosing.asOf"). Use it in priceLede/priceFairValue, clearly labelled as a CLOSING-price average (never call it asking), and compare the subject's asking €/m² to it only when "hasAskingPrice" is true. Frame as orientation, not a definitive valuation.
- "comps" (only when "hasMarketData" is true) are nearby ASKING listings (idealista) — secondary context only; label them ASKING and note recorded closings sit somewhat below asking.
- Only if "hasBarriBenchmark", "hasMarketData" AND "hasAskingPrice" are ALL false may you say the price/market analysis is "to verify" / pending data ("por verificar" in Spanish, "per verificar" in Catalan). If "hasBarriBenchmark" is true you DO have a closing-price benchmark — use it, do not say comparable data is missing.
- Where a fact is unknown, say it must be verified rather than guessing.
- Tone: trustworthy proptech — concise, practical, no fluff, honest. Distinguish asking vs closing prices when prices are discussed.
- Spanish must be natural, native-quality Spanish (es-ES), not a literal translation.
- Catalan must be natural, native-quality Catalan (ca-ES, Central / Barcelona variant), not a literal translation from Spanish. Use proper Catalan terminology (e.g. "habitatge", "edifici", "cèdula d'habitabilitat", "fons de reserva", "derrama", "ITE") rather than Spanish loanwords.
- Keep each field tight: headline ≤ 14 words; body paragraphs 2–4 sentences; list items one sentence each.
- legalItems: the standard get-before-you-offer documents for a Catalonia resale (nota simple, cédula d'habitabilitat, valid ITE, community minutes/actas, pending derrama, updated energy certificate, surface check). 5–7 items.
- checklist: 5–7 concrete pre-offer actions.
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
  // AI-written — they carry verified/maintained facts set deterministically
  // (seedBuilding, seedLegal, seedUrbanism, seedCostsTaxes).

  r.negotiation.intro = n.negotiationIntro;
  r.negotiation.items = n.negotiationItems;
  r.negotiation.tactic = n.negotiationTactic;

  r.price.lede = n.priceLede;
  r.price.fairValue = n.priceFairValue;

  r.checklist = n.checklist;

  // Footer (sources & disclaimer) is deterministic — set by seedFooter.
  return r;
}
