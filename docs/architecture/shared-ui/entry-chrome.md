---
doc: shared-ui/entry-chrome
description: AuthBrand+BootScreen+OwlVideo
owns:
  - components/AuthBrand.tsx
  - components/BootScreen.tsx
  - components/OwlVideo.tsx
related: [hoot/chat-home-page, hoot/join-page, apollo/browse, apollo/chat]
last_verified: 2026-07-25
stub: false
---

# Entry & loading chrome

Three tiny branded-chrome primitives grouped as one glue doc (all `"use client"`).

## Interface
- `OwlVideo({className?})` — the **base**: a decorative `/thinking.mp4` wrapper
  (`autoPlay`/`loop`/`muted`/`playsInline`, `aria-hidden`). Hides itself via
  `onError` state if the asset fails, so the wordmark stands alone.
- `AuthBrand({subtitle="AI Teaching Assistant"})` — `OwlVideo` + "Hoot" wordmark
  + subtitle (`.auth-brand*`). Used by the sign-in / config-error cards.
- `BootScreen({label?})` — full-page loading state (owl + wordmark + shimmer
  `.boot-screen__bar` + optional label).

## Data flow
`AuthBrand` and `BootScreen` each compose `OwlVideo`; consumers render them
directly. No fetching, no state beyond `OwlVideo`'s local `failed` flag.

## Invariants & gotchas
- If `OwlVideo` fails to load it returns `null` rather than leaving a broken-media
  box — the brand still reads.

## Related
- Consumers: [chat-home-page.md](../hoot/chat-home-page.md),
  [join-page.md](../hoot/join-page.md) (auth cards / boot),
  [browse.md](../apollo/browse.md), [chat.md](../apollo/chat.md) (bare
  `OwlVideo`).
