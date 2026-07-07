"use client";

// Standalone Apollo entry (2026-07-07 e2e baseline): concept → difficulty →
// problem picker. No Hoot transcript, no LLM inference — a deterministic
// browse over the course's teachable pool.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ApolloApiError,
  ApolloConceptSummary,
  ApolloDifficulty,
  ApolloProblemSummary,
  StudentProgressDetailed,
  getStudentProgressDetailed,
  listConcepts,
  listProblems,
  startSession,
} from "@/lib/apollo/api";
import ApolloErrorSurface from "./ApolloErrorSurface";
import ApolloProgressCard from "./ApolloProgressCard";

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
  const [progress, setProgress] = useState<StudentProgressDetailed | null>(null);

  useEffect(() => {
    // Compact progress header (spec §UI) — non-blocking, browse renders without it.
    getStudentProgressDetailed(classId).then(setProgress).catch(() => {});
    listConcepts(classId)
      .then((r) => {
        setConcepts(r.concepts);
        if (r.concepts.length > 0) setConceptId(r.concepts[0].concept_id);
      })
      .catch((e) => setError(e as Error));
  }, [classId]);

  useEffect(() => {
    if (conceptId === null) return;
    setProblems(null);
    listProblems(classId, conceptId, difficulty)
      .then((r) => setProblems(r.problems))
      .catch((e) => setError(e as Error));
  }, [classId, conceptId, difficulty]);

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

  if (concepts === null && error === null) {
    return <div className="apollo-browse__loading">Loading concepts…</div>;
  }

  return (
    <div className="apollo-browse">
      <header className="apollo-browse__header">
        <h1 className="apollo-browse__title">Teach Apollo</h1>
        <p className="apollo-browse__subtitle">
          Pick a concept and a problem, then teach Apollo how to solve it.
        </p>
        <ApolloProgressCard progress={progress} />
        <Link className="apollo-browse__progress-link" href={`/apollo/progress?class=${classId}`}>
          View my progress →
        </Link>
      </header>

      <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />

      {concepts !== null && concepts.length === 0 && (
        <div className="apollo-browse__empty">
          No teachable concepts in this course yet. Check back soon!
        </div>
      )}

      {concepts !== null && concepts.length > 0 && (
        <div className="apollo-browse__columns">
          <nav className="apollo-browse__concepts" aria-label="Concepts">
            {concepts.map((c) => (
              <button
                key={c.concept_id}
                className={`apollo-browse__concept ${
                  c.concept_id === conceptId ? "apollo-browse__concept--active" : ""
                }`}
                onClick={() => setConceptId(c.concept_id)}
              >
                {c.display_name}
              </button>
            ))}
          </nav>

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
                className="apollo-browse__surprise kg-pill__btn-secondary"
                disabled={busy || conceptId === null}
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
              {(problems ?? []).map((p) => (
                <li key={p.id} className="apollo-browse__card">
                  <p className="apollo-browse__card-text">
                    {p.problem_text.length > PREVIEW_CHARS
                      ? `${p.problem_text.slice(0, PREVIEW_CHARS)}…`
                      : p.problem_text}
                  </p>
                  <div className="apollo-browse__card-footer">
                    {p.attempted && <span className="apollo-browse__tried">tried</span>}
                    <button
                      className="kg-pill__btn-primary"
                      disabled={busy}
                      onClick={() => start(p.id)}
                    >
                      Start teaching
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
