---
doc: shell/sse-reader
description: lib/sse.ts shared SSE frame reader
owns:
  - lib/sse.ts
related: [hoot/chat-home-page, hoot/qa-proxies, apollo/api-client, apollo/session-proxies]
last_verified: 2026-08-23
stub: false
---

# Shared SSE frame reader (`lib/sse.ts`)

The app has two streaming surfaces — Hoot Q&A (`POST /api/ask/stream`) and the
Apollo teaching turn (`POST /api/apollo/sessions/{id}/chat/stream`) — and both
backends frame events the same way: `event: <name>\ndata: <json>\n\n`. This
module owns that framing once. It landed 2026-08-23 with the Apollo turn
stream; before it, the Hoot page carried the only copy inline.

## Interface
- `readSseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame>` —
  `for await` over complete frames until the stream ends.
- `parseSseFrame(part: string): SseFrame | null` — one `\n\n`-delimited chunk.
- `SseFrame = {event: string; data: string}` — both always non-empty.

## Data flow
`readSseFrames` buffers decoded chunks, splits on `\n\n`, keeps the trailing
remainder for the next read, and yields each complete frame through
`parseSseFrame` (which reads `event: ` / `data: ` prefixed lines and joins
multiple data lines with `\n`). On exit — normal end, caller `break`/`return`,
or a throw — it cancels the reader, so an early exit releases the connection.

**Framing only.** Event names and payload shapes stay with the caller: Hoot
dispatches `status`/`reasoning`/`token`/`answer`/`error`, Apollo dispatches
`received`/`working`/`reply`/`complete`/`error`. The two vocabularies name the
same concept differently (Hoot's `status` ≈ Apollo's `working`) and nothing
here assumes either — adding a shared event enum would couple two contracts
that only happen to share a wire format.

## Invariants & gotchas
- **Nameless or data-less frames are dropped** (`parseSseFrame` → null): SSE
  comments and keep-alive blanks are not events. This is the pre-existing Hoot
  behavior, preserved deliberately.
- **A trailing partial frame is DROPPED, never flushed.** Half a JSON object is
  not an event, and surfacing one would turn a dropped connection into a
  corrupt turn. Consumers detect a drop by the absence of the terminal event
  they were waiting for — which is exactly how the Apollo client raises
  `ChatStreamInterruptedError` ([api-client.md](../apollo/api-client.md)).
- **Not `EventSource`.** Both endpoints are POSTs carrying an `Authorization`
  header, which the EventSource API cannot send.
- Callers parse `frame.data` themselves and must tolerate malformed JSON — both
  do, by skipping that frame.

## Related
- [chat-home-page.md](../hoot/chat-home-page.md) — Hoot's consumer;
  [qa-proxies.md](../hoot/qa-proxies.md) — its transport.
- [api-client.md](../apollo/api-client.md) — Apollo's consumer
  (`lib/apollo/chatStream.ts`);
  [session-proxies.md](../apollo/session-proxies.md) — its transport.
