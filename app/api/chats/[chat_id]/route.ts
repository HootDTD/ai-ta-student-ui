export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ chat_id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const { chat_id } = await ctx.params;
  const resp = await fetch(`${backend}/chats/${encodeURIComponent(chat_id)}`, {
    headers,
    cache: 'no-store',
  });
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ chat_id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const { chat_id } = await ctx.params;
  const resp = await fetch(`${backend}/chats/${encodeURIComponent(chat_id)}`, {
    method: 'DELETE',
    headers,
  });
  if (resp.status === 204) return new Response(null, { status: 204 });
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('content-type') ?? 'application/json' },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ chat_id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const body = await req.text();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { chat_id } = await ctx.params;
  const resp = await fetch(`${backend}/chats/${encodeURIComponent(chat_id)}`, {
    method: 'POST',
    headers,
    body,
  });
  return new Response(resp.body, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
