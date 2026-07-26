---
doc: shell/build-config
description: package/next/tsconfig/eslint/postcss/ci.yml
owns:
  - package.json
  - next.config.ts
  - tsconfig.json
  - eslint.config.mjs
  - postcss.config.mjs
  - .github/workflows/ci.yml
related: [shell/layout-and-design-system, shell/feature-flags]
last_verified: 2026-07-25
stub: false
---

# Build & tooling config

## Interface
- **`package.json`** — name `ai-ta-ui` v0.1.0, private. Scripts: `dev` =
  `next dev --turbopack -p 3001` (student UI = **port 3001**), `build` =
  `next build`, `start` = `next start`, `lint` = bare `eslint`. Runtime deps:
  next ^15.5.9, react/react-dom 19.1.0, framer-motion, lucide-react,
  react-dropzone, and the math stack (react-markdown + remark-math +
  rehype-katex + katex + react-katex). Dev deps: tailwindcss ^4 (via
  `@tailwindcss/postcss`), eslint ^9 + eslint-config-next 15.5.3, typescript ^5.
- **`tsconfig.json`** — `strict`, `moduleResolution: bundler`, path alias
  `@/*` → repo root (so `@/components`, `@/lib`; `app/lib/auth` is imported both
  as `@/app/lib/auth` and via relative paths).
- **`next.config.ts`** — empty config object (no rewrites, no image domains).
- **`eslint.config.mjs`** — flat config via `FlatCompat`, extends
  `next/core-web-vitals` + `next/typescript`.
- **`postcss.config.mjs`** — single `@tailwindcss/postcss` plugin (Tailwind v4;
  no `tailwind.config`).

## Data flow
`.github/workflows/ci.yml` runs `build` (npm ci → lint → build) aggregated into
the required **`ci-passed`** check. Triggers on push/PR to branches
`[main, staging, ApolloV3]`. A second **`docs`** job runs the architecture
ownership lint; it is **advisory** (`continue-on-error`, not in `ci-passed`)
during the docs restructure and flips to required at W5.

## Invariants & gotchas
- **DRIFT:** the ci.yml header comment (lines 8-9) still calls
  `ApolloV3 = production line, staging = integration, main legacy`. This is
  **stale** — `main` is prod since 2026-07-12 and `ApolloV3` is retired. Document
  the real triggers; do not repeat the comment as truth.
- No UI test runner is wired yet, so there is no per-patch coverage gate here;
  changed UI code must be called out as untested in PRs until one lands.

## Env flags
`NEXT_PUBLIC_*` values are inlined at **build time**, so any client flag is fixed
per built image / per Railway service, not per user (see `feature-flags.md`).

## Related
- [layout-and-design-system.md](layout-and-design-system.md) — Tailwind v4 +
  globals consumed via this PostCSS/tsconfig setup.
- [feature-flags.md](feature-flags.md) — build-time `NEXT_PUBLIC_*` inlining.
