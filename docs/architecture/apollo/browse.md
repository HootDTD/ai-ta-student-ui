---
doc: apollo/browse
description: ApolloBrowse + ApolloSidebar
owns:
  - components/apollo/ApolloBrowse.tsx
  - components/apollo/ApolloSidebar.tsx
related: [apollo/api-client, apollo/top-bar, shared-ui/entry-chrome, shell/layout-and-design-system]
last_verified: 2026-07-27
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
- **Grade display (2026-07-26):** a problem with `grade` ({score, letter} = the
  student's best served grade, from `ApolloProblemSummary`) renders a letter
  chip (`.apollo-browse__grade--{band}`) instead of the "Tried" badge, and the
  card tints to the band (`.apollo-browse__card--grade-{band}`). `gradeBand()`
  maps `letter[0]` → a|b|c|d|f; an unknown letter (or `grade` absent on older
  backends) degrades to the plain attempted state — never an unstyled chip.
- **Feedback on chip click (2026-07-27):** when `grade.feedback` is a non-empty
  string, the chip renders as a `<button>` (`.apollo-browse__grade--clickable`,
  `aria-expanded`/`aria-controls`) toggling an in-card `.apollo-browse__feedback`
  panel — eyebrow "Your feedback" + the narrative via `MathMarkdown` (grading
  feedback carries LaTeX), band-colored left rule. Open state lives in
  `openFeedbackIds`, reset on concept/difficulty change like the text previews.
  No/empty feedback (or an older backend) → the chip stays the static `<span>`
  — never a dead-click button.

## Related
- [api-client.md](api-client.md), [top-bar.md](top-bar.md),
  [entry-chrome.md](../shared-ui/entry-chrome.md) (OwlVideo),
  [layout-and-design-system.md](../shell/layout-and-design-system.md)
  (`.apollo-layout`).
