---
doc: shared-ui/citation-chip
description: CitationChip
owns:
  - components/CitationChip.tsx
related: [hoot/chat-home-page, apollo/chat, apollo/api-client]
last_verified: 2026-07-27
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
- Consumed by `app/page.tsx` under assistant messages (gated on
  `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS=1`), and by `ApolloChat`
  ([apollo/chat.md](../apollo/chat.md)) inside INTERACTION4 reference-aside
  cards — **not** flag-gated there; the aside always shows its citations.
- Uses the mono "technical" label voice — one of the two intentional exceptions
  to the `.eyebrow` label rule.

## Env flags
`NEXT_PUBLIC_SHOW_CITATION_PREVIEWS` (gates the chip only on the Hoot chat home).

## Related
- [chat-home-page.md](../hoot/chat-home-page.md) — flag-gated consumer.
- [apollo/chat.md](../apollo/chat.md) — unconditional consumer (aside citations).
- [apollo/api-client.md](../apollo/api-client.md) — `ChatAside.citations: CitationMeta[]`.
