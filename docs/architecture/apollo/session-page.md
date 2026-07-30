---
doc: apollo/session-page
description: page.tsx + ApolloPageClient.tsx
owns:
  - app/apollo/page.tsx
  - app/apollo/ApolloPageClient.tsx
related: [apollo/api-client, apollo/chat, apollo/kg-panel, apollo/problem-panel, apollo/report-panel, apollo/coverage-celebrations, apollo/error-surface, apollo/top-bar, shell/feature-flags]
last_verified: 2026-07-29
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
history turn's `intent` string (if any) straight through to `ApolloChat`'s
`initialMessages` — INTERACTION4 reference-aside styling on reload keys off
that tag. Also forwards `state.ask_hoot_available ?? false` as `ApolloChat`'s
`askHootAvailable` (server-authoritative Ask Hoot button visibility,
[chat.md](chat.md)). Then renders inside
`.apollo-session-shell` (flex column, 100dvh): `ApolloTopBar`,
`ApolloProblemPanel`, `ApolloChat`, `ApolloKGPanel` (in a right off-canvas
`.apollo-kg-drawer` toggled by the top-bar "Understanding" action),
`ApolloCoverageCelebrations`, `ApolloErrorSurface`. A non-blocking
`getStudentProgressDetailed(classId)` feeds the avatar level (skipped without a
class id).

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
  persists for the attempt.
- Passes both `disabled` and `busy` to `ApolloChat` as its own `busy`, which is
  true only during the Done click.
- Sets `data-apollo-level={level}` on `<main>` for CSS avatar theming.
- `state.phase` exists on the payload but is **not** branched on — view selection
  is report-state vs `status==='ended'`.
- APOLLO_ONLY retargets the ended-screen "Return to Hoot" button.

## Env flags
`NEXT_PUBLIC_APOLLO_ONLY` (via `shell/feature-flags.md`).

## Related
- [api-client.md](api-client.md) + every Apollo component doc;
  [feature-flags.md](../shell/feature-flags.md).
