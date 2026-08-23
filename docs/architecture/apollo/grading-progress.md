---
doc: apollo/grading-progress
description: ApolloGradingProgress staged Done wait
owns:
  - components/apollo/ApolloGradingProgress.tsx
related: [apollo/chat, apollo/session-page, shell/layout-and-design-system]
last_verified: 2026-08-23
stub: false
---

# Apollo grading progress

The staged wait between "I'm done teaching" and the report (study-prep design
spec B.2, 2026-08-23). Grading blocks 6-20s; the old UI was a bare spinner.

## Interface
- default `ApolloGradingProgress()` — **no props. Mount/unmount is the whole
  API**: `ApolloChat` renders it only while `grading` is true, so the timers
  start with the request and are cleared on unmount. Nothing to "stop", and no
  stage state that can survive into the next attempt.
- named `GRADING_STAGES: readonly GradingStage[]` (`{id, label, atMs}`) and
  `GRADING_PANEL_DELAY_MS` — the pre-render grace, in ms.

## Data flow
Client-only: it never calls the backend and never sees the `DoneResponse`. One
`setTimeout` per stage is armed on mount at `max(stage.atMs,
GRADING_PANEL_DELAY_MS)` and fires `setStage(i)` — four timers, four renders,
deliberately not a 250ms elapsed-time ticker (~80 renders over a long grade).

Schedule, shaped to the measured `POST /done` spread (p50 ~8s, tail past 20s):
0ms "Reading your explanation…", 2500ms "Checking what Apollo understood…",
6500ms "Scoring each topic…", 12000ms "Writing your feedback…" — the last is
**terminal** and holds for however long the request takes.

Markup: a `.notice.apollo-grading` shell above `.apollo-finish` with
`role="status"`; `.eyebrow` label; an `aria-hidden`
`<ol class="apollo-grading__stages">` whose rows carry
`data-state="past|active|upcoming"`; a visually-hidden `.apollo-grading__live`
line; and `.apollo-grading__note` ("Usually 10–20 seconds…").

## Invariants & gotchas
- **Never claims completion.** Labels stay present-progressive, past rows are
  dimmed with a filled dot rather than check-marked, and there is no
  percentage or determinate bar. Only the arriving response ends the wait —
  a client clock must never imply the grade itself is finished.
- **The reveal is the parent's.** This component has no completion branch at
  all: `setReport` swaps the chat for `ApolloReportPanel`, which unmounts it.
  A response landing at 1s and one landing at 25s take the identical path, so
  "jump straight to the report whenever it lands" is structural, not timed.
- **`GRADING_PANEL_DELAY_MS = 600` is load-bearing** for "a fast grade must not
  flash a stage sequence": below it nothing renders and the student sees only
  the Done button's spinner, exactly as before. Stages advance on wall-clock,
  so a <2s grade can only ever reach stage 0 — a strobe through four labels is
  unreachable by construction.
- **Driven by `grading`, never `busy`.** `ApolloPageClient` also raises `busy`
  for "Start over"; keying this off `busy` would narrate a grade during a
  restart.
- Only the active label is announced: the visual list is `aria-hidden` and the
  hidden `<p>` is the live text. A four-row list re-read on every advance is
  noise, not information.
- Motion is already covered by the global `prefers-reduced-motion` reset in
  `globals.css` — the dot pulse needs no local guard.
- No grading semantics live here. It cannot change, delay, or short-circuit
  the Done request; deleting it would only restore the bare spinner.

## Related
- [chat.md](chat.md) — the only mount site; [session-page.md](session-page.md)
  — owns the `grading` state;
  [layout-and-design-system.md](../shell/layout-and-design-system.md).
