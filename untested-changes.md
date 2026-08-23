# Untested changes — Apollo band swap (student UI)

Study-prep design spec §A.3 (2026-08-18), Task 3 of the bands+latency build.

This repo has **no test runner**. Per the workspace standing rule and the
spec's §A.5 gate ("UI has no test runner: list every untested change"), every
behavior changed here is enumerated below with the manual QA that must cover
it on staging. Nothing in this list is covered by an automated test.

Automated checks that DID run: `npx tsc --noEmit` (clean),
`npm run lint` (0 errors; 4 pre-existing warnings in untouched files),
`python scripts/docs/check_owns_coverage.py --check-size` (0 errors) and the
`--check-last-verified` PR-path gate vs `origin/staging` (0 errors).

## New module

**`lib/apollo/bands.ts`** — the single shared band helper. No unit tests exist
for it; the backend counterpart (`score_to_band`) is unit-tested on its side,
and this is a mirror of those cuts.

| Behavior | Expected | How to check |
|---|---|---|
| `scoreToBand` cuts | ≥85 → `advanced`; 50–84 → `intermediate`; <50 → `beginner` | Boundary values 0/29/30/49/50/84/85/100 — verify against the backend's `score_to_band` unit table; the two must not drift |
| `resolveBand` precedence | A recognised served `band` token always wins over `score` | Serve a payload where `band` and `score` disagree; the token must render |
| `resolveBand` fallback | `band` absent → derive from `score` | Old/cached payload with `score` only |
| `resolveBand` unknown token | An unrecognised `band` string is treated as missing, then falls back to `score` | Hand-crafted payload with `band: "expert"` |
| `resolveBand` null case | No band **and** no usable score → `null`; caller renders nothing. **Never** a letter | Payload with `band: null, score: null` |
| `bandLabel` strings | "Beginner" / "Intermediate" / "Advanced" — exact casing | Visual |

## Changed student-visible behavior

### 1. `components/apollo/ApolloReportPanel.tsx` — Done report header
- Header renders the band word (`.apollo-scorecard__band`) instead of the
  letter (`.apollo-scorecard__letter`, class removed).
- When `resolveBand` returns `null` the `<strong>` is **omitted entirely** —
  the header degrades to just the credit bar. Previously the letter always
  rendered.
- UNCHANGED and must be verified as unchanged: the `data-tone`
  success/danger left border (still `score >= 75`), the overall credit bar and
  its `aria-valuenow`, topic scorecard rows, coverage/reveal panel, recap,
  next-step, review chips, the three footer buttons.

### 2. `app/apollo/progress/ProgressClient.tsx` — recent attempts list
- Each row's grade cell shows the band word instead of `letter`.
- `"?"` fallback preserved for an attempt with neither band nor score.
- The optional ` (score)` suffix is **unchanged** (pre-existing behavior; the
  spec did not ask for score to be hidden — see Concerns in the task report).
- The `.map` callback became a block body; row markup is otherwise identical.

### 3. `components/apollo/ApolloBrowse.tsx` — problem-card grade chip
**Not listed in the task brief — found by the mandatory §A.3 grep sweep.** It
was a live student-visible letter render.
- Chip text is the band word, not the letter.
- Chip copy switched to best-grade-wins band vocabulary:
  - `aria-label`: "Your best result for this problem: Intermediate." (+ the
    "Hide/Show your feedback." clause on the clickable variant)
  - `title`: "Your best result: Intermediate" (+ " — click for feedback")
  - was: "Your grade for this problem: B+" / "Your grade: B+"
- Color mapping changed from `letter[0]` → a|b|c|d|f to
  `BAND_COLOR_KEY`: advanced→`a`, intermediate→`c`, beginner→`d`. The `b` and
  `f` color families are now unreachable from the student UI (kept in CSS).
  **A card that used to tint B/olive or F/red now tints C/amber or D/orange.**
- The card tint, the chip, and the in-card feedback panel's left rule all key
  off the same `colorKey`, so they stay consistent.
- A `grade` that resolves to no band degrades to the plain "Tried" badge — the
  same fallback the old unknown-letter path had.

### 4. `lib/apollo/api.ts` — types only, no runtime behavior
- `band?: string | null` added beside `letter` on `Rubric.overall`,
  `ApolloProblemGrade`, `RecentAttempt`. Optional and loosely typed on purpose
  (untrusted network data, narrowed by `resolveBand`).
- `letter` is retained on all three — backward compat, teacher surfaces,
  research corpus.
- `RubricAxis.letter` (procedure/justification/simplification) was left alone:
  it is not rendered anywhere in the student UI.

### 5. `app/globals.css`
- `.apollo-scorecard__letter` → `.apollo-scorecard__band`, `font-size`
  1.5rem → 1.25rem, added `white-space: nowrap`.
- `.apollo-attempts__grade` gained `white-space: nowrap`.
- Comment-only updates on the `--grade-*` token block.

## Manual staging QA checklist (spec §A.5)

Run one full session per band outcome (beginner / intermediate / advanced):

- [ ] Done report header shows the band word, correctly sized, no wrap, and
      no letter anywhere on the panel.
- [ ] Long band word ("Intermediate") does not squash the credit bar at narrow
      viewport widths (≤400px) — the header is a flex row.
- [ ] Browse cards show band chips; card tint, chip color and feedback-panel
      left rule agree; chip click still opens the feedback panel.
- [ ] Chip `title`/`aria-label` read "Your best result: …" — check with a
      screen reader or by hovering.
- [ ] Progress page recent attempts show band words, one line per row.
- [ ] Retry a problem and confirm best-grade-wins: the displayed band never
      moves DOWN across attempts.
- [ ] Coverage meter, Done warning and the reveal panel are visually
      unchanged.
- [ ] Dark mode on all three surfaces.
- [ ] Back-compat: with a pre-band backend payload (or a cached one) the
      surfaces still show a band derived from score — and never a letter.
