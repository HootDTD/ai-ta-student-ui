---
doc: apollo/_index
description: Apollo student session UI router
owns: []
related: []
last_verified: 2026-07-25
stub: false
---

# apollo — the teach-back surface

Biggest domain (~40 files). Read [api-client.md](api-client.md) **first** — it is
the single source of every Apollo type + fetcher, imported by both pages and
every component.

| Doc | One-liner |
|---|---|
| [session-page.md](session-page.md) | `/apollo` orchestrator (page.tsx + ApolloPageClient) |
| [progress-page.md](progress-page.md) | `/apollo/progress` (page.tsx + ProgressClient) |
| [api-client.md](api-client.md) | `lib/apollo/api.ts` — types + fetchers hub |
| [top-bar.md](top-bar.md) | ApolloTopBar chrome + class switcher |
| [browse.md](browse.md) | ApolloBrowse + ApolloSidebar picker |
| [chat.md](chat.md) | ApolloChat conversation + composer |
| [kg-panel.md](kg-panel.md) | ApolloKGPanel open-learner-model |
| [kg-entry-pill.md](kg-entry-pill.md) | KGEntryPill P3 negotiation wrapper |
| [kg-entry-cards.md](kg-entry-cards.md) | Dispute + Paraphrase + Trace cards |
| [problem-panel.md](problem-panel.md) | ApolloProblemPanel current-problem card |
| [progress-card.md](progress-card.md) | ApolloProgressCard XP/level bar |
| [report-panel.md](report-panel.md) | ApolloReportPanel post-Done report |
| [coverage-celebrations.md](coverage-celebrations.md) | ApolloCoverageCelebrations |
| [error-surface.md](error-surface.md) | ApolloErrorSurface error-code copy |
| [session-proxies.md](session-proxies.md) | 7 session-lifecycle proxies |
| [practice-proxies.md](practice-proxies.md) | 5 browse/practice proxies |
| [kg-proxies.md](kg-proxies.md) | 4 P3 negotiation proxies |

## Orchestration spine
ApolloPageClient (session-page) owns session/report/KG/drawer/dedup/reset state
and wires nearly every component; `lib/apollo/api.ts` is imported by all of them.

## Cross-cutting invariants
- **NO FALLBACKS:** each `ApolloApiError.errorCode` gets explicit copy in
  ApolloErrorSurface; the errorCode union mirrors backend `error_code` strings
  (change both sides together).
- All `/api/apollo/*` proxies share the thin pattern in
  [hoot/_index.md](../hoot/_index.md) (forward Authorization, no-store).
  Cross-domain: `listMyClasses()` uses Hoot's `/api/my-classes`.
