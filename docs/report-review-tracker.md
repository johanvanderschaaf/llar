# Report content review — progress tracker

Working through the report-output review (content first, design handed to Claude
Design later). Status legend: ✅ done · 🟡 doing · ⬜ todo.

**Agreed product decision:** the **barri closing-price** benchmark (Gencat
Habitatge, registered notarial deeds) is the **single price anchor**. We are NOT
getting idealista/Fotocasa data, so portal asking figures are removed from the
report copy and the pipeline narrative.

## Batch A — mechanical / low-risk

| # | Point | Status |
|---|---|---|
| 3 | Remove "built/year" from the hero meta strip (already shown in Property snapshot) | ✅ sample + live pipeline (`template.ts`) |
| 7 | No em-dashes anywhere; replace with commas / colons / parentheses | ✅ swept buyer-facing copy (sample, `messages/{en,es,ca}.json`, `config/*.ts`, `pipeline/template.ts`, `narrate.ts`) + comps-table empty-cell placeholders in `ReportView.tsx` (now en-dash). Added "no em-dash" rule to the AI prompt. En-dashes in numeric ranges left intact. Verified 0 em-dashes in the rendered sample report. |
| 8 | Move price-section range low/high labels up to sit in line with the barri-avg label | ✅ `PriceSection.module.css` `.ends` margin-top 74px → 18px. NOTE: not yet visually confirmed — the sample fixture has no `pricing` payload so `PriceSection` only renders for live pipeline reports; confirm during batch B. |

## Batch B — price section (single anchor = barri closing prices) ✅

Enabling change: the sample now derives its price section from the SAME code path
as generated reports — `buildPricingPayload` (exported from `pipeline/template.ts`)
fed by the real Vila de Gràcia row in `bcn-barri-prices.json`. Footer likewise via
`buildFooter`. So preview == generated and both stay current automatically.

| # | Point | Status |
|---|---|---|
| 5 | Bottom line leads with flat type + position vs barri closing avg, facts-first, no portals | ✅ sample `verdict` rewritten; `narrate.ts` prompt given a BOTTOM LINE rule (lead with type + closing position, or a serious flaw first; never claim closing/comparable data missing when we have it) |
| 9 | "Closing prices" stated once in the price section | ✅ kept once in the verdict; dropped from compare label ("Barri average") and evidence title ("price benchmark"); footer tightened |
| 10a | `asOf` period localised per language | ✅ new `lib/period.ts` → evidence panel; `narrate.ts` told to translate the Catalan period. EN "January 2025 – December 2025", ES "enero…diciembre" verified |
| N3 | Single anchor = barri closing; no idealista/Fotocasa | ✅ removed from sample comps, footer (`config/footer.ts`), and `narrate.ts` facts+prompt. Page has zero portal mentions |
| N4 | Comps table | ✅ removed from `ReportView`; sample `comps: []` (matches generated reports, which have none) |

**Carry-overs noted during B (not blocking):**
- Sample's legacy `price.{lede,panels,fairValue,ladder}` are now unused by the render but still hold old portal/"fair" text (type requires them; not visible). Clean when we retire the legacy render path.
- `seedBarriPricing` still calls `buildLiveSearches` (portal deep links) → `price.liveSearches`, which nothing renders. Optional cleanup.
- Hero `sub` still says "priced broadly in line with the barrio" / "honest read" — overlaps the bottom line and is now mildly inconsistent with "9% below". → batch C (voice) / D (redundancy).
- `negotiation` still contains "Asking ≠ closing" and the price-section verdict still ends "…a fair range" (`positionPhrase`/`chipForDelta` "Fairly priced") → batch C.
- EN copy still uses the Catalan word "barri" → batch E (10b language consistency).

## Batch C — voice / facts-first ✅

| # | Point | Status |
|---|---|---|
| 2 | Facts first, no price/value verdicts | ✅ Shared pricing code de-interpreted (`chipForDelta` → "Within/Below/Above the barri range"; `positionPhrase` → "…of the barri range"; state-02 verdict "flats this size closed between…"). Sample prose de-judged (hero sub, score captions, building panel, neighbourhood note, negotiation, legal intro). Message strings ("Fair price range" → "Price range", "fair-value range" → "price range"). `narrate.ts` given a global FACTS-FIRST rule. |
| 6 | No score in bottom-line prose | ✅ prose cites no number; the score ring stays as a separate design element |
| N1 | Editorial meta-commentary | ✅ removed ("earlier drafts… corrected here" gone with the purged legacy `fairValue`) |
| N2 | Verdict tag facts-based | ✅ sample tag "Asking below the barri average"; `narrate.ts` requires a factual `verdictTag` (no "Solid buy"/"Worth a viewing") |
| N6 | Trim "honest" framing | ✅ removed "honest read" (hero sub) and "Honest note" (neighbourhood); landing-page "honest" marketing left untouched (out of report scope) |

**Carry-overs noted during C (not blocking):**
- Preview-mode band tags (`preview.tagGood`/`tagOk`/`tagLow` = "Worth a viewing" / "Check carefully" / "Proceed with caution") are still recommendations shown on the locked preview. They can't be made fact-specific (the preview hides specifics) — flagged as a preview-UX decision for you, left as-is for now.
- Building panel heading "What's good / What to scrutinise" kept (a functional pros/scrutinise label, not a price verdict).
- EN copy still uses "barri" (and now "barri range") → batch E (10b language consistency).

## Batch D — structure / redundancy ✅

| # | Point | Status |
|---|---|---|
| 11 | Legal vs checklist overlap | ✅ Clean split by type. **Legal = documents to request** (sample now derives from `buildLegal()`, which gained "división horizontal"; matches generated reports). **Checklist = on-site + process actions only** (count mailboxes, inspect roof, visit at different times, check reform permits, line up mortgage) with zero document overlap. `narrate.ts` prompt updated to keep the same split. |
| 1 | De-duplicate repeated facts | ✅ (the clear wins) Document list no longer duplicated across legal + checklist (point 11). Bottom line trimmed: dropped the energy-class recap (already in hero meta + risk row + score caption) and added a "don't recap every section, 3–4 sentences" rule to the AI prompt. The "→" arrows in the checklist are gone. |

**Carry-over on point 1 (for the design phase):** some facts still recur across sections by design — year built (snapshot / building / risk / score caption), ITE (building / risk / legal / negotiation), Clikalia resale (snapshot / bottom line / negotiation), price (hero / bottom line / price section). Each is a different *angle* (fact vs risk vs document vs lever), so sections stay self-contained for scanning. Whether to collapse these into a single shared fact bar is a layout decision best made with Claude Design, not by deleting prose now. Flagged, not changed.

## Batch E — copy polish ✅

| # | Point | Status |
|---|---|---|
| 4 | Eyebrow | ✅ New per-report eyebrow "Independent buyer's report · {date}" (date localised per locale). Added `report.eyebrow` message; `ReportView` appends `dateFmt` (now ca-aware). Landing keeps its own `hero.eyebrow`. |
| 10b | Language consistency | ✅ EN standardised on **"neighbourhood"** (matches the section-07 title); ES keeps **"barrio"**, CA keeps **"barri"**. Verified per locale: EN barri/barrio = 0, ES neighbourhood/Catalan-barri = 0, CA neighbourhood/barrio = 0. Document terms (nota simple, cédula, ITE, división horizontal, actas, derrama) kept with glosses. Months already localised in batch B. |
| N7 | "→" arrows | ✅ Removed from building panels (sample + `config/building.ts`) and the checklist; rewritten as plain sentences. The CTA arrow on the landing "Generate preview →" button left as a standard UI affordance. |

**Decisions for the design phase (Claude Design):**
- "Neighbourhood avg" / "Neighbourhood average" are longer than the old "Barri avg" in the compact number-line labels — may need width tuning or abbreviation.
- Locked-preview band tags ("Worth a viewing" etc.) still read as recommendations (see batch C note).
- Cross-section fact repetition (year built, ITE, price) is intentional/structural — candidate for a single shared fact bar (see batch D note).
