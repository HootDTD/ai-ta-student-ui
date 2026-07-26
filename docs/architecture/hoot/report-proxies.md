---
doc: hoot/report-proxies
description: 2 reports/ai-use proxies
owns:
  - app/api/reports/ai-use/[id]/route.ts
  - app/api/reports/ai-use/[id]/pdf/route.ts
related: [hoot/report-viewer-page]
last_verified: 2026-07-25
stub: false
---

# AI-use report proxies

Two thin route files (shared proxy pattern, [hoot/_index.md](_index.md)).

## Interface (route -> backend)
| Route | Method | Backend | Quirk |
|---|---|---|---|
| `/api/reports/ai-use/[id]` | GET | `/reports/ai-use/{id}` | fetch report by id |
| `/api/reports/ai-use/[id]` | POST | `/reports/ai-use/{id}` | **create** a report; here `id` is the `chat_id` — no page calls POST |
| `/api/reports/ai-use/[id]/pdf` | GET | `/reports/ai-use/{id}.pdf` | binary passthrough (Content-Disposition attachment) |

## Invariants & gotchas
- `id` param is `Promise`-typed (`await ctx.params`).
- **Inconsistency (record, don't "fix" silently):** these handlers read
  `AI_TA_API_BASE_URL` **without** the trailing-slash strip that every other
  proxy applies. The GET-report handler also omits `Cache-Control: no-store`
  (only the PDF route sets it).

## Env flags
`AI_TA_API_BASE_URL`.

## Related
- [report-viewer-page.md](report-viewer-page.md) — the sole caller.
