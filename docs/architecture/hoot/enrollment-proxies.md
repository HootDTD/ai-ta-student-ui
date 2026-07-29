---
doc: hoot/enrollment-proxies
description: 2 invite-links proxies
owns:
  - app/api/invite-links/resolve/[code]/route.ts
  - app/api/invite-links/redeem/[code]/route.ts
related: [hoot/join-page]
last_verified: 2026-07-25
stub: false
---

# Enrollment proxies

Two thin route files (shared proxy pattern, [hoot/_index.md](_index.md)).

## Interface (route → backend)
| Route | Method | Backend | Quirk |
|---|---|---|---|
| `/api/invite-links/resolve/[code]` | GET | `/invite-links/resolve/{code}` | public — used **before** sign-in; no auth needed downstream |
| `/api/invite-links/redeem/[code]` | POST | `/invite-links/redeem/{code}` | forwards the `Bearer` token |

## Invariants & gotchas
- `code` param is `Promise`-typed (`await ctx.params`).
- Data-flow contract: **resolve is public, redeem is authenticated** (mirrors the
  join page's two-step flow).

## Env flags
`AI_TA_API_BASE_URL`.

## Related
- [join-page.md](join-page.md) — the sole caller.
