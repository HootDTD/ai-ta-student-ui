---
doc: ai-ta-student-ui/pages
description: All routes — Hoot chat home, invite-link join flow, Apollo teaching session, AI-use report viewer, and the /api proxy layer to the FastAPI backend
owns:
  - app/page.tsx
  - app/join/**
  - app/apollo/**
  - app/report/**
  - app/api/**
  - app/favicon.ico
related:
  - ai-ta-student-ui/_overview
  - ai-ta-student-ui/components
  - ai-ta-backend/apollo
  - shared/product-context
last_verified: 2026-06-10
stub: false
---

## Module map and file landmarks

- `app/page.tsx` (~1370 lines, `"use client"`) — the main Hoot chat page: auth gate, class picker, chat sidebar, streaming Q&A with citations, image attachments, theme toggle, printable AI-use report generator, and the "Teach Apollo" entry point.
- `app/join/[code]/page.tsx` (`"use client"`) — invite-link landing page; resolves the code, signs the student in/up if needed, auto-redeems, redirects home.
- `app/apollo/page.tsx` — server component that just wraps `ApolloPageClient` in `<Suspense>` (needed because the client uses `useSearchParams`).
- `app/apollo/ApolloPageClient.tsx` (`"use client"`) — the Apollo session screen; orchestrates all `components/apollo/*`.
- `app/report/[id]/page.tsx` (`"use client"`) — backend-generated AI-use report viewer with copy / .md / .json / PDF export.
- `app/api/**/route.ts` — 19 proxy route handlers (no business logic; see Key dependencies for the full table).

## Public interfaces

Page routes:

| Route | Purpose |
|---|---|
| `/` | Hoot chat (sign-in form when logged out) |
| `/join/[code]` | Redeem class invite link |
| `/apollo?session=N` | Apollo teaching session (errors if `session` param missing) |
| `/report/[id]` | View AI-use report by report id |

## Main data flows

1. **Join a course** (`app/join/[code]/page.tsx`): on mount it (a) restores the stored Supabase session and (b) GETs `/api/invite-links/resolve/{code}` (unauthenticated) to fetch `{search_space_id, course_name, role}`. If not signed in, it shows an email/password sign-in / sign-up form titled "Join {course_name}". As soon as a session + resolved link both exist, an effect auto-POSTs `/api/invite-links/redeem/{code}` with the Bearer token; on `success: true` it shows "You're in!" and `router.push("/")` after 1.5s. Errors render the backend `detail` field.

2. **Ask a question + citations render** (`app/page.tsx`): auth bootstrap → fetch `/api/my-classes` (8s AbortController timeout) and auto-select the first class (no classes ⇒ "ask your instructor for a join code" error). On login a fresh client-generated `chat_id` (`chat-` + 8 hex chars) is created. `send()` POSTs `/api/ask/stream` with `{chat_id, search_space_id: selectedClassId, question, attachments: [{name, mime, data_url}]}` (images are base64 data URLs, max 6, ~5MB each, via react-dropzone or paste). The response is parsed as SSE in the browser: `event: status` updates the loading line ("Apollo is {verb} through all resources…", with `/thinking.mp4`), `event: answer` carries `{answer, citations}`, `event: error` carries a message. The assistant message is rendered with ReactMarkdown + remarkMath/rehypeKatex after `normalizeMath()` (converts `\[..\]`/`\(..\)`/bare bracketed TeX to `$`/`$$`) and `parseAnswer()` (strips trailing `Citations:` lines and a `Results:` block). When `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS=1`, `citations` render as `CitationChip`s under the answer. After each send, the sidebar chat list refreshes via GET `/api/chats?search_space_id=...`; clicking an item GETs `/api/chats/{chat_id}` and rehydrates `messages` from `data.turns`; the trash icon DELETEs it. A header menu offers theme toggle, sign out, and "Generate report" — which builds a self-contained printable HTML document client-side (declaration, prompt list, full conversation log, unique citation list, Monash acknowledgement statement) and opens it in a new tab that auto-`window.print()`s. Note: this client-side report is distinct from the backend report at `/report/[id]`.

3. **Apollo teaching session**: from `/`, the "Teach Apollo what you just learned" button (visible once messages exist) calls `startSessionFromHoot(student_id, transcript)` where transcript = all messages joined as `role: content` lines; on success it navigates to `/apollo?session={session_id}` (errorCode `no_matching_concept` shows "Apollo doesn't cover this topic yet."). `ApolloPageClient` then GETs the session state (`getSessionState`) → renders `ApolloProgressCard` (XP/level, fetched via `getStudentProgress(state.student_id)`, non-blocking), `ApolloProblemPanel` (the problem to teach toward), `ApolloChat` (teaching conversation), and `ApolloKGPanel` in an aside showing Apollo's live knowledge graph (`kg` state, updated by every chat response). "I'm done teaching" → `finishTeaching(sessionId)` → swaps the chat for `ApolloReportPanel` (rubric + diagnostic narrative + XP); chat-detected done-intent (`intent_executed`) takes the same path without a second call. From the report, "Teach more and retry" → `retryProblem` + refetch state; "End session" → `endSession` + refetch (status `ended` renders a terminal "Session ended" screen). Progress is refetched after every report so level-ups reflect immediately. `data-apollo-level={level}` is set on `<main>` for CSS theming. Missing `?session=` renders an inline error; "← Return to Hoot" pushes `/`.

4. **View report** (`app/report/[id]/page.tsx`): auth bootstrap, then GET `/api/reports/ai-use/{id}` with Bearer token → `{markdown, jsonld, model_fingerprint, prompt_hashes, chat_id, created_at}`. Renders the markdown via ReactMarkdown, warns if `jsonld.evidence.truncated`, extracts `(#turn-N)` anchors from the markdown into a "Prompts log" link list, and shows metadata/prompt-hash cards in a sticky aside. Actions: copy markdown, download .md / .json (client Blob), and Export PDF via GET `/api/reports/ai-use/{id}/pdf`. Nothing currently links here from the chat page (the chat page's "Generate report" is the client-side printable one); the POST-create proxy exists (see below) but no page calls it.

## Key dependencies

All `app/api/**` handlers share one pattern: read `AI_TA_API_BASE_URL` (500 if missing), forward the request body verbatim plus the incoming `Authorization` header, stream `resp.body` back with `Cache-Control: no-store`. They add no auth of their own — token validation happens in the backend.

| Next route | Methods | Backend path |
|---|---|---|
| `/api/ask` | POST | `/ask` (non-streaming; not used by current pages) |
| `/api/ask/stream` | POST | `/ask/stream` (SSE) |
| `/api/chats` | GET | `/chats?search_space_id=...` (query string passed through) |
| `/api/chats/[chat_id]` | GET / DELETE / POST | `/chats/{chat_id}` |
| `/api/classes` | GET | `/classes` (502 with message on connection failure; not used by current pages — `/` uses my-classes) |
| `/api/my-classes` | GET | `/my-classes` |
| `/api/invite-links/resolve/[code]` | GET | `/invite-links/resolve/{code}` |
| `/api/invite-links/redeem/[code]` | POST | `/invite-links/redeem/{code}` |
| `/api/reports/ai-use/[id]` | GET / POST | `/reports/ai-use/{id}` (POST creates; `id` is the chat_id there) |
| `/api/reports/ai-use/[id]/pdf` | GET | `/reports/ai-use/{id}.pdf` |
| `/api/apollo/sessions/from_hoot` | POST | `/apollo/sessions/from_hoot` |
| `/api/apollo/sessions/[id]` | GET | `/apollo/sessions/{id}` |
| `/api/apollo/sessions/[id]/chat` | POST | `/apollo/sessions/{id}/chat` |
| `/api/apollo/sessions/[id]/done` | POST | `/apollo/sessions/{id}/done` |
| `/api/apollo/sessions/[id]/retry` | POST | `/apollo/sessions/{id}/retry` |
| `/api/apollo/sessions/[id]/end` | POST | `/apollo/sessions/{id}/end` |
| `/api/apollo/sessions/[id]/kg/[entry_id]/challenge` | POST | `.../kg/{entry_id}/challenge` |
| `/api/apollo/sessions/[id]/kg/[entry_id]/paraphrase` | POST | `.../kg/{entry_id}/paraphrase` |
| `/api/apollo/sessions/[id]/kg/[entry_id]/skip` | POST | `.../kg/{entry_id}/skip` |
| `/api/apollo/sessions/[id]/kg/[entry_id]/trace` | GET | `.../kg/{entry_id}/trace` |

Supabase: pages never call Supabase data APIs; only auth via `app/lib/auth.ts` (sign in / sign up / refresh, localStorage persistence).

## Non-obvious conventions

- Apollo's `lib/apollo/api.ts` fetches do **not** attach the Supabase Bearer token (unlike chat/class/report fetches which pass it explicitly); the proxies forward Authorization only if present.
- `chat_id` is generated client-side, not by the backend; the backend persists turns under it (sidebar list filters to `turn_count > 0`).
- Route params are `Promise`-typed (`ctx.params` awaited) — Next 15 convention; keep it when adding handlers.
- `app/page.tsx` contains `console.log` debugging in `handleLoadChat`/`handleDeleteChat`/sidebar handlers (left in intentionally or pending cleanup).
- The Apollo error contract is "NO FALLBACKS": each `error_code` gets explicit copy (see `ApolloErrorSurface`); unknown codes fall to a generic title only as a last resort.
- `state.phase` (`INIT|TEACHING|PROBLEM_REVEAL|SOLVING|REPORT|BETWEEN`) exists on the session payload but `ApolloPageClient` does not currently branch on it — view selection is purely `report`-state vs `status === "ended"`.

## Product context

The student journey: receive an invite link → `/join/[code]` → study by asking Hoot questions at `/` (RAG answers grounded in instructor-uploaded course materials, with citations) → consolidate by teaching Apollo at `/apollo` (learning-by-teaching with a graded rubric and XP progression) → document AI usage via the printable report or `/report/[id]` for academic-integrity declarations.
