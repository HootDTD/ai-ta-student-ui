---
doc: shared-ui/_index
description: Shared presentational components router
owns: []
related: []
last_verified: 2026-07-25
stub: false
---

# shared-ui — components reused across both surfaces

Presentational chrome + renderers imported by **more than one** page/domain.
Apollo-only components live under `apollo/`.

| Doc | One-liner | Owns |
|---|---|---|
| [entry-chrome.md](entry-chrome.md) | Branded entry + loading chrome (owl mascot base) | `AuthBrand`, `BootScreen`, `OwlVideo` |
| [math-markdown.md](math-markdown.md) | Shared markdown + KaTeX renderer + `normalizeMath` | `MathMarkdown` |
| [citation-chip.md](citation-chip.md) | RAG citation pill with hover preview | `CitationChip` |
| [special-chars-palette.md](special-chars-palette.md) | Math-character keypad for textareas | `SpecialCharsPalette` |

## Cross-cutting invariants
- `OwlVideo` is the base primitive wrapped by both `AuthBrand` and `BootScreen`
  and also used directly by `ApolloBrowse`/`ApolloChat` — a shared-ui → (hoot +
  apollo) fan-out.
- The repo has **two** math renderers on purpose: `MathMarkdown` (here) and
  `react-katex` `InlineMath` in `ApolloKGPanel`. Route LLM-authored prose through
  `MathMarkdown`; do not conflate the two.
