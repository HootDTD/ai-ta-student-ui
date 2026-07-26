---
doc: apollo/browse
description: ApolloBrowse + ApolloSidebar
owns:
  - components/apollo/ApolloBrowse.tsx
  - components/apollo/ApolloSidebar.tsx
related: [apollo/api-client, apollo/top-bar, shared-ui/entry-chrome, shell/layout-and-design-system]
last_verified: 2026-07-25
stub: false
---

# ApolloBrowse + ApolloSidebar

The standalone concept → difficulty → problem picker at `/apollo?class=N` (no
Hoot transcript, no LLM inference) + its nav sidebar.

## Interface
- `ApolloBrowse({classId, onStarted(sessionId)})` (~214 lines).
- `ApolloSidebar({concepts, conceptId, onSelect(id), open, onClose})` (~54 lines).

## Data flow
`ApolloBrowse` fetches `listConcepts`/`listProblems`, rendering `ApolloTopBar` +
`ApolloSidebar` in a real two-column `.apollo-layout` (sidebar = persistent
full-height page-side column on desktop, off-canvas drawer on mobile — the same
split as Hoot's `.chat-sidebar` + `flex-1` shell, NOT nested in the centered
column). The welcome state reuses `.empty-greeting` + `<OwlVideo>` until a concept
is chosen, then a difficulty tablist + problem cards (+ a "Surprise me" button
that starts with no `problemId`). "Start teaching" / a card's button calls
`startSession` then `onStarted(session_id)`.
`ApolloSidebar` lists concepts (keyed by `concept_id`), sets `aria-current="true"`
on the active one, and closes on outside-click / Escape when `open`.

## Invariants & gotchas
- Problem statements >180 chars start as previews with an accessible "Show full
  problem"/"Show less" toggle (reset when concept/difficulty changes); the toggle
  is independent of starting a session.

## Related
- [api-client.md](api-client.md), [top-bar.md](top-bar.md),
  [entry-chrome.md](../shared-ui/entry-chrome.md) (OwlVideo),
  [layout-and-design-system.md](../shell/layout-and-design-system.md)
  (`.apollo-layout`).
