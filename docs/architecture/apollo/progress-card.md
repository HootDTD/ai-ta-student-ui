---
doc: apollo/progress-card
description: ApolloProgressCard
owns:
  - components/apollo/ApolloProgressCard.tsx
related: [apollo/api-client, apollo/session-page, apollo/progress-page]
last_verified: 2026-07-25
stub: false
---

# ApolloProgressCard

XP / level / tier progress bar (~108 lines).

## Interface
default `ApolloProgressCard({progress:StudentProgress|null})`.

## Data flow
**Hardcodes the five XP tiers** (0/300/800/1600/3000 → Apollo
Apprentice/Adept/Scholar/Sage/Archon), computes percent-through-tier and XP-to-next
from `progress.xp_total` and `progress.level`, and renders `progress.title` +
level + a `progressbar` bar. Null ⇒ a skeleton state.

## Invariants & gotchas
- The tier table **explicitly mirrors backend `apollo/overseer/xp.py::LEVEL_TIERS`**
  — the source comment warns that drift silently miscomputes the bar; change both
  sides together.
- Consumed by `ApolloPageClient` (session view) and `ProgressClient` (which passes
  the `StudentProgressDetailed` superset).

## Related
- [api-client.md](api-client.md), [session-page.md](session-page.md),
  [progress-page.md](progress-page.md).
