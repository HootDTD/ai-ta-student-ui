"use client";

import { useEffect, useRef, useState } from "react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import type {
  ApolloEdge,
  ApolloKG,
  ApolloNode,
  ConditionNode,
  DefinitionNode,
  EquationNode,
  ProcedureStepNode,
  SimplificationNode,
  VariableMappingNode,
} from "@/lib/apollo/api";
import KGEntryPill from "./KGEntryPill";

interface Props {
  kg: ApolloKG;
  // P3 — when sessionId is provided, the panel wraps each entry in a
  // KGEntryPill that supports the three negotiation moves. When absent
  // (e.g. read-only views, the legacy report panel), entries render
  // bare without the pill — pre-P3 behavior preserved.
  sessionId?: number;
  // P3.5 — when set, the panel pulses the entry pill with this id for
  // a few seconds so the student notices Apollo's invite. Cleared by
  // the parent after a single pulse cycle.
  pulseEntryId?: string | null;
  // Bubbled when a negotiation move succeeds — parent updates its KG
  // state and may clear `pulseEntryId`.
  onKgUpdated?: (kg: ApolloKG) => void;
}

function nodesByType<T extends ApolloNode>(
  kg: ApolloKG,
  type: T["node_type"],
): T[] {
  return kg.nodes.filter((n): n is T => n.node_type === type);
}

function bulletList<T>(
  items: T[],
  render: (item: T, idx: number) => React.ReactNode,
) {
  if (items.length === 0) {
    return <em className="note">(none yet)</em>;
  }
  return (
    <ul className="plain-list">
      {items.map((item, idx) => (
        <li key={idx}>{render(item, idx)}</li>
      ))}
    </ul>
  );
}

function orderedProcedureSteps(kg: ApolloKG): ProcedureStepNode[] {
  const steps = nodesByType<ProcedureStepNode>(kg, "procedure_step");
  if (steps.length === 0) return [];

  const stepIds = new Set(steps.map((s) => s.node_id));
  const precedes = kg.edges.filter(
    (e) => e.edge_type === "PRECEDES" &&
           stepIds.has(e.from_node_id) &&
           stepIds.has(e.to_node_id),
  );
  const incoming = new Map<string, number>();
  steps.forEach((s) => incoming.set(s.node_id, 0));
  precedes.forEach((e) => {
    incoming.set(e.to_node_id, (incoming.get(e.to_node_id) ?? 0) + 1);
  });

  // Find chain head: node with no incoming PRECEDES.
  const head = steps.find((s) => incoming.get(s.node_id) === 0);
  if (!head) return steps; // Cycle / orphans — fall back to insertion order.

  const nextOf = new Map<string, string>();
  precedes.forEach((e) => nextOf.set(e.from_node_id, e.to_node_id));

  const chain: ProcedureStepNode[] = [];
  const seen = new Set<string>();
  let current: string | undefined = head.node_id;
  const stepIndex = new Map(steps.map((s) => [s.node_id, s]));
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = stepIndex.get(current);
    if (node) chain.push(node);
    current = nextOf.get(current);
  }
  // Append any orphans not in the chain (preserves insertion order).
  steps.forEach((s) => {
    if (!seen.has(s.node_id)) chain.push(s);
  });
  return chain;
}

function usesTargets(kg: ApolloKG, fromId: string): EquationNode[] {
  const targetIds = new Set(
    kg.edges
      .filter((e) => e.edge_type === "USES" && e.from_node_id === fromId)
      .map((e) => e.to_node_id),
  );
  return nodesByType<EquationNode>(kg, "equation").filter((eq) =>
    targetIds.has(eq.node_id),
  );
}

// Helper: pill-or-bare wrapper. When sessionId is missing we render the
// child unwrapped — preserves pre-P3 panel rendering for read-only contexts.
function MaybePill({
  sessionId, node, pulse, onUpdated, children,
}: {
  sessionId?: number;
  node: ApolloNode;
  pulse: boolean;
  onUpdated?: (kg: ApolloKG) => void;
  children: React.ReactNode;
}) {
  if (sessionId === undefined) return <>{children}</>;
  return (
    <KGEntryPill
      sessionId={sessionId}
      node={node}
      pulseHint={pulse}
      onUpdated={(_, kg) => onUpdated?.(kg)}
    >
      {children}
    </KGEntryPill>
  );
}

export default function ApolloKGPanel({
  kg, sessionId, pulseEntryId, onKgUpdated,
}: Props) {
  const equations = nodesByType<EquationNode>(kg, "equation");
  const conditions = nodesByType<ConditionNode>(kg, "condition");
  const simplifications = nodesByType<SimplificationNode>(kg, "simplification");
  const definitions = nodesByType<DefinitionNode>(kg, "definition");
  const variableMappings = nodesByType<VariableMappingNode>(kg, "variable_mapping");
  const procedureSteps = orderedProcedureSteps(kg);

  const asideRef = useRef<HTMLElement | null>(null);

  // P3.5 — when pulseEntryId changes, scroll the matching pill into view.
  // The pulse animation is owned by the pill itself via pulseHint; this
  // effect is just the scroll.
  useEffect(() => {
    if (!pulseEntryId || asideRef.current === null) return;
    const el = asideRef.current.querySelector(
      `[data-entry-id="${CSS.escape(pulseEntryId)}"]`,
    );
    if (el && el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [pulseEntryId]);

  return (
    <aside ref={asideRef} className="card apollo-kg">
      <div className="eyebrow">Apollo&apos;s understanding</div>

      <div className="apollo-kg__section">
        <strong>Equations</strong>
        {bulletList(equations, (n) => {
          const tex = n.content.latex ?? n.content.symbolic;
          const label = n.content.label ?? "";
          return (
            <MaybePill
              sessionId={sessionId} node={n}
              pulse={pulseEntryId === n.node_id}
              onUpdated={onKgUpdated}
            >
              <span>
                {label && <span>{label}: </span>}
                <InlineMath math={tex} />
              </span>
            </MaybePill>
          );
        })}
      </div>

      <div className="apollo-kg__section">
        <strong>Conditions</strong>
        {bulletList(conditions, (n) => (
          <MaybePill
            sessionId={sessionId} node={n}
            pulse={pulseEntryId === n.node_id}
            onUpdated={onKgUpdated}
          >
            <span>
              {n.content.label ? `${n.content.label} — ` : ""}
              {n.content.applies_when}
            </span>
          </MaybePill>
        ))}
      </div>

      <div className="apollo-kg__section">
        <strong>Simplifications</strong>
        {bulletList(simplifications, (n) => (
          <MaybePill
            sessionId={sessionId} node={n}
            pulse={pulseEntryId === n.node_id}
            onUpdated={onKgUpdated}
          >
            <span>
              when {n.content.applies_when}, {n.content.transformation}
            </span>
          </MaybePill>
        ))}
      </div>

      <div className="apollo-kg__section">
        <strong>Definitions</strong>
        {bulletList(definitions, (n) => (
          <MaybePill
            sessionId={sessionId} node={n}
            pulse={pulseEntryId === n.node_id}
            onUpdated={onKgUpdated}
          >
            <span>
              {n.content.concept} = {n.content.meaning}
            </span>
          </MaybePill>
        ))}
      </div>

      <div className="apollo-kg__section">
        <strong>Variable mappings</strong>
        {bulletList(variableMappings, (n) => (
          <MaybePill
            sessionId={sessionId} node={n}
            pulse={pulseEntryId === n.node_id}
            onUpdated={onKgUpdated}
          >
            <span>
              {n.content.term} → {n.content.symbol}
            </span>
          </MaybePill>
        ))}
      </div>

      <div className="apollo-kg__section">
        <strong>Procedure steps</strong>
        {bulletList(procedureSteps, (n, i) => {
          const targets = usesTargets(kg, n.node_id);
          return (
            <MaybePill
              sessionId={sessionId} node={n}
              pulse={pulseEntryId === n.node_id}
              onUpdated={onKgUpdated}
            >
              <span>
                {i + 1}. {n.content.action}
                {targets.length > 0 && (
                  <span className="note">
                    {" "}
                    → uses {targets.map((t) => t.content.label || t.node_id).join(", ")}
                  </span>
                )}
              </span>
            </MaybePill>
          );
        })}
      </div>
    </aside>
  );
}
