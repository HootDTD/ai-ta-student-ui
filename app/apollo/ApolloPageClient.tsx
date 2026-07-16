"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApolloApiError,
  endSession,
  finishTeaching,
  getSessionState,
  getStudentProgressDetailed,
  nextProblem,
  restartProblem,
  retryProblem,
  type ApolloDifficulty,
  type ApolloKG,
  type ApolloSessionState,
  type CoveredTopic,
  type DoneResponse,
  type StudentProgress,
} from "@/lib/apollo/api";
import ApolloBrowse from "@/components/apollo/ApolloBrowse";
import ApolloChat from "@/components/apollo/ApolloChat";
import ApolloCoverageCelebrations, {
  type CoverageCelebration,
} from "@/components/apollo/ApolloCoverageCelebrations";
import ApolloErrorSurface from "@/components/apollo/ApolloErrorSurface";
import ApolloKGPanel from "@/components/apollo/ApolloKGPanel";
import ApolloProblemPanel from "@/components/apollo/ApolloProblemPanel";
import ApolloReportPanel from "@/components/apollo/ApolloReportPanel";
import ApolloTopBar from "@/components/apollo/ApolloTopBar";
import { APOLLO_ONLY } from "@/lib/flags";

export default function ApolloPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("session"));
  const classId = Number(searchParams.get("class"));

  const [state, setState] = useState<ApolloSessionState | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<number | null>(null);
  const [kg, setKg] = useState<ApolloKG | null>(null);
  const [report, setReport] = useState<DoneResponse | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrations, setCelebrations] = useState<CoverageCelebration[]>([]);
  // The lasting checklist: every covered topic stays here for the whole
  // attempt, one row per concept. `celebrations` is only the transient pop.
  const [coveredTopics, setCoveredTopics] = useState<CoverageCelebration[]>([]);
  const seenCoveredRef = useRef(new Set<string>());
  const seenCoveredNamesRef = useRef(new Set<string>());
  const celebrationIdRef = useRef(0);
  const celebrationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // "Apollo's understanding" is a toggle drawer, not a stretched side column,
  // so the teaching chat gets a single centered column like Hoot's chat.
  const [kgOpen, setKgOpen] = useState(false);

  useEffect(() => {
    return () => celebrationTimersRef.current.forEach(clearTimeout);
  }, []);

  function handleCoverageSnapshot(topics: CoveredTopic[]) {
    const next: CoverageCelebration[] = [];
    for (const topic of topics) {
      if (seenCoveredRef.current.has(topic.node_id)) continue;
      seenCoveredRef.current.add(topic.node_id);
      // Belt-and-suspenders dedup: never show two rows with the same label,
      // even if the tally reports two distinct nodes under one display name.
      const nameKey = topic.display_name.trim().toLowerCase();
      if (!nameKey || seenCoveredNamesRef.current.has(nameKey)) continue;
      seenCoveredNamesRef.current.add(nameKey);
      next.push({ eventId: ++celebrationIdRef.current, displayName: topic.display_name });
    }
    if (!next.length) return;

    // Persist each new topic in the lasting checklist AND fire its transient
    // pop. The pop clears after 3.6s; the checklist row stays for the attempt.
    setCoveredTopics((current) => [...current, ...next]);
    setCelebrations((current) => [...current, ...next]);
    const eventIds = new Set(next.map((item) => item.eventId));
    const timer = setTimeout(() => {
      setCelebrations((current) => current.filter((item) => !eventIds.has(item.eventId)));
      celebrationTimersRef.current = celebrationTimersRef.current.filter((item) => item !== timer);
    }, 3600);
    celebrationTimersRef.current.push(timer);
  }

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setState(null);
    setLoadedSessionId(null);
    setKg(null);
    setReport(null);
    setProgress(null);
    setError(null);
    setBusy(false);
    setKgOpen(false);
    setCelebrations([]);
    setCoveredTopics([]);
    seenCoveredRef.current.clear();
    seenCoveredNamesRef.current.clear();
    celebrationTimersRef.current.forEach(clearTimeout);
    celebrationTimersRef.current = [];

    getSessionState(sessionId)
      .then((s) => {
        if (cancelled) return;
        setState(s);
        setLoadedSessionId(sessionId);
        setKg(s.kg);
        // Fetch progress for the greeting + avatar level. Non-blocking;
        // errors fall back silently (greeting renders level 1 defaults).
        // Course-scoped endpoint — skip entirely without a class id.
        if (!classId) return;
        getStudentProgressDetailed(classId)
          .then((nextProgress) => {
            if (!cancelled) setProgress(nextProgress);
          })
          .catch(() => {
            if (!cancelled) setProgress(null);
          });
      })
      .catch((e) => {
        if (!cancelled) setError(e as Error);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, classId]);

  // After any Done event, refresh progress so the greeting/avatar update
  // on a level-up without requiring a page reload.
  useEffect(() => {
    if (!report || !classId) return;
    getStudentProgressDetailed(classId)
      .then(setProgress)
      .catch(() => {});
  }, [report, classId]);

  // Close the understanding drawer on Escape.
  useEffect(() => {
    if (!kgOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKgOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [kgOpen]);

  async function handleDone() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await finishTeaching(sessionId);
      setReport(r);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await retryProblem(sessionId);
      const fresh = await getSessionState(sessionId);
      setState(fresh);
      setKg(fresh.kg);
      // Retry starts a fresh attempt server-side. Close any drawer that was
      // showing the previous attempt before rendering the blank state.
      setReport(null);
      setKgOpen(false);
      setCelebrations([]);
      seenCoveredRef.current.clear();
      celebrationTimersRef.current.forEach(clearTimeout);
      celebrationTimersRef.current = [];
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const difficulty = (state?.problem?.difficulty ?? "intro") as ApolloDifficulty;
      await nextProblem(sessionId, difficulty);
      const fresh = await getSessionState(sessionId);
      setState(fresh);
      setKg(fresh.kg);
      // Retry is a new attempt with no prior-attempt UI state.
      setReport(null);
      setKgOpen(false);
      setCelebrations([]);
      seenCoveredRef.current.clear();
      celebrationTimersRef.current.forEach(clearTimeout);
      celebrationTimersRef.current = [];
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestart() {
    if (!sessionId) return;
    if (
      !window.confirm(
        "Start this problem over? Apollo forgets everything you taught it for this attempt.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await restartProblem(sessionId);
      const fresh = await getSessionState(sessionId);
      setState(fresh);
      setKg(fresh.kg);
      setReport(null);
      setKgOpen(false);
      setCelebrations([]);
      seenCoveredRef.current.clear();
      celebrationTimersRef.current.forEach(clearTimeout);
      celebrationTimersRef.current = [];
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await endSession(sessionId);
      // Close the loop: land back on the course's problem browse. Without
      // a class id (old deep link) fall back to the ended-session view.
      if (classId) {
        router.push(`/apollo?class=${classId}`);
        return;
      }
      setReport(null);
      const fresh = await getSessionState(sessionId);
      setState(fresh);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId) {
    if (classId) {
      return (
        <ApolloBrowse
          classId={classId}
          onStarted={(sid) => router.replace(`/apollo?session=${sid}&class=${classId}`)}
        />
      );
    }
    return (
      <>
        <ApolloTopBar maxWidthClassName="max-w-4xl" />
        <main className="apollo-page">
          <div className="apollo-page__main">
            <div className="module">
              <p className="lede">
                Open Apollo from your class page so we know which course you&apos;re in.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!state || loadedSessionId !== sessionId) {
    return (
      <>
        <ApolloTopBar
          classId={classId}
          onBack={() => router.push(`/apollo?class=${classId}`)}
          backLabel="Back to problems"
          maxWidthClassName="max-w-4xl"
        />
        <main className="apollo-page">
          <div className="apollo-page__main">
            {error ? (
              <>
                <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />
                {classId ? (
                  <div>
                    <button
                      type="button"
                      className="ui-button ui-button--primary ui-button--small"
                      onClick={() => router.push(`/apollo?class=${classId}`)}
                    >
                      Back to problems
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="card">
                <span>Loading session…</span>
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  if (state.status === "ended") {
    return (
      <>
        <ApolloTopBar
          classId={classId}
          onBack={() => router.push(`/apollo?class=${classId}`)}
          backLabel="Back to problems"
          maxWidthClassName="max-w-4xl"
        />
        <main className="apollo-page">
          <div className="apollo-page__main">
            <div className="module">
              <h1 className="section-title">Session ended</h1>
              <p className="lede">You&apos;ve ended this Apollo session.</p>
              <div className="apollo-page__exit-actions">
                {classId ? (
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--small"
                    onClick={() => router.push(`/apollo?class=${classId}`)}
                  >
                    Browse more problems
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--small"
                    onClick={() => router.push(APOLLO_ONLY ? "/apollo" : "/")}
                  >
                    {APOLLO_ONLY ? "Browse problems" : "Return to Hoot"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const levelForAvatar = progress?.level ?? 1;

  return (
    <div className="apollo-session-shell">
      <ApolloTopBar
        classId={classId}
        onBack={() => router.push(`/apollo?class=${classId}`)}
        backLabel="Back to problems"
        maxWidthClassName="max-w-3xl"
        actions={
          <>
            {kg && (
              <button
                type="button"
                className="apollo-topbar__action"
                onClick={() => setKgOpen((v) => !v)}
                aria-expanded={kgOpen}
              >
                Understanding
              </button>
            )}
            {!report && (
              <button
                type="button"
                className="apollo-topbar__action"
                disabled={busy}
                onClick={() => void handleRestart()}
              >
                Start over
              </button>
            )}
          </>
        }
      />
      <main className="apollo-page" data-apollo-level={levelForAvatar}>
        <ApolloProblemPanel problem={state.problem} />
        <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />
        {report ? (
          <ApolloReportPanel
            report={report}
            onRetry={handleRetry}
            onEnd={handleEnd}
            onNext={handleNext}
            busy={busy}
          />
        ) : (
          <ApolloChat
            sessionId={sessionId}
            initialMessages={state.messages.map((m) => ({ role: m.role, content: m.content }))}
            onKgUpdate={(newKg) => setKg(newKg)}
            onCoverageSnapshot={handleCoverageSnapshot}
            onDoneClicked={handleDone}
            onDoneFromChat={(result) => setReport(result)}
            disabled={busy}
            busy={busy}
          />
        )}
      </main>
      <ApolloCoverageCelebrations celebrating={celebrations} covered={coveredTopics} />
      {kg && (
        <>
          {kgOpen && (
            <div
              className="apollo-kg-drawer-overlay"
              onClick={() => setKgOpen(false)}
              aria-hidden
            />
          )}
          <aside
            className={`apollo-kg-drawer ${kgOpen ? "apollo-kg-drawer--open" : ""}`}
            aria-hidden={!kgOpen}
          >
            <ApolloKGPanel
              kg={kg}
              sessionId={sessionId}
              onKgUpdated={(newKg) => setKg(newKg)}
            />
          </aside>
        </>
      )}
    </div>
  );
}
