"use client";

import { useEffect, useRef, useState } from "react";

import { ApolloApiError, sendChat } from "@/lib/apollo/api";
import type { ApolloKG, ChatAside, CoveredTopic, DoneResponse } from "@/lib/apollo/api";
import SpecialCharsPalette from "@/components/SpecialCharsPalette";
import OwlVideo from "@/components/OwlVideo";
import MathMarkdown from "@/components/MathMarkdown";
import { CitationChip } from "@/components/CitationChip";
import ApolloErrorSurface from "./ApolloErrorSurface";
import { isEchoOfApolloTurn } from "./echoGuard";

// A chat turn. `intent`/`aside` are only ever set on apollo-role turns:
// `intent === "reference_aside"` (from a live reply or transcript reload)
// renders the distinct Hoot "From the course materials" card instead of a
// normal persona bubble. `aside` (citations included) comes from a live
// `sendChat` response or from the session snapshot's replay of stored aside
// metadata; asides persisted before the backend stored that metadata reload
// with the `intent` tag but no citations.
interface ChatMessage {
  role: string;
  content: string;
  intent?: string;
  aside?: ChatAside;
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
  disabled?: boolean;
  // True while the parent is processing the "I'm done teaching" click
  // (awaiting finishTeaching); drives the button's loading state.
  busy?: boolean;
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
  busy,
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
    try {
      const resp = await sendChat(sessionId, myMsg, wasAskMode);
      if (resp.message_kind === "reference_aside" && resp.aside) {
        setMessages((m) => [
          ...m,
          {
            role: "apollo",
            content: resp.aside!.text,
            intent: "reference_aside",
            aside: resp.aside,
          },
          { role: "apollo", content: resp.apollo_reply },
        ]);
        if (resp.intent_executed?.intent === "reference_question") {
          setAsideCount(resp.intent_executed.aside_count);
        }
      } else {
        // Ask-mode submit that didn't come back as an aside (flag off, or
        // the concept isn't reference-eligible) falls through to a normal
        // teaching turn — no error state, just quietly leave ask-mode. The
        // reply still answers the student's question, so keep the Hoot
        // attribution for this live turn (a transcript reload shows it as a
        // plain teaching turn — the backend stores it as one).
        setMessages((m) => [
          ...m,
          {
            role: "apollo",
            content: resp.apollo_reply,
            intent: wasAskMode ? "hoot_answer" : undefined,
          },
        ]);
      }
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
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  const hasConversation = messages.length > 0 || sending;

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
            {sending && (
              <div className="apollo-turn apollo-turn--apollo" aria-live="polite">
                <ApolloAvatar thinking />
                {/* askMode is still true while an ask-mode send is in flight
                    (it only resets after the response), so it names the
                    speaker the student is actually waiting on. */}
                <div className={`apollo-turn__body ${askMode ? "apollo-aside" : "msg-ai"}`}>
                  <span className="eyebrow">{askMode ? "Hoot" : "Apollo"}</span>
                  <em className="note" style={{ margin: 0 }}>
                    thinking…
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
            {busy && <span className="ui-button__spinner" aria-hidden />}
            {busy ? "Grading your teaching…" : "I'm done teaching"}
          </button>
        </div>
      </div>
    </section>
  );
}
