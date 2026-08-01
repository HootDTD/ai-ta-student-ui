---
doc: apollo/top-bar
description: ApolloTopBar
owns:
  - components/apollo/ApolloTopBar.tsx
related: [apollo/api-client, hoot/qa-proxies, shell/feature-flags, shell/auth-client]
last_verified: 2026-07-31
stub: false
---

# ApolloTopBar

Chrome shared by every Apollo page (~240 lines).

## Interface
default `ApolloTopBar({classId?, onBack?, backLabel?, onToggleSidebar?,
hideProgressLink?, actions?, maxWidthClassName?})`. Renders Hoot's own
`.site-header`/`.site-brand` (with the exact Tailwind layout Hoot's `<header>`
uses) so the two headers can't drift.

## Data flow
- Left cluster: an optional sidebar-toggle (browse only) or back button
  (session/progress), then a **class-switcher dropdown** that fetches
  `listMyClasses()` on mount and `router.push('/apollo?class={id}')` on select
  (dropping any session/concept state).
- Center: the "Apollo" brand, absolutely centered, pointer-events-none.
- Right cluster: any `actions` as visible `.apollo-topbar__action` buttons (the
  session view passes the "Understanding" KG-drawer toggle + "Start over"), then
  the ⋮ overflow menu: theme toggle, "My progress" (unless `hideProgressLink`),
  "Return to Hoot", "Sign out of {email}".
- The theme toggle and sign-out mirror Hoot's header menu (`app/page.tsx`):
  toggle flips the `dark` class + `localStorage.theme` with the
  `theme-transition` fade; sign-out calls `clearStoredSession()` then
  `router.push('/')` (the `/` sign-in card still serves under `APOLLO_ONLY`).

## Invariants & gotchas
- The class switcher fetches **independently of the `classId` prop** (which is
  only ever the current course), so it still renders on the "no class in URL"
  error screens and lets the student fix that.
- "Return to Hoot" is hidden under `APOLLO_ONLY`.
- The mount effect that applies `localStorage.theme` to `<html>` is
  load-bearing under `APOLLO_ONLY`: the Hoot page's equivalent effect never
  runs there, so this is the only theme initializer on Apollo-only builds.
- Consumed by `ApolloBrowse`, `ApolloPageClient`, `ProgressClient`.

## Env flags
`NEXT_PUBLIC_APOLLO_ONLY`.

## Related
- [api-client.md](api-client.md) (`listMyClasses`),
  [qa-proxies.md](../hoot/qa-proxies.md) (`/api/my-classes`),
  [feature-flags.md](../shell/feature-flags.md).
