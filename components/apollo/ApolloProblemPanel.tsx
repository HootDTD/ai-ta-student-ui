"use client";

import type { ApolloProblem } from "@/lib/apollo/api";
import MathMarkdown from "@/components/MathMarkdown";

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
      <div className="prose md-body">
        <MathMarkdown>{problem.problem_text}</MathMarkdown>
      </div>
    </section>
  );
}
