export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const resp = await fetch(`${backend}/reports/ai-use/${encodeURIComponent(params.id)}`);
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('content-type') ?? 'application/json' },
  });
}

