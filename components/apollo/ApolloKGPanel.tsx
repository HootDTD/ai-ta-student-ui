"use client";

import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import type { ApolloKG } from "@/lib/apollo/api";

interface Props {
  kg: ApolloKG;
}

function bulletList<T>(items: T[], render: (item: T, idx: number) => React.ReactNode) {
  if (items.length === 0) {
    return <em style={{ color: "#888", fontSize: "0.9em" }}>(none yet)</em>;
  }
  return (
    <ul style={{ margin: "4px 0 8px 16px", padding: 0 }}>
      {items.map((item, idx) => (
        <li key={idx} style={{ margin: "2px 0" }}>
          {render(item, idx)}
        </li>
      ))}
    </ul>
  );
}

export default function ApolloKGPanel({ kg }: Props) {
  return (
    <aside
      style={{
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "12px 16px",
        background: "#fafafa",
        fontSize: "0.95em",
      }}
    >
      <h3 style={{ margin: "0 0 8px 0", fontSize: "1em" }}>What Apollo has understood so far</h3>

      <strong>Equations:</strong>
      {bulletList(kg.equation, (e) => {
        const label = (e as Record<string, string>).label ?? "";
        const sym = (e as Record<string, string>).symbolic ?? "";
        return (
          <span>
            {label && <span>{label}: </span>}
            <InlineMath math={sym} />
          </span>
        );
      })}

      <strong>Conditions:</strong>
      {bulletList(kg.condition, (c) => {
        const aw = (c as Record<string, string>).applies_when ?? "";
        const lab = (c as Record<string, string>).label ?? "";
        return <span>{lab ? `${lab} — ` : ""}{aw}</span>;
      })}

      <strong>Simplifications:</strong>
      {bulletList(kg.simplification, (s) => {
        const aw = (s as Record<string, string>).applies_when ?? "";
        const tr = (s as Record<string, string>).transformation ?? "";
        return <span>when {aw}, {tr}</span>;
      })}

      <strong>Definitions:</strong>
      {bulletList(kg.definition, (d) => {
        const c = (d as Record<string, string>).concept ?? "";
        const m = (d as Record<string, string>).meaning ?? "";
        return <span>{c} = {m}</span>;
      })}

      <strong>Variable mappings:</strong>
      {bulletList(kg.variable_mapping, (v) => {
        const t = (v as Record<string, string>).term ?? "";
        const sym = (v as Record<string, string>).symbol ?? "";
        return <span>{t} → {sym}</span>;
      })}
    </aside>
  );
}
