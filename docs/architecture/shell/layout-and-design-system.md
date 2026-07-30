---
doc: shell/layout-and-design-system
description: app/layout.tsx + globals.css (+assets)
owns:
  - app/layout.tsx
  - app/globals.css
related: [shell/session-refresh, shared-ui/math-markdown]
last_verified: 2026-07-30
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
  scorecard set `apollo-scorecard*` (card shell + header/letter/headline/
  overall-bar/recap/next-step/review — the INTERACTION3 review card +
  `apollo-ask-hoot*` composer affordance live here too) and `apollo-topic*`
  (row/glyph/label/bar/credit/body/note/quote, status-colored via
  `data-status`) — added 2026-07-26 for the per-topic feedback scorecard
  (`ApolloReportPanel`). 2026-07-30: `.apollo-scorecard` became the report
  card's own shell (Hoot-answer-panel look, tone on the left border);
  `.apollo-turn--student` right-aligns `.msg-user` bubbles and Apollo turns
  reuse `.msg-ai`, so `msg-user`/`msg-ai`/`msg-ai__sources` are now shared by
  the Apollo chat, not Hoot-home-only; `.apollo-aside` (serif, tinted) is
  Hoot's distinct speaker card. `.apollo-aside__citations` and the
  `.apollo-turn--aside` wrapper were retired.
- **Grade-band tokens (2026-07-26):** `--grade-{a,b,c,d,f}-{border,bg,solid}`
  in both `:root` and `html.dark` — A/C/F reuse the success/warning/danger
  families, B (olive) and D (burnt orange) sit between so the letters read as
  a continuous scale. Consumed only by `.apollo-browse__card--grade-*` /
  `.apollo-browse__grade--*` / the `.apollo-browse__feedback--*` left rules
  (2026-07-27 in-card feedback panel; see `apollo/browse.md`).
- **Single label treatment:** use `.eyebrow`; do not hand-roll
  bold-UPPERCASE-gray labels (the two intentional exceptions are the mono
  `citation-chip` label voice and KG-pill card eyebrows).
- **Corner language (2026-07-30):** hard corners mean "document" (panels,
  aside cards, chips, scorecard); `.msg-user` is the one rounded element
  (`border-radius: 12px 12px 0 12px`, square corner pointing at the sender) —
  student turns are speech, not document. The only other curves are the
  pill-shaped progress bar tracks. Don't round anything else.
- `.citation-chip__label--link` (2026-07-30) — linkable chips render the label
  as a real `<button>`; the modifier only adds the pointer cursor and strips
  UA button leftovers (see `shared-ui/citation-chip.md`).
- `apollo-topics`/`apollo-topic__*`/`apollo-rubric` are live again — the
  per-topic scorecard rows in `ApolloReportPanel` reuse them (see
  `apollo/report-panel.md`).
- Load-bearing assets ride here (described, not code-owned): `public/thinking.mp4`
  (owl avatar), `public/*.svg` (default Next), `app/favicon.ico`.

## Related
- [session-refresh.md](session-refresh.md) — the component mounted here.
- [math-markdown.md](../shared-ui/math-markdown.md) — needs the global KaTeX CSS.
