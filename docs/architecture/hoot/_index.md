---
doc: hoot/_index
description: Hoot QA pages + proxies router (documents shared proxy pattern)
owns: []
related: []
last_verified: 2026-07-25
stub: false
---

# hoot — the RAG-QA surface + /api proxies

| Doc | One-liner | Owns |
|---|---|---|
| [chat-home-page.md](chat-home-page.md) | The big multi-purpose home (auth, class picker, streaming Q&A, sidebar, report) | `app/page.tsx` |
| [join-page.md](join-page.md) | Invite-link redemption | `app/join/[code]/page.tsx` |
| [report-viewer-page.md](report-viewer-page.md) | Backend AI-use report viewer | `app/report/[id]/page.tsx` |
| [qa-proxies.md](qa-proxies.md) | 6 ask/chats/classes proxies | `ask`, `ask/stream`, `chats`, `chats/[chat_id]`, `classes`, `my-classes` |
| [enrollment-proxies.md](enrollment-proxies.md) | 2 invite-links proxies | `invite-links/resolve/[code]`, `invite-links/redeem/[code]` |
| [report-proxies.md](report-proxies.md) | 2 reports/ai-use proxies | `reports/ai-use/[id]`, `reports/ai-use/[id]/pdf` |

## Shared proxy pattern (all 26 `app/api/**` handlers, hoot + apollo)
Every proxy leaf references this — the leaf lists only route→backend path plus
per-route quirks. Each handler: declares `runtime = "nodejs"`; reads
`AI_TA_API_BASE_URL` (**500** if missing; trailing slashes stripped); forwards
the request body + the incoming `Authorization` header **verbatim**; streams
`resp.body` back with `Cache-Control: no-store`; adds **no** auth of its own.
Next-15 route params are `Promise`-typed (`await ctx.params`).

## Cross-domain note
`/api/my-classes` (owned here, in `qa-proxies.md`) is also the transport for
Apollo's `listMyClasses()` / `ApolloTopBar` class switcher.
