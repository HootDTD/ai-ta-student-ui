"use client";

import { Fragment, useState } from "react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import DifficultyPicker from "./DifficultyPicker";
import type { Difficulty, DoneResponse, Rubric, RubricAxis } from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  onNextProblem: (difficulty: Difficulty) => Promise<void>;
  defaultDifficulty: Difficulty;
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

export default function ApolloReportPanel({
  report,
  onRetry,
  onEnd,
  onNextProblem,
  defaultDifficulty,
  busy,
}: Props) {
  const { rubric, solver_indicator, diagnostic_narrative } = report;
  const [nextChoice, setNextChoice] = useState<Difficulty>(defaultDifficulty);
  const [nextBusy, setNextBusy] = useState(false);
  const [nextError, setNextError] = useState<string | null>(null);
  const tone = rubric.overall.score >= PASS_SCORE ? "success" : "danger";

  // Gamification fields are optional so older backend deploys still render.
  const xpEarned = report.xp_earned;
  const levelUp = report.level_up === true;
  const levelAfter = report.level_after;

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

      {typeof xpEarned === "number" && (
        <p className="apollo-xp-line">+{xpEarned} XP earned</p>
      )}

      {levelUp && typeof levelAfter === "number" && (
        <div className="apollo-level-up" role="status" aria-live="polite">
          <span className="apollo-level-up__confetti" aria-hidden>🎉</span>
          <span>
            Level up! You&apos;re now <strong>level {levelAfter}</strong>.
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

      <section className="apollo-next-problem mt-6">
        <h3 className="text-base font-semibold text-slate-900">Move on to a new problem</h3>
        <p className="mt-1 text-sm text-slate-600">
          Pick the difficulty of your next problem — you can always switch later.
        </p>
        <div className="mt-3">
          <DifficultyPicker
            value={nextChoice}
            onChange={setNextChoice}
            disabled={nextBusy}
          />
        </div>
        {nextError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">{nextError}</p>
        ) : null}
        <button
          type="button"
          onClick={async () => {
            setNextBusy(true);
            setNextError(null);
            try {
              await onNextProblem(nextChoice);
            } catch (e) {
              setNextError((e as Error).message);
            } finally {
              setNextBusy(false);
            }
          }}
          disabled={nextBusy}
          className="mt-4 ui-button ui-button--primary ui-button--small"
        >
          {nextBusy ? "Loading…" : "Next problem"}
        </button>
      </section>
    </section>
  );
}
