"use client";

// P3.7 — Negotiable OLM pill wrapper.
//
// Wraps a single KG entry. Shows:
//   - the entry's surface text (rendered by the parent panel)
//   - a small confidence dot (green ≥ 0.8 / yellow 0.5–0.8 / red < 0.5)
//   - three action buttons: ?  ✎  ↩
//   - inline expandable cards for dispute / paraphrase / trace
//
// The pill is the only handle the student has on the entry's negotiation
// state. It owns the API calls (challenge / paraphrase / skip / trace)
// and bubbles updates to the parent via `onUpdated(entry, kg)`.

import { useState } from "react";
import type {
  ApolloNode,
  ApolloKG,
  NegotiationTrace,
} from "@/lib/apollo/api";
import {
  challengeEntry,
  paraphraseEntry,
  skipEntry,
  getEntryTrace,
} from "@/lib/apollo/api";
import KGEntryDispute from "./KGEntryDispute";
import KGEntryParaphrase from "./KGEntryParaphrase";
import KGEntryTrace from "./KGEntryTrace";

interface Props {
  sessionId: number;
  node: ApolloNode;
  // Render-prop for the entry's primary surface form (parent decides
  // how to render equations, conditions, etc. — this component is
  // type-agnostic).
  children: React.ReactNode;
  // Bubble update for parent to refresh KG view.
  onUpdated?: (entry: ApolloNode, kg: ApolloKG) => void;
  // P3.5 — when the chat envelope flags this entry for an OLM invite,
  // the panel sets `pulseHint=true` for a few seconds so the pill
  // animates briefly. Purely visual — does not change behavior.
  pulseHint?: boolean;
}

type Expanded = "none" | "dispute" | "paraphrase" | "trace";


function _confidenceClass(conf: number | undefined): string {
  // Default 1.0 (legacy) → green.
  const c = conf ?? 1.0;
  if (c >= 0.8) return "kg-pill__dot--green";
  if (c >= 0.5) return "kg-pill__dot--yellow";
  return "kg-pill__dot--red";
}


function _statusBadge(node: ApolloNode): string | null {
  const status = node.status ?? "ACCEPTED";
  if (status === "DISPUTED") return "disputed";
  if (status === "DUAL") return node.student_belief ? "your wording" : "skipped";
  return null;
}


export default function KGEntryPill({
  sessionId,
  node,
  children,
  onUpdated,
  pulseHint,
}: Props) {
  const [expanded, setExpanded] = useState<Expanded>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<NegotiationTrace | null>(null);

  const dotClass = _confidenceClass(node.parser_confidence);
  const status = node.status ?? "ACCEPTED";
  const badge = _statusBadge(node);

  function _toggle(target: Expanded) {
    setError(null);
    setExpanded((prev) => (prev === target ? "none" : target));
    if (target !== "trace") {
      setTrace(null);
    }
  }

  async function _onChallenge(reason: string) {
    setBusy(true); setError(null);
    try {
      const res = await challengeEntry(sessionId, node.node_id, reason);
      onUpdated?.(res.entry, res.kg);
      setExpanded("none");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "challenge failed");
    } finally {
      setBusy(false);
    }
  }

  async function _onParaphrase(surfaceForm: string) {
    setBusy(true); setError(null);
    try {
      const res = await paraphraseEntry(sessionId, node.node_id, surfaceForm);
      onUpdated?.(res.entry, res.kg);
      setExpanded("none");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "paraphrase failed");
    } finally {
      setBusy(false);
    }
  }

  async function _onSkip() {
    setBusy(true); setError(null);
    try {
      const res = await skipEntry(sessionId, node.node_id);
      onUpdated?.(res.entry, res.kg);
      setExpanded("none");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "skip failed");
    } finally {
      setBusy(false);
    }
  }

  async function _onLoadTrace() {
    if (trace !== null) {
      _toggle("trace");
      return;
    }
    setBusy(true); setError(null);
    try {
      const t = await getEntryTrace(sessionId, node.node_id);
      setTrace(t);
      setExpanded("trace");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "trace failed");
    } finally {
      setBusy(false);
    }
  }

  const pulseClass = pulseHint ? "kg-pill--pulse" : "";
  const statusClass =
    status === "DISPUTED" ? "kg-pill--disputed" :
    status === "DUAL" ? "kg-pill--dual" : "";

  return (
    <div
      className={`kg-pill ${statusClass} ${pulseClass}`}
      data-entry-id={node.node_id}
      data-entry-status={status}
    >
      <div className="kg-pill__row">
        <span
          className={`kg-pill__dot ${dotClass}`}
          aria-label={`parser confidence ${node.parser_confidence ?? 1.0}`}
          title={`Parser confidence: ${(
            (node.parser_confidence ?? 1.0) * 100
          ).toFixed(0)}%`}
        />
        <span className="kg-pill__text">{children}</span>
        {badge && <span className="kg-pill__badge">{badge}</span>}
        <span className="kg-pill__actions">
          <button
            type="button"
            className="kg-pill__btn"
            disabled={busy}
            onClick={() => _toggle("dispute")}
            aria-label="challenge this entry"
            title="Challenge — flag this as wrong / misheard"
          >?</button>
          <button
            type="button"
            className="kg-pill__btn"
            disabled={busy}
            onClick={() => _toggle("paraphrase")}
            aria-label="paraphrase this entry"
            title="Paraphrase — supply your preferred wording"
          >✎</button>
          <button
            type="button"
            className="kg-pill__btn"
            disabled={busy}
            onClick={_onSkip}
            aria-label="skip this entry"
            title="Skip — pass through to grader without a paraphrase"
          >↩</button>
          <button
            type="button"
            className="kg-pill__btn kg-pill__btn--muted"
            disabled={busy}
            onClick={_onLoadTrace}
            aria-label="show trace"
            title="Apollo's wiring — show the source utterance + move history"
          >…</button>
        </span>
      </div>

      {error && <div className="kg-pill__error" role="alert">{error}</div>}

      {expanded === "dispute" && (
        <KGEntryDispute
          busy={busy}
          onCancel={() => _toggle("none")}
          onSubmit={_onChallenge}
        />
      )}
      {expanded === "paraphrase" && (
        <KGEntryParaphrase
          busy={busy}
          initialValue={node.student_belief ?? ""}
          onCancel={() => _toggle("none")}
          onSubmit={_onParaphrase}
        />
      )}
      {expanded === "trace" && trace !== null && (
        <KGEntryTrace
          trace={trace}
          onClose={() => _toggle("none")}
        />
      )}
    </div>
  );
}
