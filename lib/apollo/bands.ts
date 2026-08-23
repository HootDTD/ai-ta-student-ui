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

/** Score (0-100) → band. Mirror of the backend cut table.
 *
 *  Rounds first, because the backend bands an ALREADY-ROUNDED integer. A
 *  fractional score only reaches this fallback from a cached or older payload,
 *  and comparing it raw would disagree with the server on the half-point either
 *  side of a cut: 84.6 is `advanced` on the backend (round → 85) but would
 *  resolve `intermediate` here. Rounding here makes the two tables identical
 *  for every input, not just for integers. */
export function scoreToBand(score: number): ProficiencyBand {
  const rounded = Math.round(score);
  if (rounded >= ADVANCED_FLOOR) return "advanced";
  if (rounded >= INTERMEDIATE_FLOOR) return "intermediate";
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

/** The `--grade-*` design-token family a band tints to. The tokens keep their
 *  letter-shaped names — they are shared, and the five-step scale still exists
 *  for teacher surfaces — so only three of the five are reachable from a
 *  student surface. */
export type BandColorKey = "a" | "c" | "d";

/** Band → token family. `beginner` deliberately takes `d`, not `f`: the softer
 *  end of the scale for the band a student is most likely to land in first. */
const BAND_COLOR_KEY: Record<ProficiencyBand, BandColorKey> = {
  advanced: "a",
  intermediate: "c",
  beginner: "d",
};

/**
 * One visual family per band, for every student surface that tints by grade
 * (browse card + chip, the Done report's accent border and band word).
 *
 * Keying colour off the BAND rather than off a score threshold is the point:
 * the report panel used to flip tone at score ≥ 75, mid-Intermediate, so two
 * Intermediate results could look like a pass and a fail. Read this map — do
 * not re-derive a colour from a score, and do not re-spell the mapping in CSS.
 */
export function bandColorKey(band: ProficiencyBand): BandColorKey {
  return BAND_COLOR_KEY[band];
}
