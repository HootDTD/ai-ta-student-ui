---
doc: apollo/report-panel
description: ApolloReportPanel
owns:
  - components/apollo/ApolloReportPanel.tsx
related: [shared-ui/math-markdown, apollo/api-client, apollo/session-page]
last_verified: 2026-07-26
stub: false
---

# ApolloReportPanel

Post-Done report: the per-topic feedback **scorecard** (2026-07-26, backend
contract = ai-ta-backend PR #200; reverses the 2026-07-14 letter-only minimal
display).

## Interface
default `ApolloReportPanel({report:DoneResponse, onRetry(), onEnd(), onNext(),
busy?})`.

## Data flow
Tone `success`/`danger` is keyed on `rubric.overall.score >= 75` (`PASS_SCORE`).
Render ladder, best-available first:
1. **Scorecard** (`report.topics` non-empty): grade header (letter + overall
   credit bar), topic rows sorted by `weight` desc — each a `<details
   class="apollo-topic" data-status=…>` with status glyph, `display_name`,
   credit bar + whole-number percent; expanded body shows the topic's
   `feedback.topic_feedback[]` note (matched by `canonical_key`, rendered via
   `MathMarkdown`) and a "You said:" quote. When `report.feedback` exists, its
   `headline` renders above the list, `recap[]` as muted lines, `next_step` as
   a `.notice` callout footer, and the flat `diagnostic_narrative` is
   **suppressed** (same content, flattened). Without `feedback`, topics still
   render and the narrative `<details>` appears as before.
2. No topics → legacy rubric fallback + `diagnostic_narrative` (pre-topic-score
   behavior, unchanged).
Quote source (`resolveQuote`): with a feedback block, ONLY its (already
backend-gated) `quote`; without one, fall back to the topic's own
`evidence_span`. Nav buttons "Next problem" / "Try again from scratch" (retry =
fresh-slate new empty attempt) / "End session" unchanged.

## Invariants & gotchas
- **Deploy-order safe:** every scorecard field (`feedback`, `evidence_span`) is
  optional — against a pre-PR#200 backend the panel renders exactly the prior
  topics+narrative (or rubric-fallback) view.
- Misconception sub-row rendering is retained but runtime-dead (backend detector
  retired; `misconceptions` always `()`).
- Still not rendered: numeric overall score/XP line/level-up banner. Migration
  note: payload prefers `report.progress.*` over flat `xp_*` (neither rendered).

## Related
- [math-markdown.md](../shared-ui/math-markdown.md), [api-client.md](api-client.md),
  [session-page.md](session-page.md).
