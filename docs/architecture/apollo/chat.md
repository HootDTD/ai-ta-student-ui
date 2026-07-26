---
doc: apollo/chat
description: ApolloChat
owns:
  - components/apollo/ApolloChat.tsx
related: [apollo/api-client, apollo/error-surface, apollo/session-page, shared-ui/math-markdown, shared-ui/special-chars-palette, shared-ui/entry-chrome]
last_verified: 2026-07-25
stub: false
---

# ApolloChat

Apollo teaching conversation + composer (~220 lines).

## Interface
default `ApolloChat({sessionId, initialMessages:{role,content}[], onKgUpdate(kg),
onCoverageSnapshot(topics), onDoneClicked(), onDoneFromChat?(result:DoneResponse),
disabled?, busy?})`. Owns local `messages`/`draft`/`sending`/`error`.

## Data flow
`handleSend` → `sendChat(sessionId, msg)`; appends Apollo's reply, calls
`onKgUpdate(resp.kg)` and `onCoverageSnapshot(resp.covered_topics ?? [])`, and if
`resp.intent_executed?.intent === 'done'` forwards the embedded `DoneResponse` via
`onDoneFromChat` (chat-affirmed-done shortcut — no second round-trip). On error it
pops the optimistic student turn and renders `ApolloErrorSurface` inline.

Layout: a fill-height flex column `.apollo-chat` = scrolling `.apollo-chat__scroll`
over a bottom-pinned `.apollo-chat__composer` (works only because
`ApolloPageClient` wraps the session in `.apollo-session-shell` 100dvh). Before the
first turn: centered `OwlVideo` + "I'm listening…". Composer: `SpecialCharsPalette`
insert, a right-aligned Send row ("Sending…" while sending), then the full-width
`.apollo-finish` band (the session's one loud affordance: solid success-green
`.ui-button--done` "I'm done teaching" → `onDoneClicked`; shows
`.ui-button__spinner` + "Grading your teaching…" while `busy`).

## Invariants & gotchas
- Both roles render `content` through shared `MathMarkdown` (`.prose.md-body`).
- Per-turn owl (`ApolloAvatar`, `/thinking.mp4`) takes a `thinking` prop — only
  the in-flight placeholder animates; settled turns hold a paused first frame.
- `ApolloPageClient` passes both `disabled` and `busy` as its own `busy` (true
  only for the Done click).

## Related
- [api-client.md](api-client.md), [error-surface.md](error-surface.md),
  [math-markdown.md](../shared-ui/math-markdown.md),
  [special-chars-palette.md](../shared-ui/special-chars-palette.md),
  [entry-chrome.md](../shared-ui/entry-chrome.md), [session-page.md](session-page.md).
