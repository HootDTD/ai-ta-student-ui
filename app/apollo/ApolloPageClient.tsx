"use client";

import { useEffect, useState } from "react";
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
  type DoneResponse,
  type ReviewRequiredEntry,
  type StudentProgress,
} from "@/lib/apollo/api";
import DoneGateModal from "@/components/apollo/DoneGateModal";
import ApolloBrowse from "@/components/apollo/ApolloBrowse";
import ApolloChat from "@/components/apollo/ApolloChat";
import ApolloErrorSurface from "@/components/apollo/ApolloErrorSurface";
import ApolloKGPanel from "@/components/apollo/ApolloKGPanel";
import ApolloProblemPanel from "@/components/apollo/ApolloProblemPanel";
import ApolloReportPanel from "@/components/apollo/ApolloReportPanel";
import ApolloTopBar from "@/components/apollo/ApolloTopBar";

export default function ApolloPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = Number(searchParams.get("session"));
  const classId = Number(searchParams.get("class"));

  const [state, setState] = useState<ApolloSessionState | null>(null);
  const [kg, setKg] = useState<ApolloKG | null>(null);
  const [pulseEntryId, setPulseEntryId] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [gateEntries, setGateEntries] = useState<ReviewRequiredEntry[] | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [report, setReport] = useState<DoneResponse | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSessionState(sessionId)
      .then((s) => {
        setState(s);
        setKg(s.kg);
        // Fetch progress for the greeting + avatar level. Non-blocking;
        // errors fall back silently (greeting renders level 1 defaults).
        // Course-scoped endpoint — skip entirely without a class id.
        if (!classId) return;
        getStudentProgressDetailed(classId)
          .then(setProgress)
          .catch(() => setProgress(null));
      })
      .catch((e) => setError(e as Error));
  }, [sessionId, classId]);

  // After any Done event, refresh progress so the greeting/avatar update
  // on a level-up without requiring a page reload.
  useEffect(() => {
    if (!report || !classId) return;
    getStudentProgressDetailed(classId)
      .then(setProgress)
      .catch(() => {});
  }, [report, classId]);

  async function handleDone() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await finishTeaching(sessionId);
      setReport(r);
      setGateEntries(null);
      setGateOpen(false);
    } catch (e) {
      if (e instanceof ApolloApiError && e.errorCode === "review_required") {
        const entries = (e.extra["review_required"] as ReviewRequiredEntry[]) ?? [];
        setGateEntries(entries);
        setTouched(new Set());
        setGateOpen(true);
      } else {
        setError(e as Error);
      }
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
      setReport(null);
      setGateEntries(null);
      setTouched(new Set());
      setPulseEntryId(null);
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
      setGateEntries(null);
      setTouched(new Set());
      setPulseEntryId(null);
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

  if (!state) {
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
                    onClick={() => router.push("/")}
                  >
                    Return to Hoot
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
    <>
      <ApolloTopBar
        classId={classId}
        progress={progress}
        onBack={() => router.push(`/apollo?class=${classId}`)}
        backLabel="Back to problems"
        maxWidthClassName="max-w-4xl"
        menuExtra={(close) =>
          !report ? (
            <button
              type="button"
              className="dropdown-item text-sm"
              disabled={busy}
              onClick={() => {
                close();
                void handleRestart();
              }}
            >
              Start over
            </button>
          ) : null
        }
      />
      <main className="apollo-page" data-apollo-level={levelForAvatar}>
      <div className="apollo-page__main">
        <ApolloProblemPanel problem={state.problem} />
        <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />
        {gateEntries && gateOpen && (
          <DoneGateModal
            entries={gateEntries}
            touched={touched}
            onJumpTo={(entryId) => {
              setGateOpen(false);
              setPulseEntryId(entryId);
            }}
            onClose={() => setGateOpen(false)}
            onRetry={() => {
              setGateOpen(false);
              void handleDone();
            }}
          />
        )}
        {gateEntries && !gateOpen && !report && (
          <button
            type="button"
            className="apollo-gate-resume"
            onClick={() => setGateOpen(true)}
          >
            Resume review ({gateEntries.filter((e) => !touched.has(e.entry_id)).length} left)
          </button>
        )}
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
            onDoneClicked={handleDone}
            onDoneFromChat={(result) => setReport(result)}
            disabled={busy}
          />
        )}
      </div>
      <aside className="apollo-page__aside">
        {kg && (
          <ApolloKGPanel
            kg={kg}
            sessionId={sessionId}
            pulseEntryId={pulseEntryId}
            onKgUpdated={(newKg) => setKg(newKg)}
            onEntryTouched={(id) =>
              setTouched((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
              })
            }
          />
        )}
      </aside>
      </main>
    </>
  );
}
