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
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 6,
          padding: 12,
          minHeight: "40vh",
          maxHeight: "55vh",
          overflowY: "auto",
          background: "#fff",
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ margin: "6px 0" }}>
            <strong style={{ color: m.role === "student" ? "#0a4" : "#024" }}>
              {m.role === "student" ? "You" : "Apollo"}:
            </strong>{" "}
            {m.content}
          </div>
        ))}
        {sending && <em style={{ color: "#888" }}>Apollo is thinking…</em>}
      </div>

      <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Teach Apollo in your own words…"
        rows={3}
        disabled={disabled || sending}
        style={{ width: "100%", padding: 8, fontSize: "1em" }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSend} disabled={disabled || sending || !draft.trim()}>
          Send
        </button>
        <button onClick={onDoneClicked} disabled={disabled || sending}>
          I'm done teaching
        </button>
      </div>
    </section>
  );
}
