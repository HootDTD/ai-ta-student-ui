---
doc: hoot/join-page
description: app/join/[code]/page.tsx
owns:
  - app/join/[code]/page.tsx
related: [shared-ui/entry-chrome, shell/auth-client, hoot/enrollment-proxies]
last_verified: 2026-07-25
stub: false
---

# Join page (`app/join/[code]/page.tsx`)

Invite-link landing page (~276 lines, `"use client"`) at `/join/[code]`.

## Interface
Default `JoinPage()` — reads `code` from `useParams`.

## Data flow
On mount: (a) restore the stored session via `ensureActiveSession`; (b) GET
`/api/invite-links/resolve/{code}` (**unauthenticated**) → `{search_space_id,
course_name, role}`. If not signed in, an email/password sign-in/sign-up form
titled "Join {course_name}" renders. Once a session **and** a resolved link both
exist, an effect auto-POSTs `/api/invite-links/redeem/{code}` with the `Bearer`
token; on `success:true` it shows "You're in!" then `router.push('/')` after
~1.5s. All branches (checking, sign-in, success, enrolling, errors) render on the
shared `AuthBrand`/`BootScreen` entry-screen design.

## Invariants & gotchas
- **resolve is public, redeem is authenticated** — the resolve call runs before
  sign-in so the course name can be shown.
- Backend errors render via the response `detail` field.

## Related
- [entry-chrome.md](../shared-ui/entry-chrome.md),
  [auth-client.md](../shell/auth-client.md),
  [enrollment-proxies.md](enrollment-proxies.md).
