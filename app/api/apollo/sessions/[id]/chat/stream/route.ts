export const runtime = 'nodejs';

// SSE sibling of `../route.ts`. Same request body, same auth forwarding — the
// only differences are the upstream path and the Content-Type fallback, which
// matches `app/api/ask/stream/route.ts` because this endpoint is SSE, not JSON.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  // Forward raw body to preserve streaming compatibility
  const body = await req.text();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { id } = await ctx.params;
  const resp = await fetch(`${backend}/apollo/sessions/${encodeURIComponent(id)}/chat/stream`, {
    method: 'POST',
    headers,
    body,
  });

  // `resp.body` is passed through un-buffered, so the backend's per-event
  // flushes reach the browser as they happen. Do not `await resp.text()` here
  // — that would re-serialize the whole turn and delete the latency win.
  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-store',
    },
  });
}
