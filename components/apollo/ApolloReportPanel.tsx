"use client";

import MathMarkdown from "@/components/MathMarkdown";
import type { DoneResponse } from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  onNext: () => void;
  busy?: boolean;
}

const PASS_SCORE = 75;

export default function ApolloReportPanel({
  report,
  onRetry,
  onEnd,
  onNext,
  busy,
}: Props) {
  const { rubric, diagnostic_narrative } = report;
  const tone = rubric.overall.score >= PASS_SCORE ? "success" : "danger";

  return (
    <section className="notice" data-tone={tone}>
      <div className="eyebrow">Teaching grade</div>
      <strong style={{ fontSize: "1.25rem" }}>{rubric.overall.letter}</strong>

      <details open>
        <summary>Diagnostic Narrative</summary>
        <div className="prose md-body" style={{ margin: "0.5rem 0 0" }}>
          <MathMarkdown>{diagnostic_narrative}</MathMarkdown>
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
          Try again from scratch
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
