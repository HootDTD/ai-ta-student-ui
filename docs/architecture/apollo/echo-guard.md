---
doc: apollo/echo-guard
description: echoGuard.ts copied-reply detector
owns:
  - components/apollo/echoGuard.ts
related: [apollo/chat]
last_verified: 2026-08-23
stub: false
---

# Echo guard (`components/apollo/echoGuard.ts`)

Bimodal-fix P0.6 / defect I8 (2026-08-07). Pilot students submitted Apollo's
previous turn back as their own message — verbatim, and once minus its first 2
characters (manual select-copy-paste; there is no programmatic prefill path in
the UI). Graded as the student's words, that is a free pass.

Split out of [chat.md](chat.md) on 2026-08-23 (leaf line cap); the detector is a
standalone pure module, so it gets its own leaf.

## Interface
`isEchoOfApolloTurn(draft: string, lastApolloMessage: string): boolean` — pure,
no React, no I/O.

## Data flow
Whitespace-normalized substring containment: true when the draft covers ≥90% of
Apollo's most recent apollo-role turn (asides included). `ApolloChat.handleSend`
calls it before sending and, on a hit, asks `window.confirm` ("…send it
anyway?") — the same native-confirm precedent as restart.

## Invariants & gotchas
- **Confirm-gated, never a hard block.** A student who means it can always send.
  Cancelling keeps the draft in the composer so it can be rewritten.
- The ≥90% span is what keeps short legitimate quotes of a phrase from
  prompting; don't lower it without re-checking that.
- Applies to ask-mode submits too — the check runs before the transport branch.

## Related
- [chat.md](chat.md) — the only caller.
