---
doc: apollo/chat
description: ApolloChat
owns:
  - components/apollo/ApolloChat.tsx
related: [apollo/api-client, apollo/echo-guard, apollo/error-surface, apollo/grading-progress, apollo/session-page, shell/feature-flags, shell/sse-reader, shared-ui/math-markdown, shared-ui/special-chars-palette, shared-ui/entry-chrome, shared-ui/citation-chip]
last_verified: 2026-08-23
stub: false
---

# ApolloChat

Apollo teaching conversation + composer (624 lines).

## Interface
default `ApolloChat({sessionId, initialMessages:ChatMessage[], onKgUpdate(kg),
onCoverageSnapshot(topics), onDoneClicked(), onDoneFromChat?(result:DoneResponse),
initialCoverage?:GradedCoverage|null, disabled?, grading?})`. `ChatMessage = {role, content,
intent?, aside?:ChatAside}` (exported). Owns local `messages`/`draft`/`sending`/
`error`/`askMode`/`asideCount`/`coverage`/`confirmingDone`/`turn`. Also exports `GradedCoverage`
and four pure helpers (exported so they can be unit-tested the day a runner lands, and so the
session page can reuse the reader): `readGradedCoverage(resp)`, `coverageMeterLabel(coverage)`,
`doneWarningText(open)`, `apolloTurnMessages(resp, wasAskMode)`.

**Turn transport — streaming by default, blocking behind a kill switch (2026-08-23).** `handleSend`
reads `apolloTurnStreamingEnabled()` ([feature-flags.md](../shell/feature-flags.md)) per send and
awaits either `sendChatStreamed` (SSE, default) or `sendChat` (blocking POST). **That await is the
ENTIRE seam** — both resolve to the same `ChatResponse`, and everything after it
(`apolloTurnMessages`, the KG / coverage / aside-count / `onDoneFromChat` reconciliation, the error
surface, the rollback rule) is one shared implementation, so the fallback path cannot rot.

While streaming, local `turn: {note, replied, grading} | null` carries live progress. `working`
frames put the backend's phase copy into `note`, replacing the static "thinking…" in the in-flight
placeholder — that is what makes activity visible inside a second instead of after the whole 10-17s
turn. `reply` appends Apollo's text to the transcript at once (it is final then) and clears `note`,
hiding the placeholder; a LATER `working` re-sets `note` and brings it back, because the contract
allows `working` after `reply`. The settled payload then **replaces** that provisional bubble
(`replied ? m.slice(0,-1) : m`) rather than appending beside it — a reference-aside turn settles as
*two* bubbles, not one. Auto-done is exactly that case: it streams `reply`, then
`working(grading)`, then `complete`, so `showGradingPanel = grading || turn.grading` mounts the
same `ApolloGradingProgress` the clicked-Done path mounts
([grading-progress.md](grading-progress.md)). The reply stays readable throughout, the thinking
placeholder is suppressed while the panel is up so one wait is narrated once, and the reveal is
unchanged: `complete` carries `intent_executed.done` and `onDoneFromChat` swaps in the report,
unmounting both.

**Pre-Done coverage meter + Done guard (P2.2, 2026-08-07).** Each response may carry
`graded_topic_total`/`open_graded_topics`; `readGradedCoverage` accepts them only when both are
finite, `total > 0` and `0 ≤ open ≤ total`, else the previous snapshot is kept — a rejected/absent
pair leaves `coverage` null, hiding the meter and leaving Done unguarded (pre-P2.2 behavior, fail
closed like `ask_hoot_available`). `coverage` also **seeds from `initialCoverage`** (the session
snapshot's copy of the same counts, same reader), so a reload/resume mid-attempt keeps meter and
guard. The meter sits in `.apollo-finish__copy`: pill track (`.apollo-finish__meter-*`,
`role="progressbar"` over addressed-of-total) + `coverageMeterLabel`; state is carried by the
**fill** colour (`--success-solid` → `--warning-solid`) while the label keeps `--muted` and takes
weight — `--warning-solid` text there fails AA in light theme. Clicking "I'm done teaching" with
`coverage.open > 0` does **not** call `onDoneClicked`; it opens a `.notice[data-tone="warning"]
.apollo-finish-confirm` alert above the band with `doneWarningText` and two actions: "Keep
teaching" (dismiss, returns focus to the composer) and "Grade anyway" (calls `onDoneClicked`).
While it is up the Done button is **disabled** and focus moves to "Keep teaching" — the notice
renders above a bottom-pinned band, so Done neither moves nor loses focus, and without both a
double-click / double-Enter would grade through a warning nobody read. `doneGuardOpen` is derived
(`confirmingDone && coverage.open > 0`), never `confirmingDone` alone, so the button can't be
stranded disabled by a notice that stopped rendering. Sending a turn clears the pending warning.
The chat-affirmed-done path (`intent_executed`) is server-side and unguarded by design.

**Turn styling (2026-07-30):** the transcript reuses the Hoot chat home's bubble vocabulary so both
chats read as one product. Student turns are right-aligned `.msg-user` bubbles (no speaker label);
Apollo persona turns are `.msg-ai` panels (opaque paper, 4px accent left border) under an "Apollo"
eyebrow with the owl avatar in the gutter.

INTERACTION4: when the response has `message_kind === "reference_aside"`, `apolloTurnMessages`
returns two apollo-role turns instead of one — the aside turn (`content: aside.text`, `intent:
"reference_aside"`, `aside` carrying the full `ChatAside` incl. citations) followed by a normal
turn for `apollo_reply` (the persona's resume line). The aside is attributed to **Hoot**, not
Apollo: same avatar-gutter layout but a tinted `.apollo-aside` card (visually distinct from
Apollo's `.msg-ai`) labeled "Hoot — from the course materials", citations in a `.msg-ai__sources`
row ("Sources referenced" + the reused `CitationChip`,
[citation-chip.md](../shared-ui/citation-chip.md)); `in_scope: false` still renders as an aside —
the text itself is the refusal. On session reload, `ApolloPageClient` forwards each history turn's
`intent` string and `aside` payload verbatim, so a reloaded `reference_aside` turn renders the same
card, chips included (the snapshot rebuilds `aside` from stored row metadata; asides persisted
before the backend stored that metadata reload without chips).

**Ask Hoot (button-gated entry to the aside lane):** the reference-aside path is never
auto-detected — it fires only when the student explicitly opens ask-mode via the "Unsure? Ask
Hoot!" button in `.apollo-chat__send-row`. The whole affordance is visibility-gated by the
`askHootAvailable` prop (default false), the server-authoritative mirror of the backend aside gate
(INTERACTION4 + concept allowlist, `ask_hoot_available` in the session snapshot): off-allowlist
concepts render no button at all instead of a button whose submits silently degrade to teaching
turns. `enterAskMode` re-checks it, so ask-mode is unreachable when hidden. Clicking it sets
`askMode`, which swaps the textarea placeholder to "Ask a question about the course material…",
adds the `.apollo-textarea--ask-mode` accent border, and shows the inline instruction "Type in your
question above and click 'Ask'" plus a "Cancel" affordance (`role`-less status text + button,
`aria-live` on the wrapper announces the mode change) in place of the button. `handleSend`
snapshots `askMode` at submit time and passes it as the transport's third arg, which adds
`ask_hoot: true` to the request body only for that submit — normal teaching sends are byte-for-byte
unchanged. Ask-mode always exits once the response resolves, aside or not: if `message_kind` isn't
`"reference_aside"` (flag off, or the concept wasn't reference-eligible) the reply is tagged with
the **live-only** `intent: "hoot_answer"` — a Hoot-attributed aside card (eyebrow "Hoot", no
citations), no error surfaced, ask-mode quietly closed. That tag is client-side only: the backend
stores the turn as a plain teaching turn, so a reload shows it as an ordinary Apollo turn. While an
ask-mode send is in flight the thinking placeholder also swaps to the aside card + "Hoot" eyebrow
(`askMode` stays true until the response lands). `asideCount` seeds from the reload count above
and, on a live aside response, is overwritten with `resp.intent_executed.aside_count` (the
backend's authoritative per-session tally, `intent: "reference_question"`) rather than incremented
locally. The button disables at the 3-per-session cap (`askHootCapped`), with both a `title`
tooltip and an `aria-label` spelling out the same "You've used all 3 Ask Hoot questions for this
session." reason, so the disabled state reaches screen readers too, not just hover.

**Echo guard.** `handleSend` runs `isEchoOfApolloTurn(draft, lastApolloMessage)` before sending and
confirm-gates a hit; see [echo-guard.md](echo-guard.md).

## Data flow
`handleSend` → optimistic student turn → `sendChatStreamed`/`sendChat` → on settle:
`apolloTurnMessages(resp, wasAskMode)` (replacing the provisional streamed bubble when there was
one), `onKgUpdate(resp.kg)`, `onCoverageSnapshot(resp.covered_topics ?? [])`, `readGradedCoverage`,
and if `resp.intent_executed?.intent === 'done'` the embedded `DoneResponse` via `onDoneFromChat`
(chat-affirmed-done shortcut — no second round-trip). On error it renders `ApolloErrorSurface`
inline (ask-mode is left as-is, so the student doesn't lose their place mid-question) and pops the
optimistic student turn — **unless the stream already delivered `reply`**, in which case both turns
stay.

Layout: a fill-height flex column `.apollo-chat` = scrolling `.apollo-chat__scroll` over a
bottom-pinned `.apollo-chat__composer` (works only because `ApolloPageClient` wraps the session in
`.apollo-session-shell` 100dvh). Before the first turn: centered `OwlVideo` + "I'm listening…".
Composer: `SpecialCharsPalette` insert, then `.apollo-chat__send-row` (space-between: the Ask Hoot
affordance/status left, Send right — "Sending…"/"Ask" while sending or in ask-mode), then the
full-width `.apollo-finish` band (the session's one loud affordance: solid success-green
`.ui-button--done` "I'm done teaching" → `handleDoneClick` → `onDoneClicked`; `.ui-button__spinner`
+ "Grading your teaching…" while `showGradingPanel`), preceded by the Done-guard notice when
pending and, while `showGradingPanel`, by `ApolloGradingProgress`.

## Invariants & gotchas
- Both roles render `content` through shared `MathMarkdown` (`.prose.md-body`).
- Three speaker treatments, deliberately distinct: student `.msg-user` bubble, Apollo `.msg-ai`
  panel, Hoot `.apollo-aside` tinted card. Don't collapse Hoot back into the Apollo styling — the
  split is the product requirement.
- Per-turn owl (`ApolloAvatar`, `/thinking.mp4`) takes a `thinking` prop — only the in-flight
  placeholder animates; settled turns hold a paused first frame.
- **One seam, not two paths.** The transport flag may only choose the awaited call; duplicating
  settle/error logic into a streaming-only branch is the drift it exists to prevent.
- **The post-`reply` rollback exception is deliberate.** Once `reply` has landed the backend owns
  the turn's final text and finishes it server-side even if the connection dies, so tearing a reply
  the student already read off the screen is the dishonest option. Pre-`reply` failures still roll
  back, byte-identical to the blocking path.
- **`showGradingPanel` is the single "a grade is running" signal** — staged panel AND the Done
  button's spinner/label both read it. There is no `busy` prop; `ApolloPageClient`'s `busy` (raised
  by "Start over" too) arrives only as `disabled`. Keying the label off it again re-introduces both
  bugs it had: "Grading your teaching…" during a restart, "I'm done teaching" through auto-done.
- The Done guard **warns, never blocks** — a student who wants an early grade is always one click
  away ("Grade anyway"). Don't turn it into a hard gate — and don't make the Done button itself the
  second click either, that is exactly the double-click bypass the disabled state exists to close.

## Related
- [api-client.md](api-client.md), [echo-guard.md](echo-guard.md), [error-surface.md](error-surface.md),
  [grading-progress.md](grading-progress.md), [session-page.md](session-page.md),
  [feature-flags.md](../shell/feature-flags.md), [sse-reader.md](../shell/sse-reader.md),
  [math-markdown.md](../shared-ui/math-markdown.md), [entry-chrome.md](../shared-ui/entry-chrome.md), [special-chars-palette.md](../shared-ui/special-chars-palette.md).
