"use client";

import { useState } from "react";

import { ApolloApiError, sendChat } from "@/lib/apollo/api";
import type { ApolloKG } from "@/lib/apollo/api";
import ApolloErrorSurface from "./ApolloErrorSurface";

interface Props {
  sessionId: number;
  initialMessages: Array<{ role: string; content: string }>;
  onKgUpdate: (kg: ApolloKG) => void;
  onDoneClicked: () => void;
  disabled?: boolean;
}

export default function ApolloChat({
  sessionId,
  initialMessages,
  onKgUpdate,
  onDoneClicked,
  disabled,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);

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
    } catch (err) {
      setError(err as Error);
      // Roll back the optimistic student message since the turn didn't complete.
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="composer-grid">
      <div className="apollo-scrollback">
        {messages.map((m, i) => (
          <div key={i} className="apollo-turn">
            <span className="eyebrow">
              {m.role === "student" ? "You" : "Apollo"}
            </span>
            <span>{m.content}</span>
          </div>
        ))}
        {sending && <em className="note">Apollo is thinking…</em>}
      </div>

      <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />

      <textarea
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
