---
doc: hoot/chat-home-page
description: app/page.tsx (~1420 lines)
owns:
  - app/page.tsx
related: [shared-ui/math-markdown, shared-ui/citation-chip, shared-ui/special-chars-palette, shared-ui/entry-chrome, hoot/qa-proxies, apollo/api-client, shell/feature-flags]
last_verified: 2026-07-25
stub: false
---

# Hoot chat home (`app/page.tsx`)

The main Hoot page (~1420 lines, `"use client"`) — the single largest file.
Monolith-hub (R2): documented by feature-cluster, not line-by-line.

## Interface
Default `Page()` — self-contained; no exported symbols. Consumes shell auth,
`MathMarkdown`, `CitationChip`, `SpecialCharsPalette`, `AuthBrand`/`BootScreen`/
`OwlVideo`, and Apollo's `startSessionFromHoot`/`listMyClasses`.

## Data flow (feature clusters)
1. **Auth gate/bootstrap** — `loadStoredSession` → `ensureActiveSession` →
   save/clear; entry states use `AuthBrand`/`BootScreen` + `.auth-screen`/
   `.auth-card`.
2. **Class picker** — GET `/api/my-classes` (8s `AbortController` timeout,
   auto-select first; none ⇒ "ask your instructor for a join code").
3. **Streaming Q&A** — client-generated `chat_id` (`chat-`+8 hex); `send()` POSTs
   `/api/ask/stream` with `{chat_id, search_space_id, question, attachments:
   [{name, mime, data_url}]}` (images = base64 data URLs, max 6 ~5MB, dropzone or
   paste). The browser parses SSE frames split on `\n\n`, dispatching on
   `event:` — `status` (updates the thinking line over `/thinking.mp4`),
   `reasoning` (deliberately **not** surfaced), `token` (streamed answer deltas),
   `answer` (`{answer, citations}`), `error`. Assistant text renders through
   `MathMarkdown` over `parseAnswer()` (strips trailing `Citations:`/`Results:`
   blocks); `CitationChip`s show when `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS=1`.
4. **Chat sidebar** — GET `/api/chats?search_space_id` after send; GET
   `/api/chats/{chat_id}` rehydrates from `data.turns`; trash ⇒ DELETE (list
   filters `turn_count>0`).
5. **Header menu** — theme toggle (`dark` class + `localStorage.theme`), sign
   out, and **"Generate report"** = a **client-side** printable HTML doc
   (declaration + prompt list + conversation log + unique citations + Monash
   acknowledgement) opened in a new tab that auto-`window.print()`s — distinct
   from the backend `/report/[id]`, and using its own `mdToHtml` (not
   `MathMarkdown`).
6. **"Teach Apollo"** — `startSessionFromHoot(selectedClassId, transcript)` then
   navigate to `/apollo?session={id}`; `errorCode no_matching_concept` ⇒ "Apollo
   doesn't cover this topic yet."
7. **APOLLO_ONLY** — signed-in users `router.replace`'d to `/apollo`; the Hoot
   chat never renders.

## Invariants & gotchas
- Left-in `console.error`/`console.log` debugging in the auth and chat
  load/delete handlers.
- The client "Generate report" flow is separate from the backend report viewer
  (`report-viewer-page.md`); nothing links the two.

## Env flags
`AI_TA_API_BASE_URL` (via proxies), `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS`,
`NEXT_PUBLIC_APOLLO_ONLY`.

## Related
- [math-markdown.md](../shared-ui/math-markdown.md),
  [citation-chip.md](../shared-ui/citation-chip.md),
  [special-chars-palette.md](../shared-ui/special-chars-palette.md),
  [entry-chrome.md](../shared-ui/entry-chrome.md).
- [qa-proxies.md](qa-proxies.md) — the transport.
- [api-client.md](../apollo/api-client.md) — `startSessionFromHoot`.
- [feature-flags.md](../shell/feature-flags.md) — APOLLO_ONLY.
