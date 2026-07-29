---
doc: apollo/kg-entry-cards
description: Dispute+Paraphrase+Trace cards
owns:
  - components/apollo/KGEntryDispute.tsx
  - components/apollo/KGEntryParaphrase.tsx
  - components/apollo/KGEntryTrace.tsx
related: [apollo/kg-entry-pill, apollo/api-client]
last_verified: 2026-07-25
stub: false
---

# KG entry cards

The three inline expandable cards `KGEntryPill` reveals (grouped — all small, all
children of the pill).

## Interface
- `KGEntryDispute({busy, onCancel, onSubmit(reason)})` — free-text reason, max
  **500** chars (`MAX_REASON`), with a char counter.
- `KGEntryParaphrase({busy, initialValue, onCancel, onSubmit(surfaceForm)})` — max
  **1000** chars (`MAX_FORM`); only the surface **wording** changes — structural
  fields are never mutated by the backend.
- `KGEntryTrace({trace:NegotiationTrace, onClose})` — read-only "Apollo's wiring"
  card: source-utterance quote + chronological move list (actor · move · time,
  with challenge reason / paraphrase text quoted), styled in a non-Apollo gray
  voice to read as system metadata.

## Invariants & gotchas
- The `500`/`1000` char limits are **frontend copies of backend contracts** —
  change both sides together.
- Submit is gated on non-empty, non-over-limit, not-busy.

## Related
- [kg-entry-pill.md](kg-entry-pill.md), [api-client.md](api-client.md).
