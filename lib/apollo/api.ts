// Typed client for Apollo's /api/apollo/* proxy routes.
// Every function either resolves with data or throws ApolloApiError whose
// `errorCode` matches the backend's `error_code` field. UI components
// render each code explicitly (NO FALLBACKS).

export type ApolloErrorCode =
  | "parser_could_not_extract"
  | "filter_rejected"
  | "malformed_equation"
  | "no_matching_concept"
  | "pool_exhausted"
  | "session_frozen"
  | "coverage_grading_failed"
  // P3 — Negotiable OLM
  | "kg_entry_not_found"
  | "review_required"
  | "unknown";

export class ApolloApiError extends Error {
  errorCode: ApolloErrorCode;
  status: number;
  extra: Record<string, unknown>;
  constructor(message: string, errorCode: ApolloErrorCode, status: number, extra: Record<string, unknown> = {}) {
    super(message);
    this.errorCode = errorCode;
    this.status = status;
    this.extra = extra;
  }
}

export interface ApolloProblem {
  id: string;
  concept_id: string;
  difficulty: string;
  problem_text: string;
  given_values: Record<string, number>;
  target_unknown: string;
}

export type ApolloNodeType =
  | "equation"
  | "condition"
  | "simplification"
  | "definition"
  | "variable_mapping"
  | "procedure_step";

export type ApolloEdgeType = "PRECEDES" | "USES" | "DEPENDS_ON" | "SCOPES";

export type ApolloNodeSource = "parser" | "reference" | "system";

// P3 — Negotiable OLM. Three statuses an entry can be in:
//   ACCEPTED — parser-authored, student has not contested.
//   DISPUTED — student flagged this entry as wrong / misheard.
//   DUAL     — system + student each hold a belief (paraphrase or skip).
export type ApolloNodeStatus = "ACCEPTED" | "DISPUTED" | "DUAL";

interface ApolloNodeBase {
  node_id: string;
  attempt_id: number;
  source: ApolloNodeSource;
  // P1 — parser self-confidence in [0, 1]. Default 1.0 on legacy nodes.
  parser_confidence?: number;
  // P3 — negotiation state and student belief (when paraphrased).
  status?: ApolloNodeStatus;
  student_belief?: string | null;
}

export interface EquationNode extends ApolloNodeBase {
  node_type: "equation";
  content: { symbolic: string; label: string; latex?: string; variables?: string[] };
}
export interface ConditionNode extends ApolloNodeBase {
  node_type: "condition";
  content: { applies_when: string; label: string };
}
export interface SimplificationNode extends ApolloNodeBase {
  node_type: "simplification";
  content: { applies_when: string; transformation: string };
}
export interface DefinitionNode extends ApolloNodeBase {
  node_type: "definition";
  content: { concept: string; meaning: string };
}
export interface VariableMappingNode extends ApolloNodeBase {
  node_type: "variable_mapping";
  content: { term: string; symbol: string };
}
export interface ProcedureStepNode extends ApolloNodeBase {
  node_type: "procedure_step";
  content: { action: string; purpose: string };
}

export type ApolloNode =
  | EquationNode
  | ConditionNode
  | SimplificationNode
  | DefinitionNode
  | VariableMappingNode
  | ProcedureStepNode;

export interface ApolloEdge {
  edge_type: ApolloEdgeType;
  from_node_id: string;
  to_node_id: string;
  attempt_id: number;
  source: string;
  from_node_type?: ApolloNodeType | null;
  to_node_type?: ApolloNodeType | null;
}

export interface ApolloKG {
  nodes: ApolloNode[];
  edges: ApolloEdge[];
}

export interface ApolloSessionState {
  session_id: number;
  student_id: string;
  concept_cluster_id: string;
  status: "active" | "paused" | "ended";
  phase: "INIT" | "TEACHING" | "PROBLEM_REVEAL" | "SOLVING" | "REPORT" | "BETWEEN";
  problem: ApolloProblem | null;
  kg: ApolloKG;
  messages: Array<{ role: string; content: string; turn_index: number }>;
}

export interface ChatResponse {
  apollo_reply: string;
  kg_entries_added: number;
  kg: ApolloKG;
  // Item #5: when the chat handler classifies a non-teaching intent
  // above the confidence threshold, it stashes a pending intent and
  // replies with a confirmation prompt. The student's next turn either
  // affirms (executes the intent) or falls through to teaching.
  intent_pending?: {
    intent: "done" | "restart" | "next" | "return_to_hoot" | "help" | "off_topic";
    confidence: number;
  };
  // When a pending `done` is affirmed, the handler dispatches handle_done
  // inline and returns the result here so the UI can switch to the report
  // view without a second round-trip.
  intent_executed?: {
    intent: "done";
    result: DoneResponse;
  };
}

export interface RubricAxis {
  score: number;
  letter: string;
  present?: boolean;
}

export interface Rubric {
  overall: { score: number; letter: string };
  procedure: RubricAxis;
  justification: RubricAxis;
  simplification: RubricAxis;
}

export interface ProgressEnvelope {
  xp_earned: number;
  xp_before: number;
  xp_after: number;
  level_before: number;
  level_after: number;
  level_up: boolean;
  title_after: string;
  // Percent (0-100) of the way through the current tier.
  level_progress_pct: number;
  // XP remaining to reach the next tier; null when at max level.
  xp_to_next_level: number | null;
}

export interface DoneResponse {
  rubric: Rubric;
  diagnostic_narrative: string;
  coverage: {
    per_step: Record<string, string>;
    procedure_scores: Record<string, number>;
    // Item #10: optional per-ref confidence; absent on older backends.
    confidences?: Record<string, number>;
  };
  // Item #9: structured progress envelope is the source of truth for
  // level / threshold display. Frontend renders these fields directly
  // — no formula duplication.
  progress?: ProgressEnvelope;
  // Flat fields (kept during the FE migration window so older clients
  // still render). Prefer `progress.*` going forward.
  xp_earned?: number;
  xp_before?: number;
  xp_after?: number;
  level_before?: number;
  level_after?: number;
  level_up?: boolean;
}

export interface StudentProgress {
  student_id: string;
  xp_total: number;
  level: number;
  title: string;
  next_tier_threshold: number | null;
}

async function _handle(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  const code = (body["error_code"] as ApolloErrorCode) ?? "unknown";
  const message = (body["message"] as string) ?? `${res.status} ${res.statusText}`;
  throw new ApolloApiError(message, code, res.status, body);
}

export async function startSessionFromHoot(studentId: string, hootTranscript: string): Promise<{
  session_id: number;
  problem: ApolloProblem;
}> {
  const res = await fetch("/api/apollo/sessions/from_hoot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ student_id: studentId, hoot_transcript: hootTranscript }),
  });
  return (await _handle(res)) as { session_id: number; problem: ApolloProblem };
}

export async function getSessionState(sessionId: number): Promise<ApolloSessionState> {
  const res = await fetch(`/api/apollo/sessions/${sessionId}`);
  return (await _handle(res)) as ApolloSessionState;
}

export async function sendChat(sessionId: number, message: string): Promise<ChatResponse> {
  const res = await fetch(`/api/apollo/sessions/${sessionId}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return (await _handle(res)) as ChatResponse;
}

export async function finishTeaching(sessionId: number): Promise<DoneResponse> {
  const res = await fetch(`/api/apollo/sessions/${sessionId}/done`, { method: "POST" });
  return (await _handle(res)) as DoneResponse;
}

export async function retryProblem(sessionId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/apollo/sessions/${sessionId}/retry`, { method: "POST" });
  return (await _handle(res)) as { ok: boolean };
}

export async function endSession(sessionId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/apollo/sessions/${sessionId}/end`, { method: "POST" });
  return (await _handle(res)) as { ok: boolean };
}

export async function getStudentProgress(studentId: string): Promise<StudentProgress> {
  const res = await fetch(`/api/apollo/progress/${encodeURIComponent(studentId)}`);
  return (await _handle(res)) as StudentProgress;
}

// ---------------------------------------------------------------------
// P3 — Negotiable OLM. Three move endpoints + trace lookup.
//
// challenge / paraphrase / skip each return the updated KG entry plus
// the full KG envelope so the panel can re-render without a second
// fetch. trace returns the chronological audit log of moves on one
// entry (read-only, used by the "Apollo's wiring" trace card).
// ---------------------------------------------------------------------

export type NegotiateMove = "challenge" | "paraphrase" | "skip";

export interface NegotiateResponse {
  entry: ApolloNode;
  kg: ApolloKG;
  move: NegotiateMove;
}

export interface NegotiationTraceMove {
  actor: "student" | "parser" | "system";
  move: NegotiateMove;
  payload: Record<string, unknown>;
  created_at: string | null;
}

export interface NegotiationTrace {
  node_id: string;
  moves: NegotiationTraceMove[];
  source_utterance: string | null;
}

// P3.6 — Done-gate review payload (returned in 422 body).
export interface ReviewRequiredEntry {
  entry_id: string;
  type: ApolloNodeType;
  reason: "low_confidence" | "disputed";
  summary: string;
}

export async function challengeEntry(
  sessionId: number,
  entryId: string,
  reason: string,
): Promise<NegotiateResponse> {
  const res = await fetch(
    `/api/apollo/sessions/${sessionId}/kg/${encodeURIComponent(entryId)}/challenge`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  return (await _handle(res)) as NegotiateResponse;
}

export async function paraphraseEntry(
  sessionId: number,
  entryId: string,
  surfaceForm: string,
): Promise<NegotiateResponse> {
  const res = await fetch(
    `/api/apollo/sessions/${sessionId}/kg/${encodeURIComponent(entryId)}/paraphrase`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface_form: surfaceForm }),
    },
  );
  return (await _handle(res)) as NegotiateResponse;
}

export async function skipEntry(
  sessionId: number,
  entryId: string,
): Promise<NegotiateResponse> {
  const res = await fetch(
    `/api/apollo/sessions/${sessionId}/kg/${encodeURIComponent(entryId)}/skip`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
  );
  return (await _handle(res)) as NegotiateResponse;
}

export async function getEntryTrace(
  sessionId: number,
  entryId: string,
): Promise<NegotiationTrace> {
  const res = await fetch(
    `/api/apollo/sessions/${sessionId}/kg/${encodeURIComponent(entryId)}/trace`,
  );
  return (await _handle(res)) as NegotiationTrace;
}
