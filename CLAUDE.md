# AI-TA Student UI

Next.js 15 App Router app — the student-facing client of Hoot (chat with
citation-backed answers, invite-link course join, the Apollo teaching session,
and the AI-use report viewer). Talks to the FastAPI backend (port 8000 in dev)
through `/api` proxy routes; auth via Supabase.

> This repo is part of the Hoot AI-TA workspace. If a workspace-level
> `CLAUDE.md` wasn't loaded (session opened inside this repo), read
> `../ai-ta-backend/docs/shared-architecture/README.md` for the full cross-repo
> doc map, conventions, security, and product context.

## Doc tree — navigate docs first, code second

`docs/architecture/` describes this repo's code; each doc declares `owns:`
globs in its frontmatter and is the authority on those files:

- `docs/architecture/_overview.md` — config, entry layout, env vars, backend proxy pattern, Supabase client, lib utilities
- `docs/architecture/pages.md` — all routes: chat home, join flow, Apollo session, report viewer, `/api` proxy layer
- `docs/architecture/components.md` — `components/**` incl. the `components/apollo/` subtree

Never read a source file to understand the *system* — that's what the docs are
for. Read code only to make the change.

**Drift contract:** before editing a source file, load its owner doc. After
editing code, update the owner doc in the same commit and bump
`last_verified`. Stale docs are worse than no docs.

## Dev

```bash
npm run dev   # port 3001
```

Backend must be running on :8000 (see `../ai-ta-backend/CLAUDE.md`).
