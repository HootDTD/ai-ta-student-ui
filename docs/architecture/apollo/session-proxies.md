---
doc: apollo/session-proxies
description: 7 session-lifecycle proxies
owns:
  - app/api/apollo/sessions/[id]/route.ts
  - app/api/apollo/sessions/[id]/chat/route.ts
  - app/api/apollo/sessions/[id]/done/route.ts
  - app/api/apollo/sessions/[id]/end/route.ts
  - app/api/apollo/sessions/[id]/next/route.ts
  - app/api/apollo/sessions/[id]/restart_problem/route.ts
  - app/api/apollo/sessions/[id]/retry/route.ts
related: [apollo/api-client, apollo/session-page]
last_verified: 2026-07-25
stub: false
---

# Apollo session-lifecycle proxies

The seven `sessions/[id]/*` route files (shared proxy pattern,
[hoot/_index.md](../hoot/_index.md)). All forward `Authorization`, set
`no-store`, and `encodeURIComponent` the `Promise`-typed `id`.

## Interface (route → backend)
| Route | Method | Backend | Backing fetcher |
|---|---|---|---|
| `/api/apollo/sessions/[id]` | GET | `/apollo/sessions/{id}` | `getSessionState` |
| `.../[id]/chat` | POST | `.../chat` | `sendChat` |
| `.../[id]/done` | POST | `.../done` | `finishTeaching` |
| `.../[id]/end` | POST | `.../end` | `endSession` |
| `.../[id]/next` | POST | `.../next` (body `{difficulty}`) | `nextProblem` |
| `.../[id]/restart_problem` | POST | `.../restart_problem` | `restartProblem` |
| `.../[id]/retry` | POST | `.../retry` | `retryProblem` |

## Invariants & gotchas
- Grouping is **structural**: everything under `sessions/[id]/` lives here;
  session **creation** (`sessions` POST, `from_hoot` POST) is in
  `practice-proxies.md`.

## Env flags
`AI_TA_API_BASE_URL`.

## Related
- [api-client.md](api-client.md), [session-page.md](session-page.md).
