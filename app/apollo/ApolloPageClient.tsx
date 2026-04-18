"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  ApolloApiError,
  endSession,
  finishTeaching,
  getSessionState,
  retryProblem,
  type ApolloKG,
  type ApolloSessionState,
  type DoneResponse,
} from "@/lib/apollo/api";
import ApolloChat from "@/components/apollo/ApolloChat";
import ApolloErrorSurface from "@/components/apollo/ApolloErrorSurface";
import ApolloKGPanel from "@/components/apollo/ApolloKGPanel";
import ApolloProblemPanel from "@/components/apollo/ApolloProblemPanel";
import ApolloReportPanel from "@/components/apollo/ApolloReportPanel";

export default function ApolloPageClient() {
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("session"));

  const [state, setState] = useState<ApolloSessionState | null>(null);
  const [kg, setKg] = useState<ApolloKG | null>(null);
  const [report, setReport] = useState<DoneResponse | null>(null);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSessionState(sessionId)
      .then((s) => {
        setState(s);
        setKg(s.kg);
      })
      .catch((e) => setError(e as Error));
  }, [sessionId]);

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

  if (!sessionId) {
    return (
      <main className="apollo-page">
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
        <div className="apollo-page__main">
          <div className="card">
            <div className="eyebrow">Apollo</div>
            <span>Loading session…</span>
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "ended") {
    return (
      <main className="apollo-page">
        <div className="apollo-page__main">
          <div className="module">
            <div className="eyebrow">Apollo</div>
            <h1 className="section-title">Session ended</h1>
            <p className="lede">You&apos;ve ended this Apollo session.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="apollo-page">
      <div className="apollo-page__main">
        <div>
          <div className="eyebrow">Apollo</div>
          <h1 className="section-title">Teach Apollo</h1>
        </div>
        <ApolloProblemPanel problem={state.problem} />
        <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />
        {report ? (
          <ApolloReportPanel report={report} onRetry={handleRetry} onEnd={handleEnd} busy={busy} />
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
