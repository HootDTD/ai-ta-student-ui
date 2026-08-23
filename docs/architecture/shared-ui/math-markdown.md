---
doc: shared-ui/math-markdown
description: MathMarkdown + normalizeMath
owns:
  - components/MathMarkdown.tsx
related: [hoot/chat-home-page, apollo/chat, apollo/problem-panel, apollo/kg-panel]
last_verified: 2026-08-23
stub: false
---

# MathMarkdown

The shared markdown + KaTeX renderer — the **default** for any
LLM-authored / evidence-quoted text.

## Interface
- default `memo(MathMarkdown)({children: string})` — `ReactMarkdown` with
  `remark-math` + `rehype-katex` applied to `normalizeMath(children)`. Emits
  **no wrapper element**, so callers supply their own container
  (`.prose.md-body` in Apollo surfaces; `.prose.max-w-none` in the main chat).
- named `normalizeMath(str)` — converts the delimiters LLMs emit — `\(..\)`,
  `\[..\]`, and two bare-bracket TeX heuristics — into the `$..$` / `$$..$$` that
  `remark-math` parses. Extracted verbatim from `app/page.tsx` so every surface
  normalizes identically.

## Data flow
KaTeX CSS is imported both here and globally in `app/layout.tsx`.

## Invariants & gotchas
- **`React.memo` is load-bearing (2026-08-23).** `react-markdown` v10 calls
  `createProcessor(options)` in its render body with no memoization of its own,
  so an un-memoized render rebuilds the unified pipeline **and** re-parses the
  whole document. `ApolloChat` re-renders on every keystroke (the composer
  draft is parent state), which meant re-parsing the entire KaTeX scrollback
  per character typed.
- The memo relies on the props shape staying exactly `{children: string}`, so
  the default shallow compare is the correct predicate and no `areEqual` is
  needed. **Every call site must pass one JSX expression child that evaluates
  to a string** (audited 2026-08-23 across `app/page.tsx`, `ApolloChat`,
  `ApolloBrowse`, `ApolloProblemPanel`, `ApolloReportPanel` — all conform).
  Adding an object/array/callback prop, or splitting children across several
  JSX children (which makes `children` a fresh array each render), silently
  reverts the whole optimization.
- **INVARIANT:** the repo intentionally has two math renderers — this markdown
  pipeline (normalizes `\(..\)`/`\[..\]`) **and** `react-katex` `InlineMath` for
  `$..$`-only equation nodes in `ApolloKGPanel` (+ the client printable report's
  `mdToHtml` in `app/page.tsx`). Do not conflate them.

## Related
- Consumers: [chat-home-page.md](../hoot/chat-home-page.md),
  [chat.md](../apollo/chat.md), [problem-panel.md](../apollo/problem-panel.md),
  [report-panel.md](../apollo/report-panel.md).
- [kg-panel.md](../apollo/kg-panel.md) — the `InlineMath` alternative.
