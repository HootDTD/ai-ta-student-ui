// Shared Server-Sent-Events frame reader.
//
// Both streaming surfaces in this app speak the SAME wire format, because the
// backend frames them with the same helper shape:
// `event: <name>\ndata: <json>\n\n` (Hoot Q&A: `server.py::_sse_event` behind
// `/api/ask/stream`; the Apollo teaching turn: `apollo/handlers/chat_stream.py`
// behind `/api/apollo/sessions/{id}/chat/stream`). This module owns that
// framing once so the two readers cannot drift. Event vocabulary and payload
// shapes stay with each caller — this layer only hands back raw frames.
//
// Deliberately NOT `EventSource`: both endpoints are POSTs with an
// `Authorization` header, which the EventSource API cannot send.

export interface SseFrame {
  /** The `event:` line, trimmed. Never empty — nameless frames are dropped. */
  event: string;
  /** The `data:` lines joined with `\n`, still raw text. Never empty. */
  data: string;
}

/**
 * Parse one `\n\n`-delimited frame. Returns null for anything that isn't a
 * usable `event:` + `data:` pair (SSE comments, keep-alive blanks, a frame
 * whose data lines are all empty) — callers skip those, which is exactly what
 * the hand-rolled reader this replaces did.
 */
export function parseSseFrame(part: string): SseFrame | null {
  let event = "";
  const dataLines: string[] = [];
  for (const line of part.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
  }
  const data = dataLines.join("\n");
  if (!event || !data) return null;
  return { event, data };
}

/**
 * Yield complete SSE frames from a response body until the stream ends.
 *
 * A trailing partial frame (the connection died mid-frame) is DROPPED rather
 * than flushed: half a JSON object is not an event, and silently surfacing one
 * would turn a dropped connection into a corrupt turn. Callers detect that
 * case by the absence of the terminal event they were waiting for.
 *
 * Cancelling the reader on exit means an early `break`/`return` by the caller
 * releases the connection instead of leaving it dangling.
 */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const frame = parseSseFrame(part);
        if (frame) yield frame;
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}
