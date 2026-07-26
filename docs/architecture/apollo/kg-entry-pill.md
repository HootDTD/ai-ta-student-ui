---
doc: apollo/kg-entry-pill
description: KGEntryPill
owns:
  - components/apollo/KGEntryPill.tsx
related: [apollo/kg-entry-cards, apollo/kg-panel, apollo/api-client, apollo/kg-proxies]
last_verified: 2026-07-25
stub: false
---

# KGEntryPill

Per-KG-entry P3 negotiation wrapper (~228 lines) — the student's only handle on
negotiation state.

## Interface
default `KGEntryPill({sessionId, node:ApolloNode, children, onUpdated?(entry, kg),
pulseHint?})`. `children` is the entry's surface form (**render-prop** — the
parent decides how each node type renders), so the pill is type-agnostic.

## Data flow
Shows a confidence dot from `node.parser_confidence` (green ≥0.8 / yellow ≥0.5 /
red; legacy default 1.0), a status badge ("disputed" for DISPUTED; "your wording"
or "skipped" for DUAL depending on `student_belief`), and four buttons: **?**
challenge, **✎** paraphrase, **↩** skip (immediate, no card), **…** trace. It owns
the API calls (`challengeEntry`/`paraphraseEntry`/`skipEntry`/`getEntryTrace`) and
bubbles `(entry, kg)` up via `onUpdated`. It renders the three inline cards (see
`kg-entry-cards.md`); the trace is fetched lazily and cached.

## Invariants & gotchas
- Sets `data-entry-id` / `data-entry-status`; `pulseHint` adds `kg-pill--pulse`.
- Only one card is expanded at a time (`Expanded` state machine).

## Related
- [kg-entry-cards.md](kg-entry-cards.md), [kg-panel.md](kg-panel.md) (parent),
  [api-client.md](api-client.md), [kg-proxies.md](kg-proxies.md).
