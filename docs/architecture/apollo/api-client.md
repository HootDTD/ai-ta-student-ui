---
doc: apollo/api-client
description: lib/apollo/api.ts (types + fetchers hub) + bands.ts + chatStream.ts
owns:
  - lib/apollo/api.ts
  - lib/apollo/bands.ts
  - lib/apollo/chatStream.ts
related: [shell/auth-client, shell/sse-reader, shell/feature-flags, apollo/error-surface, apollo/session-proxies, apollo/practice-proxies, apollo/kg-proxies, hoot/qa-proxies, apollo/progress-card, apollo/chat]
last_verified: 2026-08-23
stub: false
---

# Apollo API client (`lib/apollo/api.ts`)

Monolith-hub (R2): the Apollo type + fetch contract (~568 lines) — the most-imported module in the
UI. Every Apollo component and both Apollo pages import from it; other Apollo docs reference its
types rather than redefining them.

## Interface
**Types.** `ApolloErrorCode` union (`parser_could_not_extract | filter_rejected |
malformed_equation | no_matching_concept | pool_exhausted | session_frozen |
coverage_grading_failed | kg_entry_not_found | problem_not_found | unknown`) — **mirrors backend
`error_code` strings** (change both sides together). Class `ApolloApiError(message, errorCode,
status, extra)`. Domain models: `ApolloProblem` (carries `target_unknown` + `given_values`), the
`ApolloNode` discriminated union (equation / condition / simplification / definition /
variable_mapping / procedure_step, each with typed `content`) over `ApolloNodeBase` (`node_id`,
`attempt_id`, `source` parser|reference|system, `parser_confidence?`, `status`
ACCEPTED|DISPUTED|DUAL, `student_belief?`), `ApolloEdge` (PRECEDES|USES|DEPENDS_ON|SCOPES),
`ApolloKG {nodes, edges}`, `ApolloSessionState` (`phase`
INIT|TEACHING|PROBLEM_REVEAL|SOLVING|REPORT|BETWEEN, `messages[].intent?` — reload tag, e.g.
`"reference_aside"` — and `messages[].aside?:ChatAside`, the citation payload the backend rebuilds
from stored row metadata so reloaded aside cards keep their chips; absent on pre-metadata rows;
plus optional `graded_topic_total?`/`open_graded_topics?` mirroring the chat response so a reload
rehydrates the P2.2 meter/Done guard), `CoveredTopic`, `ChatAside` (INTERACTION4: `text`,
`citations:CitationMeta[]` — reuses Hoot's `/ask` citation type rather than redefining it,
`in_scope`), `ChatResponse` (`apollo_reply`, `kg`, `covered_topics?`,
`graded_topic_total?`/`open_graded_topics?` (P2.2 grading-fix contract, 2026-08-07 — graded
reference nodes in total vs still-open in the tally; both optional so an older backend just hides
the meter), `intent_pending?`, `intent_executed?{intent:'done', result:DoneResponse} |
{intent:'reference_question', aside_count:number}`, `message_kind?:'reference_aside'`,
`aside?:ChatAside`), `Rubric`/`RubricAxis`, `ProgressEnvelope`, `TopicCredit`/`TopicMisconception`
(flag-gated topic grading; `TopicCredit.evidence_span?` = verbatim gated student quote, backend PR
#200; `TopicCredit.status` gained `'unprobed'` and `TopicCredit.reference_text?` was added
2026-08-07 — see [report-panel.md](report-panel.md)), `TopicFeedbackItem`/`DoneFeedback`
(structured scorecard feedback: `headline`, per-topic `note`+code-gated `quote|null`+optional
`review?:TopicReviewPointer[]` (INTERACTION3, max 3, `{doc_id, label, page, upload_id?}` —
`upload_id` feeds the citation chip's source-PDF link; `doc_id` doubles as its fallback key),
deterministic `recap[]`, `next_step`), `DoneResponse` (rubric + `diagnostic_narrative` + coverage +
`progress?` + flat `xp_*` migration fields + `topics?` + `feedback?` — feedback served only
alongside non-empty topics and only on diagnostic-LLM success; feedback ⇒ topics, never the
reverse), `StudentProgress`(+`Detailed`), `ConceptMastery`/`RecentAttempt`,
`Negotiate*`/`NegotiationTrace` types, `ApolloProblemSummary` (browse cards; `grade?:
ApolloProblemGrade | null` = `{score, letter, band?, feedback?}`, the student's best served grade
plus that same attempt's Done-time narrative — both optional so older backends without the fields
behave like null).

**Proficiency bands (`lib/apollo/bands.ts`, study-prep spec §A.1/§A.3, 2026-08-23)** — the
student-facing grade vocabulary; the only module that decides what a student sees in place of a
letter. Exports `ProficiencyBand` (`beginner|intermediate|advanced`, the lowercase wire tokens),
`scoreToBand(score)` (cuts ≥85 / ≥50 / else — mirrors backend `score_to_band`, **frozen for the
study**; it `Math.round`s first because the backend bands an already-rounded int, so 84.6 must
resolve `advanced` here too), `resolveBand({band?, score?})` → band or `null`, `bandLabel(band)` →
"Beginner"/"Intermediate"/"Advanced" (display strings live here and nowhere else), and
`bandColorKey(band)` → `BandColorKey` (`"a"|"c"|"d"`): the one band→`--grade-*` token family map,
advanced→`a`, intermediate→`c`, beginner→`d` (`beginner` takes the softer `d`, not `f`). Every
surface that tints by grade reads that map — the browse card + chip and the report panel's
`data-grade` — so a band looks the same everywhere and no colour is ever re-derived from a score
threshold. Wire field is `band?: string | null` beside `letter` on `Rubric.overall`,
`ApolloProblemGrade` and `RecentAttempt` — typed loosely on purpose (untrusted network data),
narrowed by `resolveBand`.

**Streaming turn transport (`lib/apollo/chatStream.ts`, 2026-08-23).** Split out of `api.ts` by
file size only — same `apolloHeaders`, same `ChatResponse`, same `ApolloApiError` values as
`sendChat`. `sendChatStreamed(sessionId, message, askHoot?, {onWorking, onReply})` POSTs
`.../chat/stream` and reads SSE frames through [sse-reader.md](../shell/sse-reader.md). Events:
`received` (proof of life), `working {stage, message}` (backend-owned copy; `stage` is passed
through as a plain string so an unknown future stage still renders), `reply {apollo_reply}`
(Apollo's final text, released before persistence and before any auto-done grading run), and the
terminal `complete {payload}` / `error {status, body, message?}`. Ordering is `received →
working(accepted) → working* → reply → working* → terminal` — **`working` can follow `reply`**
(auto-done announces `grading` after releasing the reply), so a consumer must not treat `reply` as
"no more progress is coming". Also exports `ChatTurnStage` (`accepted|reading|thinking|grading`)
and `GRADING_STAGE`.

**Fetchers** (all same-origin `/api/apollo/*` except `listMyClasses`):
- Session lifecycle: `startSessionFromHoot`, `getSessionState`, `sendChat(sessionId, message,
  askHoot?)`, `finishTeaching`, `retryProblem`, `endSession`. `askHoot` (INTERACTION4's "Ask Hoot"
  button, [chat.md](chat.md)) adds `ask_hoot: true` to the request body only when true — normal
  teaching submits' body is unchanged. `ApolloSessionState` carries optional `ask_hoot_available`
  (backend aside gate: INTERACTION4 + concept allowlist); absent = hidden, so older backend
  payloads fail closed.
- Standalone browse/practice: `listConcepts`, `listProblems`, `startSession`, `nextProblem`,
  `restartProblem`, `getStudentProgressDetailed`.
- P3 negotiation: `challengeEntry`, `paraphraseEntry`, `skipEntry`, `getEntryTrace`.
- `listMyClasses()` hits **Hoot's** `/api/my-classes` and hand-rolls its own `res.ok` check (that
  route lacks the `{error_code, message}` shape).

## Data flow
Every non-2xx funnels through module-private `_handle()` → exported `apolloErrorFromBody(body,
status, statusText?)` → throws `ApolloApiError` built from the body's `error_code`/`message`.
Exported `apolloHeaders(withBody?)` builds a `Bearer` header from `loadStoredSession()` +
`authHeaders()` (shell/auth-client), so **Apollo fetches are authenticated** — the proxies only
forward `Authorization` if present. Both are exported (rather than module-private, as they were
before 2026-08-23) for `chatStream.ts` only.

`chatStream.ts` throws the SAME error values as the blocking route, on purpose: pre-stream HTTP
failures (401/403/404/422) go through `apolloErrorFromBody` directly, and an in-band `error` frame
carries the status and error JSON the blocking route WOULD have returned, so it goes through the
same factory — one mapping, no parallel copy that can drift. Its one distinct failure is
`ChatStreamInterruptedError` (a plain `Error`, not an `ApolloApiError`): the stream ended with no
terminal event, i.e. the connection dropped. Its `replyReleased` flag records whether Apollo's text
had already reached the student, which is what lets the caller decide between rolling the turn back
and keeping it ([chat.md](chat.md)).

## Invariants & gotchas
- Comment policy at top: the UI renders each error code explicitly, **NO FALLBACKS** (see
  `apollo/error-surface.md`).
- **`sendChat` and `sendChatStreamed` must stay interchangeable.** They take the same arguments and
  resolve to the same `ChatResponse` (the stream's terminal `complete.payload` IS the blocking
  route's body), because the turn-streaming kill switch
  ([feature-flags.md](../shell/feature-flags.md)) swaps one for the other at a single call site. A
  field added to one transport's result and not the other is a bug in the pair, not a feature.
- The `ApolloErrorCode` union and `ApolloProgressCard`'s XP tiers are frontend copies of backend
  contracts — keep in sync.
- Same for the 2026-08-07 grading-fix fields (`graded_topic_total`, `open_graded_topics` on BOTH
  `ChatResponse` and `ApolloSessionState`, `TopicCredit.reference_text`, status `'unprobed'`):
  every one is optional here, so the UI degrades to its pre-P2 rendering against a backend that
  hasn't shipped them yet. The session-state pair is the weaker half of the contract — the brief
  pinned the counts to the chat response only, so until the backend also serves them on the
  snapshot, a mid-attempt reload shows no meter until the next turn.
- **Letters never reach a student surface** (spec §A.3). `letter` stays on every payload (backward
  compat, teacher surfaces, research corpus) but the student UI renders `bands.ts` output only:
  `resolveBand` returns `null` rather than ever falling back to a letter, and a caller given `null`
  renders nothing. A new student-visible grade render that skips `bandLabel` is a spec violation.
- **Neither does the numeric score** (user ruling 2026-08-23). `score`, `topic.credit` and
  `misconception.dock_points` stay on the wire in full resolution and keep feeding logging and the
  research corpus; on a student surface the band is the entire verdict. `score` may be READ —
  `resolveBand` derives from it when `band` is absent — but never printed, and never leaked through
  an `aria-valuenow`/`aria-label` either. Grade quantities only; the coverage counts and the XP
  economy are separate and unaffected.

## Related
- [auth-client.md](../shell/auth-client.md) — token source.
- [error-surface.md](error-surface.md); the proxy leaves ([session-proxies.md](session-proxies.md),
  [practice-proxies.md](practice-proxies.md), [kg-proxies.md](kg-proxies.md));
  [qa-proxies.md](../hoot/qa-proxies.md) (`/api/my-classes`); [progress-card.md](progress-card.md).
- [citation-chip.md](../shared-ui/citation-chip.md) — `CitationMeta`, reused by
  `ChatAside.citations`.
- [sse-reader.md](../shell/sse-reader.md) — framing for `chatStream.ts`;
  [feature-flags.md](../shell/feature-flags.md) — the transport kill switch; [chat.md](chat.md) —
  the one caller that branches between the two transports.
