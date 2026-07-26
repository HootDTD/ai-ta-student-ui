---
doc: ai-ta-student-ui/_overview
description: Root router (client-only auth, /api proxies)
owns: []
related: []
last_verified: 2026-07-25
stub: false
---

# Student UI — architecture overview

Hoot's student app: a Next.js 15 App Router SPA (dev port 3001) with two
surfaces — **Hoot** (course-scoped RAG chat) and **Apollo** (teach-back). Auth is
client-only; the backend is reached only through same-origin `/api/*` proxies.

## Reading protocol
CLAUDE.md → `shared-architecture/README.md` → this → a domain `_index.md` → 1-3
leaf docs. Resolve any source file to its owning doc via `docs/index.json`.

## Domains
| Domain | Index | Covers |
|---|---|---|
| shell | [shell/_index.md](shell/_index.md) | build/CI config, root layout + design system, auth client, session refresh, feature flags |
| shared-ui | [shared-ui/_index.md](shared-ui/_index.md) | presentational components reused by both surfaces |
| hoot | [hoot/_index.md](hoot/_index.md) | RAG chat home, join, report viewer + their `/api` proxies |
| apollo | [apollo/_index.md](apollo/_index.md) | teach-back pages, components, API client + proxies |

## Cross-cutting invariants
- **All backend calls go through `/api/*` Node-runtime proxies** that forward the
  incoming `Authorization` header verbatim and set `Cache-Control: no-store`,
  adding no auth of their own (pattern documented once in `hoot/_index.md` and
  `apollo/_index.md`).
- **Auth is entirely client-side.** `app/lib/auth.ts` is a hand-rolled Supabase
  GoTrue REST client storing the session in `localStorage` (key
  `hoot_auth_session_v1`) — no SSR, no middleware, no `@supabase/supabase-js`.
  Env is per-deployment; never name a Supabase project in these docs.
- **Two math renderers coexist by design** — `MathMarkdown` (markdown + KaTeX)
  and `react-katex` `InlineMath` in `ApolloKGPanel`; do not conflate them.
