---
doc: shell/session-refresh
description: SessionRefresher.tsx
owns:
  - components/SessionRefresher.tsx
related: [shell/auth-client, shell/layout-and-design-system]
last_verified: 2026-07-25
stub: false
---

# SessionRefresher

New file, absent from the pre-restructure docs.

## Interface
Default `SessionRefresher()` — an invisible (`return null`) `"use client"`
component mounted **once** in `app/layout.tsx`.

## Data flow
On mount it calls `ensureFreshStoredSession()` (see `shell/auth-client.md`) once,
then sets a **240s (4-min)** `setInterval` tick plus a `visibilitychange`
listener that refreshes when the tab returns to `visible`. Both are cleaned up on
unmount.

## Invariants & gotchas
- The Apollo API layer reads the token per-request via `loadStoredSession()`, so
  keeping `localStorage` fresh is sufficient — this component never passes a
  token to anyone.
- The 4-min tick pairs with `auth.ts`'s 7-min (`REFRESH_BUFFER_SEC=420`) buffer;
  the `visibilitychange` handler covers wake-from-sleep where timers didn't fire.

## Related
- [auth-client.md](auth-client.md) — provides `ensureFreshStoredSession()`.
- [layout-and-design-system.md](layout-and-design-system.md) — the mount site.
