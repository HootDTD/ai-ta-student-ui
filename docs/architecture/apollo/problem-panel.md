---
doc: apollo/problem-panel
description: ApolloProblemPanel
owns:
  - components/apollo/ApolloProblemPanel.tsx
related: [shared-ui/math-markdown, apollo/api-client]
last_verified: 2026-07-25
stub: false
---

# ApolloProblemPanel

Current-problem card (~25 lines, tiny).

## Interface
default `ApolloProblemPanel({problem:ApolloProblem|null})`.

## Data flow
Shows `problem.problem_text` **only**, rendered via shared `MathMarkdown`
(LaTeX-delimited math typesets; plain ASCII passes through). Null ⇒ "No problem
loaded yet."

## Invariants & gotchas
- **HISTORY/INVARIANT (keep):** the former muted "Teach Apollo enough to solve for
  {target_unknown}" goal line was removed 2026-07-14 because it leaked the answer
  variable. `target_unknown` is still on the `ApolloProblem` type (backend
  contract) but is deliberately **not surfaced** here.

## Related
- [math-markdown.md](../shared-ui/math-markdown.md), [api-client.md](api-client.md).
