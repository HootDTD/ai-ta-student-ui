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
  API**: `ApolloChat` renders it only while a grade is in flight, so the timers
  start with the request and are cleared on unmount. Nothing to "stop", and no
  stage state that can survive into the next attempt.
- named `GRADING_STAGES: readonly GradingStage[]` (`{id, label, atMs}`) and
  `GRADING_PANEL_DELAY_MS` — the pre-render grace, in ms.

## Data flow
Client-only: it never calls the backend and never sees the `DoneResponse`. One
`setTimeout` per stage is armed on mount at `max(stage.atMs,
GRADING_PANEL_DELAY_MS)` and fires `setStage(i)` — four timers, five renders
(the t=0 mount of the empty live region, then one per stage),
deliberately not a 250ms elapsed-time ticker (~80 renders over a long grade).

Schedule, shaped to the measured `POST /done` spread (p50 ~8s, tail past 20s):
0ms "Reading your explanation…", 2500ms "Checking what Apollo understood…",
6500ms "Scoring each topic…", 12000ms "Writing your feedback…" — the last is
**terminal** and holds for however long the request takes.

Markup is a fragment of two siblings. First, the visually-hidden
`<p class="apollo-grading__live" role="status">` — mounted at t=0, holding
**only** the active label. Second, once past the grace delay, the visible
`.notice.apollo-grading` shell above `.apollo-finish`: `.eyebrow` label, an
`aria-hidden` `<ol class="apollo-grading__stages">` whose rows carry
`data-state="past|active|upcoming"`, and `.apollo-grading__note` ("Usually
10–20 seconds…"). The panel carries no ARIA role at all, and its
`data-stage={active.id}` styles nothing — it is deliberately kept as the
**QA/automation hook**: with no test runner in this repo and the stage `<ol>`
`aria-hidden`, it is the only stable programmatic handle on which stage is
active. Keep it in sync with `GRADING_STAGES[].id`; don't remove it as dead
markup.

## Invariants & gotchas
- **Never claims completion.** Labels stay present-progressive, a passed row
  gains a filled dot rather than a checkmark, and there is no percentage or
  determinate bar. Only the arriving response ends the wait — a client clock
  must never imply the grade itself is finished.
- **The reveal is the parent's.** This component has no completion branch at
  all: `setReport` swaps the chat for `ApolloReportPanel`, which unmounts it.
  A response landing at 1s and one landing at 25s take the identical path, so
  "jump straight to the report whenever it lands" is structural, not timed.
- **Two mount sites, one component (2026-08-23).** `ApolloChat` renders it on
  `showGradingPanel = grading || turn.grading`: the clicked-Done request
  (parent-owned `grading`, [session-page.md](session-page.md)) and an *auto-done*
  turn, whose stream announces `working(grading)` after it has already released
  Apollo's reply ([chat.md](chat.md)). The auto-done case is why grading is no
  longer synonymous with "the Done button was pressed" — the student reads the
  reply while this panel narrates the grade behind it. Both sites are still
  pure mount/unmount; do not add a prop to distinguish them.
- **`GRADING_PANEL_DELAY_MS = 600` is load-bearing** for "a fast grade must not
  flash a stage sequence": below it no visible panel renders (only the empty,
  1x1-clipped live region) and the student sees just the Done button's spinner,
  exactly as before. Stages advance on wall-clock,
  so a <2s grade can only ever reach stage 0 — a strobe through four labels is
  unreachable by construction.
- **Driven by `grading`/`turn.grading`, never `busy`.** `ApolloPageClient` also
  raises `busy` for "Start over"; keying this off `busy` would narrate a grade
  during a restart.
- **The live region holds the label and nothing else** — and that is a
  correctness requirement, not tidiness. `role="status"` implies
  `aria-atomic="true"`, so the region is re-read IN FULL on every mutation:
  with the eyebrow and the "Usually 10–20 seconds" note inside it, all three
  stage advances would re-announce the whole box. Never move `role="status"`
  back onto the `.notice`, and never add content to the live `<p>`.
- **The live `<p>` mounts at t=0, empty, and is only ever mutated.** A live
  region inserted already populated is skipped by most screen readers, so
  mounting it with the panel at the 600ms mark would silently drop stage 0.
  This is why the component returns a fragment and renders something from the
  very first frame instead of `null`.
- The visual `<ol>` is `aria-hidden`: it is repeated context for a sighted
  reader, and a four-row list re-read on every advance is noise.
- Motion is already covered by the global `prefers-reduced-motion` reset in
  `globals.css` — the dot pulse needs no local guard.
- No grading semantics live here. It cannot change, delay, or short-circuit
  the Done request; deleting it would only restore the bare spinner.

## Related
- [chat.md](chat.md) — the mount owner (both sites);
  [session-page.md](session-page.md) — owns the clicked-Done `grading` state;
  [layout-and-design-system.md](../shell/layout-and-design-system.md).
