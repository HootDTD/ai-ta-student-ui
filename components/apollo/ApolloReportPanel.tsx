"use client";

import { Fragment } from "react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import type { DoneResponse, Rubric, RubricAxis } from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  busy?: boolean;
}

const BAR_CELLS = 8;
const PASS_SCORE = 75;

const AXIS_LABELS: Record<keyof Omit<Rubric, "overall">, string> = {
  procedure: "Procedure",
  justification: "Justification",
  simplification: "Simplification",
};

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

function AxisRow({ label, axis }: { label: string; axis: RubricAxis }) {
  const filled = Math.round((axis.score / 100) * BAR_CELLS);
  const bar = "█".repeat(filled) + "▒".repeat(BAR_CELLS - filled);
  return (
    <div
      className="apollo-rubric__row"
      data-present={axis.present === false ? "false" : "true"}
    >
      <span>{label}</span>
      <span>{axis.letter}</span>
      <span>({axis.score})</span>
      <span aria-hidden>{bar}</span>
    </div>
  );
}

function solverOutcomeText(
  si: DoneResponse["solver_indicator"],
): string {
  if (si.reached) {
    return si.value
      ? `Apollo reached the answer: ${si.value} ✓`
      : "Apollo reached the answer ✓";
  }
  const missing = si.missing && si.missing.length > 0
    ? ` — missing: ${si.missing.join(", ")}`
    : "";
  return `Apollo got stuck${missing}`;
}

export default function ApolloReportPanel({ report, onRetry, onEnd, busy }: Props) {
  const { rubric, solver_indicator, diagnostic_narrative } = report;
  const tone = rubric.overall.score >= PASS_SCORE ? "success" : "danger";

  return (
    <section className="notice" data-tone={tone}>
      <div className="eyebrow">Teaching grade</div>
      <strong style={{ fontSize: "1.25rem" }}>
        {rubric.overall.letter} ({rubric.overall.score})
      </strong>

      <div className="apollo-rubric">
        <AxisRow label={AXIS_LABELS.procedure} axis={rubric.procedure} />
        <AxisRow label={AXIS_LABELS.justification} axis={rubric.justification} />
        <AxisRow label={AXIS_LABELS.simplification} axis={rubric.simplification} />
      </div>

      <p className="note" style={{ margin: "0.5rem 0" }}>
        {solverOutcomeText(solver_indicator)}
      </p>

      <details open>
        <summary>Diagnostic narrative</summary>
        <div
          className="prose"
          style={{ whiteSpace: "pre-wrap", margin: "0.5rem 0 0" }}
        >
          {diagnostic_narrative.split("\n").map((line, i) => (
            <div key={i}>{renderWithMath(line)}</div>
          ))}
        </div>
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
