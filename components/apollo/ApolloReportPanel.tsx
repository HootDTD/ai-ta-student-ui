"use client";

import MathMarkdown from "@/components/MathMarkdown";
import { CitationChip } from "@/components/CitationChip";
import type { CitationMeta } from "@/components/CitationChip";
import type {
  DoneResponse,
  TopicCredit,
  TopicFeedbackItem,
  TopicReviewPointer,
} from "@/lib/apollo/api";
import { bandColorKey, bandLabel, resolveBand } from "@/lib/apollo/bands";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  onNext: () => void;
  busy?: boolean;
}

const STATUS_GLYPH: Record<TopicCredit["status"], string> = {
  covered: "✓",
  partial: "◐",
  missing: "✗",
  // P1.2b: never asked this attempt — an empty circle, not a cross. It is
  // excluded from the denominator, so it must not read as a failure.
  unprobed: "○",
};

// The word in the credit column, replacing the "72%" the column used to show
// (band-only ruling 2026-08-23: no numeric grade quantity on a student
// surface). It is not just cosmetic cover for the removed number — the glyph
// beside it is `aria-hidden`, so before this the percentage was the ONLY
// status signal a screen reader got from a summary row.
const STATUS_LABEL: Record<TopicCredit["status"], string> = {
  covered: "Covered",
  partial: "Partial",
  missing: "Missing",
  unprobed: "n/a",
};

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

// INTERACTION3 review pointers render as the same citation chips the Hoot
// answering engine uses ("[YOUNG ET AL. 2020, P. 3]"). Labels arrive
// marker-shaped with the page usually already inside, so only append the
// page when the label doesn't carry it. doc_id is deliberately unused here;
// it's kept on the type for a future deep-link, not rendered in v1.
function reviewChipMeta(r: TopicReviewPointer): CitationMeta {
  const bare = r.label.replace(/^\[/, "").replace(/\]$/, "");
  const label =
    typeof r.page === "number" && !bare.includes(`p. ${r.page}`)
      ? `[${bare}, p. ${r.page}]`
      : `[${bare}]`;
  return {
    label,
    doc_type: "Course material",
    file: bare,
    page: r.page,
    // Source-link keys: upload_id when the backend stored the source PDF,
    // doc_id as the chip's fallback; either makes the chip clickable.
    upload_id: r.upload_id ?? null,
    doc_id: r.doc_id,
  };
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
  const unprobed = topic.status === "unprobed";
  // Drives the bar's width only. The proportion is a qualitative reading of
  // the row; the number itself is never printed (see STATUS_LABEL).
  const percent = unprobed ? 0 : Math.round(topic.credit * 100);
  // Network data: guard the nested array so a mid-deploy payload without
  // `misconceptions` degrades to "no findings" instead of a crash.
  const misconceptions = topic.misconceptions ?? [];
  const note = feedbackItem?.note;
  const quote = resolveQuote(topic, feedbackItem, hasFeedback);
  // D2 / P2.3: the reference statement for a topic that missed full credit.
  const referenceText = topic.reference_text ?? null;
  const hasBody =
    Boolean(note) ||
    Boolean(quote) ||
    Boolean(referenceText) ||
    unprobed ||
    misconceptions.length > 0;

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
      <span className="apollo-topic__credit">
        {unprobed ? (
          <abbr title="Apollo never asked about this topic — it isn't counted in your grade.">
            {STATUS_LABEL.unprobed}
          </abbr>
        ) : (
          STATUS_LABEL[topic.status]
        )}
      </span>
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
    // Weak topics open pre-expanded: their note + Review pointers are the
    // actionable part of the grade, not something to hide behind a click.
    // `unprobed` rows are the exception — there can be several of them
    // (P1.2b probes only a subset per attempt) and their body is a single
    // "not counted" line, so auto-expanding them would bury the actionable
    // feedback under a wall of non-findings. The summary row already says it
    // with the ○ glyph and the "n/a" abbr tooltip.
    <details
      className="apollo-topic"
      data-status={topic.status}
      open={topic.status !== "covered" && !unprobed}
    >
      <summary className="apollo-topic__summary">{summary}</summary>

      <div className="apollo-topic__body">
        {unprobed && (
          <p className="apollo-topic__unprobed">
            Apollo never asked you about this one, so it isn&apos;t counted in
            your grade.
          </p>
        )}
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
        {referenceText && (
          // D2 (2026-08-07): the ONE sanctioned reveal — the reference
          // statement for a topic that missed credit, collapsed by default so
          // the student's own work stays the headline. Never the full worked
          // solution, and only after grading.
          <details className="apollo-topic__model">
            <summary className="apollo-topic__model-summary">
              What full credit looks like
            </summary>
            <div className="apollo-topic__model-body prose md-body">
              <MathMarkdown>{referenceText}</MathMarkdown>
            </div>
          </details>
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
                  // Was "−N pts", the dock rendered as points out of 100 — a
                  // numeric grade quantity, so it is gone (band-only ruling
                  // 2026-08-23). The qualitative half is what mattered anyway:
                  // this is the counterpart to the "corrected ✓" badge below,
                  // and `dock_points` still travels on the wire for logging.
                  <span className="apollo-topic__misconception-open">
                    not corrected
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

  // Study-prep spec §A.3 + the 2026-08-23 band-only ruling: the band IS the
  // grade a student sees — no letter, and no number beside it. `null` (neither
  // a band token nor a usable score) renders nothing; an empty header beats
  // leaking a letter. `rubric.overall.score` is still read here, but only to
  // derive that band on a payload that predates the `band` field.
  const band = resolveBand(rubric.overall);

  // The card's whole visual tone follows the band, so one band always looks
  // like itself. It used to flip success/danger at score ≥ 75 — mid-
  // Intermediate — which showed two Intermediate results as a pass and a fail.
  const colorKey = band ? bandColorKey(band) : null;

  // Non-empty `topics` ⇒ scorecard rendering; absent/empty ⇒ today's
  // band + narrative rendering (older backend, or a soft-failed topic
  // score on this attempt) — zero regression for that path.
  const topics = report.topics;
  const hasTopics = Array.isArray(topics) && topics.length > 0;
  const feedback = hasTopics ? report.feedback : undefined;

  // INTERACTION3 review pointers get their own card below Next step — they
  // are course-material reading directions, not part of the ✗/✓ scorecard.
  const reviewSections =
    hasTopics && feedback
      ? (topics as TopicCredit[])
          .map((topic) => {
            const item = feedback.topic_feedback.find(
              (f) => f.canonical_key === topic.canonical_key,
            );
            return {
              key: topic.canonical_key,
              label: topic.display_name ?? topic.canonical_key,
              review: item?.review ?? [],
            };
          })
          .filter((s) => s.review.length > 0)
      : [];

  return (
    <section className="apollo-scorecard" data-grade={colorKey ?? undefined}>
      <div className="eyebrow">Teaching grade</div>

      {/* The band alone. The overall credit bar that used to sit beside it was
          the score in another costume — its width and its `aria-valuenow` both
          published the number — so it is gone rather than de-labelled, and the
          band takes back the full headline size. */}
      {band && (
        <strong className="apollo-scorecard__band">{bandLabel(band)}</strong>
      )}

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
        <>
          <div className="notice apollo-scorecard__next-step" data-tone="success">
            <span className="eyebrow">Next step</span>
            <MathMarkdown>{feedback.next_step}</MathMarkdown>
          </div>
          {reviewSections.length > 0 && (
            <div className="notice apollo-scorecard__review">
              <span className="eyebrow">Review the course materials</span>
              {reviewSections.map((section) => (
                <div key={section.key} className="apollo-scorecard__review-line">
                  {reviewSections.length > 1 && (
                    <span className="apollo-scorecard__review-topic">
                      {section.label}
                    </span>
                  )}
                  {section.review.map((r, ri) => (
                    <CitationChip key={ri} meta={reviewChipMeta(r)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
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
