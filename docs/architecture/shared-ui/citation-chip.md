---
doc: shared-ui/citation-chip
description: CitationChip
owns:
  - components/CitationChip.tsx
related: [hoot/chat-home-page]
last_verified: 2026-07-25
stub: false
---

# CitationChip

RAG citation pill with a pure-CSS hover preview.

## Interface
- named `CitationChip({meta: CitationMeta})`.
- `CitationMeta = {label, doc_type?, file?, page?, ocr_conf?, bbox?, thumb?}`
  (type exported here).

## Data flow
Renders the `label` plus a CSS-driven `.citation-chip__preview` card showing doc
type, file, `p. N`, `OCR NN%`, and an optional thumbnail via `next/image`
(`unoptimized`). **No fetch on hover** — everything comes from `meta`.

## Invariants & gotchas
- Consumed **only** by `app/page.tsx`, under assistant messages, gated on
  `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS=1`.
- Uses the mono "technical" label voice — one of the two intentional exceptions
  to the `.eyebrow` label rule.

## Env flags
`NEXT_PUBLIC_SHOW_CITATION_PREVIEWS` (gates whether the chip renders at all).

## Related
- [chat-home-page.md](../hoot/chat-home-page.md) — the sole consumer.
