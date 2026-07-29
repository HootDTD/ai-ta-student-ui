---
doc: apollo/coverage-celebrations
description: ApolloCoverageCelebrations
owns:
  - components/apollo/ApolloCoverageCelebrations.tsx
related: [apollo/session-page, apollo/api-client]
last_verified: 2026-07-25
stub: false
---

# ApolloCoverageCelebrations

Right-pinned covered-topic feedback (~68 lines).

## Interface
default `ApolloCoverageCelebrations({celebrating:CoverageCelebration[],
covered:CoverageCelebration[]})`; `CoverageCelebration = {eventId:number,
displayName:string}` (type exported here).

## Data flow
Two coupled surfaces: `celebrating` = transient sparkle pops (drawn checkmark +
burst + shine, one per newly-covered topic, in an `aria-live="polite"` region);
`covered` = a persistent "Topics covered" checklist (compact green-check rows,
scrolls past `min(46vh, 24rem)`). Renders `null` when both are empty.

## Invariants & gotchas
- **Dedup (by `node_id` AND normalized `display_name`) and per-attempt reset are
  owned by `ApolloPageClient`** (fed from `ChatResponse.covered_topics` via the
  chat's `onCoverageSnapshot`), so each topic celebrates + lists exactly once; the
  parent clears each pop on a ~3.6s timer.

## Related
- [session-page.md](session-page.md), [api-client.md](api-client.md).
