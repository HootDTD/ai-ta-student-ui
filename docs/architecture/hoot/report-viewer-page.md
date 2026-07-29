---
doc: hoot/report-viewer-page
description: app/report/[id]/page.tsx
owns:
  - app/report/[id]/page.tsx
related: [hoot/report-proxies, shell/auth-client]
last_verified: 2026-07-25
stub: false
---

# Report viewer (`app/report/[id]/page.tsx`)

Backend-generated AI-use report viewer (~228 lines, `"use client"`) at
`/report/[id]`.

## Interface
Default `ReportPage()` — reads `id` from `useParams`.

## Data flow
Auth bootstrap (`ensureActiveSession`), then GET `/api/reports/ai-use/{id}` with
`Bearer` -> `{markdown, jsonld, model_fingerprint, prompt_hashes, chat_id,
created_at}`. Renders `markdown` via plain `ReactMarkdown` (no math); warns when
`jsonld.evidence.truncated`; extracts `(#turn-N)` anchors from the markdown into a
"Prompts log" link list (deduped, capped at 12); shows metadata / prompt-hash
cards in a sticky aside. Actions: copy markdown, download `.md`/`.json` (client
`Blob`), Export PDF via GET `/api/reports/ai-use/{id}/pdf`.

## Invariants & gotchas
- **Nothing in the app currently links here** — the chat page's "Generate report"
  is the separate client-side printable one; the POST-create proxy exists but no
  page calls it.

## Related
- [report-proxies.md](report-proxies.md), [auth-client.md](../shell/auth-client.md).
