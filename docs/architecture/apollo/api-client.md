---
doc: apollo/api-client
description: lib/apollo/api.ts (types + fetchers hub)
owns:
  - lib/apollo/api.ts
related: [shell/auth-client, apollo/error-surface, apollo/session-proxies, apollo/practice-proxies, apollo/kg-proxies, hoot/qa-proxies, apollo/progress-card]
last_verified: 2026-07-30
stub: false
---

# Apollo API client (`lib/apollo/api.ts`)

Monolith-hub (R2): the Apollo type + fetch contract (~568 lines) — the
most-imported module in the UI. Every Apollo component and both Apollo pages
import from it; other Apollo docs reference its types rather than redefining them.

## Interface
**Types.** `ApolloErrorCode` union (`parser_could_not_extract | filter_rejected |
malformed_equation | no_matching_concept | pool_exhausted | session_frozen |
coverage_grading_failed | kg_entry_not_found | problem_not_found | unknown`) —
**mirrors backend `error_code` strings** (change both sides together). Class
`ApolloApiError(message, errorCode, status, extra)`. Domain models:
`ApolloProblem` (carries `target_unknown` + `given_values`), the `ApolloNode`
discriminated union (equation / condition / simplification / definition /
variable_mapping / procedure_step, each with typed `content`) over `ApolloNodeBase`
(`node_id`, `attempt_id`, `source` parser|reference|system, `parser_confidence?`,
`status` ACCEPTED|DISPUTED|DUAL, `student_belief?`), `ApolloEdge`
(PRECEDES|USES|DEPENDS_ON|SCOPES), `ApolloKG {nodes, edges}`, `ApolloSessionState`
(`phase` INIT|TEACHING|PROBLEM_REVEAL|SOLVING|REPORT|BETWEEN, `messages[].intent?`
— reload tag, e.g. `"reference_aside"` — and `messages[].aside?:ChatAside`, the
citation payload the backend rebuilds from stored row metadata so reloaded aside
cards keep their chips; absent on pre-metadata rows), `CoveredTopic`, `ChatAside`
(INTERACTION4: `text`, `citations:CitationMeta[]` — reuses Hoot's `/ask` citation
type rather than redefining it, `in_scope`), `ChatResponse` (`apollo_reply`, `kg`,
`covered_topics?`, `intent_pending?`, `intent_executed?{intent:'done',
result:DoneResponse} | {intent:'reference_question', aside_count:number}`,
`message_kind?:'reference_aside'`, `aside?:ChatAside`), `Rubric`/`RubricAxis`,
`ProgressEnvelope`, `TopicCredit`/`TopicMisconception` (flag-gated topic grading;
`TopicCredit.evidence_span?` = verbatim gated student quote, backend PR #200),
`TopicFeedbackItem`/`DoneFeedback` (structured scorecard feedback: `headline`,
per-topic `note`+code-gated `quote|null`+optional `review?:TopicReviewPointer[]`
(INTERACTION3, max 3, `{doc_id, label, page, upload_id?}` — `upload_id` feeds
the citation chip's source-PDF link; `doc_id` doubles as its fallback key), deterministic `recap[]`, `next_step`),
`DoneResponse` (rubric + `diagnostic_narrative` + coverage + `progress?` + flat
`xp_*` migration fields + `topics?` + `feedback?` — feedback served only
alongside non-empty topics and only on diagnostic-LLM success; feedback ⇒
topics, never the reverse), `StudentProgress`(+`Detailed`),
`ConceptMastery`/`RecentAttempt`, `Negotiate*`/`NegotiationTrace` types,
`ApolloProblemSummary` (browse cards; `grade?: ApolloProblemGrade | null` =
`{score, letter, feedback?}`, the student's best served grade plus that same
attempt's Done-time narrative — both optional so older backends without the
fields behave like null).

**Fetchers** (all same-origin `/api/apollo/*` except `listMyClasses`):
- Session lifecycle: `startSessionFromHoot`, `getSessionState`,
  `sendChat(sessionId, message, askHoot?)`, `finishTeaching`, `retryProblem`,
  `endSession`. `askHoot` (INTERACTION4's "Ask Hoot" button, [chat.md](chat.md))
  adds `ask_hoot: true` to the request body only when true — normal teaching
  submits' body is unchanged. `ApolloSessionState` carries optional
  `ask_hoot_available` (backend aside gate: INTERACTION4 + concept allowlist);
  absent = hidden, so older backend payloads fail closed.
- Standalone browse/practice: `listConcepts`, `listProblems`, `startSession`,
  `nextProblem`, `restartProblem`, `getStudentProgressDetailed`.
- P3 negotiation: `challengeEntry`, `paraphraseEntry`, `skipEntry`,
  `getEntryTrace`.
- `listMyClasses()` hits **Hoot's** `/api/my-classes` and hand-rolls its own
  `res.ok` check (that route lacks the `{error_code, message}` shape).

## Data flow
Every non-2xx funnels through module-private `_handle()` → throws
`ApolloApiError` built from the body's `error_code`/`message`. Module-private
`apolloHeaders(withBody?)` builds a `Bearer` header from `loadStoredSession()` +
`authHeaders()` (shell/auth-client), so **Apollo fetches are authenticated** — the
proxies only forward `Authorization` if present.

## Invariants & gotchas
- Comment policy at top: the UI renders each error code explicitly, **NO
  FALLBACKS** (see `apollo/error-surface.md`).
- The `ApolloErrorCode` union and `ApolloProgressCard`'s XP tiers are
  frontend copies of backend contracts — keep in sync.

## Related
- [auth-client.md](../shell/auth-client.md) — token source.
- [error-surface.md](error-surface.md); the proxy leaves
  ([session-proxies.md](session-proxies.md), [practice-proxies.md](practice-proxies.md),
  [kg-proxies.md](kg-proxies.md)); [qa-proxies.md](../hoot/qa-proxies.md)
  (`/api/my-classes`); [progress-card.md](progress-card.md).
- [citation-chip.md](../shared-ui/citation-chip.md) — `CitationMeta`, reused by `ChatAside.citations`.
