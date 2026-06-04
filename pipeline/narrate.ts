import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createAnthropic } from "@/lib/anthropic";
import { aiConfig } from "@/config/ai";
import type { Report } from "@/types/report";
import type { ReportInput } from "@/types/db";
import { L } from "@/lib/localized";

/* ---------- output schema (strict JSON, bilingual) ---------- */

const Loc = z.object({ en: z.string(), es: z.string() });

const NarrativeSchema = z.object({
  verdictHeadline: Loc,
  verdictBody: Loc,
  verdictTag: Loc,
  snapshotNote: Loc,
  buildingGood: Loc,
  buildingScrutinise: Loc,
  buildingKeyline: Loc,
  legalIntro: Loc,
  legalItems: z.array(Loc),
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
  };
}

const SYSTEM = `You are a property due-diligence analyst writing a bilingual (English + Spanish) buyer dossier for a flat in Barcelona, aimed at foreign buyers.

STRICT RULES — these are non-negotiable:
- Ground EVERY statement in the FACTS JSON the user provides. Do NOT invent prices, comparables, €/m² figures, scores, legal facts, dates, or citations.
- If "hasMarketData" is false or "hasAskingPrice" is false, do NOT state any specific market price, €/m² comparison, or fair-value number. Instead say plainly that the price/market analysis is "to verify" / pending comparable data ("por verificar" in Spanish).
- If "hasMarketData" is true, the "comps" array holds nearby ASKING listings (idealista). In priceLede/priceFairValue you MAY compare the subject's asking €/m² to these comps — but ONLY using the numbers given. Always label them ASKING prices from a portal (not closing prices), note that recorded closings typically sit somewhat below asking, and frame the result as orientation for the buyer to confirm, never a definitive valuation.
- Where a fact is unknown, say it must be verified rather than guessing.
- Tone: trustworthy proptech — concise, practical, no fluff, honest. Distinguish asking vs closing prices when prices are discussed.
- Spanish must be natural, native-quality Spanish (es-ES), not a literal translation.
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

  r.building.panels = [
    { heading: { en: "What's good", es: "Lo bueno" }, body: n.buildingGood },
    {
      heading: { en: "What to scrutinise", es: "Lo que hay que escrutar" },
      body: n.buildingScrutinise,
    },
  ];
  r.building.keyline = n.buildingKeyline;

  r.legal.intro = n.legalIntro;
  r.legal.items = n.legalItems;

  r.neighbourhood.lede = n.neighbourhoodLede;
  r.neighbourhood.note = n.neighbourhoodNote;

  // Urbanism, costs and tax/subsidies are intentionally NOT AI-written — they
  // carry verified/maintained facts set deterministically (seedUrbanism,
  // seedCostsTaxes).

  r.negotiation.intro = n.negotiationIntro;
  r.negotiation.items = n.negotiationItems;
  r.negotiation.tactic = n.negotiationTactic;

  r.price.lede = n.priceLede;
  r.price.fairValue = n.priceFairValue;

  r.checklist = n.checklist;

  // Keep a standard bilingual disclaimer if the operator hasn't set one.
  if (!L(r.footer.disclaimer, "en")) {
    r.footer.disclaimer = {
      en: "This dossier is an orientation tool and does not replace a professional technical survey, legal review, or mortgage valuation. Figures marked “estimate” or “to verify” must be confirmed before you commit.",
      es: "Este dosier es una herramienta de orientación y no sustituye un informe técnico profesional, una revisión legal ni una tasación hipotecaria. Las cifras marcadas como «estimación» o «por verificar» deben confirmarse antes de comprometerte.",
    };
  }
  return r;
}
