---
doc: shared-ui/math-markdown
description: MathMarkdown + normalizeMath
owns:
  - components/MathMarkdown.tsx
related: [hoot/chat-home-page, apollo/chat, apollo/problem-panel, apollo/kg-panel]
last_verified: 2026-07-25
stub: false
---

# MathMarkdown

The shared markdown + KaTeX renderer — the **default** for any
LLM-authored / evidence-quoted text.

## Interface
- default `MathMarkdown({children: string})` — `ReactMarkdown` with `remark-math`
  + `rehype-katex` applied to `normalizeMath(children)`. Emits **no wrapper
  element**, so callers supply their own container (`.prose.md-body` in Apollo
  surfaces; `.prose.max-w-none` in the main chat).
- named `normalizeMath(str)` — converts the delimiters LLMs emit — `\(..\)`,
  `\[..\]`, and two bare-bracket TeX heuristics — into the `$..$` / `$$..$$` that
  `remark-math` parses. Extracted verbatim from `app/page.tsx` so every surface
  normalizes identically.

## Data flow
KaTeX CSS is imported both here and globally in `app/layout.tsx`.

## Invariants & gotchas
- **INVARIANT:** the repo intentionally has two math renderers — this markdown
  pipeline (normalizes `\(..\)`/`\[..\]`) **and** `react-katex` `InlineMath` for
  `$..$`-only equation nodes in `ApolloKGPanel` (+ the client printable report's
  `mdToHtml` in `app/page.tsx`). Do not conflate them.

## Related
- Consumers: [chat-home-page.md](../hoot/chat-home-page.md),
  [chat.md](../apollo/chat.md), [problem-panel.md](../apollo/problem-panel.md),
  [report-panel.md](../apollo/report-panel.md).
- [kg-panel.md](../apollo/kg-panel.md) — the `InlineMath` alternative.
