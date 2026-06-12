---
doc: ai-ta-student-ui/components
description: Shared UI components — CitationChip, SpecialCharsPalette, and the components/apollo/ subtree (chat, KG panel, negotiation pills, report, progress, done-gate)
owns:
  - components/**
related:
  - ai-ta-student-ui/_overview
  - ai-ta-student-ui/pages
  - ai-ta-backend/apollo
  - shared/product-context
last_verified: 2026-06-10
stub: false
---

## Module map and file landmarks

All components are `"use client"`. Types come from `@/lib/apollo/api` (the Apollo domain model) and styling from the class system in `app/globals.css`.

- `components/CitationChip.tsx` — citation pill with hover preview.
- `components/SpecialCharsPalette.tsx` — collapsible math-character keypad for textareas.
- `components/apollo/ApolloChat.tsx` — Apollo teaching conversation + composer.
- `components/apollo/ApolloErrorSurface.tsx` — error-code → human copy renderer.
- `components/apollo/ApolloKGPanel.tsx` — "Apollo's understanding" knowledge-graph sidebar.
- `components/apollo/ApolloProblemPanel.tsx` — current problem card.
- `components/apollo/ApolloProgressCard.tsx` — XP/level/tier progress bar.
- `components/apollo/ApolloReportPanel.tsx` — post-Done rubric/grade report.
- `components/apollo/DoneGateModal.tsx` — P3.8 review-required modal (currently unwired; see Non-obvious conventions).
- `components/apollo/KGEntryPill.tsx` — per-KG-entry negotiation wrapper (challenge/paraphrase/skip/trace).
- `components/apollo/KGEntryDispute.tsx`, `KGEntryParaphrase.tsx`, `KGEntryTrace.tsx` — the pill's inline expandable cards.

## Public interfaces

- **`CitationChip`** (named export) — props `{ meta: CitationMeta }` where `CitationMeta = { label, doc_type?, file?, page?, ocr_conf?, bbox?, thumb? }` (type also exported from this file). Renders the label plus a CSS-driven hover preview (`citation-chip__preview`) showing doc type, file, `p. N`, `OCR NN%`, and an optional thumbnail (`next/image`, unoptimized). Consumed by `app/page.tsx` under assistant messages when `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS=1`.
- **`SpecialCharsPalette`** (default) — props `{ onInsert: (ch: string) => void }`. Toggle button (Σ) reveals rows of Greek letters, super/subscripts, operators, relations, brackets; keys use `onMouseDown preventDefault` so the textarea keeps focus and the consumer inserts at the caret. Consumed by `app/page.tsx` and `ApolloChat`.
- **`ApolloChat`** (default) — props `{ sessionId, initialMessages: {role, content}[], onKgUpdate(kg), onDoneClicked(), onDoneFromChat?(result: DoneResponse), disabled? }`. Owns local `messages`/`draft`/`sending`/`error` state. `handleSend` calls `sendChat(sessionId, msg)`; appends Apollo's reply, calls `onKgUpdate(resp.kg)`, and if `resp.intent_executed?.intent === "done"` forwards the embedded `DoneResponse` via `onDoneFromChat` (the chat-affirmed-done shortcut). On error it pops the optimistic student turn and renders `ApolloErrorSurface` inline. Empty state shows the Apollo avatar (`/thinking.mp4`) with the "walk me through the steps" prompt; footer has Send + "I'm done teaching" (→ `onDoneClicked`). Consumed by `ApolloPageClient`.
- **`ApolloErrorSurface`** (default) — props `{ error: ApolloApiError | Error | null, onDismiss? }`. Maps each `errorCode` to a title and a detail sentence interpolating `err.extra` (e.g. `parser_could_not_extract` quotes `extra.utterance`; `pool_exhausted` quotes `extra.difficulty`/`concept_cluster_id`). Non-`ApolloApiError`s get a generic title + `err.message`. Consumed by `ApolloPageClient` and `ApolloChat`.
- **`ApolloKGPanel`** (default) — props `{ kg: ApolloKG, sessionId?: number, pulseEntryId?: string | null, onKgUpdated?(kg) }`. Buckets `kg.nodes` into six sections (Equations via KaTeX `InlineMath` on `content.latex ?? content.symbolic`; Conditions; Simplifications; Definitions; Variable mappings as `term → symbol`; Procedure steps topologically ordered by `PRECEDES` edges with cycle/orphan fallback, annotated with "uses {equation labels}" from `USES` edges). When `sessionId` is provided each entry is wrapped in `KGEntryPill` (negotiation UI); when absent entries render bare (pre-P3 read-only behavior). `pulseEntryId` scrolls the matching `[data-entry-id]` into view. Consumed by `ApolloPageClient` (currently with only `kg` — see Non-obvious conventions).
- **`ApolloProblemPanel`** (default) — props `{ problem: ApolloProblem | null }`. Shows difficulty label (intro/easy/medium/hard → Beginner/Easy/Intermediate/Challenging), `problem_text`, and "Teach Apollo enough to solve for {target_unknown}". Null ⇒ "No problem loaded yet." Consumed by `ApolloPageClient`.
- **`ApolloProgressCard`** (default) — props `{ progress: StudentProgress | null }`. Hardcodes the five XP tiers (0/300/800/1600/3000 → Apprentice/Adept/Scholar/Sage/Archon) explicitly mirroring backend `apollo/overseer/xp.py::LEVEL_TIERS` (comment warns drift silently miscomputes the bar). Computes percent-through-tier and XP-to-next; null ⇒ skeleton. Consumed by `ApolloPageClient`.
- **`ApolloReportPanel`** (default) — props `{ report: DoneResponse, onRetry(), onEnd(), busy? }`. Tone success/danger keyed on `rubric.overall.score >= 75`. Renders overall letter+score, three `AxisRow`s (procedure/justification/simplification) with a unicode block bar (`█▒`, 8 cells), XP line preferring `report.progress.*` over the legacy flat fields, a level-up banner, and the diagnostic narrative with inline `$...$` segments rendered via KaTeX. Buttons: "Teach more and retry" / "End session". Consumed by `ApolloPageClient`.
- **`KGEntryPill`** (default) — props `{ sessionId, node: ApolloNode, children (the entry's surface form, render-prop style), onUpdated?(entry, kg), pulseHint? }`. The student's only handle on negotiation state: confidence dot from `node.parser_confidence` (green ≥0.8 / yellow ≥0.5 / red, legacy default 1.0), status badge ("disputed" for DISPUTED; "your wording" or "skipped" for DUAL depending on `student_belief`), and four buttons — `?` challenge, `✎` paraphrase, `↩` skip (immediate, no card), `…` trace. It owns the API calls (`challengeEntry`/`paraphraseEntry`/`skipEntry`/`getEntryTrace`) and bubbles `(entry, kg)` up via `onUpdated`. Sets `data-entry-id`/`data-entry-status`; `pulseHint` adds `kg-pill--pulse`.
- **`KGEntryDispute`** (default) — props `{ busy, onCancel, onSubmit(reason) }`; free-text reason, max 500 chars (backend contract), char counter.
- **`KGEntryParaphrase`** (default) — props `{ busy, initialValue, onCancel, onSubmit(surfaceForm) }`; max 1000 chars; only the surface wording changes — structural fields are never mutated by the backend.
- **`KGEntryTrace`** (default) — props `{ trace: NegotiationTrace, onClose }`. Read-only "Apollo's wiring" card: source utterance quote + chronological move list (`actor move · time`, with challenge reason / paraphrase text quoted). Deliberately styled in non-Apollo gray voice.
- **`DoneGateModal`** (default) — props `{ entries: ReviewRequiredEntry[], touched: Set<string>, onJumpTo(entryId), onClose(), onRetry() }`. Designed for the P3.6 done-gate: when Done returns 422 `review_required`, list each flagged entry (reason `low_confidence` or `disputed`) with "Jump to entry"; "Re-submit Done" stays disabled until every entry id is in `touched`.

## Main data flows

1. **Citations render**: `app/page.tsx` parses the SSE `answer` event's `citations` array into `CitationMeta[]` and maps them to `CitationChip`s in the message footer; hover reveals the preview card (pure CSS, no fetch).
2. **Apollo teaching turn**: student types in `ApolloChat` (optionally inserting symbols via `SpecialCharsPalette`) → `sendChat` → reply appended, `onKgUpdate(resp.kg)` lifts the new KG to `ApolloPageClient`, which re-renders `ApolloKGPanel` so the student watches Apollo's understanding grow live.
3. **Negotiation move (P3)**: inside `ApolloKGPanel` (when given a `sessionId`), a pill button POSTs challenge/paraphrase/skip → backend returns `{entry, kg, move}` → pill calls `onUpdated(entry, kg)` → panel bubbles `onKgUpdated(kg)` to the page → full KG re-render without a second fetch. Trace is a read-only GET shown inline.
4. **Done → report**: "I'm done teaching" (`onDoneClicked`) or a chat-affirmed done intent (`onDoneFromChat`) produces a `DoneResponse`; `ApolloPageClient` swaps `ApolloChat` for `ApolloReportPanel` and refetches `getStudentProgress()` (no argument — identity from Bearer token) so `ApolloProgressCard` reflects any level-up.

## Key dependencies

- `@/lib/apollo/api` for all Apollo types and fetchers (which hit the `/api/apollo/*` proxies → backend on port 8000; exact backend paths listed in `ai-ta-student-ui/pages`).
- `react-katex` (`InlineMath`) + `katex/dist/katex.min.css` in `ApolloKGPanel` and `ApolloReportPanel`; `next/image` in `CitationChip`.
- `/thinking.mp4` from `public/` as the Apollo avatar in `ApolloChat`.
- No Supabase usage anywhere in `components/`.

## Non-obvious conventions

- **Wiring gap to know about**: `DoneGateModal` is defined but not imported by any page or component, and `ApolloPageClient` renders `<ApolloKGPanel kg={kg} />` without `sessionId`/`pulseEntryId`/`onKgUpdated` — so in the current page wiring KG entries render bare (no negotiation pills) and the done-gate/pulse flows (P3.5–P3.8) are dormant frontend capability awaiting hookup. The components and proxy routes are complete; only the page-level props are missing.
- `MaybePill` in `ApolloKGPanel` is the intentional toggle: `sessionId === undefined` ⇒ pre-P3 read-only rendering preserved for report/legacy contexts.
- `KGEntryPill` is type-agnostic by design — the parent panel decides how each node type's surface form renders and passes it as `children` (render-prop comment in source).
- Char limits (500 dispute / 1000 paraphrase) and the XP tier table are duplicated frontend copies of backend contracts — change both sides together.
- `ApolloReportPanel` keeps fallbacks to flat `xp_*` fields for a backend migration window; prefer `report.progress.*` (Item #9 in source comments).
- Private helpers inside components use a leading-underscore naming style (`_confidenceClass`, `_onChallenge`, `_reasonLabel`).

## Product context

These components implement Apollo's pedagogy: the student is the teacher, the KG panel is Apollo's transparent "open learner model", and the P3 negotiation pills let the student contest what Apollo heard (challenge), restate it (paraphrase), or wave it through (skip) — so grading at Done is against what the student actually meant. The rubric/XP loop (report panel + progress card) gamifies repeated teach-retry cycles.
