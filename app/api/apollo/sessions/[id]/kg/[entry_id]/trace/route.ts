// P3 — Negotiable OLM. Forwards GET /trace to the backend.
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; entry_id: string }> },
) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;

  const { id, entry_id } = await ctx.params;
  const resp = await fetch(
    `${backend}/apollo/sessions/${encodeURIComponent(id)}/kg/${encodeURIComponent(entry_id)}/trace`,
    { method: 'GET', headers },
  );

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
