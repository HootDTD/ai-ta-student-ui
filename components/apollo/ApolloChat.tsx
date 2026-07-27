"use client";

import { useEffect, useRef, useState } from "react";

import { ApolloApiError, sendChat } from "@/lib/apollo/api";
import type { ApolloKG, ChatAside, CoveredTopic, DoneResponse } from "@/lib/apollo/api";
import SpecialCharsPalette from "@/components/SpecialCharsPalette";
import OwlVideo from "@/components/OwlVideo";
import MathMarkdown from "@/components/MathMarkdown";
import { CitationChip } from "@/components/CitationChip";
import ApolloErrorSurface from "./ApolloErrorSurface";

// A chat turn. `intent`/`aside` are only ever set on apollo-role turns:
// `intent === "reference_aside"` (from a live reply or transcript reload)
// renders the distinct "From the course materials" card instead of a normal
// persona bubble. `aside` (citations included) is only available on turns
// built from a live `sendChat` response — reloaded history carries the
// `intent` tag but not the structured citations.
interface ChatMessage {
  role: string;
  content: string;
  intent?: string;
  aside?: ChatAside;
}

interface Props {
  sessionId: number;
  initialMessages: ChatMessage[];
  onKgUpdate: (kg: ApolloKG) => void;
  onCoverageSnapshot: (topics: CoveredTopic[]) => void;
  onDoneClicked: () => void;
  // Item #5: when chat detects a "done" intent and the student affirms,
  // the backend executes handle_done inline and embeds the result in
  // the chat response. We forward that pre-fetched result to the parent
  // so it can render the report without a redundant API call.
  onDoneFromChat?: (result: DoneResponse) => void;
  disabled?: boolean;
  // True while the parent is processing the "I'm done teaching" click
  // (awaiting finishTeaching); drives the button's loading state.
  busy?: boolean;
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
  onKgUpdate,
  onCoverageSnapshot,
  onDoneClicked,
  onDoneFromChat,
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const ASK_HOOT_CAP = 3;
  const askHootCapped = asideCount >= ASK_HOOT_CAP;

  function enterAskMode() {
    if (askHootCapped) return;
    setAskMode(true);
  }

  function cancelAskMode() {
    setAskMode(false);
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

  async function handleSend() {
    if (!draft.trim() || sending) return;
    const myMsg = draft.trim();
    const wasAskMode = askMode;
    setDraft("");
    setError(null);
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
        // teaching turn — no error state, just quietly leave ask-mode.
        setMessages((m) => [...m, { role: "apollo", content: resp.apollo_reply }]);
      }
      if (wasAskMode) setAskMode(false);
      onKgUpdate(resp.kg);
      onCoverageSnapshot(resp.covered_topics ?? []);
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
                    <span className="eyebrow">You</span>
                    <div className="prose md-body">
                      <MathMarkdown>{m.content}</MathMarkdown>
                    </div>
                  </div>
                );
              }
              if (m.intent === "reference_aside") {
                return (
                  <div key={i} className="apollo-turn apollo-turn--aside">
                    <div
                      className="apollo-aside"
                      role="note"
                      aria-label="From the course materials"
                      data-in-scope={m.aside ? m.aside.in_scope : true}
                    >
                      <span className="eyebrow" aria-hidden>
                        From the course materials
                      </span>
                      <div className="prose md-body">
                        <MathMarkdown>{m.content}</MathMarkdown>
                      </div>
                      {m.aside && m.aside.citations.length > 0 && (
                        <div className="apollo-aside__citations">
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
                  <div className="apollo-turn__body">
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
                <div className="apollo-turn__body">
                  <span className="eyebrow">Apollo</span>
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
          <div className="apollo-ask-hoot" aria-live="polite">
            {askMode ? (
              <>
                <span className="apollo-ask-hoot__status">Ask Hoot mode — asking a question, not teaching</span>
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
                className="ui-button ui-button--ghost ui-button--small"
              >
                Unsure? Ask Hoot!
              </button>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={disabled || sending || !draft.trim()}
            type="button"
            className="ui-button ui-button--primary ui-button--small"
          >
            {sending ? "Sending…" : askMode ? "Ask" : "Send"}
          </button>
        </div>

        <div className="apollo-finish">
          <div className="apollo-finish__copy">
            <span className="eyebrow">Finished teaching?</span>
            <p className="apollo-finish__note">
              Apollo will try to solve the problem using only what you taught
              it.
            </p>
          </div>
          <button
            onClick={onDoneClicked}
            disabled={disabled || sending}
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
