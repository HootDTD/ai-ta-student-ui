---
doc: shell/auth-client
description: app/lib/auth.ts GoTrue client
owns:
  - app/lib/auth.ts
related: [shell/session-refresh, apollo/api-client, hoot/join-page]
last_verified: 2026-07-25
stub: false
---

# Auth client & session store

Hand-rolled Supabase **GoTrue REST** auth client + `localStorage` session store —
there is **no `@supabase/supabase-js`** dependency.

## Interface
Consumed by `app/page.tsx`, `app/join`, `app/report`, `lib/apollo/api.ts`, and
`components/SessionRefresher.tsx`.
- Types `StoredSession {access_token, refresh_token?, expires_at?, user_id?,
  user_email?}` and `SignUpResult {session, requiresEmailConfirmation}`.
- Constants `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_AUTH_ENABLED`,
  `SUPABASE_REST_URL` (exported but no code queries PostgREST).
- `signInWithPassword` (POST `token?grant_type=password`), `signUpWithPassword`
  (POST `signup`; null session + `requiresEmailConfirmation=true` when no token),
  `refreshSession` (POST `token?grant_type=refresh_token`).
- `loadStoredSession`/`saveStoredSession`/`clearStoredSession` (localStorage key
  `hoot_auth_session_v1`).
- `ensureActiveSession(session)` — refresh only when <30s of validity remains
  (page-load use).
- `authHeaders(accessToken?, includeJsonContentType?)` — `Bearer` builder that
  falls back to the anon key.
- `ensureFreshStoredSession()` — **proactive refresh** (added; absent from the
  old docs).

## Data flow
`ensureFreshStoredSession()` reloads the stored session and refreshes it when
less than `REFRESH_BUFFER_SEC` (=420s) of validity remains, then re-saves it. It
is **single-flighted** via a module-level `refreshInFlight` promise because
Supabase rotates refresh tokens — two concurrent refreshes would invalidate each
other. `session-refresh.md` drives it on a timer.

## Invariants & gotchas
- On refresh **failure** `ensureFreshStoredSession()` returns the **stale**
  session unchanged, so a transient network blip never signs the user out
  mid-class; the eventual 401 surfaces instead.
- Do **not** name a Supabase project — the old docs named a now-dead project; the
  URL/key are per-deployment env.

## Env flags
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both required for
`SUPABASE_AUTH_ENABLED`).

## Related
- [session-refresh.md](session-refresh.md) — the driver.
- [api-client.md](../apollo/api-client.md) — imports `authHeaders` +
  `loadStoredSession`.
- [join-page.md](../hoot/join-page.md) — sign-in/sign-up consumer.
