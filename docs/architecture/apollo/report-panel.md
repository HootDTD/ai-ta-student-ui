---
doc: apollo/report-panel
description: ApolloReportPanel
owns:
  - components/apollo/ApolloReportPanel.tsx
related: [shared-ui/math-markdown, shared-ui/citation-chip, apollo/api-client, apollo/session-page]
last_verified: 2026-08-07
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
The card shell is `.apollo-scorecard` (2026-07-30 restyle: mirrors the Hoot
answer panel `.msg-ai` — opaque paper panel, serif prose, tone carried on the
accent left border rather than tinting the whole card).
Render ladder, best-available first:
1. **Scorecard** (`report.topics` non-empty): grade header (serif
   `.apollo-scorecard__letter` + overall credit bar), topic rows sorted by
   `weight` desc — each a `<details class="apollo-topic" data-status=…>` with
   status glyph, `display_name`, credit bar + whole-number percent; expanded
   body shows the topic's `feedback.topic_feedback[]` note (matched by
   `canonical_key`, rendered via `MathMarkdown`) and a "You said:" quote.
   INTERACTION3 review pointers from each item's optional `review[]` render in
   their own `.apollo-scorecard__review` card below Next step (accent-edged,
   like the Hoot sources block): one `.apollo-scorecard__review-line` per weak
   topic — topic label (only when >1 sections) + one `CitationChip` per
   pointer via `reviewChipMeta` (marker-shaped label kept bracketed, page
   appended only when the label doesn't carry it; `doc_type: "Course
   material"` and the bare label as `file` feed the chip's hover preview;
   `upload_id`/`doc_id` pass through as the chip's source-PDF link keys —
   see `shared-ui/citation-chip.md`).
   `review[].doc_id` is typed but unused — no deep-linking in v1.
   **2026-08-07 grading-fix additions.** (a) *P2.3 / decision D2* — a topic
   whose `reference_text` is non-null (backend serves it only for
   `credit < 0.6`) gets a collapsed `<details class="apollo-topic__model">`
   "What full credit looks like" inside the row body, rendering the reference
   statement through `MathMarkdown`. Collapsed by default and post-grade only;
   it is the node's reference statement, never a full worked solution.
   (b) *P1.2b* — `status: "unprobed"` (a graded node Apollo never asked about,
   weight 0, out of the denominator) renders the `○` glyph, an `n/a` credit
   cell with an `<abbr title>` explaining it, a muted row
   (`.apollo-topic[data-status="unprobed"]`), and the body line "Apollo never
   asked you about this one, so it isn't counted in your grade." Weight-desc
   sorting puts these rows last on their own, and unlike the other
   below-full-credit statuses they render **collapsed** — a typical attempt
   leaves several nodes unprobed, and auto-expanding a stack of one-line
   non-findings would bury the recap/next-step. When
   `report.feedback` exists, its `headline` renders above the list, `recap[]`
   as muted lines, `next_step` as a `.notice` callout footer, and the flat
   `diagnostic_narrative` is **suppressed** (same content, flattened). Without
   `feedback`, topics still render and the narrative `<details>` appears as
   before.
2. No topics → legacy rubric fallback + `diagnostic_narrative` (pre-topic-score
   behavior, unchanged).
Quote source (`resolveQuote`): with a feedback block, ONLY its (already
backend-gated) `quote`; without one, fall back to the topic's own
`evidence_span`. Nav buttons "Next problem" / "Try again from scratch" (retry =
fresh-slate new empty attempt) / "End session" unchanged.

## Invariants & gotchas
- **Deploy-order safe:** every scorecard field (`feedback`, `evidence_span`,
  `topic_feedback[].review`, `reference_text`) is optional and `"unprobed"` is
  additive — against a pre-PR#200 backend, a backend without INTERACTION3, or
  one that hasn't shipped the 2026-08-07 grading fixes, the panel renders
  exactly the prior view.
- **Reveal policy:** `reference_text` is the ONLY model-answer surface in the
  student UI and it is backend-gated (missed topics, post-grade). Never derive
  a fuller answer client-side and never show it before the grade.
- Misconception sub-row rendering is retained but runtime-dead (backend detector
  retired; `misconceptions` always `()`).
- Still not rendered: numeric overall score/XP line/level-up banner. Migration
  note: payload prefers `report.progress.*` over flat `xp_*` (neither rendered).

## Related
- [math-markdown.md](../shared-ui/math-markdown.md), [api-client.md](api-client.md),
  [session-page.md](session-page.md).
