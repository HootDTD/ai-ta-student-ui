"use client";

import { Fragment } from "react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import type { DoneResponse, Rubric, RubricAxis } from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  onNext: () => void;
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

export default function ApolloReportPanel({ report, onRetry, onEnd, onNext, busy }: Props) {
  const { rubric, diagnostic_narrative } = report;
  const tone = rubric.overall.score >= PASS_SCORE ? "success" : "danger";

  // Item #9: prefer the structured progress envelope; fall back to the
  // flat fields only when an older backend is mid-deploy.
  const progress = report.progress;
  const xpEarned = progress?.xp_earned ?? report.xp_earned;
  const levelUp = progress?.level_up ?? (report.level_up === true);
  const levelAfter = progress?.level_after ?? report.level_after;
  const titleAfter = progress?.title_after;
  const levelProgressPct = progress?.level_progress_pct;
  const xpToNext = progress?.xp_to_next_level;

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

      {typeof xpEarned === "number" && (
        <p className="apollo-xp-line">
          +{xpEarned} XP earned
          {typeof levelProgressPct === "number" && (
            <span className="apollo-xp-line__bar" aria-hidden>
              {" — "}
              {Math.round(levelProgressPct)}% through level{" "}
              {levelAfter ?? "?"}
              {typeof xpToNext === "number" && xpToNext > 0
                ? ` (${xpToNext} to next)`
                : xpToNext === null
                  ? " (max)"
                  : ""}
            </span>
          )}
        </p>
      )}

      {levelUp && typeof levelAfter === "number" && (
        <div className="apollo-level-up" role="status" aria-live="polite">
          <span className="apollo-level-up__confetti" aria-hidden>🎉</span>
          <span>
            Level up! You&apos;re now <strong>{titleAfter ?? `level ${levelAfter}`}</strong>.
          </span>
        </div>
      )}

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
          onClick={onNext}
          disabled={busy}
          type="button"
          className="ui-button ui-button--primary ui-button--small"
        >
          Next problem
        </button>
        <button
          onClick={onRetry}
          disabled={busy}
          type="button"
          className="ui-button ui-button--small"
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
