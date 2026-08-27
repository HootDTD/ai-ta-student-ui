"use client";

// Standalone Apollo entry (2026-07-07 e2e baseline): concept → difficulty →
// problem picker. No Hoot transcript, no LLM inference — a deterministic
// browse over the course's teachable pool.

import { useCallback, useEffect, useState } from "react";
import {
  ApolloApiError,
  ApolloConceptSummary,
  ApolloDifficulty,
  ApolloProblemSummary,
  listConcepts,
  listProblems,
  startSession,
} from "@/lib/apollo/api";
import { bandColorKey, bandLabel, resolveBand } from "@/lib/apollo/bands";
import ApolloErrorSurface from "./ApolloErrorSurface";
import ApolloSidebar from "./ApolloSidebar";
import MathMarkdown from "@/components/MathMarkdown";
import OwlVideo from "@/components/OwlVideo";
import ApolloTopBar from "./ApolloTopBar";

const DIFFICULTIES: ApolloDifficulty[] = ["intro", "standard", "hard"];
const PREVIEW_CHARS = 180;

interface Props {
  classId: number;
  onStarted: (sessionId: number) => void;
}

export default function ApolloBrowse({ classId, onStarted }: Props) {
  const [concepts, setConcepts] = useState<ApolloConceptSummary[] | null>(null);
  const [conceptId, setConceptId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<ApolloDifficulty>("intro");
  const [problems, setProblems] = useState<ApolloProblemSummary[] | null>(null);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedProblemIds, setExpandedProblemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [openFeedbackIds, setOpenFeedbackIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    // No auto-select: the browse page opens on a centered prompt until the
    // student picks a concept from the sidebar.
    listConcepts(classId)
      .then((r) => setConcepts(r.concepts))
      .catch((e) => setError(e as Error));
  }, [classId]);

  useEffect(() => {
    if (conceptId === null) return;
    setProblems(null);
    setExpandedProblemIds(new Set());
    setOpenFeedbackIds(new Set());
    listProblems(classId, conceptId, difficulty)
      .then((r) => setProblems(r.problems))
      .catch((e) => setError(e as Error));
  }, [classId, conceptId, difficulty]);

  const toggleProblem = useCallback((problemId: string) => {
    setExpandedProblemIds((current) => {
      const next = new Set(current);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }
      return next;
    });
  }, []);

  const toggleFeedback = useCallback((problemId: string) => {
    setOpenFeedbackIds((current) => {
      const next = new Set(current);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }
      return next;
    });
  }, []);

  const start = useCallback(
    async (problemId?: string) => {
      if (conceptId === null) return;
      setBusy(true);
      setError(null);
      try {
        const res = await startSession(classId, conceptId, difficulty, problemId);
        onStarted(res.session_id);
      } catch (e) {
        setError(e as Error);
        setBusy(false);
      }
    },
    [classId, conceptId, difficulty, onStarted],
  );

  return (
    <div className="apollo-layout">
      <ApolloSidebar
        concepts={concepts ?? []}
        conceptId={conceptId}
        onSelect={setConceptId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="apollo-layout__main">
        <ApolloTopBar
          classId={classId}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <div className="apollo-shell">
          <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />

          {concepts === null && error === null && (
            <div className="apollo-browse__loading">Loading concepts…</div>
          )}

          {concepts !== null && concepts.length === 0 && (
            <div className="apollo-browse__empty">
              No teachable concepts in this course yet. Check back soon!
            </div>
          )}

          {concepts !== null && concepts.length > 0 && conceptId === null && (
            <div className="empty-greeting">
              <OwlVideo className="empty-greeting__owl" />
              <div className="empty-greeting__title">What are we teaching today?</div>
              <p className="empty-greeting__note">Pick a concept from the sidebar to get started.</p>
              <button
                type="button"
                className="ui-button ui-button--small apollo-browse__welcome-btn"
                onClick={() => setSidebarOpen(true)}
              >
                Browse concepts
              </button>
            </div>
          )}

          {conceptId !== null && (
            <section className="apollo-browse__problems">
              <div className="apollo-browse__difficulties" role="tablist">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={d === difficulty}
                    className={`apollo-browse__difficulty ${
                      d === difficulty ? "apollo-browse__difficulty--active" : ""
                    }`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </button>
                ))}
                <button
                  className="apollo-browse__surprise"
                  disabled={busy}
                  onClick={() => start()}
                >
                  Surprise me
                </button>
              </div>

              {problems === null && <div className="apollo-browse__loading">Loading problems…</div>}
              {problems !== null && problems.length === 0 && (
                <div className="apollo-browse__empty">
                  No {difficulty} problems for this concept yet — try another difficulty.
                </div>
              )}
              <ul className="apollo-browse__cards">
                {(problems ?? []).map((p) => {
                  const isLong = p.problem_text.length > PREVIEW_CHARS;
                  const isExpanded = expandedProblemIds.has(p.id);
                  const problemText =
                    isLong && !isExpanded
                      ? `${p.problem_text.slice(0, PREVIEW_CHARS)}…`
                      : p.problem_text;
                  // Best served result across this student's graded attempts.
                  // No band and no score ⇒ the card falls back to the neutral
                  // "Tried" state; the letter is never a fallback (spec §A.3).
                  const band = p.grade ? resolveBand(p.grade) : null;
                  // One token family per band, shared with the Done report's
                  // accent border — the map lives in `lib/apollo/bands.ts`.
                  const colorKey = band ? bandColorKey(band) : null;
                  const feedback = p.grade?.feedback?.trim() ? p.grade.feedback : null;
                  const feedbackOpen = openFeedbackIds.has(p.id);
                  const feedbackPanelId = `apollo-feedback-${p.id}`;

                  return (
                    <li
                      key={p.id}
                      className={`apollo-browse__card${
                        colorKey ? ` apollo-browse__card--grade-${colorKey}` : ""
                      }`}
                    >
                      {isLong ? (
                        <button
                          type="button"
                          className="apollo-browse__card-text apollo-browse__card-toggle"
                          aria-expanded={isExpanded}
                          onClick={() => toggleProblem(p.id)}
                        >
                          <span>{problemText}</span>
                          <span className="apollo-browse__card-toggle-label" aria-hidden="true">
                            {isExpanded ? "Show less" : "Show full problem"}
                            <span
                              className={`apollo-browse__card-chevron ${
                                isExpanded ? "apollo-browse__card-chevron--expanded" : ""
                              }`}
                            >
                              ⌄
                            </span>
                          </span>
                        </button>
                      ) : (
                        <p className="apollo-browse__card-text">{problemText}</p>
                      )}
                      {colorKey && feedback && feedbackOpen && (
                        <div
                          id={feedbackPanelId}
                          className={`apollo-browse__feedback apollo-browse__feedback--${colorKey}`}
                        >
                          <span className="eyebrow">Your feedback</span>
                          <MathMarkdown>{feedback}</MathMarkdown>
                        </div>
                      )}
                      <div className="apollo-browse__card-footer">
                        {band && colorKey ? (
                          feedback ? (
                            <button
                              type="button"
                              className={`apollo-browse__grade apollo-browse__grade--${colorKey} apollo-browse__grade--clickable`}
                              aria-expanded={feedbackOpen}
                              aria-controls={feedbackPanelId}
                              aria-label={`Your best result for this problem: ${bandLabel(
                                band,
                              )}. ${feedbackOpen ? "Hide" : "Show"} your feedback.`}
                              title={`Your best result: ${bandLabel(
                                band,
                              )} — click for feedback`}
                              onClick={() => toggleFeedback(p.id)}
                            >
                              {bandLabel(band)}
                            </button>
                          ) : (
                            <span
                              className={`apollo-browse__grade apollo-browse__grade--${colorKey}`}
                              aria-label={`Your best result for this problem: ${bandLabel(
                                band,
                              )}`}
                              title={`Your best result: ${bandLabel(band)}`}
                            >
                              {bandLabel(band)}
                            </span>
                          )
                        ) : (
                          p.attempted && (
                            <span className="apollo-browse__tried">Tried</span>
                          )
                        )}
                        <button
                          className="ui-button ui-button--primary ui-button--small"
                          disabled={busy}
                          onClick={() => start(p.id)}
                        >
                          Start teaching
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
