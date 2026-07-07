"use client";

import type { ApolloProblem } from "@/lib/apollo/api";

interface Props {
  problem: ApolloProblem | null;
}

export default function ApolloProblemPanel({ problem }: Props) {
  if (!problem) {
    return (
      <section className="empty-state">
        <em className="note">No problem loaded yet.</em>
      </section>
    );
  }
  return (
    <section className="module">
      <p className="prose" style={{ margin: 0 }}>
        {problem.problem_text}
      </p>
      <p className="note" style={{ margin: 0 }}>
        Teach Apollo enough to solve for {problem.target_unknown}.
      </p>
    </section>
  );
}
