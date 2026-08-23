# Untested changes — Apollo band swap (student UI)

> Append-only log for the `feat/apollo-study-bands-latency` branch — one H1
> section per task, each self-contained. Task 5a is at the bottom.

Study-prep design spec §A.3 (2026-08-18), Task 3 of the bands+latency build.

This repo has **no test runner**. Per the workspace standing rule and the
spec's §A.5 gate ("UI has no test runner: list every untested change"), every
behavior changed here is enumerated below with the manual QA that must cover
it on staging. Nothing in this list is covered by an automated test.

Automated checks that DID run: `npx tsc --noEmit` (clean),
`npm run lint` (0 errors; 4 pre-existing warnings in untouched files),
`python scripts/docs/check_owns_coverage.py --check-size` (0 errors) and the
`--check-last-verified` PR-path gate vs `origin/staging` (0 errors).

## New module

**`lib/apollo/bands.ts`** — the single shared band helper. No unit tests exist
for it; the backend counterpart (`score_to_band`) is unit-tested on its side,
and this is a mirror of those cuts.

| Behavior | Expected | How to check |
|---|---|---|
| `scoreToBand` cuts | ≥85 → `advanced`; 50–84 → `intermediate`; <50 → `beginner` | Boundary values 0/29/30/49/50/84/85/100 — verify against the backend's `score_to_band` unit table; the two must not drift |
| `resolveBand` precedence | A recognised served `band` token always wins over `score` | Serve a payload where `band` and `score` disagree; the token must render |
| `resolveBand` fallback | `band` absent → derive from `score` | Old/cached payload with `score` only |
| `resolveBand` unknown token | An unrecognised `band` string is treated as missing, then falls back to `score` | Hand-crafted payload with `band: "expert"` |
| `resolveBand` null case | No band **and** no usable score → `null`; caller renders nothing. **Never** a letter | Payload with `band: null, score: null` |
| `bandLabel` strings | "Beginner" / "Intermediate" / "Advanced" — exact casing | Visual |

## Changed student-visible behavior

### 1. `components/apollo/ApolloReportPanel.tsx` — Done report header
- Header renders the band word (`.apollo-scorecard__band`) instead of the
  letter (`.apollo-scorecard__letter`, class removed).
- When `resolveBand` returns `null` the `<strong>` is **omitted entirely** —
  the header degrades to just the credit bar. Previously the letter always
  rendered.
- UNCHANGED and must be verified as unchanged: the `data-tone`
  success/danger left border (still `score >= 75`), the overall credit bar and
  its `aria-valuenow`, topic scorecard rows, coverage/reveal panel, recap,
  next-step, review chips, the three footer buttons.
  → **SUPERSEDED BY TASK 3b** (bottom of this file): the tone flip and the
  overall credit bar are both gone. Only coverage/reveal panel, recap,
  next-step, review chips and the footer buttons are still "unchanged" here.

### 2. `app/apollo/progress/ProgressClient.tsx` — recent attempts list
- Each row's grade cell shows the band word instead of `letter`.
- `"?"` fallback preserved for an attempt with neither band nor score.
- The optional ` (score)` suffix is **unchanged** (pre-existing behavior; the
  spec did not ask for score to be hidden — see Concerns in the task report).
  → **SUPERSEDED BY TASK 3b**: the user ruled band-only, and the suffix was
  removed there.
- The `.map` callback became a block body; row markup is otherwise identical.

### 3. `components/apollo/ApolloBrowse.tsx` — problem-card grade chip
**Not listed in the task brief — found by the mandatory §A.3 grep sweep.** It
was a live student-visible letter render.
- Chip text is the band word, not the letter.
- Chip copy switched to best-grade-wins band vocabulary:
  - `aria-label`: "Your best result for this problem: Intermediate." (+ the
    "Hide/Show your feedback." clause on the clickable variant)
  - `title`: "Your best result: Intermediate" (+ " — click for feedback")
  - was: "Your grade for this problem: B+" / "Your grade: B+"
- Color mapping changed from `letter[0]` → a|b|c|d|f to
  `BAND_COLOR_KEY`: advanced→`a`, intermediate→`c`, beginner→`d`. The `b` and
  `f` color families are now unreachable from the student UI (kept in CSS).
  **A card that used to tint B/olive or F/red now tints C/amber or D/orange.**
- The card tint, the chip, and the in-card feedback panel's left rule all key
  off the same `colorKey`, so they stay consistent.
- A `grade` that resolves to no band degrades to the plain "Tried" badge — the
  same fallback the old unknown-letter path had.

### 4. `lib/apollo/api.ts` — types only, no runtime behavior
- `band?: string | null` added beside `letter` on `Rubric.overall`,
  `ApolloProblemGrade`, `RecentAttempt`. Optional and loosely typed on purpose
  (untrusted network data, narrowed by `resolveBand`).
- `letter` is retained on all three — backward compat, teacher surfaces,
  research corpus.
- `RubricAxis.letter` (procedure/justification/simplification) was left alone:
  it is not rendered anywhere in the student UI.

### 5. `app/globals.css`
- `.apollo-scorecard__letter` → `.apollo-scorecard__band`, `font-size`
  1.5rem → 1.25rem, added `white-space: nowrap`.
- `.apollo-attempts__grade` gained `white-space: nowrap`.
- Comment-only updates on the `--grade-*` token block.

## Manual staging QA checklist (spec §A.5)

Run one full session per band outcome (beginner / intermediate / advanced):

- [ ] Done report header shows the band word, correctly sized, no wrap, and
      no letter anywhere on the panel.
- [ ] Long band word ("Intermediate") does not squash the credit bar at narrow
      viewport widths (≤400px) — the header is a flex row.
- [ ] Browse cards show band chips; card tint, chip color and feedback-panel
      left rule agree; chip click still opens the feedback panel.
- [ ] Chip `title`/`aria-label` read "Your best result: …" — check with a
      screen reader or by hovering.
- [ ] Progress page recent attempts show band words, one line per row.
- [ ] Retry a problem and confirm best-grade-wins: the displayed band never
      moves DOWN across attempts.
- [ ] Coverage meter, Done warning and the reveal panel are visually
      unchanged.
- [ ] Dark mode on all three surfaces.
- [ ] Back-compat: with a pre-band backend payload (or a cached one) the
      surfaces still show a band derived from score — and never a letter.

---

# Untested changes — Done staged progress + client perf (student UI)

Study-prep design spec §B.2/§B.3 (2026-08-18), Task 5a of the bands+latency
build. Same standing rule as above: **no test runner in this repo**, so every
behavior changed here is enumerated with the manual QA that must cover it on
staging. Nothing below is covered by an automated test.

Automated checks that DID run: `npx tsc --noEmit` (clean), `npm run lint`
(0 errors; the same 4 pre-existing warnings in untouched files),
`npm run build` (clean), `python scripts/docs/check_owns_coverage.py
--repo-name student-ui --check-size` (0 errors) and the
`--check-last-verified` PR-path gate vs `origin/staging` (0 errors).

**Out of scope, unchanged:** the Done request itself, its error handling and
timeout behavior, grading semantics of any kind, the coverage meter, the Done
warning/guard, and the reveal panel. The turn-send transport is untouched (the
streaming reader and its kill-switch flag are a separate, later task).

## New module

**`components/apollo/ApolloGradingProgress.tsx`** — the staged Done wait. Pure
client timing, no network, no props; mount/unmount is its entire lifecycle.

| Behavior | Expected | How to check |
|---|---|---|
| Grace delay | Nothing renders for the first 600ms after the Done click | Grade a session that returns fast; only the button spinner should appear |
| Stage schedule | Stage advances at 0 / 2.5s / 6.5s / 12s elapsed | Watch a real slow grade with a stopwatch |
| Terminal stage | "Writing your feedback…" holds indefinitely; no 5th stage, no "done" state, no percentage | Let a 20s+ grade run to completion |
| Reveal | The panel vanishes the instant the report renders, whatever stage it was on | Slow grade AND fast grade |
| Timer cleanup | No stage text ever appears in a later attempt | Grade → "Try again from scratch" → watch the composer |
| Live region | Each advance announces the new stage label **and nothing else** — no eyebrow, no "Usually 10–20 seconds" note. All four stages announce, stage 0 included | Screen reader (NVDA/VoiceOver). The live `<p>` is the whole region and mounts empty at t=0; the `<ol>` is `aria-hidden` |
| Reduced motion | The active dot does not pulse | OS "reduce motion" on — covered by the global reset, verify it actually lands |

## Changed student-visible behavior

### 1. `components/apollo/ApolloChat.tsx` — new `grading` prop + panel slot
- New optional prop `grading?: boolean` (default `false`). When true, renders
  `<ApolloGradingProgress />` between the Done-guard notice and the
  `.apollo-finish` band.
- **Deliberately NOT keyed off `busy`:** the parent raises `busy` for "Start
  over" as well, and the panel must never narrate a grade during a restart.
- UNCHANGED and must be verified as unchanged: the Done button's own spinner
  and "Grading your teaching…" label (still driven by `busy`, including the
  pre-existing quirk that a "Start over" shows that label — see Concerns),
  the coverage meter, `doneWarningText` and the whole Done guard incl. focus
  handling, the composer, Ask Hoot, the echo guard, the transcript.

### 2. `app/apollo/ApolloPageClient.tsx` — `grading` state
- New `grading` state, set alongside `busy` in `handleDone` and cleared in the
  same `finally`; also reset on the `?session=` state boundary.
- No other handler touches it — `handleRetry` / `handleNext` / `handleRestart`
  / `handleEnd` still only move `busy`.
- The chat-affirmed-done path (`onDoneFromChat`, where the backend runs
  `handle_done` inside the chat response) does **not** raise `grading`; that
  wait still shows the normal "thinking…" turn placeholder. Unchanged from
  before, but worth knowing when QA'ing.

### 3. `app/apollo/ApolloPageClient.tsx` — parallel session load
- `getSessionState` and `getStudentProgressDetailed` now start together
  instead of the progress call waiting inside the session-state `.then`.
- Error semantics preserved **per call** and deliberately not `Promise.all`:
  each promise keeps its own handler, so a failing progress fetch cannot
  reach the session-state error path and vice versa.
- **Behavior delta:** when the session-state fetch *fails*, the progress
  request is now still issued (previously it was never reached). It is a
  read-only course-scoped GET whose result is dropped on that path — no user
  visible effect, one extra request on an error that already ends the screen.
- The `classId`-absent skip is unchanged: no progress request at all.
- `cancelled`-flag guarding is unchanged on both paths.

### 4. `components/MathMarkdown.tsx` — `React.memo`
- Default export is now `memo(MathMarkdown)`. No API change: same single
  `children: string` prop, same output, same `normalizeMath` behavior, and
  `normalizeMath` is still exported unchanged.
- Effect: a long KaTeX-heavy scrollback is no longer re-parsed on every
  keystroke in the composer.
- Risk to watch: memoization means a call site that mutates a string in place
  (impossible for JS strings) or relies on a re-render for side effects would
  break. No call site does either — all **13** pass one expression child that
  evaluates to a string.

### 5. `app/globals.css`
- New `.apollo-grading`, `__stages`, `__stage[data-state]`, `__dot`,
  `__note`, `__live` rules and the `apolloGradingPulse` keyframe. Additive
  only — no existing rule was edited, so nothing else can shift.

## Manual staging QA checklist (spec §A.5)

- [ ] **Slow grade:** click Done on a full session; the panel appears after a
      beat and walks Reading → Checking → Scoring → Writing without ever
      showing a completed/100% state, then is replaced by the report.
- [ ] **Fast grade:** contrive a short session (or a cached/fast grade); a
      sub-2s grade must show at most the first stage — no strobe through
      labels — and a sub-0.6s grade must show no panel at all.
- [ ] **Failure path:** force the Done request to fail (offline the tab
      mid-grade); the panel disappears, `ApolloErrorSurface` shows the same
      copy as before, and the Done button becomes clickable again.
- [ ] **Restart:** click "Start over" from the top bar — the grading panel
      must NOT appear.
- [ ] **Retry after a grade:** report → "Try again from scratch" → no stale
      stage text anywhere.
- [ ] **Narrow viewport (≤400px):** the panel stacks above the finish band and
      does not push the Done button off screen.
- [ ] **Short viewport HEIGHT (e.g. 1366×640, or a phone in landscape):** the
      panel injects into the bottom-pinned `.apollo-chat__composer`, which
      shrinks `.apollo-chat__scroll` by roughly the panel's own height mid-
      grade. Confirm the last turn does not slide out of view (and that the
      transcript is still scrollable to it) at the moment the panel appears.
- [ ] **Dark mode** on the panel.
- [ ] **Contrast:** every stage label is readable in both themes. Not-yet-
      reached rows are deliberately NOT dimmed — an opacity ramp on this text
      measures ~2.4:1 in both themes, under AA, so recession is carried by the
      dot alone. If a future edit re-adds opacity to the label, that is the
      regression to catch.
- [ ] **Screen reader:** each advance announces the new stage label and
      NOTHING else — if you hear "Grading in progress … Usually 10–20
      seconds" repeated on every advance, the live region has been merged back
      into the panel (`role="status"` implies `aria-atomic="true"`). All four
      stages should announce, stage 0 included. The visual list stays silent.
- [ ] **Reduced motion:** no dot pulse.
- [ ] **Typing latency:** open a long, KaTeX-heavy session (20+ turns with
      equations) and type a paragraph into the composer — keystrokes should
      feel immediate. Compare against `main` on the same session if possible;
      this is the whole point of the memo.
- [ ] **Session load:** open a session deep link with the network panel open —
      `GET .../sessions/{id}` and `GET .../progress` must overlap, not stack.
      Confirm the greeting/avatar level still renders correctly.
- [ ] **Session load, error path:** open a session id that 404s — the error
      surface renders as before (the extra progress request in flight must not
      change what is shown).

---

# Untested changes — band-only grade display (student UI)

User ruling 2026-08-23 (supersedes the spec's silence), Task 3b of the
bands+latency build. Same standing rule as above: **no test runner in this
repo**, so every behavior changed here is enumerated with the manual QA that
must cover it on staging. Nothing below is covered by an automated test.

Automated checks that DID run: `npx tsc --noEmit` (clean), `npm run lint`
(0 errors; the same 4 pre-existing warnings in untouched files),
`npm run build` (clean), `python scripts/docs/check_owns_coverage.py
--check-size` (0 errors) and the `--check-last-verified` PR-path gate vs
`origin/staging` (0 errors).

**The ruling:** a student sees the proficiency BAND and no numeric grade score
anywhere. Full resolution keeps flowing on the wire and into logging — this is
display-only. The 50/85 cuts are frozen and were not touched.

**Out of scope, unchanged:** the XP economy (`ApolloProgressCard` — XP total,
level, tier bar and its `aria-valuenow`), the Done coverage meter and its
counts, the concept-mastery percentages on the progress page, the Done
warning/guard, the reveal panel (`reference_text`), and every wire type —
`score`, `credit` and `dock_points` all still arrive and are still logged.

## Changed student-visible behavior

### 1. `lib/apollo/bands.ts` — rounding + shared colour map
- `scoreToBand` now `Math.round`s before comparing the cuts. It is only
  reachable through the `resolveBand` fallback (a payload with no served `band`
  token), and it changes what a fractional score resolves to: **84.5–84.99 now
  resolves `advanced` where it resolved `intermediate`**, and 49.5–49.99 now
  `intermediate` instead of `beginner`. That is the point — the backend bands
  an already-rounded int, so the two tables now agree for every input.
- New `bandColorKey(band)` → `"a" | "c" | "d"`, plus the exported
  `BandColorKey` type. Behaviorally identical to the `BAND_COLOR_KEY` that
  lived inside `ApolloBrowse` (advanced→a, intermediate→c, beginner→d); it
  moved so the report panel can share one map instead of forking it.

| Behavior | Expected | How to check |
|---|---|---|
| Rounding at the advanced cut | 84.4 → intermediate; 84.5 → advanced | Payload with `band` absent and a fractional `score` |
| Rounding at the intermediate cut | 49.4 → beginner; 49.5 → intermediate | Same |
| Integers unchanged | 0/29/49/50/84/85/100 band exactly as in the Task 3 table above | Regression check — rounding must not move an integer |
| Served token still wins | A payload WITH `band` never reaches `scoreToBand` | Serve `band: "beginner", score: 99` — must show Beginner |
| `bandColorKey` parity | Browse card tints are byte-identical to the Task 3 build | Visual A/B |

### 2. `components/apollo/ApolloReportPanel.tsx` — Done report
- **Overall credit bar REMOVED** (`.apollo-scorecard__overall-bar-track`
  /`-fill` and the `.apollo-scorecard__header` flex row that wrapped it). It
  published the score twice — as the fill width and as `aria-valuenow` on a
  `role="progressbar"` labelled "Overall credit". Screen-reader users lose that
  announcement; that is the intent, not a regression.
- The band word is now the sole header content, on its own grid row, back at
  the full 1.5rem the letter chip had (Task 3 had stepped it to 1.25rem to
  share the line with the bar). When no band resolves, the eyebrow "Teaching
  grade" is followed directly by the headline.
- **Tone rekeyed:** `data-tone={score >= 75 ? "success" : "danger"}` became
  `data-grade={bandColorKey(band)}` (a/c/d); the accent left border AND the
  band word take that family. Visible consequences:
  - Two Intermediate results now look identical. Before, a 74 was a red card
    and a 76 a green one.
  - **Advanced (≥85) stays green, but every Intermediate (50–84) is now amber
    and every Beginner (<50) burnt orange — where before 75–84 was green and
    everything under 75 was red.** Expect the average card to look "warmer"
    than it did.
  - `PASS_SCORE` is deleted; there is no pass/fail concept on this panel.
  - No band ⇒ no `data-grade` ⇒ the neutral `--accent` border. Previously an
    unresolvable band still got a success/danger border computed from `score`.
- **Per-topic `NN%` credit cell REMOVED**, replaced by a status word:
  covered→"Covered", partial→"Partial", missing→"Missing", unprobed→"n/a"
  (its `<abbr title>` is unchanged). The per-row credit BAR is KEPT — it is the
  qualitative reading and prints no number. Column widened 3rem → 4.5rem so the
  word fits instead of leaving a hole where the figure was.
  - a11y: the row glyph and the bar track are both `aria-hidden`, so the
    percentage used to be the only per-row status a screen reader received.
    The word restores it — an improvement, but it is a NEW announcement on
    every row, so re-listen to a long report.
- **Misconception `−N pts` dock chip REMOVED**, replaced by the qualitative
  "not corrected" — the counterpart to the existing "corrected ✓" badge.
  `dockToPoints()` deleted; `.apollo-topic__misconception-dock` renamed
  `-open`. **Runtime-dead in practice:** the backend misconception detector is
  retired, so `misconceptions` is always empty and only an old payload reaches
  this path. It was still fixed because it is a live code path in the UI.

### 3. `app/apollo/progress/ProgressClient.tsx` — recent attempts
- The ` (72)` suffix after the band is gone; the cell is the band word only,
  `"?"` when nothing resolves.
- `.apollo-attempts__grade` lost `tabular-nums` (no digits left in that cell),
  so the column may measure a hair differently.
- Concept mastery percentages on the same page are deliberately untouched —
  mastery is not the attempt grade (see Concerns in the task report).

### 4. `components/apollo/ApolloBrowse.tsx`
- Local `BAND_COLOR_KEY` deleted; imports `bandColorKey` instead. **No
  behavior change** — same three mappings, and the chips were already
  word-only.

### 5. `app/globals.css`
- Deleted: `.apollo-scorecard[data-tone="success"]` / `["danger"]`,
  `.apollo-scorecard__header`, `.apollo-scorecard__overall-bar-track`,
  `.apollo-scorecard__overall-bar-fill`.
- Added: six `.apollo-scorecard[data-grade="a|c|d"]` rules — left border and
  band-word colour.
- Edited: `.apollo-scorecard__band` (1.25rem → 1.5rem, `white-space: nowrap`
  dropped), `.apollo-topic__row` (last column 3rem → 4.5rem),
  `.apollo-topic__misconception-dock` → `-open`, `.apollo-attempts__grade`
  (`tabular-nums` dropped).
- `.notice[data-tone=…]` is NOT touched — the Next-step callout still uses it.

## Manual staging QA checklist

- [ ] **No number, whole session:** run one full session per band outcome and
      read every student surface — browse card, chat, Done report (header,
      every topic row expanded, misconceptions, recap, next step, review
      chips), progress page. No grade number anywhere. XP, level, coverage
      counts and concept-mastery percentages SHOULD still be visible.
- [ ] **Screen-reader sweep of those same surfaces** — the number must not
      survive as an `aria-valuenow`/`aria-label` either. Specifically confirm
      the report header no longer announces "Overall credit, NN".
- [ ] **Tone consistency:** two attempts that both land Intermediate (e.g. ~55
      and ~83) must render visually identical cards — same border colour, same
      band-word colour. Repeat for two Advanced and two Beginner results.
- [ ] **Cross-surface consistency:** for the SAME result, the browse card tint,
      its chip, its feedback-panel left rule and the report card all agree.
- [ ] **No band:** force `band: null, score: null` — the header shows the
      eyebrow and no word, the border is the neutral accent, and nothing reads
      as half-drawn.
- [ ] **Topic rows:** a mixed report (covered + partial + missing + unprobed)
      shows four distinct words, bars still fill proportionally, and the "n/a"
      tooltip still explains unprobed.
- [ ] **Dark mode** on the report card, the band word, and the browse cards.
      The `--grade-*` families are the ones the browse chips already used, but
      check the band word at 1.5rem specifically.
- [ ] **Narrow viewport (≤400px):** "Intermediate" at 1.5rem must wrap rather
      than clip now that `nowrap` is gone.
- [ ] **Back-compat:** a pre-band cached payload still shows a band derived
      from `score` — and still no number.

---

# Untested changes — Apollo turn streaming (student UI)

Task 5b of the bands+latency build (study-prep design spec B.1; backend event
contract from Task 4 + the 2026-08-23 contract correction). Same standing rule
as above: **no test runner in this repo**, so every behavior changed here is
enumerated with the manual QA that must cover it on staging. Nothing below is
covered by an automated test.

Automated checks that DID run: `npx tsc --noEmit` (clean), `npm run lint`
(0 errors; the same 4 pre-existing warnings in untouched files),
`npm run build` (clean, `/api/apollo/sessions/[id]/chat/stream` registered),
`python scripts/docs/check_owns_coverage.py --check-size` (0 errors) and the
`--check-last-verified` PR-path gate vs `origin/staging` (0 errors).

**What changed:** the Apollo teaching turn now streams over SSE by default. The
blocking `POST .../chat` path is untouched and still fully live behind a flag.

## New modules

**`lib/sse.ts`** — the SSE framing both streaming surfaces share, extracted
from `app/page.tsx`. Framing only; event vocabulary stays with each caller.

| Behavior | Expected | How to check |
|---|---|---|
| Frame split | Events delimited by a blank line; `event: `/`data: ` lines read per frame; multiple data lines joined with a newline | Hoot Q&A still streams token-by-token, identically to `main` |
| Nameless / data-less frame | Skipped, not yielded | Pre-existing behavior; regression only |
| Trailing partial frame | **Dropped, never flushed** | Kill the network mid-answer — no half-parsed garbage should reach the transcript |
| Early exit | Reader cancelled, connection released | Apollo turn: `complete` arrives, connection closes promptly (network panel) |

**`lib/apollo/chatStream.ts`** — `sendChatStreamed(sessionId, message, askHoot?,
{onWorking, onReply})`. Same args and same resolved `ChatResponse` as
`sendChat`; throws the same `ApolloApiError` values.

| Behavior | Expected | How to check |
|---|---|---|
| Pre-stream HTTP failure | 401/403/404/422 throw `ApolloApiError` exactly as the blocking path does | Expire the token mid-session, then send |
| In-band `error` frame | `{status, body}` becomes the same `ApolloApiError` the blocking route would raise; the frame-level `message` is used only when `body.message` is missing | Force `session_frozen` (409) via an already-finalized session |
| Unknown `working` stage | Copy still renders (stage is passed through as a string) | Requires a backend change; reason about it in review |
| Unknown event name | Ignored, not fatal | Same |
| `complete` with no payload | Treated as an interrupted stream, not a silent success | Reason about it in review |
| Stream ends with no terminal event | `ChatStreamInterruptedError` — a plain `Error`, NOT an `ApolloApiError` | Disconnect mid-turn (below) |

**`app/api/apollo/sessions/[id]/chat/stream/route.ts`** — near-copy of the
blocking `chat` proxy; only the upstream path and the `text/event-stream`
Content-Type fallback differ. `resp.body` is passed through un-buffered.

## Changed student-visible behavior

### 1. `lib/flags.ts` — turn-streaming kill switch
- New `APOLLO_TURN_STREAMING_DEFAULT` (env `NEXT_PUBLIC_APOLLO_TURN_STREAMING`,
  **off-tokens only**, so unset means streaming ON).
- New `apolloTurnStreamingEnabled()`, read **per send**, with a localStorage
  override at `hoot.apollo.turn_streaming` (`off`/`on`; anything else falls
  back to the build default). SSR-safe and safe against a throwing
  `localStorage`.
- The override exists because `NEXT_PUBLIC_*` is inlined at build time and
  Railway is known to skip variable-only redeploys — without it the kill switch
  would need a rebuild to take effect.
- `APOLLO_ONLY` is untouched.

### 2. `components/apollo/ApolloChat.tsx` — the send path
- **Transport branch.** One `await` differs; nothing else. If a reviewer finds
  turn-state logic duplicated per transport, that is a bug.
- **In-flight placeholder copy.** Was always the literal "thinking…". Now, on a
  streamed turn, it shows the backend's `working.message` ("Got it — Apollo is
  listening.", "Apollo is reading what you taught…", "Apollo is thinking it
  through…"). It falls back to "thinking…" before the first frame and on the
  blocking path. The placeholder wrapper already carried `aria-live="polite"`,
  so each phase now produces an announcement where previously there were none.
- **Reply renders early.** Apollo's bubble is appended on the `reply` event, and
  the placeholder disappears at that moment. The settled payload then REPLACES
  that provisional bubble.
- **Reference-aside turns visibly re-shape.** The `reply` event carries only
  `apollo_reply`, so an Ask-Hoot turn briefly shows the resume line as a Hoot
  card, then swaps to [aside card, plain Apollo bubble] when `complete` lands.
  On the blocking path both appear at once. The short aside lane makes the gap
  small, but it IS a new visible transition.
- **Auto-done.** `working(grading)` after `reply` sets `turn.grading`, which
  mounts `ApolloGradingProgress` — the same panel a clicked Done mounts, with
  the same 600ms grace and the same stage schedule. The reply stays readable
  behind it and the placeholder is suppressed so the wait is narrated once.
- **Rollback rule changed for one case.** On error the optimistic student turn
  is still popped — UNLESS the stream already delivered `reply`, in which case
  both the student turn and Apollo's reply stay on screen with the error notice
  above them. Rationale: past `reply` the backend owns the turn's final text
  and commits it server-side even if the client vanishes.
  - **Known gap:** if the failure lands between `reply` and the reply row's
    commit, the kept bubble will not survive a refresh. Narrow window, failed
    turn either way; flagged rather than papered over.
- **New exports** (no behavior of their own): `ChatMessage`,
  `apolloTurnMessages(resp, wasAskMode)`.
- Unchanged and must be verified as unchanged: the echo guard, the Ask Hoot cap
  and gating, the P2.2 coverage meter, the Done guard and its focus handling,
  the composer disable rules, and the scroll-to-bottom effect.

### 3. `app/page.tsx` — Hoot Q&A (refactor only, no intended behavior change)
- The inline SSE loop was replaced by `readSseFrames`. The `status` /
  `reasoning` / `token` / `answer` / `error` dispatch is byte-identical.
- One narrow difference: `res.body?.getReader()` became `res.body`, so the
  "[error] No response stream" branch now triggers on a missing body rather
  than a missing reader. Same condition in practice.

### 4. `lib/apollo/api.ts` — no call-site behavior change
- `_handle`'s error branch was extracted to exported `apolloErrorFromBody` +
  `readErrorBody`; `apolloHeaders` became exported. Same values, one mapping.
- Micro-change: the fallback message is now trimmed, so a response with an
  empty `statusText` (HTTP/2) reads "404" rather than "404 " with a trailing
  space.

## Manual staging QA checklist

- [ ] **Streamed turn, happy path:** send a teaching message with the network
      panel open. `POST .../chat/stream` returns 200 `text/event-stream`; a
      phase line appears **under 1s**; the copy advances (listening, reading,
      thinking); Apollo's reply renders as soon as it is ready; the KG drawer,
      the covered-topic celebrations and the coverage meter all update exactly
      as they do on `main`.
- [ ] **Compare against blocking, same session:** flip the switch off (below),
      send an equivalent message, and confirm the settled transcript, KG,
      celebrations and meter are identical — only the wait differs.
- [ ] **Kill-switch flip mid-session:** with a session open, run
      `localStorage.setItem('hoot.apollo.turn_streaming','off')` in the console
      and send again **without reloading** — the request must go to `.../chat`
      (not `/stream`) and the turn must complete normally with the old
      "thinking…" placeholder. `removeItem` and send again returns to
      streaming. Also verify a build with
      `NEXT_PUBLIC_APOLLO_TURN_STREAMING=0` streams nothing at all.
- [ ] **Error event surface:** trigger a real in-band failure (e.g. a frozen
      session, or a concept that hits `coverage_grading_failed`). The SAME
      `ApolloErrorSurface` copy must appear as on the blocking path, the
      student turn must be popped (no reply had landed), and the draft/ask-mode
      state must behave as before. Confirm the HTTP status is **200** and the
      failure is in-band — a 5xx dashboard will not see it.
- [ ] **Pre-stream error:** clear the stored token and send. A 401 must surface
      through the normal error path, not as an interrupted stream.
- [ ] **Auto-done, reply-then-grading:** say something that triggers the
      done-intent confirmation, then affirm it. Expected order: Apollo's reply
      appears, THEN the staged grading panel appears below the composer, THEN
      the report replaces the chat. The reply must stay readable the whole
      time, and there must be exactly one narration of the wait (no "thinking…"
      bubble alongside the panel).
- [ ] **Auto-done, grading failure:** if reachable, confirm reply, then grading
      panel, then error notice — with the reply still on screen afterwards.
- [ ] **Mid-stream disconnect then refresh:** send a turn, then kill the
      network (devtools offline) before the reply lands. Expected: the error
      notice reads "The connection to Apollo dropped mid-turn… reload the page
      to check", and the student turn is popped. Reload with the network back:
      **both the student turn and Apollo's reply must be there** — the backend
      finished the turn regardless. Repeat, dropping the network AFTER the
      reply renders: this time both bubbles stay on screen under the notice,
      and a reload shows the same two turns (not duplicates).
- [ ] **Long silent gap:** the ~8-12s unified-question call has no heartbeat.
      Confirm no intermediary (Railway, the Next proxy) closes the stream —
      watch one slow turn end to end without a drop.
- [ ] **Ask Hoot over streaming:** ask a reference question. The resume line
      may appear before the aside card; confirm the settled state is the normal
      two-card shape, the citation chips are present, ask-mode exits, and the
      3-per-session cap still counts correctly.
- [ ] **Ask Hoot fall-through:** an ask-mode submit that comes back as a plain
      teaching turn still renders the Hoot-attributed card with no error.
- [ ] **Echo guard still fires** on a streamed send (the confirm runs before
      the transport branch).
- [ ] **Screen reader:** the in-flight placeholder now announces each phase.
      Confirm one line per advance (not the whole bubble), and that the
      auto-done grading panel's own live region is not announcing at the same
      time.
- [ ] **Hoot Q&A regression:** ask a question on `/` and confirm streaming
      tokens, the status line, citations and the error path all behave exactly
      as before the reader extraction.
- [ ] **Concurrency:** two students (or two browsers) streaming turns in the
      same class at once — no cross-talk, no stalled stream.
