---
description: Orient a fresh chat to the PisoWise project before doing any work.
---

You're a fresh agent joining the **PisoWise** project — a Barcelona property
due-diligence tool. Before responding to whatever the user asks next, do the
following in order, then briefly confirm what you've understood.

## 1. Read the canonical docs

- **`AGENTS.md`** (repo root) — the load-bearing one. Covers:
  - The audience + ethical stance: local first-time buyers, **not** foreign
    investors, **not** the tourist-home / short-let market.
  - Code conventions that are easy to violate silently: adapters never throw,
    seeders are pure (`structuredClone`), `Localized = { en, es }` for any
    prose, `toVerify: true` on anything but a confident `ok`, the three
    Supabase clients (`admin` / `server` / `client`) are not interchangeable,
    and the difference between `report.alerts[]` and `urbanism.items[]`.
- **`README.md`** — project purpose, current state, data sources, layout.
- **`types/report.ts`** — the `Report` shape you'll be reading/writing.
- **`pipeline/generate.ts`** — the report-generation flow (catastro lookup →
  adapters in parallel → seeders → DB write). This is the spine.

Optional, only if relevant to the task:
- **`adapters/*.ts`** — one per external data source; same contract.
- **`pipeline/template.ts`** — the `seedX(report, data)` functions.
- **`components/report/ReportView.tsx`** — how the report renders.
- The AFH-endpoint reference lives in user memory at
  `~/.claude/projects/-Users-johan-Documents-Flat-analyser-Barcelona/memory/bcn-afh-affectation-endpoint.md`.

## 2. Know the operational facts

- **Live at https://llar.vercel.app**; Vercel auto-deploys on push to `main`.
  So default to **working on a feature branch**, not main.
- **Vercel env vars are set for Production only**, not Preview. PR-branch
  previews can't currently generate reports (Supabase / Anthropic missing).
  Don't be surprised by it; verify changes locally instead.
- **Local dev**: `npm run dev`, then http://localhost:3000/ca (default locale).
  `.env.local` already has Supabase + Anthropic keys.
- **To see the full report past the paywall**: sign in at `/admin/login` as
  any Supabase Auth user. The gate in `app/[locale]/report/[id]/page.tsx`
  treats any authenticated user as the operator.
- **Git remote** is HTTPS + macOS Keychain — pushes work without prompts.

## 3. Before writing code

- **Confirm your understanding back to the user** in 2–3 sentences and ask any
  clarifying questions. Don't dive into edits cold.
- **If you're adding a new external data source**, propose the approach first
  (which endpoint, what it costs in latency, what failure mode). The user
  cares about data quality and will likely have a view.
- **If you're touching planning / affectation / heritage code**, you're in the
  `urbanism` family — read `adapters/urbanism.ts`, `affectation.ts`,
  `heritage.ts`, and `pipeline/template.ts:seedUrbanism` first; the section
  was rebuilt as plain-language status rows and the conventions are non-obvious.
- **Don't add a `console.log` to debug and leave it.** Use the `note` field on
  `AdapterResult` for diagnostic info.

Now read the files above and tell me what you've understood + what you'd like
to clarify before we start on the task.
