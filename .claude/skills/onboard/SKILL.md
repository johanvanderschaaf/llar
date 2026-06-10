---
name: onboard
description: Background knowledge about this project's implementation details. Use when working on changes, debugging, or understanding how the system works.
user-invocable: false
---

# PisoWise onboarding pack

Reference docs for parts of the codebase that aren't covered by [README](../../../README.md) or [AGENTS.md](../../../AGENTS.md).
Read those two first — these docs assume them.

| Doc | When to read |
|---|---|
| [DATA_SCHEMA.md](./DATA_SCHEMA.md) | Touching the `Report` shape, the committed JSON datasets, the DB rows, or `report_sources` provenance. |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Adding or fixing an adapter — endpoint URLs, auth, cache TTLs, file formats. |
| [PIPELINE_FLOW.md](./PIPELINE_FLOW.md) | Editing `pipeline/generate.ts` or wondering why a section seeds in one state vs another. |
| [SCORING.md](./SCORING.md) | Touching the score — the five pillars, weights, the risk override, or the missing-data flags. |
| [REFRESH_SCRIPTS.md](./REFRESH_SCRIPTS.md) | Refreshing the static datasets (Gencat barri prices, BCN polygons) or adding a new refresh script. |
