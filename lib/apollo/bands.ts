// Apollo proficiency bands — the student-facing grade vocabulary
// (study-prep design spec 2026-08-18, §A.1/§A.3).
//
// Letters still travel on the wire (backward compat, teacher surfaces, the
// research corpus) but MUST NOT reach a student surface. Every student-visible
// grade render goes through this module, so there is exactly one place that
// knows the band tokens, their display strings, and the score cuts.

export type ProficiencyBand = "beginner" | "intermediate" | "advanced";

/** Display strings live in the student UI; the wire value is the lowercase
 *  token (spec §A.1). One map — never re-spell these at a call site. */
const BAND_LABEL: Record<ProficiencyBand, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// Cuts FROZEN for the study — never move them mid-study (spec §A.1). These
// mirror the backend's `score_to_band`; the backend remains the source of
// truth and its `band` token always wins. They exist here only for the
// defensive fallback below.
const ADVANCED_FLOOR = 85;
const INTERMEDIATE_FLOOR = 50;

function isBand(value: unknown): value is ProficiencyBand {
  return (
    value === "beginner" || value === "intermediate" || value === "advanced"
  );
}

/** Score (0-100) → band. Mirror of the backend cut table. */
export function scoreToBand(score: number): ProficiencyBand {
  if (score >= ADVANCED_FLOOR) return "advanced";
  if (score >= INTERMEDIATE_FLOOR) return "intermediate";
  return "beginner";
}

/**
 * Resolve the band to display for one graded payload.
 *
 * Precedence: the backend's `band` token wins whenever it is one we recognise.
 * When it is absent — a payload cached from before the band field shipped, or
 * an older backend — we derive from `score`, and ONLY from `score`. When
 * neither is usable the caller gets `null` and must render nothing: falling
 * back to the letter is a spec violation (§A.3), so no path here can produce
 * one. An unrecognised `band` string is treated as missing rather than shown.
 */
export function resolveBand(source: {
  band?: string | null;
  score?: number | null;
}): ProficiencyBand | null {
  if (isBand(source.band)) return source.band;
  const { score } = source;
  return typeof score === "number" && Number.isFinite(score)
    ? scoreToBand(score)
    : null;
}

/** "Beginner" / "Intermediate" / "Advanced". */
export function bandLabel(band: ProficiencyBand): string {
  return BAND_LABEL[band];
}
