---
doc: apollo/session-page
description: page.tsx + ApolloPageClient.tsx
owns:
  - app/apollo/page.tsx
  - app/apollo/ApolloPageClient.tsx
related: [apollo/api-client, apollo/chat, apollo/grading-progress, apollo/kg-panel, apollo/problem-panel, apollo/report-panel, apollo/coverage-celebrations, apollo/error-surface, apollo/top-bar, shell/feature-flags]
last_verified: 2026-08-23
stub: false
---

# Apollo session page

Monolith-hub (R2) for the teaching-session screen.

## Interface
- `app/apollo/page.tsx` — trivial server component wrapping `ApolloPageClient` in
  `<Suspense>` (required because the client uses `useSearchParams`).
- `app/apollo/ApolloPageClient.tsx` (~450 lines, `"use client"`) — the
  orchestrator; no exported symbols.

## Data flow
Reads `?session=` (missing + `?class=` ⇒ renders `ApolloBrowse`; missing both ⇒
inline "open from your class page"). GETs `getSessionState` and forwards each
history turn's `intent` string and `aside` payload (if any) straight through to
`ApolloChat`'s `initialMessages` — INTERACTION4 reference-aside styling on
reload keys off the tag, and the forwarded `aside` restores the card's
citation chips (absent on rows persisted before the backend stored aside
metadata — the card then renders without chips). Also forwards `state.ask_hoot_available ?? false` as `ApolloChat`'s
`askHootAvailable` (server-authoritative Ask Hoot button visibility,
[chat.md](chat.md)). Then renders inside
`.apollo-session-shell` (flex column, 100dvh): `ApolloTopBar`,
`ApolloProblemPanel`, `ApolloChat`, `ApolloKGPanel` (in a right off-canvas
`.apollo-kg-drawer` toggled by the top-bar "Understanding" action),
`ApolloCoverageCelebrations`, `ApolloErrorSurface`. A non-blocking
`getStudentProgressDetailed(classId)` feeds the avatar level (skipped without a
class id); since 2026-08-23 it is fired **in parallel** with `getSessionState`
rather than inside its `.then` — each keeps its own handler (session error →
`ApolloErrorSurface`; progress error → silent `setProgress(null)`), so neither
can mask the other. Do not fold them into a `Promise.all`: a rejected progress
fetch would then take the session state's error path with it.

Done path: "I'm done teaching" → `finishTeaching(sessionId)` **or** chat-detected
`intent_executed` (`onDoneFromChat`) → swaps chat for `ApolloReportPanel` and
re-fetches progress so level-ups show. From the report: "Try again from scratch"
→ `retryProblem` (fresh-slate); "Next problem" → `nextProblem`; "End session" →
`endSession` (→ `/apollo?class=` browse, or a terminal "Session ended" screen
without a class id). Top-bar "Start over" → `restartProblem` behind a
`window.confirm`.

## Invariants & gotchas
- **CRITICAL:** a changed `?session=` query param is a **hard state boundary** —
  the load effect clears all prior session/report/KG/drawer/celebration state,
  ignores superseded fetches (`cancelled` flag), and keeps the loading surface
  until `loadedSessionId === sessionId`, so a completed attempt's grade can never
  leak into a newly selected problem.
- Owns **per-attempt coverage dedup/reset** (by `node_id` AND normalized
  `display_name`), fed to `ApolloCoverageCelebrations` via the chat's
  `onCoverageSnapshot` callback: transient pops clear after ~3.6s; the checklist
  persists for the attempt. Retry / next / restart are all **fresh-attempt
  boundaries** and must clear the whole set — pops, the `coveredTopics`
  checklist, and BOTH dedup refs (2026-08-07: the name ref and the checklist
  were previously left behind, so the next attempt showed the old attempt's
  covered rows and could never celebrate again).
- `ApolloChat` is keyed by `attemptNonce`, bumped on those same three paths, so
  a fresh attempt **remounts** the chat. Without the key, "Start over" (the only
  fresh-attempt path reachable with no report on screen) left the chat mounted
  and holding the previous attempt's transcript and P2.2 coverage meter —
  `initialMessages` seeds `useState` once and never resyncs.
- Passes both `disabled` and `busy` to `ApolloChat` as its own `busy` — which
  "Start over" raises as well, so a **separate** `grading` flag (set only around
  `finishTeaching`, cleared in the same `finally`, and reset on the session
  boundary) drives the staged wait panel: `busy` would narrate a grade during a
  restart. Also passes `initialCoverage={readGradedCoverage(state)}` — the
  session snapshot's graded-topic counts, reusing the chat's own reader so the
  P2.2 meter and Done guard survive a reload/resume instead of reappearing only
  after the next turn.
- Sets `data-apollo-level={level}` on `<main>` for CSS avatar theming.
- `state.phase` exists on the payload but is **not** branched on — view selection
  is report-state vs `status==='ended'`.
- APOLLO_ONLY retargets the ended-screen "Return to Hoot" button.

## Env flags
`NEXT_PUBLIC_APOLLO_ONLY` (via `shell/feature-flags.md`).

## Related
- [api-client.md](api-client.md) + every Apollo component doc;
  [feature-flags.md](../shell/feature-flags.md).
