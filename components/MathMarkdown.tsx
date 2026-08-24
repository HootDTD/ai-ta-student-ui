"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Convert the LaTeX delimiters LLMs emit — `\(...\)`, `\[...\]`, plus a few
 * bare-bracket heuristics — into the `$...$` / `$$...$$` that `remark-math`
 * understands. `remark-math` only recognises dollar delimiters by default, so
 * without this step Apollo's `\(\sum...\)` renders as literal text.
 *
 * Extracted verbatim from `app/page.tsx` so every surface (main chat, Apollo
 * chat, problem card) normalises math identically.
 */
export function normalizeMath(text: string): string {
  let out = text;
  out = out.replace(/^\s*\\\[([\s\S]*?)\\\]\s*$/gm, (_m, inner) => `$$${inner.trim()}$$`);
  out = out.replace(/\\\((.+?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
  out = out.replace(/^\s*\[\s*([^\n\]]+?)\s*\]\s*$/gm, (m, inner) => {
    if (/\\[a-zA-Z]+|\^|_/.test(inner)) return `$$${inner}$$`;
    return m;
  });
  out = out.replace(/\[(\s*[^\]]*?)\]/g, (m, inner) => {
    if (/\\[a-zA-Z]+|\^|_/.test(inner) && !/\$\$?.*\$\$?/.test(inner)) {
      return `$${inner.trim()}$`;
    }
    return m;
  });
  return out;
}

/**
 * Markdown renderer with KaTeX math support. Pass the raw text as children;
 * the caller supplies its own container (typically a `.prose` wrapper).
 */
function MathMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {normalizeMath(children)}
    </ReactMarkdown>
  );
}

/**
 * Memoized on purpose (2026-08-23 latency work). `react-markdown` v10 calls
 * `createProcessor(options)` in its render body with no memoization, so every
 * render rebuilds the unified pipeline AND re-parses the whole document
 * through remark-math + rehype-katex. The heaviest consumer, `ApolloChat`,
 * re-renders on every keystroke (the composer draft is parent state), so a
 * long KaTeX-heavy scrollback was re-parsed per character typed.
 *
 * The props shape is a single `children: string`, so React's default shallow
 * comparison is exactly the right predicate — no custom `areEqual`. Every call
 * site passes one JSX expression child that evaluates to a string (audited
 * 2026-08-23: `app/page.tsx`, `ApolloChat`, `ApolloBrowse`,
 * `ApolloProblemPanel`, `ApolloReportPanel`); there is no inline
 * object/array/function prop anywhere that would defeat it. **Keep it that
 * way** — adding an object/callback prop, or splitting children across
 * multiple JSX children (which makes `children` a fresh array every render),
 * silently reverts this to the un-memoized cost.
 */
export default memo(MathMarkdown);
