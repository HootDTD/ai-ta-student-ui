"use client";

import { useEffect, useRef, useState } from "react";

import { ApolloApiError, sendChat } from "@/lib/apollo/api";
import type { ApolloKG, ChatAside, ChatResponse, CoveredTopic, DoneResponse } from "@/lib/apollo/api";
import { GRADING_STAGE, sendChatStreamed } from "@/lib/apollo/chatStream";
import { apolloTurnStreamingEnabled } from "@/lib/flags";
import SpecialCharsPalette from "@/components/SpecialCharsPalette";
import OwlVideo from "@/components/OwlVideo";
import MathMarkdown from "@/components/MathMarkdown";
import { CitationChip } from "@/components/CitationChip";
import ApolloErrorSurface from "./ApolloErrorSurface";
import ApolloGradingProgress from "./ApolloGradingProgress";
import { isEchoOfApolloTurn } from "./echoGuard";

// A chat turn. `intent`/`aside` are only ever set on apollo-role turns:
// `intent === "reference_aside"` (from a live reply or transcript reload)
// renders the distinct Hoot "From the course materials" card instead of a
// normal persona bubble. `aside` (citations included) comes from a live
// `sendChat` response or from the session snapshot's replay of stored aside
// metadata; asides persisted before the backend stored that metadata reload
// with the `intent` tag but no citations.
export interface ChatMessage {
  role: string;
  content: string;
  intent?: string;
  aside?: ChatAside;
}

// Live progress for a STREAMED turn; null on the blocking path and between
// turns. `note` is the backend's own phase copy for the in-flight placeholder
// (cleared when the reply lands, re-set by any later phase); `replied` flips
// once Apollo's text is in the transcript; `grading` latches when the turn
// turns out to be an auto-done and grading is running behind the reply.
interface TurnProgress {
  note: string | null;
  replied: boolean;
  grading: boolean;
}

// The apollo-role turns a settled response becomes. Shared by both transports
// so the reference-aside shape can never diverge between them: an aside turn
// is TWO bubbles (the Hoot card, then the persona's resume line), everything
// else is one. `wasAskMode` only tags the live-only "hoot_answer" attribution.
export function apolloTurnMessages(resp: ChatResponse, wasAskMode: boolean): ChatMessage[] {
  if (resp.message_kind === "reference_aside" && resp.aside) {
    return [
      {
        role: "apollo",
        content: resp.aside.text,
        intent: "reference_aside",
        aside: resp.aside,
      },
      { role: "apollo", content: resp.apollo_reply },
    ];
  }
  return [
    {
      role: "apollo",
      content: resp.apollo_reply,
      intent: wasAskMode ? "hoot_answer" : undefined,
    },
  ];
}

interface Props {
  sessionId: number;
  initialMessages: ChatMessage[];
  // Server-authoritative Ask Hoot visibility: mirrors the backend aside gate
  // (INTERACTION4 + concept allowlist). Off-allowlist concepts must not show
  // the button — the backend would silently treat ask_hoot as a normal
  // teaching turn. Missing field (older backend) reads as hidden.
  askHootAvailable?: boolean;
  onKgUpdate: (kg: ApolloKG) => void;
  onCoverageSnapshot: (topics: CoveredTopic[]) => void;
  onDoneClicked: () => void;
  // Item #5: when chat detects a "done" intent and the student affirms,
  // the backend executes handle_done inline and embeds the result in
  // the chat response. We forward that pre-fetched result to the parent
  // so it can render the report without a redundant API call.
  onDoneFromChat?: (result: DoneResponse) => void;
  // P2.2 rehydration: the graded-topic snapshot carried by the session
  // state, so a reload / resume mid-attempt keeps the meter and the Done
  // guard instead of silently dropping both until the next turn. Null (or a
  // backend that doesn't serve the counts on the snapshot) ⇒ pre-P2.2
  // behavior — no meter, unguarded Done — until a chat response reports them.
  initialCoverage?: GradedCoverage | null;
  // Raised by the parent for ANY in-flight session action — a Done grade or a
  // "Start over" — and used only to gate input.
  disabled?: boolean;
  // True ONLY while a CLICKED Done grade is in flight; never raised for
  // "Start over". Together with the stream's own auto-done signal it drives
  // both the staged-progress panel and the Done button's loading state, so the
  // two can never disagree about whether a grade is running.
  grading?: boolean;
}

// P2.2 pre-Done coverage. Both counts come from the chat response; the meter
// stays hidden until a turn has reported them (older backend ⇒ no meter, no
// Done guard — the pre-P2.2 behavior exactly).
export interface GradedCoverage {
  total: number;
  open: number;
}

// A response only updates the meter when BOTH counts came back as finite
// numbers and the totals are self-consistent; anything else keeps the last
// known snapshot rather than flashing a wrong count at the student.
export function readGradedCoverage(resp: {
  graded_topic_total?: number;
  open_graded_topics?: number;
}): GradedCoverage | null {
  const { graded_topic_total: total, open_graded_topics: open } = resp;
  if (typeof total !== "number" || typeof open !== "number") return null;
  if (!Number.isFinite(total) || !Number.isFinite(open)) return null;
  if (total <= 0 || open < 0 || open > total) return null;
  return { total, open };
}

// "3 of 5 topics addressed — 2 still open" / "All 5 topics addressed".
export function coverageMeterLabel(coverage: GradedCoverage): string {
  const addressed = coverage.total - coverage.open;
  if (coverage.open === 0) {
    return `All ${coverage.total} topics addressed`;
  }
  return `${addressed} of ${coverage.total} topics addressed — ${coverage.open} still open`;
}

// The Done-guard copy (design spec P2.2). Singular/plural matters here: this
// is the sentence that decides whether a student walks into an unfair grade.
export function doneWarningText(open: number): string {
  const subject = open === 1 ? "1 topic is unaddressed" : `${open} topics are unaddressed`;
  return `${subject} — Apollo's last question is one of them. Grade anyway?`;
}

// The owl animates only while Apollo is processing a turn; settled turns
// hold the first frame so old answers don't read as still "thinking".
function ApolloAvatar({ thinking = false }: { thinking?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (thinking) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [thinking]);

  return (
    <video
      ref={ref}
      className="apollo-avatar"
      src="/thinking.mp4"
      autoPlay={thinking}
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden
    />
  );
}

export default function ApolloChat({
  sessionId,
  initialMessages,
  askHootAvailable = false,
  onKgUpdate,
  onCoverageSnapshot,
  onDoneClicked,
  onDoneFromChat,
  initialCoverage = null,
  disabled,
  grading = false,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);
  const [askMode, setAskMode] = useState(false);
  // Ask Hoot is capped at 3 questions per session. Reloaded history carries
  // no counter of its own, so seed it by counting transcript turns already
  // tagged `reference_aside` (same tag the aside card itself keys on).
  const [asideCount, setAsideCount] = useState(
    () => initialMessages.filter((m) => m.intent === "reference_aside").length,
  );
  // P2.2: last graded-topic snapshot the backend reported, and whether the
  // Done click is currently held behind the unaddressed-topics confirm.
  // Seeded from the session snapshot so a reload mid-attempt doesn't drop the
  // meter and silently un-guard Done.
  const [coverage, setCoverage] = useState<GradedCoverage | null>(initialCoverage);
  const [confirmingDone, setConfirmingDone] = useState(false);
  // Streamed-turn progress; null whenever a turn is not streaming.
  const [turn, setTurn] = useState<TurnProgress | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const keepTeachingRef = useRef<HTMLButtonElement | null>(null);
  const ASK_HOOT_CAP = 3;
  const askHootCapped = asideCount >= ASK_HOOT_CAP;
  // Derived, never trusted from `confirmingDone` alone: the guard is "open"
  // only while the notice is actually on screen, so the Done button can never
  // be left disabled by a warning that stopped rendering (e.g. a later turn
  // closed the last open topic).
  const doneGuardOpen = confirmingDone && coverage !== null && coverage.open > 0;

  function enterAskMode() {
    if (!askHootAvailable || askHootCapped) return;
    setAskMode(true);
  }

  function cancelAskMode() {
    setAskMode(false);
  }

  // Done is guarded, never blocked: with open graded topics a click opens the
  // warning, and grading requires an explicit "Grade anyway". The Done button
  // itself is disabled while the warning is up, so a double-click (or a
  // double-Enter — the button neither moves nor loses focus when the notice
  // appears above the bottom-pinned band) can't blow past a warning the
  // student never read. No coverage snapshot (older backend) ⇒ straight
  // through, as before.
  function handleDoneClick() {
    if (coverage && coverage.open > 0) {
      setConfirmingDone(true);
      return;
    }
    onDoneClicked();
  }

  // Dismissing the guard hands focus to the composer — the action the button
  // promises — instead of stranding it on the just-disabled Done button.
  function dismissDoneGuard() {
    setConfirmingDone(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function insertChar(ch: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setDraft((d) => d + ch);
      return;
    }
    const start = ta.selectionStart ?? draft.length;
    const end = ta.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + ch + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + ch.length, start + ch.length);
    });
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Move focus into the guard when it opens: the Done button goes disabled at
  // the same moment, and a keyboard student left focused on a disabled control
  // would be stranded (and would never reach the decision).
  useEffect(() => {
    if (doneGuardOpen) keepTeachingRef.current?.focus();
  }, [doneGuardOpen]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    const myMsg = draft.trim();
    // Echo guard (P0.6): a message that is essentially Apollo's own last turn
    // copied back would be graded as the student's words. Confirm-gated, not
    // a hard block — window.confirm matches the restart precedent — and the
    // draft stays in the composer on cancel so the student can rewrite it.
    const lastApolloMessage =
      [...messages].reverse().find((m) => m.role === "apollo")?.content ?? "";
    if (
      isEchoOfApolloTurn(myMsg, lastApolloMessage) &&
      !window.confirm(
        "That looks like Apollo's last message copied back. Apollo can only " +
          "learn from your own words — send it anyway?",
      )
    ) {
      return;
    }
    const wasAskMode = askMode;
    setDraft("");
    setError(null);
    // The student kept teaching, so any pending Done warning is stale.
    setConfirmingDone(false);
    setMessages((m) => [...m, { role: "student", content: myMsg }]);
    setSending(true);

    // The ONLY thing the kill switch changes is which awaited call produces
    // the `ChatResponse`. Everything downstream of it — the settled-turn
    // reconciliation, the error surface, the rollback rule — is one
    // implementation shared by both transports, so the blocking path can
    // never drift out from under the streaming one.
    const streaming = apolloTurnStreamingEnabled();
    setTurn(streaming ? { note: null, replied: false, grading: false } : null);
    // Local mirror of `turn.replied`: the settle and catch paths below need it
    // synchronously, and a React state read here would be one render behind.
    let replied = false;

    try {
      const resp = streaming
        ? await sendChatStreamed(sessionId, myMsg, wasAskMode, {
            onWorking: (stage, note) =>
              setTurn((t) =>
                t ? { ...t, note, grading: t.grading || stage === GRADING_STAGE } : t,
              ),
            onReply: (text) => {
              // Guard, not an assertion: the contract says exactly one `reply`
              // precedes the terminal event, but a second one would append a
              // second provisional bubble while the settle path only ever
              // slices ONE off — decapitating the turn before it. Ignore any
              // repeat rather than let a backend regression corrupt the
              // transcript.
              if (replied) return;
              replied = true;
              // Apollo's text is final at this point, so it goes into the
              // transcript immediately — on an auto-done turn the student
              // reads it while grading is still running.
              setMessages((m) => [
                ...m,
                {
                  role: "apollo",
                  content: text,
                  intent: wasAskMode ? "hoot_answer" : undefined,
                },
              ]);
              setTurn((t) => (t ? { ...t, replied: true, note: null } : t));
            },
          })
        : await sendChat(sessionId, myMsg, wasAskMode);

      // Reconcile from the terminal payload exactly as the blocking path
      // reconciles from its response body — they are the same object. The
      // provisional streamed bubble is dropped first, because the settled
      // shape may be two turns (a reference aside) rather than one.
      setMessages((m) => [
        ...(replied ? m.slice(0, -1) : m),
        ...apolloTurnMessages(resp, wasAskMode),
      ]);
      if (
        resp.message_kind === "reference_aside" &&
        resp.aside &&
        resp.intent_executed?.intent === "reference_question"
      ) {
        setAsideCount(resp.intent_executed.aside_count);
      }
      // Ask-mode always exits once the response lands, aside or not: a submit
      // that fell through to a normal teaching turn (flag off, or the concept
      // isn't reference-eligible) is not an error, it just keeps the Hoot
      // attribution for this live turn via `apolloTurnMessages`.
      if (wasAskMode) setAskMode(false);
      onKgUpdate(resp.kg);
      onCoverageSnapshot(resp.covered_topics ?? []);
      const nextCoverage = readGradedCoverage(resp);
      if (nextCoverage) setCoverage(nextCoverage);
      if (resp.intent_executed?.intent === "done" && onDoneFromChat) {
        onDoneFromChat(resp.intent_executed.result);
      }
    } catch (err) {
      setError(err as Error);
      // Pop the optimistic student turn, as this path always has — UNLESS the
      // stream already delivered Apollo's reply. Past that point the backend
      // has the turn's final text and finishes it server-side even if the
      // connection died, so tearing a reply the student already read back off
      // the screen would be the dishonest option, not the safe one.
      //
      // `replied` is the RIGHT key for that rule, and the ordering is what
      // makes it right: backend `chat.py` emits the reply phase (916), then
      // persists the reply row (918 → `_persist_apollo_reply`, 322), and only
      // then can any later failure raise an in-band `error` frame. So a reply
      // the student has seen is already durable, and an error arriving after
      // it does not un-persist the turn. Do not "fix" this to roll back
      // unconditionally — that would delete a turn a refresh will show.
      if (!replied) setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
      setTurn(null);
    }
  }

  const hasConversation = messages.length > 0 || sending;
  // Grading runs for a clicked Done (parent-owned `grading`) and for an
  // auto-done turn, which the stream announces mid-turn as `working(grading)`.
  // Both mount the SAME staged panel — mount/unmount is its whole API.
  const showGradingPanel = grading || turn?.grading === true;
  // The in-flight placeholder is the pre-reply affordance. Once Apollo's reply
  // is on screen it disappears — unless a LATER phase reports in (the contract
  // allows `working` after `reply`), in which case it comes back carrying that
  // phase's copy. The grading phase is excluded because the staged panel below
  // is already narrating it; two narrations of one wait is noise.
  const showThinkingTurn = !showGradingPanel && (!turn?.replied || turn.note !== null);

  return (
    <section className="apollo-chat">
      <div ref={scrollRef} className="apollo-chat__scroll">
        {hasConversation ? (
          <div className="apollo-scrollback">
            {messages.map((m, i) => {
              if (m.role === "student") {
                return (
                  <div key={i} className="apollo-turn apollo-turn--student">
                    <div className="msg-user prose md-body">
                      <MathMarkdown>{m.content}</MathMarkdown>
                    </div>
                  </div>
                );
              }
              if (m.intent === "reference_aside" || m.intent === "hoot_answer") {
                return (
                  <div key={i} className="apollo-turn apollo-turn--apollo">
                    <ApolloAvatar />
                    <div
                      className="apollo-turn__body apollo-aside"
                      role="note"
                      aria-label="Hoot — from the course materials"
                      data-in-scope={m.aside ? m.aside.in_scope : true}
                    >
                      <span className="eyebrow" aria-hidden>
                        {m.intent === "reference_aside"
                          ? "Hoot — from the course materials"
                          : "Hoot"}
                      </span>
                      <div className="prose md-body">
                        <MathMarkdown>{m.content}</MathMarkdown>
                      </div>
                      {m.aside && m.aside.citations.length > 0 && (
                        <div className="msg-ai__sources">
                          <span className="msg-ai__sources-label">
                            Sources referenced
                          </span>
                          {m.aside.citations.map((c, ci) => (
                            <CitationChip key={ci} meta={c} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="apollo-turn apollo-turn--apollo">
                  <ApolloAvatar />
                  <div className="apollo-turn__body msg-ai">
                    <span className="eyebrow">Apollo</span>
                    <div className="prose md-body">
                      <MathMarkdown>{m.content}</MathMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}
            {sending && showThinkingTurn && (
              <div className="apollo-turn apollo-turn--apollo" aria-live="polite">
                <ApolloAvatar thinking />
                {/* askMode is still true while an ask-mode send is in flight
                    (it only resets after the response), so it names the
                    speaker the student is actually waiting on. */}
                <div className={`apollo-turn__body ${askMode ? "apollo-aside" : "msg-ai"}`}>
                  <span className="eyebrow">{askMode ? "Hoot" : "Apollo"}</span>
                  {/* Streamed turns replace the static word with the backend's
                      own phase copy, which is why activity is visible inside a
                      second instead of after the whole 10-17s turn. The
                      blocking path (and the gap before the first frame) keeps
                      "thinking…" exactly as before. */}
                  <em className="note" style={{ margin: 0 }}>
                    {turn?.note ?? "thinking…"}
                  </em>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="apollo-chat__welcome">
            <OwlVideo className="empty-greeting__owl" />
            <p className="empty-greeting__note">
              I&apos;m listening — walk me through your thinking.
            </p>
          </div>
        )}
      </div>

      <div className="apollo-chat__composer">
        <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />

        <SpecialCharsPalette onInsert={insertChar} />

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            askMode
              ? "Ask a question about the course material…"
              : "Teach Apollo in your own words…"
          }
          rows={3}
          disabled={disabled || sending}
          className={`textarea ${askMode ? "apollo-textarea--ask-mode" : ""}`}
        />

        <div className="apollo-chat__send-row">
          {askHootAvailable && (
          <div className="apollo-ask-hoot" aria-live="polite">
            {askMode ? (
              <>
                <span className="apollo-ask-hoot__status">
                  Type in your question above and click &apos;Ask&apos;
                </span>
                <button
                  onClick={cancelAskMode}
                  type="button"
                  className="ui-button ui-button--ghost ui-button--small"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={enterAskMode}
                disabled={disabled || sending || askHootCapped}
                type="button"
                title={
                  askHootCapped
                    ? "You've used all 3 Ask Hoot questions for this session."
                    : undefined
                }
                aria-label={
                  askHootCapped
                    ? "Unsure? Ask Hoot! You've used all 3 Ask Hoot questions for this session."
                    : "Unsure? Ask Hoot!"
                }
                className="ui-button ui-button--small apollo-ask-hoot__button"
              >
                Unsure? Ask Hoot!
              </button>
            )}
          </div>
          )}
          <button
            onClick={handleSend}
            disabled={disabled || sending || !draft.trim()}
            type="button"
            className="ui-button ui-button--primary ui-button--small"
          >
            {sending ? "Sending…" : askMode ? "Ask" : "Send"}
          </button>
        </div>

        {doneGuardOpen && coverage && (
          <div className="notice apollo-finish-confirm" data-tone="warning" role="alert">
            <span className="eyebrow">Before you finish</span>
            <p className="apollo-finish-confirm__text">{doneWarningText(coverage.open)}</p>
            <div className="apollo-finish-confirm__actions">
              <button
                ref={keepTeachingRef}
                onClick={dismissDoneGuard}
                type="button"
                className="ui-button ui-button--primary ui-button--small"
              >
                Keep teaching
              </button>
              <button
                onClick={() => {
                  setConfirmingDone(false);
                  onDoneClicked();
                }}
                disabled={disabled || sending}
                type="button"
                className="ui-button ui-button--ghost ui-button--small"
              >
                Grade anyway
              </button>
            </div>
          </div>
        )}

        {/* Staged progress for the 6-20s grade. Mounted only while a grade is
            actually in flight, so its own timers start and stop with it; the
            reveal is this unmounting when the parent swaps in the report.
            Two mount sites, one component: the clicked-Done request (parent
            `grading`) and an auto-done turn, whose stream announces grading
            after it has already released Apollo's reply. Nothing below
            changes — the Done button keeps its spinner and label, and the
            meter/guard are untouched. */}
        {showGradingPanel && <ApolloGradingProgress />}

        <div className="apollo-finish">
          <div className="apollo-finish__copy">
            <span className="eyebrow">Finished teaching?</span>
            <p className="apollo-finish__note">
              Apollo will try to solve the problem using only what you taught
              it.
            </p>
            {coverage && (
              <div className="apollo-finish__meter" data-open={coverage.open > 0}>
                <div
                  className="apollo-finish__meter-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={coverage.total}
                  aria-valuenow={coverage.total - coverage.open}
                  aria-label="Topics addressed"
                >
                  <div
                    className="apollo-finish__meter-fill"
                    style={{
                      width: `${Math.round(
                        ((coverage.total - coverage.open) / coverage.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="apollo-finish__meter-label">
                  {coverageMeterLabel(coverage)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleDoneClick}
            disabled={disabled || sending || doneGuardOpen}
            type="button"
            className="ui-button ui-button--done"
          >
            {/* Keyed on `showGradingPanel`, NOT `busy`. `busy` is also raised
                by "Start over", which made the button claim "Grading your
                teaching…" during a restart; and it is NOT raised by an
                auto-done, which left it reading "I'm done teaching" while a
                grade was actually running. The same condition that mounts the
                staged panel is the honest one for this label — the button and
                the panel now always agree about whether a grade is in
                flight. */}
            {showGradingPanel && <span className="ui-button__spinner" aria-hidden />}
            {showGradingPanel ? "Grading your teaching…" : "I'm done teaching"}
          </button>
        </div>
      </div>
    </section>
  );
}
