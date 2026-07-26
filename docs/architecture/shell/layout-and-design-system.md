---
doc: shell/layout-and-design-system
description: app/layout.tsx + globals.css (+assets)
owns:
  - app/layout.tsx
  - app/globals.css
related: [shell/session-refresh, shared-ui/math-markdown]
last_verified: 2026-07-26
stub: false
---

# Root layout & design system

## Interface
- **`app/layout.tsx`** — server `RootLayout`. Loads Google fonts **Fraunces**
  (`--font-fraunces`, `opsz` axis + italic) and **JetBrains Mono**
  (`--font-jetbrains-mono`); imports `app/globals.css` and
  `katex/dist/katex.min.css` globally; sets metadata title
  `"Hoot - AI Teaching Assistant"`; mounts `<SessionRefresher/>` **once** above
  `{children}`. The `<body>` is bare `className="antialiased"` — no providers,
  no shared header; each page renders its own chrome.
- **`app/globals.css`** (~2900 lines) — `@import "tailwindcss"` plus the
  hand-rolled BEM-ish class library every component/page depends on. No
  importable JS interface: consumers reference class names.

## Data flow
Dark mode = a `dark` class on `<html>` + `localStorage.theme`, toggled inside
`app/page.tsx` (no `next-themes`). `:root` CSS variables carry the light palette;
`html.dark` overrides them.

## Invariants & gotchas
- Class families (catalog, not a rule dump): `module`/`card`/`notice[data-tone]`,
  `eyebrow`/`section-title`/`note`, `ui-button` (+`--done` success-green,
  `--spinner`), `input`/`textarea`/`field-label`, `dropdown*`, `chat-sidebar*`,
  `msg-user`/`msg-ai`, `citation-chip*`, `char-palette*`, `auth-brand*`/
  `boot-screen*`/`auth-screen`/`auth-card`, `empty-greeting`, and the Apollo set
  `apollo-page*`/`apollo-layout*`/`apollo-shell`/`apollo-browse*`/
  `apollo-session-shell`/`apollo-turn*`/`apollo-chat*`/`apollo-finish*`/
  `apollo-kg*`/`kg-pill*`/`apollo-progress-card*`/`apollo-mastery*`/
  `apollo-attempts*`/`apollo-coverage-*`/`apollo-topbar*`, plus the report
  scorecard set `apollo-scorecard*` (header/headline/overall-bar/recap/
  next-step) and `apollo-topic*` (row/glyph/label/bar/credit/body/note/quote,
  status-colored via `data-status`) — added 2026-07-26 for the per-topic
  feedback scorecard (`ApolloReportPanel`).
- **Single label treatment:** use `.eyebrow`; do not hand-roll
  bold-UPPERCASE-gray labels (the two intentional exceptions are the mono
  `citation-chip` label voice and KG-pill card eyebrows).
- Legacy CSS `apollo-topics`/`apollo-topic__*`/`apollo-rubric` is retained but
  now **unreferenced by JS** after `ApolloReportPanel` was slimmed (see
  `apollo/report-panel.md`).
- Load-bearing assets ride here (described, not code-owned): `public/thinking.mp4`
  (owl avatar), `public/*.svg` (default Next), `app/favicon.ico`.

## Related
- [session-refresh.md](session-refresh.md) — the component mounted here.
- [math-markdown.md](../shared-ui/math-markdown.md) — needs the global KaTeX CSS.
