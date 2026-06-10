"use client";

import type { StudentProgress } from "@/lib/apollo/api";

// Tier thresholds mirror apollo/overseer/xp.py::LEVEL_TIERS. If you change
// one, change both — drift here silently miscomputes the progress bar.
const TIERS: ReadonlyArray<{ threshold: number; title: string }> = [
  { threshold: 0,    title: "Apollo Apprentice" },
  { threshold: 300,  title: "Apollo Adept" },
  { threshold: 800,  title: "Apollo Scholar" },
  { threshold: 1600, title: "Apollo Sage" },
  { threshold: 3000, title: "Apollo Archon" },
];

interface Props {
  progress: StudentProgress | null;
}

function formatXp(n: number): string {
  return n.toLocaleString();
}

export default function ApolloProgressCard({ progress }: Props) {
  if (!progress) {
    return (
      <section
        className="apollo-progress-card"
        data-level={1}
        data-loading="true"
        aria-label="Loading your Apollo progress"
      >
        <div className="apollo-progress-card__row">
          <div className="apollo-progress-card__identity">
            <span className="apollo-progress-card__title">Loading progress…</span>
          </div>
          <div className="apollo-progress-card__bar-track" aria-hidden>
            <div className="apollo-progress-card__bar-fill" style={{ width: "0%" }} />
          </div>
          <div className="apollo-progress-card__meta" aria-hidden>&nbsp;</div>
        </div>
      </section>
    );
  }

  const level = progress.level;
  const currentTierThreshold = TIERS[level - 1]?.threshold ?? 0;
  const nextTier = TIERS[level]; // undefined at max level
  const isMax = nextTier == null;

  const percentFilled = isMax
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          ((progress.xp_total - currentTierThreshold) /
            (nextTier.threshold - currentTierThreshold)) *
            100,
        ),
      );

  const xpToNext = isMax
    ? 0
    : Math.max(0, nextTier.threshold - progress.xp_total);

  return (
    <section
      className="apollo-progress-card"
      data-level={level}
      data-max={isMax ? "true" : "false"}
      aria-label={`${progress.title}, level ${level}, ${progress.xp_total} experience points`}
    >
      <div className="apollo-progress-card__row">
        <div className="apollo-progress-card__identity">
          <span className="apollo-progress-card__title">{progress.title}</span>
          <span className="apollo-progress-card__level">
            Level {level}
            {isMax && " · Max"}
          </span>
        </div>

        <div
          className="apollo-progress-card__bar-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percentFilled)}
        >
          <div
            className="apollo-progress-card__bar-fill"
            style={{ width: `${percentFilled}%` }}
          />
        </div>

        <div className="apollo-progress-card__meta">
          <span className="apollo-progress-card__xp">
            {formatXp(progress.xp_total)} XP
          </span>
          <span className="apollo-progress-card__next">
            {isMax
              ? "Highest tier reached"
              : `${formatXp(xpToNext)} to ${nextTier.title}`}
          </span>
        </div>
      </div>
    </section>
  );
}
