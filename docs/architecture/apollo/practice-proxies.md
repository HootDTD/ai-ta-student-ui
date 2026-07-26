---
doc: apollo/practice-proxies
description: 5 browse/practice proxies
owns:
  - app/api/apollo/concepts/route.ts
  - app/api/apollo/problems/route.ts
  - app/api/apollo/progress/route.ts
  - app/api/apollo/sessions/route.ts
  - app/api/apollo/sessions/from_hoot/route.ts
related: [apollo/api-client, apollo/browse, apollo/progress-page, hoot/chat-home-page]
last_verified: 2026-07-25
stub: false
---

# Apollo browse / practice proxies

Five route files (shared proxy pattern, [hoot/_index.md](../hoot/_index.md)) —
the collection-level reads plus session **creation**. Several were absent from the
pre-restructure proxy table (drift). All forward `Authorization` + set `no-store`.

## Interface (route → backend)
| Route | Method | Backend | Backing fetcher |
|---|---|---|---|
| `/api/apollo/concepts` | GET | `/apollo/concepts?search_space_id=…` | `listConcepts` |
| `/api/apollo/problems` | GET | `/apollo/problems?…` | `listProblems` |
| `/api/apollo/progress` | GET | `/apollo/progress` (identity from Bearer) | `getStudentProgressDetailed` |
| `/api/apollo/sessions` | POST | `/apollo/sessions` (body `{search_space_id, concept_id, difficulty, problem_id?}`) | `startSession` |
| `/api/apollo/sessions/from_hoot` | POST | `/apollo/sessions/from_hoot` (body `{search_space_id, hoot_transcript, difficulty?}`) | `startSessionFromHoot` |

## Invariants & gotchas
- Query strings pass through via `new URL(req.url).search`.
- `/apollo/progress` replaced the old `/progress/{student_id}` — identity now
  comes from the Bearer token, not a path param.

## Env flags
`AI_TA_API_BASE_URL`.

## Related
- [api-client.md](api-client.md), [browse.md](browse.md),
  [progress-page.md](progress-page.md),
  [chat-home-page.md](../hoot/chat-home-page.md) (`startSessionFromHoot`).
