"use client";

import type { ApolloProblem } from "@/lib/apollo/api";

interface Props {
  problem: ApolloProblem | null;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  intro: "Intro",
  standard: "Standard",
  hard: "Hard",
};

export default function ApolloProblemPanel({ problem }: Props) {
  if (!problem) {
    return (
      <section className="empty-state">
        <em className="note">No problem loaded yet.</em>
      </section>
    );
  }
  const difficultyLabel =
    DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty;
  return (
    <section className="module">
      <div className="eyebrow">Problem · {difficultyLabel}</div>
      <p className="prose" style={{ margin: 0 }}>
        {problem.problem_text}
      </p>
      <p className="note" style={{ margin: 0 }}>
        Teach Apollo enough to solve for {problem.target_unknown}.
      </p>
    </section>
  );
}
