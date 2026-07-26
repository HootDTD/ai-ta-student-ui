---
doc: apollo/report-panel
description: ApolloReportPanel
owns:
  - components/apollo/ApolloReportPanel.tsx
related: [shared-ui/math-markdown, apollo/api-client, apollo/session-page]
last_verified: 2026-07-25
stub: false
---

# ApolloReportPanel

Post-Done report (~66 lines).

## Interface
default `ApolloReportPanel({report:DoneResponse, onRetry(), onEnd(), onNext(),
busy?})`.

## Data flow
Tone `success`/`danger` is keyed on `rubric.overall.score >= 75` (`PASS_SCORE`) —
the numeric score is used **only** for tone. The student-facing display is
deliberately minimal (2026-07-14): the overall **letter** grade only (no numeric
score / percentage), the `diagnostic_narrative` rendered through shared
`MathMarkdown` (`.prose.md-body`), and nav buttons "Next problem" / "Try again
from scratch" (retry = fresh-slate new empty attempt) / "End session".

## Invariants & gotchas
- **Removed from render** (still present in the `DoneResponse` payload): numeric
  score, topic checklist, three-axis rubric rows, per-misconception sub-rows, XP
  line, level-up banner — so `.apollo-topics`/`.apollo-topic__*`/`.apollo-rubric`
  CSS is now unreferenced by this panel.
- Migration-window note: the payload prefers `report.progress.*` but falls back to
  the flat `xp_*` fields (neither is currently rendered here).

## Related
- [math-markdown.md](../shared-ui/math-markdown.md), [api-client.md](api-client.md),
  [session-page.md](session-page.md).
