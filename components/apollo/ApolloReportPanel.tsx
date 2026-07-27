"use client";

import MathMarkdown from "@/components/MathMarkdown";
import type { DoneResponse, TopicCredit, TopicFeedbackItem } from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  onNext: () => void;
  busy?: boolean;
}

const PASS_SCORE = 75;

const STATUS_GLYPH: Record<TopicCredit["status"], string> = {
  covered: "✓",
  partial: "◐",
  missing: "✗",
};

// dock_points is stored as a fraction of the 0.30 severity clamp (design
// spec §2); the report renders it as "points out of 100" the way the
// overall score is expressed, so round(dock_points * 100).
function dockToPoints(dockPoints: number): number {
  return Math.round(dockPoints * 100);
}

// Resolves the quote to show for one topic's expanded row. Structured
// feedback (when present) already gated its own quote against the topic's
// evidence span — use it verbatim, including its `null`. Only when there is
// no feedback block at all (soft-failed LLM call, or a pre-PR#200 backend)
// do we fall back to the topic's own `evidence_span` so the row still shows
// what the student said.
function resolveQuote(
  topic: TopicCredit,
  feedbackItem: TopicFeedbackItem | undefined,
  hasFeedback: boolean,
): string | null {
  if (hasFeedback) return feedbackItem?.quote ?? null;
  return topic.evidence_span ?? null;
}

function TopicRow({
  topic,
  feedbackItem,
  hasFeedback,
}: {
  topic: TopicCredit;
  feedbackItem: TopicFeedbackItem | undefined;
  hasFeedback: boolean;
}) {
  const label = topic.display_name ?? topic.canonical_key;
  const percent = Math.round(topic.credit * 100);
  // Network data: guard the nested array so a mid-deploy payload without
  // `misconceptions` degrades to "no findings" instead of a crash.
  const misconceptions = topic.misconceptions ?? [];
  const note = feedbackItem?.note;
  const quote = resolveQuote(topic, feedbackItem, hasFeedback);
  const hasBody = Boolean(note) || Boolean(quote) || misconceptions.length > 0;

  const summary = (
    <div className="apollo-topic__row">
      <span className="apollo-topic__glyph" aria-hidden>
        {STATUS_GLYPH[topic.status]}
      </span>
      <span className="apollo-topic__label">{label}</span>
      <div className="apollo-topic__bar-track" aria-hidden>
        <div
          className="apollo-topic__bar-fill"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <span className="apollo-topic__credit">{percent}%</span>
    </div>
  );

  if (!hasBody) {
    return (
      <div className="apollo-topic" data-status={topic.status}>
        {summary}
      </div>
    );
  }

  return (
    <details className="apollo-topic" data-status={topic.status}>
      <summary className="apollo-topic__summary">{summary}</summary>

      <div className="apollo-topic__body">
        {note && (
          <div className="apollo-topic__note prose md-body">
            <MathMarkdown>{note}</MathMarkdown>
          </div>
        )}
        {quote && (
          <p className="apollo-topic__quote">
            You said: &ldquo;<MathMarkdown>{quote}</MathMarkdown>&rdquo;
          </p>
        )}

        {misconceptions.length > 0 && (
          <div className="apollo-topic__misconceptions">
            {misconceptions.map((m, i) => (
              <div
                key={`${m.canonical_key}-${i}`}
                className="apollo-topic__misconception"
                data-resolved={m.resolved ? "true" : "false"}
              >
                <span className="apollo-topic__misconception-name">
                  {m.canonical_key}
                </span>
                {!m.resolved && (
                  <span className="apollo-topic__misconception-dock">
                    −{dockToPoints(m.dock_points)} pts
                  </span>
                )}
                {m.evidence_span && (
                  <span className="apollo-topic__misconception-evidence">
                    &ldquo;<MathMarkdown>{m.evidence_span}</MathMarkdown>&rdquo;
                  </span>
                )}
                {m.resolved && (
                  <span className="apollo-topic__misconception-badge">
                    corrected ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function TopicScorecard({
  topics,
  feedback,
}: {
  topics: TopicCredit[];
  feedback: DoneResponse["feedback"];
}) {
  const ordered = [...topics].sort((a, b) => b.weight - a.weight);
  const feedbackByKey = new Map(
    (feedback?.topic_feedback ?? []).map((item) => [item.canonical_key, item]),
  );

  return (
    <div className="apollo-rubric apollo-topics">
      {ordered.map((topic) => (
        <TopicRow
          key={topic.canonical_key}
          topic={topic}
          feedbackItem={feedbackByKey.get(topic.canonical_key)}
          hasFeedback={feedback != null}
        />
      ))}
    </div>
  );
}

export default function ApolloReportPanel({
  report,
  onRetry,
  onEnd,
  onNext,
  busy,
}: Props) {
  const { rubric, diagnostic_narrative } = report;
  const tone = rubric.overall.score >= PASS_SCORE ? "success" : "danger";

  // Non-empty `topics` ⇒ scorecard rendering; absent/empty ⇒ today's
  // letter + narrative rendering (older backend, or a soft-failed topic
  // score on this attempt) — zero regression for that path.
  const topics = report.topics;
  const hasTopics = Array.isArray(topics) && topics.length > 0;
  const feedback = hasTopics ? report.feedback : undefined;

  return (
    <section className="notice" data-tone={tone}>
      <div className="eyebrow">Teaching grade</div>

      <div className="apollo-scorecard__header">
        <strong style={{ fontSize: "1.25rem" }}>{rubric.overall.letter}</strong>
        {hasTopics && (
          <div
            className="apollo-scorecard__overall-bar-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(rubric.overall.score)}
            aria-label="Overall credit"
          >
            <div
              className="apollo-scorecard__overall-bar-fill"
              style={{
                width: `${Math.max(0, Math.min(100, rubric.overall.score))}%`,
              }}
            />
          </div>
        )}
      </div>

      {hasTopics && feedback && (
        <p className="apollo-scorecard__headline prose md-body">
          <MathMarkdown>{feedback.headline}</MathMarkdown>
        </p>
      )}

      {hasTopics && (
        <TopicScorecard topics={topics as TopicCredit[]} feedback={feedback} />
      )}

      {hasTopics && feedback && feedback.recap.length > 0 && (
        <ul className="apollo-scorecard__recap">
          {feedback.recap.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      {hasTopics && feedback ? (
        <div className="notice apollo-scorecard__next-step" data-tone="success">
          <span className="eyebrow">Next step</span>
          <MathMarkdown>{feedback.next_step}</MathMarkdown>
        </div>
      ) : (
        <details open>
          <summary>Diagnostic Narrative</summary>
          <div className="prose md-body" style={{ margin: "0.5rem 0 0" }}>
            <MathMarkdown>{diagnostic_narrative}</MathMarkdown>
          </div>
        </details>
      )}

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
