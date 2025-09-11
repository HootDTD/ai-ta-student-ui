# AI-TA UI (Next.js)

## Setup
1. `npm i`
2. Create `.env.local`:
```

AI_TA_API_BASE_URL="[http://localhost:8000](http://localhost:8000)"

```
3. `npm run dev` and open http://localhost:3001

## How it works
- `app/api/ask/route.ts` proxies `POST /api/ask` → `$AI_TA_API_BASE_URL/ask` and streams responses.
- `app/page.tsx` provides a chat UI with drag-drop, paste-to-attach, previews, and streaming answers.
- Images are sent inline as base64 data URLs. Update backend to decode and process.

## Extend
- If backend needs extra fields (e.g., `course_id`, `doc_sets`), add to the `fetch('/api/ask')` body.
- For file uploads to object storage, add `app/api/upload/route.ts` and send returned URLs instead of base64.
