"use client";

import MathMarkdown from "@/components/MathMarkdown";
import type {
  DoneResponse,
  Rubric,
  RubricAxis,
  TopicCredit,
  TranscriptTurn,
} from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  onNext: () => void;
  busy?: boolean;
}

const BAR_CELLS = 8;
const PASS_SCORE = 75;

// "_general" is the synthetic bucket (design spec §2) for misconceptions
// whose finding didn't localize to a reference topic node; it always
// renders last, labelled "Other issues" rather than its raw key.
const GENERAL_TOPIC_KEY = "_general";

const AXIS_LABELS: Record<keyof Omit<Rubric, "overall">, string> = {
  procedure: "Procedure",
  justification: "Justification",
  simplification: "Simplification",
};

const STATUS_GLYPH: Record<TopicCredit["status"], string> = {
  covered: "✓",
  partial: "◐",
  missing: "✗",
};

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

// dock_points is stored as a fraction of the 0.30 severity clamp (design
// spec §2); the report renders it as "points out of 100" the way the
// overall score is expressed, so round(dock_points * 100).
function dockToPoints(dockPoints: number): number {
  return Math.round(dockPoints * 100);
}

function TopicRow({ topic }: { topic: TopicCredit }) {
  const label =
    topic.canonical_key === GENERAL_TOPIC_KEY
      ? "Other issues"
      : (topic.display_name ?? topic.canonical_key);
  // Network data: guard the nested array so a mid-deploy payload without
  // `misconceptions` degrades to "no findings" instead of a crash.
  const misconceptions = topic.misconceptions ?? [];

  return (
    <div className="apollo-topic" data-status={topic.status}>
      <div className="apollo-topic__row">
        <span className="apollo-topic__glyph" aria-hidden>
          {STATUS_GLYPH[topic.status]}
        </span>
        <span className="apollo-topic__label">{label}</span>
        <span className="apollo-topic__credit">
          {Math.round(topic.credit * 100)}%
        </span>
      </div>

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
  );
}

function TopicList({ topics }: { topics: TopicCredit[] }) {
  // "_general" always renders last regardless of its position in the
  // served array (design spec §2).
  const ordered = [
    ...topics.filter((t) => t.canonical_key !== GENERAL_TOPIC_KEY),
    ...topics.filter((t) => t.canonical_key === GENERAL_TOPIC_KEY),
  ];
  return (
    <div className="apollo-rubric apollo-topics">
      {ordered.map((topic) => (
        <TopicRow key={topic.canonical_key} topic={topic} />
      ))}
    </div>
  );
}

function TranscriptSection({ transcript }: { transcript: TranscriptTurn[] }) {
  return (
    <details>
      <summary>Your conversation with Apollo</summary>
      <div className="apollo-transcript">
        {transcript.map((turn) => (
          <div
            key={turn.turn_index}
            className="apollo-transcript__turn"
            data-role={turn.role}
          >
            <span className="apollo-transcript__role">
              {turn.role === "student" ? "You" : "Apollo"}
            </span>
            <div className="prose md-body">
              <MathMarkdown>{turn.content}</MathMarkdown>
            </div>
          </div>
        ))}
      </div>
    </details>
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

  // Design spec §5: topics present (and non-empty) ⇒ checklist replaces
  // the three legacy axis rows; absent/empty ⇒ today's axis rendering
  // (flag off / old backend, backward compatible).
  const topics = report.topics;
  const hasTopics = Array.isArray(topics) && topics.length > 0;
  const transcript = report.transcript;
  const hasTranscript = Array.isArray(transcript) && transcript.length > 0;

  return (
    <section className="notice" data-tone={tone}>
      <div className="eyebrow">Teaching grade</div>
      <strong style={{ fontSize: "1.25rem" }}>
        {rubric.overall.letter} ({rubric.overall.score})
      </strong>

      {hasTopics ? (
        <TopicList topics={topics as TopicCredit[]} />
      ) : (
        <div className="apollo-rubric">
          <AxisRow label={AXIS_LABELS.procedure} axis={rubric.procedure} />
          <AxisRow label={AXIS_LABELS.justification} axis={rubric.justification} />
          <AxisRow label={AXIS_LABELS.simplification} axis={rubric.simplification} />
        </div>
      )}

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
        <div className="prose md-body" style={{ margin: "0.5rem 0 0" }}>
          <MathMarkdown>{diagnostic_narrative}</MathMarkdown>
        </div>
      </details>

      {hasTranscript && (
        <TranscriptSection transcript={transcript as TranscriptTurn[]} />
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
