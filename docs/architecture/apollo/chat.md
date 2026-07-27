---
doc: apollo/chat
description: ApolloChat
owns:
  - components/apollo/ApolloChat.tsx
related: [apollo/api-client, apollo/error-surface, apollo/session-page, shared-ui/math-markdown, shared-ui/special-chars-palette, shared-ui/entry-chrome, shared-ui/citation-chip]
last_verified: 2026-07-27
stub: false
---

# ApolloChat

Apollo teaching conversation + composer (~250 lines).

## Interface
default `ApolloChat({sessionId, initialMessages:ChatMessage[], onKgUpdate(kg),
onCoverageSnapshot(topics), onDoneClicked(), onDoneFromChat?(result:DoneResponse),
disabled?, busy?})`. `ChatMessage = {role, content, intent?, aside?:ChatAside}`.
Owns local `messages`/`draft`/`sending`/`error`.

INTERACTION4: when `sendChat`'s response has `message_kind === "reference_aside"`,
`handleSend` pushes two apollo-role turns instead of one — the aside turn
(`content: aside.text`, `intent: "reference_aside"`, `aside` carrying the full
`ChatAside` incl. citations) followed by a normal turn for `apollo_reply` (the
persona's resume line). Rendered as a bordered `.apollo-aside` card labeled
"From the course materials", citations via the reused `CitationChip`
([citation-chip.md](../shared-ui/citation-chip.md)); `in_scope: false` still
renders as an aside — the text itself is the refusal. On session reload,
`ApolloPageClient` forwards each history turn's `intent` string through
verbatim, so a reloaded `reference_aside` turn renders with the same card
styling — but without citations (the transcript replay doesn't carry them
back, only `role`/`content`/`intent`).

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
