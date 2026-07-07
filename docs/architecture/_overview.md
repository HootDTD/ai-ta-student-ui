---
doc: ai-ta-student-ui/_overview
description: Next.js 15 App Router student app ("Hoot") — config, entry layout, env vars, backend proxy pattern, Supabase auth client, and shared lib utilities
owns:
  - "*.{ts,mjs,json}"
  - app/layout.tsx
  - app/globals.css
  - app/lib/**
  - lib/**
  - public/**
related:
  - ai-ta-student-ui/pages
  - ai-ta-student-ui/components
  - shared/product-context
last_verified: 2026-07-07
stub: false
---

## Module map and file landmarks

- `package.json` — package name `ai-ta-ui`, version 0.1.0. Scripts: `dev` = `next dev --turbopack -p 3001` (student UI runs on **port 3001**), `build`, `start`, `lint` (= bare `eslint`). Runtime deps: `next ^15.5.9`, `react`/`react-dom` 19.1.0, `framer-motion` (animations), `lucide-react` (icons), `react-dropzone` (image attachments), `react-markdown` + `remark-math` + `rehype-katex` + `katex` + `react-katex` (markdown/LaTeX rendering). Dev deps: `tailwindcss ^4` via `@tailwindcss/postcss`, `eslint ^9` with `eslint-config-next 15.5.3`, `typescript ^5`.
- `next.config.ts` — empty config object (`const nextConfig: NextConfig = {}`); no rewrites, no image domains, nothing custom.
- `tsconfig.json` — strict mode, `moduleResolution: bundler`, path alias `@/*` → repo root (so `@/components/...`, `@/lib/...`).
- `eslint.config.mjs` — flat config via `FlatCompat`, extends `next/core-web-vitals` + `next/typescript`; ignores `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`.
- `postcss.config.mjs` — single plugin `@tailwindcss/postcss` (Tailwind v4 style, no tailwind.config file).
- `app/layout.tsx` — root layout. Loads Google fonts **Fraunces** (`--font-fraunces`, with opsz axis + italic) and **JetBrains Mono** (`--font-jetbrains-mono`), imports `app/globals.css` and `katex/dist/katex.min.css` globally. Metadata: title "Hoot - AI Teaching Assistant". Body is just `<body className="antialiased">{children}</body>` — no providers, no header; each page renders its own chrome.
- `app/globals.css` — ~1855 lines; the design system. `@import "tailwindcss"` plus a large hand-rolled class library: CSS variables in `:root` with `html.dark` overrides (theme toggled by adding `dark` class on `<html>`), and component classes used throughout (`module`, `card`, `notice` (with `data-tone`), `eyebrow`, `section-title`, `note`, `ui-button` + variants, `input`/`textarea`/`field-label`, `dropdown*`, `chat-sidebar*`, `msg-user`/`msg-ai`, `citation-chip*`, `char-palette*`, `apollo-page*`, `apollo-turn*`, `apollo-kg*`, `kg-pill*`, `done-gate-modal*`, `apollo-progress-card*`, `thinking-indicator*`).
- `app/lib/auth.ts` — hand-rolled Supabase GoTrue client (no `@supabase/supabase-js` dependency). See Public interfaces.
- `lib/apollo/api.ts` — typed client for the Apollo proxy routes (`/api/apollo/*`); defines all Apollo domain types (`ApolloSessionState`, `ApolloKG`, node/edge types, `DoneResponse`, `ProgressEnvelope`, `NegotiateResponse`, etc.) and the `ApolloApiError` class whose `errorCode` mirrors the backend `error_code` field. Comment policy at top: UI renders each error code explicitly, "NO FALLBACKS".
- `public/` — `thinking.mp4` (Apollo owl avatar / thinking animation used on the chat page and Apollo chat), `favicon.ico`, plus default Next SVGs (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`).
- `.github/workflows/ci.yml` — CI: npm ci → lint → build, aggregated into a `ci-passed` required check. Branch model documented in the file: **ApolloV3 = production line (Railway prod)**, `staging` = integration, `main` legacy.
- `.env` — local env file (see Env vars).

## Public interfaces

`app/lib/auth.ts` exports (consumed by `app/page.tsx`, `app/join/[code]/page.tsx`, `app/report/[id]/page.tsx`):

- Types: `StoredSession { access_token, refresh_token?, expires_at?, user_id?, user_email? }`, `SignUpResult { session, requiresEmailConfirmation }`.
- Constants: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_AUTH_ENABLED` (true only if both env vars set), `SUPABASE_REST_URL`.
- `signInWithPassword(email, password)` → POST `{SUPABASE_URL}/auth/v1/token?grant_type=password`.
- `signUpWithPassword(email, password)` → POST `{SUPABASE_URL}/auth/v1/signup`; returns null session + `requiresEmailConfirmation: true` when no access token comes back.
- `refreshSession(refreshToken)` → POST `token?grant_type=refresh_token`.
- `loadStoredSession()` / `saveStoredSession()` / `clearStoredSession()` — localStorage under key `hoot_auth_session_v1`.
- `ensureActiveSession(session)` — returns session as-is if it expires more than 30s from now, otherwise refreshes via refresh_token; returns null on failure.
- `authHeaders(accessToken, includeJsonContentType?)` — Bearer header builder (falls back to anon key).

`lib/apollo/api.ts` exports the Apollo fetch functions (all hit same-origin `/api/apollo/*` proxy routes): `startSessionFromHoot`, `getSessionState`, `sendChat`, `finishTeaching` (Done), `retryProblem`, `endSession`, `getStudentProgress`, the standalone browse surface (`listConcepts`, `listProblems`, `startSession`, `nextProblem`, `restartProblem`, `getStudentProgressDetailed`), and the P3 negotiation moves `challengeEntry`, `paraphraseEntry`, `skipEntry`, `getEntryTrace`. All funnel non-2xx responses through `_handle()` which throws `ApolloApiError(message, errorCode, status, extra)` — **except** `listMyClasses()`, which hits Hoot's shared `/api/my-classes` route (not `/api/apollo/*`) for `ApolloTopBar`'s class switcher and hand-rolls its own `res.ok` check instead, since that route doesn't return the `{error_code, message}` shape. All Apollo fetches attach the Supabase bearer token via the module-private `apolloHeaders()` (built from `loadStoredSession()` + `authHeaders()`) — unlike the note this doc previously carried, Apollo fetches are **not** unauthenticated.

## Main data flows

1. **Auth bootstrap (every page that needs auth)**: on mount → `loadStoredSession()` from localStorage → `ensureActiveSession()` (silent refresh if expiring) → `saveStoredSession()` or `clearStoredSession()`. There is no middleware/SSR auth; auth is entirely client-side and the access token is forwarded manually in `Authorization: Bearer` headers on fetches.
2. **Backend calls**: browser never calls the FastAPI backend directly. Every call goes to a same-origin `/api/*` Next route handler which forwards to `process.env.AI_TA_API_BASE_URL` (default `http://localhost:8000`), passing through the `Authorization` header and streaming the response body back. See `ai-ta-student-ui/pages` for the full proxy route list.
3. **Supabase calls**: only Supabase **Auth** (GoTrue REST endpoints) is called directly from the browser, using `NEXT_PUBLIC_SUPABASE_URL` + anon key. `SUPABASE_REST_URL` is exported but no current code in app/ or components/ queries PostgREST directly (the README mentions older textbook/question recording behavior that is no longer in `app/page.tsx`).

## Key dependencies

Env vars actually read in code:

| Var | Where | Purpose |
|---|---|---|
| `AI_TA_API_BASE_URL` | every `app/api/**/route.ts` (server-side) | FastAPI backend base URL, e.g. `http://localhost:8000`. Routes return 500 "AI_TA_API_BASE_URL missing" if unset. Trailing slashes stripped. |
| `NEXT_PUBLIC_SUPABASE_URL` | `app/lib/auth.ts` | Supabase project URL (currently project `uduxdniieeqbljtwocxy` per `.env`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `app/lib/auth.ts` | Anon key for GoTrue requests. |
| `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS` | `app/page.tsx` | `"1"` enables citation chips under assistant answers. |

Backend endpoints reached (via the proxies): `/ask`, `/ask/stream`, `/chats`, `/chats/{chat_id}`, `/classes`, `/my-classes`, `/invite-links/resolve/{code}`, `/invite-links/redeem/{code}`, `/reports/ai-use/{id}`, `/reports/ai-use/{id}.pdf`, and the Apollo family `/apollo/sessions/from_hoot`, `/apollo/sessions/{id}`, `/apollo/sessions/{id}/chat|done|retry|end`, `/apollo/sessions/{id}/kg/{entry_id}/challenge|paraphrase|skip|trace`, `/apollo/progress/{student_id}`.

## Non-obvious conventions

- **Two lib directories**: `app/lib/` (auth only) and root `lib/` (Apollo API client). Imports use relative paths for `app/lib/auth` (`./lib/auth`, `../../lib/auth`) but the `@/` alias for `lib/apollo/api`.
- No Supabase JS SDK — auth is raw `fetch` against GoTrue REST. Session persistence is a single localStorage key, not cookies, so SSR never sees auth.
- Styling is mostly the custom class system in `globals.css` (BEM-ish names) with Tailwind utilities sprinkled inline; CSS variables like `var(--border)`, `var(--card-fill)` are referenced from Tailwind arbitrary values.
- All proxy route handlers declare `export const runtime = 'nodejs'` and set `Cache-Control: no-store`.
- Dark mode = `dark` class on `<html>` + `localStorage.theme`, toggled in `app/page.tsx` (no next-themes).
- `tsconfig.tsbuildinfo` and `dev-server.log` exist at repo root (build/dev artifacts, not source).

## Product context

Hoot is the **student-facing** web app of the Hoot AI-TA system (teacher UI on port 3002 and FastAPI backend on port 8000 live in sibling repos `ai-ta-teacher-ui/`, `ai-ta-backend/`). Students sign in with Supabase email/password, join a class via instructor invite links, ask course-grounded questions answered by the backend RAG pipeline with citations, then can flip into "Apollo" — a teach-the-AI learning-by-teaching mode — and generate AI-use acknowledgement reports for academic integrity.
