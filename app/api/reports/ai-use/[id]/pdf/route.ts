export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const resp = await fetch(`${backend}/reports/ai-use/${encodeURIComponent(params.id)}.pdf`);
  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/pdf',
      'Content-Disposition': resp.headers.get('content-disposition') ?? `attachment; filename="ai-use-report-${params.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

