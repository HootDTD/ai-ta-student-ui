---
doc: hoot/qa-proxies
description: 7 ask/chats/classes/materials proxies
owns:
  - app/api/ask/route.ts
  - app/api/ask/stream/route.ts
  - app/api/chats/route.ts
  - app/api/chats/[chat_id]/route.ts
  - app/api/classes/route.ts
  - app/api/my-classes/route.ts
  - app/api/materials/file-url/route.ts
related: [hoot/chat-home-page, apollo/api-client, apollo/top-bar]
last_verified: 2026-07-30
stub: false
---

# Hoot QA proxies

Seven thin route files, all following the shared proxy pattern in
[hoot/_index.md](_index.md) — this leaf lists only route→backend + per-route
quirks.

## Interface (route → backend)
| Route | Method(s) | Backend | Quirk |
|---|---|---|---|
| `/api/ask` | POST | `/ask` | non-streaming; not used by current pages |
| `/api/ask/stream` | POST | `/ask/stream` | SSE; Content-Type defaults `text/event-stream` |
| `/api/chats` | GET | `/chats?search_space_id=…` | query string passed through |
| `/api/chats/[chat_id]` | GET/DELETE/POST | `/chats/{chat_id}` | DELETE passes 204 with null body |
| `/api/classes` | GET | `/classes` | 502 (with message) on connection failure; not used by current pages |
| `/api/my-classes` | GET | `/my-classes` | adds `Accept: application/json`; try/catch → 502 "Failed to reach backend /my-classes" |
| `/api/materials/file-url` | GET | `/materials/file-url` | citation-chip source links; forwards `?upload_id=`/`?doc_id=` query + Authorization; backend does membership + signed-URL minting |

## Invariants & gotchas
- Params are `Promise`-typed (Next 15: `await ctx.params`) — keep when adding
  handlers.
- **Cross-domain:** `/api/my-classes` also serves Apollo's `listMyClasses()` /
  `ApolloTopBar` class switcher.

## Env flags
`AI_TA_API_BASE_URL`.

## Related
- [chat-home-page.md](chat-home-page.md), [api-client.md](../apollo/api-client.md),
  [top-bar.md](../apollo/top-bar.md).
