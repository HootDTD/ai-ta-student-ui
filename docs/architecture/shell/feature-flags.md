---
doc: shell/feature-flags
description: lib/flags.ts APOLLO_ONLY
owns:
  - lib/flags.ts
related: [hoot/chat-home-page, apollo/top-bar, apollo/session-page]
last_verified: 2026-07-25
stub: false
---

# Feature flags

## Interface
Single export `APOLLO_ONLY` — truthy when `NEXT_PUBLIC_APOLLO_ONLY` is in
`{1, true, yes, on}` (case-insensitive, trimmed).

## Data flow
`NEXT_PUBLIC_*` is inlined at build time, so the flag is fixed **per Railway
service / per built image**, not per user.

## Invariants & gotchas
- Effect (implemented in `app/page.tsx` + `ApolloTopBar`): `/` still serves the
  sign-in card, but signed-in users are `router.replace`'d to
  `/apollo?class={first my-class}` (bare `/apollo` on none/error) and the Hoot
  chat never renders; the "Return to Hoot" entry points are hidden/retargeted.
- The backend enforces the same policy **independently** via `HOOT_QA_ENABLED`
  (POST `/ask` 403s), so the flag is defense-in-depth, not the sole gate.

## Env flags
`NEXT_PUBLIC_APOLLO_ONLY`.

## Related
- [chat-home-page.md](../hoot/chat-home-page.md) — the redirect origin.
- [top-bar.md](../apollo/top-bar.md), [session-page.md](../apollo/session-page.md)
  — hide/retarget "Return to Hoot".
