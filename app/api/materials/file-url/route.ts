export const runtime = 'nodejs';

// Proxy for GET /materials/file-url (citation-chip source links). Forwards
// the id query params and the caller's Authorization header; the backend
// does the membership check and mints the short-lived signed storage URL.
export async function GET(req: Request) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const search = new URL(req.url).search;
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;

  let resp: Response;
  try {
    resp = await fetch(`${backend}/materials/file-url${search}`, {
      headers,
      cache: 'no-store',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown backend connection error';
    return new Response(`Failed to reach backend /materials/file-url: ${msg}`, { status: 502 });
  }

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
