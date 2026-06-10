"use client";

// P3.7 — read-only "Apollo's wiring" card. Shows the source utterance
// (best-effort: latest student message) and the chronological audit
// log of negotiation moves. Styled in non-Apollo voice — gray header —
// to make clear this is system metadata, not Apollo speaking.

import type { NegotiationTrace } from "@/lib/apollo/api";

interface Props {
  trace: NegotiationTrace;
  onClose: () => void;
}

function _payloadSummary(move: string, payload: Record<string, unknown>): string {
  if (move === "challenge") {
    const r = payload?.["reason"];
    return typeof r === "string" ? `"${r}"` : "";
  }
  if (move === "paraphrase") {
    const s = payload?.["surface_form"];
    return typeof s === "string" ? `"${s}"` : "";
  }
  return "";
}

function _fmtMove(actor: string, move: string): string {
  return `${actor} ${move}`;
}

export default function KGEntryTrace({ trace, onClose }: Props) {
  return (
    <div className="kg-pill__card kg-pill__card--trace" role="region">
      <div className="kg-pill__card-eyebrow kg-pill__trace-eyebrow">
        Apollo&apos;s wiring
      </div>
      {trace.source_utterance && (
        <div className="kg-pill__trace-source">
          <div className="kg-pill__trace-label">source utterance</div>
          <div className="kg-pill__trace-quote">{trace.source_utterance}</div>
        </div>
      )}
      <div className="kg-pill__trace-moves">
        <div className="kg-pill__trace-label">moves</div>
        {trace.moves.length === 0 ? (
          <em className="kg-pill__trace-empty">(no moves yet)</em>
        ) : (
          <ol className="kg-pill__trace-list">
            {trace.moves.map((m, i) => (
              <li key={i}>
                <span className="kg-pill__trace-actor">{_fmtMove(m.actor, m.move)}</span>
                {m.created_at && (
                  <span className="kg-pill__trace-when"> · {new Date(m.created_at).toLocaleTimeString()}</span>
                )}
                {(() => {
                  const summary = _payloadSummary(m.move, m.payload);
                  return summary ? <div className="kg-pill__trace-payload">{summary}</div> : null;
                })()}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="kg-pill__card-meta">
        <button
          type="button"
          className="kg-pill__btn-secondary"
          onClick={onClose}
        >close</button>
      </div>
    </div>
  );
}
