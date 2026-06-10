"use client";

import { useEffect, useRef, useState } from "react";

import { ApolloApiError, sendChat } from "@/lib/apollo/api";
import type { ApolloKG, DoneResponse } from "@/lib/apollo/api";
import SpecialCharsPalette from "@/components/SpecialCharsPalette";
import ApolloErrorSurface from "./ApolloErrorSurface";

interface Props {
  sessionId: number;
  initialMessages: Array<{ role: string; content: string }>;
  onKgUpdate: (kg: ApolloKG) => void;
  onDoneClicked: () => void;
  // Item #5: when chat detects a "done" intent and the student affirms,
  // the backend executes handle_done inline and embeds the result in
  // the chat response. We forward that pre-fetched result to the parent
  // so it can render the report without a redundant API call.
  onDoneFromChat?: (result: DoneResponse) => void;
  disabled?: boolean;
}

function ApolloAvatar() {
  return (
    <video
      className="apollo-avatar"
      src="/thinking.mp4"
      autoPlay
      loop
      muted
      playsInline
      aria-hidden
    />
  );
}

export default function ApolloChat({
  sessionId,
  initialMessages,
  onKgUpdate,
  onDoneClicked,
  onDoneFromChat,
  disabled,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    setDraft("");
    setError(null);
    setMessages((m) => [...m, { role: "student", content: myMsg }]);
    setSending(true);
    try {
      const resp = await sendChat(sessionId, myMsg);
      setMessages((m) => [...m, { role: "apollo", content: resp.apollo_reply }]);
      onKgUpdate(resp.kg);
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
    <section className="composer-grid">
      {hasConversation ? (
        <div ref={scrollRef} className="apollo-scrollback">
          {messages.map((m, i) => {
            if (m.role === "student") {
              return (
                <div key={i} className="apollo-turn apollo-turn--student">
                  <span className="eyebrow">You</span>
                  <span>{m.content}</span>
                </div>
              );
            }
            return (
              <div key={i} className="apollo-turn apollo-turn--apollo">
                <ApolloAvatar />
                <div className="apollo-turn__body">
                  <span className="eyebrow">Apollo</span>
                  <span>{m.content}</span>
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="apollo-turn apollo-turn--apollo" aria-live="polite">
              <ApolloAvatar />
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
        <div className="apollo-empty">
          <ApolloAvatar />
          <div>
            <div className="eyebrow">Apollo</div>
            <p className="prose" style={{ margin: 0 }}>
              I need you to walk me through the steps to solve this — not just give me formulas. Explain what to do first, why it applies here, and how to get from there to the answer.
            </p>
          </div>
        </div>
      )}

      <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />

      <SpecialCharsPalette onInsert={insertChar} />

      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Teach Apollo in your own words…"
        rows={3}
        disabled={disabled || sending}
        className="textarea"
      />

      <div className="composer-foot">
        <button
          onClick={handleSend}
          disabled={disabled || sending || !draft.trim()}
          type="button"
          className="ui-button ui-button--primary ui-button--small"
        >
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          onClick={onDoneClicked}
          disabled={disabled || sending}
          type="button"
          className="ui-button ui-button--small"
        >
          I&apos;m done teaching
        </button>
      </div>
    </section>
  );
}
