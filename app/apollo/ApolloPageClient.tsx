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
    return <main style={{ padding: 24 }}>Missing ?session=N query parameter.</main>;
  }

  if (!state) {
    return <main style={{ padding: 24 }}>Loading session…</main>;
  }

  if (state.status === "ended") {
    return (
      <main style={{ padding: 24 }}>
        <h1>Session ended</h1>
        <p>You&apos;ve ended this Apollo session.</p>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: "1.3em", margin: 0 }}>Teach Apollo</h1>
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
      <aside>{kg && <ApolloKGPanel kg={kg} />}</aside>
    </main>
  );
}
