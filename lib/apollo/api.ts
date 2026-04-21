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

export interface ApolloKG {
  equation: Array<Record<string, unknown>>;
  definition: Array<Record<string, unknown>>;
  condition: Array<Record<string, unknown>>;
  simplification: Array<Record<string, unknown>>;
  variable_mapping: Array<Record<string, unknown>>;
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

export interface SolverIndicator {
  reached: boolean;
  value?: string;
  missing?: string[];
}

export interface DoneResponse {
  rubric: Rubric;
  solver_indicator: SolverIndicator;
  diagnostic_narrative: string;
  coverage: {
    per_step: Record<string, string>;
    procedure_scores: Record<string, number>;
  };
  // Phase 2 gamification (may be absent if backend is mid-deploy).
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
