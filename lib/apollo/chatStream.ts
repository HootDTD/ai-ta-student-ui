// Streaming transport for the Apollo teaching turn.
//
// Split out of `api.ts` purely for file size — it is the same client, uses the
// same `apolloHeaders`, and produces the same `ChatResponse` and the same
// `ApolloApiError` values as `sendChat`. That equivalence is the point: the
// caller swaps ONE await and keeps a single implementation of turn-state
// handling (see `ApolloChat.handleSend`).
//
// Wire contract (backend `apollo/handlers/chat_stream.py`), SSE frames of
// `event: <name>` + a single-line JSON `data:` that repeats the name:
//
//   received  {session_id}                  — first frame, before any work
//   working   {stage, message}              — 0..n, backend-owned copy
//   reply     {apollo_reply}                — Apollo's final student-visible text
//   complete  {payload}                     — terminal; payload === the body the
//                                             blocking POST .../chat returns
//   error     {status, body, message?}      — terminal; `status`/`body` are what
//                                             the blocking route would have
//                                             returned, so the SAME error codes
//                                             reach the SAME UI copy
//
// Ordering: received → working(accepted) → working* → reply → working* →
// (complete | error). Note the `working*` AFTER `reply`: an auto-done turn
// releases Apollo's reply first and only then announces `working(grading)`,
// so a consumer must not treat `reply` as "no more progress is coming".
// Exactly one terminal event ends every stream; a stream that ends without
// one is a transport-level drop, not a turn outcome.

import { apolloErrorFromBody, apolloHeaders, readErrorBody, type ChatResponse } from "./api";
import { readSseFrames } from "@/lib/sse";

/** Closed vocabulary at time of writing; consumers must tolerate additions. */
export type ChatTurnStage = "accepted" | "reading" | "thinking" | "grading";

/** The one stage with UI semantics rather than just copy: it means the turn
 *  turned into an auto-done and grading is now running behind the reply. */
export const GRADING_STAGE: ChatTurnStage = "grading";

export interface ChatStreamHandlers {
  /**
   * A progress phase. `stage` is a stable token, `message` is backend-owned
   * student-facing copy. `stage` is typed as a plain string on purpose — an
   * unknown future stage must still render its copy rather than vanish.
   */
  onWorking?: (stage: string, message: string) => void;
  /** Apollo's final reply text, released as soon as it is final — before
   *  persistence and before any auto-done grading run. */
  onReply?: (apolloReply: string) => void;
}

/**
 * The stream ended without a terminal event: the connection dropped, the proxy
 * cut it, or the tab lost the network. The turn itself is unaffected — the
 * backend runs it to completion on a detached task and commits — so the honest
 * message is "reload", not "it failed".
 *
 * `replyReleased` records whether Apollo's text had already reached the
 * student before the drop, which decides whether the caller may keep the
 * rendered turn or must roll its optimistic message back.
 */
export class ChatStreamInterruptedError extends Error {
  readonly replyReleased: boolean;

  constructor(replyReleased: boolean) {
    super(
      replyReleased
        ? "The connection dropped while Apollo was finishing this turn. Apollo " +
            "kept what you taught it — reload the page to see the rest."
        : "The connection to Apollo dropped mid-turn. Apollo may still have " +
            "saved this turn — reload the page to check before retyping it.",
    );
    this.name = "ChatStreamInterruptedError";
    this.replyReleased = replyReleased;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Same inputs and same resolved value as `sendChat`, plus progress callbacks.
 * Resolves with the terminal `complete.payload`; throws `ApolloApiError` for
 * both pre-stream HTTP failures and in-band `error` frames, and
 * `ChatStreamInterruptedError` when the stream ends with neither.
 */
export async function sendChatStreamed(
  sessionId: number,
  message: string,
  askHoot?: boolean,
  handlers: ChatStreamHandlers = {},
): Promise<ChatResponse> {
  const res = await fetch(`/api/apollo/sessions/${sessionId}/chat/stream`, {
    method: "POST",
    headers: apolloHeaders(true),
    body: JSON.stringify({ message, ...(askHoot ? { ask_hoot: true } : {}) }),
  });

  // Anything the backend resolves BEFORE the 200 (401/403/404/422, or a proxy
  // failure) is ordinary HTTP and takes the ordinary path — byte-identical to
  // what `sendChat` throws for the same condition.
  if (!res.ok) {
    throw apolloErrorFromBody(await readErrorBody(res), res.status, res.statusText);
  }
  if (!res.body) throw new ChatStreamInterruptedError(false);

  let replyReleased = false;

  for await (const frame of readSseFrames(res.body)) {
    let payload: Record<string, unknown>;
    try {
      payload = asRecord(JSON.parse(frame.data));
    } catch {
      continue; // Malformed data line — skip it, same as Hoot's reader.
    }

    switch (frame.event) {
      case "received":
        // Proof of life only. The very next frame is working(accepted), which
        // carries the copy, so there is nothing to render here.
        break;
      case "working": {
        const stage = payload.stage;
        const copy = payload.message;
        if (typeof stage === "string" && typeof copy === "string") {
          handlers.onWorking?.(stage, copy);
        }
        break;
      }
      case "reply": {
        const text = payload.apollo_reply;
        if (typeof text === "string") {
          replyReleased = true;
          handlers.onReply?.(text);
        }
        break;
      }
      case "complete": {
        const body = payload.payload;
        if (body && typeof body === "object") return body as ChatResponse;
        // Terminal frame with no payload: nothing to reconcile from.
        throw new ChatStreamInterruptedError(replyReleased);
      }
      case "error": {
        const status = typeof payload.status === "number" ? payload.status : 500;
        // `body` is the blocking route's own error JSON. The frame also
        // carries a top-level `message` mirroring `body.message`; use it only
        // as a fallback so a body without one still produces readable copy.
        const body = { ...asRecord(payload.body) };
        if (typeof body.message !== "string" && typeof payload.message === "string") {
          body.message = payload.message;
        }
        // No statusText: this status came from the frame, not from `res`
        // (whose statusText is the stream's own "OK").
        throw apolloErrorFromBody(body, status);
      }
      default:
        break; // Forward-compatible: an unknown event is ignored, not fatal.
    }
  }

  throw new ChatStreamInterruptedError(replyReleased);
}
