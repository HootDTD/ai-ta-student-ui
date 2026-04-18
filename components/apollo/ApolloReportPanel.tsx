"use client";

import type { DoneResponse } from "@/lib/apollo/api";

interface Props {
  report: DoneResponse;
  onRetry: () => void;
  onEnd: () => void;
  busy?: boolean;
}

export default function ApolloReportPanel({ report, onRetry, onEnd, busy }: Props) {
  const { result, value, missing_variables, narrated_trace, diagnostic_report } = report;
  return (
    <section
      style={{
        border: "1px solid #888",
        borderRadius: 6,
        padding: 12,
        background: result === "solved" ? "#e7f7ea" : "#fdeaea",
      }}
    >
      <header style={{ marginBottom: 6 }}>
        <strong>{result === "solved" ? `Apollo solved it — value = ${value}` : "Apollo got stuck"}</strong>
      </header>
      {result === "stuck" && missing_variables.length > 0 && (
        <p>
          <em>Missing: {missing_variables.join(", ")}</em>
        </p>
      )}
      <details open style={{ margin: "8px 0" }}>
        <summary>Apollo's reasoning trace</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.9em" }}>{narrated_trace}</pre>
      </details>
      <details open style={{ margin: "8px 0" }}>
        <summary>Diagnostic report</summary>
        <p style={{ whiteSpace: "pre-wrap" }}>{diagnostic_report}</p>
      </details>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onRetry} disabled={busy}>
          Teach more and retry
        </button>
        <button onClick={onEnd} disabled={busy}>
          End session
        </button>
      </div>
    </section>
  );
}
