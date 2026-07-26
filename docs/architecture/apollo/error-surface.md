---
doc: apollo/error-surface
description: ApolloErrorSurface
owns:
  - components/apollo/ApolloErrorSurface.tsx
related: [apollo/api-client]
last_verified: 2026-07-25
stub: false
---

# ApolloErrorSurface

Error-code → human-copy renderer (~70 lines) — the concrete implementation of the
"NO FALLBACKS" contract.

## Interface
default `ApolloErrorSurface({error:ApolloApiError|Error|null, onDismiss?})`.

## Data flow
Maps six `ApolloApiError.errorCode` values to an explicit title + a detail
sentence interpolating `err.extra` (e.g. `parser_could_not_extract` quotes
`extra.utterance`; `malformed_equation` quotes `extra.symbolic`/`extra.entry_id`/
`extra.parse_error`; `pool_exhausted` quotes `extra.difficulty`/
`extra.concept_cluster_id`). A non-`ApolloApiError` gets a generic title +
`err.message`; any code without an explicit case (e.g. `coverage_grading_failed`,
`kg_entry_not_found`, `problem_not_found`, `unknown`) falls to the generic
"Something went wrong".

## Invariants & gotchas
- Keep the handled `errorCode` set in sync with `apollo/api-client.md`'s
  `ApolloErrorCode` union (which mirrors backend); a newly-added code renders the
  generic copy until a case is added.
- Consumed by `ApolloPageClient`, `ApolloChat`, `ProgressClient`, `ApolloBrowse`.

## Related
- [api-client.md](api-client.md).
