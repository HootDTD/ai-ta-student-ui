---
doc: apollo/kg-proxies
description: 4 P3 negotiation proxies
owns:
  - app/api/apollo/sessions/[id]/kg/[entry_id]/challenge/route.ts
  - app/api/apollo/sessions/[id]/kg/[entry_id]/paraphrase/route.ts
  - app/api/apollo/sessions/[id]/kg/[entry_id]/skip/route.ts
  - app/api/apollo/sessions/[id]/kg/[entry_id]/trace/route.ts
related: [apollo/api-client, apollo/kg-entry-pill, apollo/kg-entry-cards]
last_verified: 2026-07-25
stub: false
---

# Apollo P3 KG-negotiation proxies

Four route files (shared proxy pattern, [hoot/_index.md](../hoot/_index.md)). Both
the `id` and `entry_id` params are `Promise`-typed and `encodeURIComponent`'d.

## Interface (route → backend)
| Route | Method | Backend | Backing fetcher |
|---|---|---|---|
| `.../kg/[entry_id]/challenge` | POST (body `{reason}`) | `.../challenge` | `challengeEntry` |
| `.../kg/[entry_id]/paraphrase` | POST (body `{surface_form}`) | `.../paraphrase` | `paraphraseEntry` |
| `.../kg/[entry_id]/skip` | POST (empty body `{}`) | `.../skip` | `skipEntry` |
| `.../kg/[entry_id]/trace` | GET | `.../trace` | `getEntryTrace` |

## Invariants & gotchas
- challenge/paraphrase/skip return `{entry, kg, move}`; trace returns the
  chronological `NegotiationTrace` (read-only audit log).

## Env flags
`AI_TA_API_BASE_URL`.

## Related
- [api-client.md](api-client.md), [kg-entry-pill.md](kg-entry-pill.md),
  [kg-entry-cards.md](kg-entry-cards.md).
