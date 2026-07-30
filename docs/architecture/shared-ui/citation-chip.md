---
doc: shared-ui/citation-chip
description: CitationChip
owns:
  - components/CitationChip.tsx
related: [hoot/chat-home-page, apollo/chat, apollo/api-client]
last_verified: 2026-07-30
stub: false
---

# CitationChip

RAG citation pill with a pure-CSS hover preview and (when the meta carries a
source id) a click-to-open source-PDF link.

## Interface
- named `CitationChip({meta: CitationMeta})`.
- `CitationMeta = {label, doc_type?, file?, page?, ocr_conf?, bbox?, thumb?,
  teacher_upload_id?, upload_id?, doc_id?}` (type exported here). The last
  three are the optional link keys: structured citations arrive with
  `teacher_upload_id` (stringified `app.uploads.id`); report review chips pass
  `upload_id`/`doc_id` from `TopicReviewPointer`.

## Data flow
Renders the `label` plus a CSS-driven `.citation-chip__preview` card showing doc
type, file, `p. N`, `OCR NN%`, and an optional thumbnail via `next/image`
(`unoptimized`). **No fetch on hover** — everything comes from `meta`.

**Source link (2026-07-30):** when `sourceQuery` resolves a numeric id
(`upload_id ?? teacher_upload_id`, else numeric `doc_id` — non-numeric
chunk-id fallbacks stay unlinked), the label renders as a `<button
class="citation-chip__label citation-chip__label--link">`. Click: open a
blank tab synchronously (popup blockers need the gesture), authenticated
fetch to `/api/materials/file-url?upload_id=|doc_id=`
([qa-proxies.md](../hoot/qa-proxies.md)) mints a short-lived signed URL, tab
navigates to it with `#page=N` appended when the meta has a page (deep-links
in built-in browser PDF viewers). Any failure closes the tab quietly — the
chip itself is the graceful fallback. No-id chips render the plain `<span>`
label exactly as before.

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
