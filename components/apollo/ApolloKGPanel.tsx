"use client";

import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import type { ApolloKG } from "@/lib/apollo/api";

interface Props {
  kg: ApolloKG;
}

function bulletList<T>(items: T[], render: (item: T, idx: number) => React.ReactNode) {
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

export default function ApolloKGPanel({ kg }: Props) {
  return (
    <aside className="card">
      <div className="eyebrow">Apollo&apos;s understanding</div>
      <h3 className="note" style={{ margin: 0, fontWeight: 600 }}>
        What Apollo has understood so far
      </h3>

      <div>
        <strong>Equations</strong>
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
      </div>

      <div>
        <strong>Conditions</strong>
        {bulletList(kg.condition, (c) => {
          const aw = (c as Record<string, string>).applies_when ?? "";
          const lab = (c as Record<string, string>).label ?? "";
          return (
            <span>
              {lab ? `${lab} — ` : ""}
              {aw}
            </span>
          );
        })}
      </div>

      <div>
        <strong>Simplifications</strong>
        {bulletList(kg.simplification, (s) => {
          const aw = (s as Record<string, string>).applies_when ?? "";
          const tr = (s as Record<string, string>).transformation ?? "";
          return (
            <span>
              when {aw}, {tr}
            </span>
          );
        })}
      </div>

      <div>
        <strong>Definitions</strong>
        {bulletList(kg.definition, (d) => {
          const c = (d as Record<string, string>).concept ?? "";
          const m = (d as Record<string, string>).meaning ?? "";
          return (
            <span>
              {c} = {m}
            </span>
          );
        })}
      </div>

      <div>
        <strong>Variable mappings</strong>
        {bulletList(kg.variable_mapping, (v) => {
          const t = (v as Record<string, string>).term ?? "";
          const sym = (v as Record<string, string>).symbol ?? "";
          return (
            <span>
              {t} → {sym}
            </span>
          );
        })}
      </div>
    </aside>
  );
}
