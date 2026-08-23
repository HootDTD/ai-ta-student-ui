"use client";

import { useEffect, useState } from "react";

/**
 * Staged progress for the Done -> grade wait (study-prep design spec B.2).
 *
 * `POST /done` blocks for 6-20s in production (measured: p50 ~8s, a heavy
 * tail past 20s). Until now the only feedback was a spinner on the Done
 * button, which after ~8s reads as a hang and invites a reload mid-grade.
 *
 * The schedule below is CLIENT-side and purely descriptive: it names what the
 * backend is doing at roughly that point in the call. It deliberately does
 * NOT model completion — the last stage is terminal and holds for as long as
 * the request takes, so the UI can never claim the grade is finished before
 * the response actually lands. The reveal is the parent swapping this whole
 * surface for the report; nothing here decides when that happens.
 */

export interface GradingStage {
  /** Stable key + CSS hook. */
  id: string;
  /** Student-facing copy. Present-progressive; never a completion claim. */
  label: string;
  /** Elapsed ms at which this stage becomes the active one. */
  atMs: number;
}

export const GRADING_STAGES: readonly GradingStage[] = [
  { id: "read", label: "Reading your explanation…", atMs: 0 },
  { id: "understand", label: "Checking what Apollo understood…", atMs: 2500 },
  { id: "score", label: "Scoring each topic…", atMs: 6500 },
  // Terminal: holds until the response arrives, however long that is.
  { id: "write", label: "Writing your feedback…", atMs: 12000 },
];

/**
 * The panel stays hidden for this long after the click. A fast (<2s) grade
 * therefore never flashes a stage sequence — under ~0.6s the student sees
 * only the Done button's spinner, exactly the pre-existing behavior — and a
 * grade that returns in 1s shows one honest stage rather than a strobe.
 */
export const GRADING_PANEL_DELAY_MS = 600;

/**
 * Mount only while grading is in flight (the parent gates on its own
 * `grading` state) — mount/unmount IS the start/stop, so there is no stale
 * timer and no stage carried into the next attempt.
 */
export default function ApolloGradingProgress() {
  // -1 = inside the grace delay, render nothing at all.
  const [stage, setStage] = useState(-1);

  useEffect(() => {
    const timers = GRADING_STAGES.map((s, i) =>
      setTimeout(() => setStage(i), Math.max(s.atMs, GRADING_PANEL_DELAY_MS)),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  if (stage < 0) return null;
  const active = GRADING_STAGES[stage];

  return (
    <div
      className="notice apollo-grading"
      data-stage={active.id}
      role="status"
      aria-live="polite"
    >
      <span className="eyebrow">Grading in progress</span>
      {/* Decorative for assistive tech: the whole list is repeated visual
          context, and re-reading four rows on every advance is noise. The
          hidden line below carries the one thing worth announcing. */}
      <ol className="apollo-grading__stages" aria-hidden>
        {GRADING_STAGES.map((s, i) => (
          <li
            key={s.id}
            className="apollo-grading__stage"
            data-state={i < stage ? "past" : i === stage ? "active" : "upcoming"}
          >
            <span className="apollo-grading__dot" />
            {s.label}
          </li>
        ))}
      </ol>
      <p className="apollo-grading__live">{active.label}</p>
      <p className="apollo-grading__note">
        Usually 10–20 seconds. Your report opens on its own — no need to
        refresh.
      </p>
    </div>
  );
}
