---
doc: shell/_index
description: Shell/build/auth/flags router
owns: []
related: []
last_verified: 2026-07-25
stub: false
---

# shell — app infrastructure & cross-cutting concerns

| Doc | One-liner | Owns |
|---|---|---|
| [build-config.md](build-config.md) | Root build/tooling + CI config | `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `.github/workflows/ci.yml` |
| [layout-and-design-system.md](layout-and-design-system.md) | Root layout + hand-rolled CSS design system | `app/layout.tsx`, `app/globals.css` |
| [auth-client.md](auth-client.md) | Supabase GoTrue REST client + localStorage session | `app/lib/auth.ts` |
| [session-refresh.md](session-refresh.md) | Invisible proactive-refresh driver | `components/SessionRefresher.tsx` |
| [feature-flags.md](feature-flags.md) | `APOLLO_ONLY` build-time flag | `lib/flags.ts` |

## Cross-cutting invariants
- `app/layout.tsx` is the single mount point for global fonts (Fraunces +
  JetBrains Mono) and KaTeX CSS, and mounts `<SessionRefresher/>` **once**.
- `auth-client.md` is the **sole owner of the localStorage session shape**
  (`StoredSession`, key `hoot_auth_session_v1`) consumed by every surface; the
  proactive-refresh entry `ensureFreshStoredSession()` is driven by
  `session-refresh.md`.
- Env is per-Railway-service and per-deployment. Docs name env vars, never a
  Supabase project or flag value.
