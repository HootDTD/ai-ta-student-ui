---
doc: shell/feature-flags
description: lib/flags.ts APOLLO_ONLY + Apollo turn-streaming kill switch
owns:
  - lib/flags.ts
related: [hoot/chat-home-page, apollo/top-bar, apollo/session-page, apollo/chat, apollo/api-client]
last_verified: 2026-08-23
stub: false
---

# Feature flags

## Interface
- `APOLLO_ONLY` — truthy when `NEXT_PUBLIC_APOLLO_ONLY` is in `{1, true, yes,
  on}` (case-insensitive, trimmed).
- `APOLLO_TURN_STREAMING_DEFAULT` — the Apollo turn transport default. **Off
  tokens only** (`{0, false, no, off}` on `NEXT_PUBLIC_APOLLO_TURN_STREAMING`),
  so unset ⇒ streaming ON and the blocking fallback is an explicit act.
- `apolloTurnStreamingEnabled()` — the value callers actually read, per send.
- `APOLLO_TURN_STREAMING_KEY` — the localStorage key that overrides it.

## Data flow
`NEXT_PUBLIC_*` is inlined at build time, so both defaults are fixed **per
Railway service / per built image**, not per user.

`apolloTurnStreamingEnabled()` adds one layer on top: a `localStorage`
override at `hoot.apollo.turn_streaming` (`off`-tokens ⇒ blocking, `on`-tokens
⇒ streaming, anything else ⇒ the build default). SSR-safe (no `window` ⇒ the
default) and storage-failure-safe (a throwing `localStorage` in a hardened
browser ⇒ the default, never a failed send).

## Invariants & gotchas
- APOLLO_ONLY effect (implemented in `app/page.tsx` + `ApolloTopBar`): `/` still
  serves the sign-in card, but signed-in users are `router.replace`'d to
  `/apollo?class={first my-class}` (bare `/apollo` on none/error) and the Hoot
  chat never renders; the "Return to Hoot" entry points are hidden/retargeted.
  The backend enforces the same policy **independently** via `HOOT_QA_ENABLED`
  (POST `/ask` 403s), so the flag is defense-in-depth, not the sole gate.
- **The runtime override is the actual kill switch, and that is deliberate.**
  A `NEXT_PUBLIC_*` change needs a Railway variable edit *plus* a redeploy
  (Railway is known to skip variable-only redeploys), which is too slow to be
  the only way to stop streaming during a live study session. One line in the
  console — `localStorage.setItem('hoot.apollo.turn_streaming', 'off')` — takes
  effect on the next send, no deploy. Its scope is one browser; the env var is
  still the fleet-wide default.
- **Read per send, never captured.** `apolloTurnStreamingEnabled()` is a
  function, not a module const, so a flip applies to the next turn instead of
  requiring a reload. Don't hoist it into a `useState`/module constant.
- Flipping it back must stay a complete fallback: the blocking `sendChat` path
  and the `.../chat` proxy are live code, not legacy
  ([api-client.md](../apollo/api-client.md),
  [session-proxies.md](../apollo/session-proxies.md)).

## Env flags
`NEXT_PUBLIC_APOLLO_ONLY`, `NEXT_PUBLIC_APOLLO_TURN_STREAMING`.

## Related
- [chat-home-page.md](../hoot/chat-home-page.md) — the redirect origin.
- [top-bar.md](../apollo/top-bar.md), [session-page.md](../apollo/session-page.md)
  — hide/retarget "Return to Hoot".
- [chat.md](../apollo/chat.md) — the one send-path seam the transport flag
  branches on; [api-client.md](../apollo/api-client.md) — the two transports.
