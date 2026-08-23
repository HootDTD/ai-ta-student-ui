---
doc: apollo/progress-page
description: progress/page.tsx + ProgressClient.tsx
owns:
  - app/apollo/progress/page.tsx
  - app/apollo/progress/ProgressClient.tsx
related: [apollo/api-client, apollo/top-bar, apollo/progress-card, apollo/error-surface]
last_verified: 2026-08-23
stub: false
---

# Apollo progress page

The `/apollo/progress` route (never described in the pre-restructure docs).

## Interface
- `app/apollo/progress/page.tsx` — `<Suspense>` wrapper (fallback "Loading
  progress…") around `ProgressClient`.
- `app/apollo/progress/ProgressClient.tsx` (~113 lines, `"use client"`).

## Data flow
Reads `?class=` (Number). Without a `classId`, renders `ApolloTopBar` + a prompt
to open progress from the Apollo page. With `classId`:
`getStudentProgressDetailed(classId)` → `ApolloTopBar` (onBack → `/apollo?class=`,
`hideProgressLink`), `ApolloErrorSurface`, `ApolloProgressCard`, plus two sections
from `data.detail`:
- **Concept mastery** — `.apollo-mastery` rows: `display_name` + bar at
  `mastery_avg*100%` + pct.
- **Recent attempts** — `.apollo-attempts` rows: `concept_display_name`,
  `difficulty`, proficiency band + optional `(score)`, `toLocaleDateString`.
  The band comes from `resolveBand(attempt)` (`lib/apollo/bands.ts`) — the
  served `band` token, else derived from `score`, else `"?"`. The `letter`
  field is never rendered (study-prep spec §A.3).

Empty state when both `mastery` and `recent_attempts` are empty.

## Invariants & gotchas
- Types `StudentProgressDetailed`/`ProgressDetail`/`ConceptMastery`/
  `RecentAttempt` come from `apollo/api-client.md`.

## Related
- [api-client.md](api-client.md), [top-bar.md](top-bar.md),
  [progress-card.md](progress-card.md), [error-surface.md](error-surface.md).
