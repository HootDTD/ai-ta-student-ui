---
doc: apollo/kg-panel
description: ApolloKGPanel
owns:
  - components/apollo/ApolloKGPanel.tsx
related: [apollo/kg-entry-pill, apollo/api-client, shared-ui/math-markdown, apollo/session-page]
last_verified: 2026-07-25
stub: false
---

# ApolloKGPanel

"Apollo's understanding" open-learner-model KG panel (~304 lines).

## Interface
default `ApolloKGPanel({kg:ApolloKG, sessionId?, pulseEntryId?:string|null,
onKgUpdated?(kg), onEntryTouched?(entryId)})`.

## Data flow
Buckets `kg.nodes` into six sections, each labelled with a muted `.eyebrow` under
the serif `.apollo-kg__title`; **only non-empty sections render** (total 0 ⇒ a
single quiet line): Equations (`react-katex` `InlineMath` on
`content.latex ?? content.symbolic`), Conditions, Simplifications, Definitions,
Variable mappings (`term → symbol`), Procedure steps (topologically ordered by
`PRECEDES` edges with cycle/orphan fallback to insertion order, annotated "uses
{equation labels}" from `USES` edges). The `MaybePill` helper wraps each entry in
`KGEntryPill` when `sessionId` is provided (negotiation UI on hover/focus); when
undefined, entries render **bare** (pre-P3 read-only, preserved for report/legacy).
`pulseEntryId` scrolls the matching `[data-entry-id]` into view.

## Invariants & gotchas
- Rendered by `ApolloPageClient` inside a right off-canvas `.apollo-kg-drawer`
  toggled by the top-bar "Understanding" button (keeps the chat a single centered
  column).
- This is the `react-katex` `InlineMath` renderer — the intentional counterpart to
  shared `MathMarkdown`; do not conflate.
- `ApolloPageClient` passes only `kg`/`sessionId`/`onKgUpdated`; `pulseEntryId`
  and `onEntryTouched` are unused there (P3.5 wiring).

## Related
- [kg-entry-pill.md](kg-entry-pill.md), [api-client.md](api-client.md),
  [math-markdown.md](../shared-ui/math-markdown.md), [session-page.md](session-page.md).
