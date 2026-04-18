"use client";

import type { ApolloProblem } from "@/lib/apollo/api";

interface Props {
  problem: ApolloProblem | null;
}

export default function ApolloProblemPanel({ problem }: Props) {
  if (!problem) {
    return (
      <section style={{ padding: 12, background: "#fffae5", border: "1px solid #d4b800", borderRadius: 6 }}>
        <em>No problem loaded yet.</em>
      </section>
    );
  }
  return (
    <section
      style={{
        padding: 12,
        background: "#fffae5",
        border: "1px solid #d4b800",
        borderRadius: 6,
      }}
    >
      <header style={{ marginBottom: 6 }}>
        <strong>Problem (difficulty: {problem.difficulty})</strong>
      </header>
      <p style={{ margin: "4px 0" }}>{problem.problem_text}</p>
      <div style={{ fontSize: "0.9em", color: "#555" }}>
        <strong>Teach Apollo enough to solve for {problem.target_unknown}.</strong>
      </div>
    </section>
  );
}
