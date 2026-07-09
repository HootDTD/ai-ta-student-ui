"use client";

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
export default function MathMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {normalizeMath(children)}
    </ReactMarkdown>
  );
}
