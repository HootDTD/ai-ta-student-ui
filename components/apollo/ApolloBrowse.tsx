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
  StudentProgressDetailed,
  getStudentProgressDetailed,
  listConcepts,
  listProblems,
  startSession,
} from "@/lib/apollo/api";
import ApolloErrorSurface from "./ApolloErrorSurface";
import ApolloSidebar from "./ApolloSidebar";
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
  const [progress, setProgress] = useState<StudentProgressDetailed | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Compact progress header (spec §UI) — non-blocking, browse renders without it.
    getStudentProgressDetailed(classId).then(setProgress).catch(() => {});
    // No auto-select: the browse page opens on a centered prompt until the
    // student picks a concept from the sidebar.
    listConcepts(classId)
      .then((r) => setConcepts(r.concepts))
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
          progress={progress}
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
                {(problems ?? []).map((p) => (
                  <li key={p.id} className="apollo-browse__card">
                    <p className="apollo-browse__card-text">
                      {p.problem_text.length > PREVIEW_CHARS
                        ? `${p.problem_text.slice(0, PREVIEW_CHARS)}…`
                        : p.problem_text}
                    </p>
                    <div className="apollo-browse__card-footer">
                      {p.attempted && <span className="apollo-browse__tried">Tried</span>}
                      <button
                        className="ui-button ui-button--primary ui-button--small"
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
          )}
        </div>
      </div>
    </div>
  );
}
