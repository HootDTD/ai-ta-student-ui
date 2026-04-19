"use client";

import { Fragment } from "react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import type { DoneResponse } from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  busy?: boolean;
}

function renderWithMath(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      const tex = part.slice(1, -1);
      return <InlineMath key={i} math={tex} />;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function ApolloReportPanel({ report, onRetry, onEnd, busy }: Props) {
  const { result, value, missing_variables, narrated_trace, diagnostic_report } = report;
  const tone = result === "solved" ? "success" : "danger";
  return (
    <section className="notice" data-tone={tone}>
      <div className="eyebrow">Result</div>
      <strong>
        {result === "solved" ? `Apollo solved it — value = ${value}` : "Apollo got stuck"}
      </strong>
      {result === "stuck" && missing_variables.length > 0 && (
        <p className="note">
          <em>Missing: {missing_variables.join(", ")}</em>
        </p>
      )}
      <details open>
        <summary>Apollo&apos;s reasoning trace</summary>
        <div
          className="prose apollo-trace"
          style={{ whiteSpace: "pre-wrap", margin: "0.5rem 0 0" }}
        >
          {narrated_trace.split("\n").map((line, i) => (
            <div key={i}>{renderWithMath(line)}</div>
          ))}
        </div>
      </details>
      <details open>
        <summary>Diagnostic report</summary>
        <p className="prose" style={{ whiteSpace: "pre-wrap", margin: "0.5rem 0 0" }}>
          {diagnostic_report}
        </p>
      </details>
      <div className="composer-foot">
        <button
          onClick={onRetry}
          disabled={busy}
          type="button"
          className="ui-button ui-button--primary ui-button--small"
        >
          Teach more and retry
        </button>
        <button
          onClick={onEnd}
          disabled={busy}
          type="button"
          className="ui-button ui-button--small"
        >
          End session
        </button>
      </div>
    </section>
  );
}
