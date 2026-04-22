"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApolloApiError,
  endSession,
  finishTeaching,
  getSessionState,
  getStudentProgress,
  nextProblem,
  restartProblem,
  retryProblem,
  startSessionFromHoot,
  type ApolloKG,
  type ApolloSessionState,
  type Difficulty,
  type DoneResponse,
  type StudentProgress,
} from "@/lib/apollo/api";
import ApolloChat from "@/components/apollo/ApolloChat";
import ApolloErrorSurface from "@/components/apollo/ApolloErrorSurface";
import ApolloKGPanel from "@/components/apollo/ApolloKGPanel";
import ApolloProblemPanel from "@/components/apollo/ApolloProblemPanel";
import ApolloProgressCard from "@/components/apollo/ApolloProgressCard";
import ApolloReportPanel from "@/components/apollo/ApolloReportPanel";
import PreHandoffPicker from "@/components/apollo/PreHandoffPicker";
import SwitchProblemButton from "@/components/apollo/SwitchProblemButton";
import RestartProblemButton from "@/components/apollo/RestartProblemButton";

export default function ApolloPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("session"));
  const pending = searchParams.get("pending") === "1";

  const returnLink = (
    <button
      type="button"
      className="apollo-return-link"
      onClick={() => router.push("/")}
    >
      ← Return to Hoot
    </button>
  );

  const [state, setState] = useState<ApolloSessionState | null>(null);
  const [kg, setKg] = useState<ApolloKG | null>(null);
  const [report, setReport] = useState<DoneResponse | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  async function handlePreHandoffStart(difficulty: Difficulty) {
    setPendingError(null);
    const transcript = sessionStorage.getItem("apollo_pending_transcript") ?? "";
    const studentId = sessionStorage.getItem("apollo_pending_student_id") ?? "unknown";
    try {
      const res = await startSessionFromHoot(studentId, transcript, difficulty);
      sessionStorage.removeItem("apollo_pending_transcript");
      sessionStorage.removeItem("apollo_pending_student_id");
      router.replace(`/apollo?session=${res.session_id}`);
    } catch (err) {
      if (err instanceof ApolloApiError && err.errorCode === "no_matching_concept") {
        setPendingError("Apollo doesn't cover this topic yet.");
      } else {
        setPendingError((err as Error).message);
      }
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    getSessionState(sessionId)
      .then((s) => {
        setState(s);
        setKg(s.kg);
        // Fetch progress for the greeting + avatar level. Non-blocking;
        // errors fall back silently (greeting renders level 1 defaults).
        getStudentProgress(s.student_id)
          .then(setProgress)
          .catch(() => setProgress(null));
      })
      .catch((e) => setError(e as Error));
  }, [sessionId]);

  // After any Done event, refresh progress so the greeting/avatar update
  // on a level-up without requiring a page reload.
  useEffect(() => {
    if (!report || !state) return;
    getStudentProgress(state.student_id)
      .then(setProgress)
      .catch(() => {});
  }, [report, state]);

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

  async function handleNextProblem(difficulty: Difficulty) {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await nextProblem(sessionId, difficulty);
      // Reload session state to pick up the new problem + empty KG.
      const s = await getSessionState(res.session_id);
      setState(s);
      setKg(s.kg);
      setReport(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestartProblem() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await restartProblem(sessionId);
      const s = await getSessionState(sessionId);
      setState(s);
      setKg(s.kg);
      setReport(null);
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
      setReport(null);
      const fresh = await getSessionState(sessionId);
      setState(fresh);
      setKg(fresh.kg);
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
      setReport(null);
      const fresh = await getSessionState(sessionId);
      setState(fresh);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId && pending) {
    return (
      <main className="apollo-page">
        <nav className="apollo-page__nav">{returnLink}</nav>
        <div className="apollo-page__main">
          <PreHandoffPicker
            onStart={handlePreHandoffStart}
            errorMessage={pendingError}
          />
        </div>
      </main>
    );
  }

  if (!sessionId) {
    return (
      <main className="apollo-page">
        <nav className="apollo-page__nav">{returnLink}</nav>
        <div className="apollo-page__main">
          <div className="notice" data-tone="danger">
            Missing ?session=N query parameter.
          </div>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="apollo-page">
        <nav className="apollo-page__nav">{returnLink}</nav>
        <div className="apollo-page__main">
          <div className="card">
            <span>Loading session…</span>
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "ended") {
    return (
      <main className="apollo-page">
        <nav className="apollo-page__nav">{returnLink}</nav>
        <div className="apollo-page__main">
          <div className="module">
            <h1 className="section-title">Session ended</h1>
            <p className="lede">You&apos;ve ended this Apollo session.</p>
          </div>
        </div>
      </main>
    );
  }

  const levelForAvatar = progress?.level ?? 1;

  return (
    <main className="apollo-page" data-apollo-level={levelForAvatar}>
      <nav className="apollo-page__nav">{returnLink}</nav>
      <div className="apollo-page__main">
        <ApolloProgressCard progress={progress} />
        <ApolloProblemPanel problem={state.problem} />
        {state.phase !== "SOLVING" ? (
          <div className="apollo-session-controls flex gap-2">
            <SwitchProblemButton onSwitch={handleNextProblem} disabled={busy} />
            <RestartProblemButton onRestart={handleRestartProblem} disabled={busy} />
          </div>
        ) : null}
        <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />
        {report ? (
          <ApolloReportPanel
            report={report}
            onRetry={handleRetry}
            onEnd={handleEnd}
            onNextProblem={handleNextProblem}
            defaultDifficulty={(state.problem?.difficulty as Difficulty | undefined) ?? "intro"}
            busy={busy}
          />
        ) : (
          <ApolloChat
            sessionId={sessionId}
            initialMessages={state.messages.map((m) => ({ role: m.role, content: m.content }))}
            onKgUpdate={(newKg) => setKg(newKg)}
            onDoneClicked={handleDone}
            disabled={busy}
          />
        )}
      </div>
      <aside className="apollo-page__aside">{kg && <ApolloKGPanel kg={kg} />}</aside>
    </main>
  );
}
