---
doc: shared-ui/special-chars-palette
description: SpecialCharsPalette
owns:
  - components/SpecialCharsPalette.tsx
related: [hoot/chat-home-page, apollo/chat]
last_verified: 2026-07-25
stub: false
---

# SpecialCharsPalette

Collapsible math-character keypad for textareas.

## Interface
- default `SpecialCharsPalette({onInsert: (ch: string) => void})`.

## Data flow
A `Σ` toggle reveals grouped rows — Greek, powers/subscripts, operators,
relations, brackets. Each key fires `onInsert(ch)`; the consumer inserts the
character at the textarea caret.

## Invariants & gotchas
- Keys use `onMouseDown` + `preventDefault()` so the textarea keeps focus while
  inserting.

## Related
- Consumers: [chat-home-page.md](../hoot/chat-home-page.md) (Hoot composer),
  [chat.md](../apollo/chat.md) (Apollo composer).
