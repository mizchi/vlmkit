# agent-l adoption log (2026-08-13)

## 0. Baseline
- `cd consumer && pnpm test` → `# pass 3 / # fail 0`, exit 0. That is green.
- Read the app (87 lines total). Eyeball suspects before running anything, so I can
  tell a real find from a lucky guess:
  - `.orders { width: 940px }` — fixed px table width, page has a `max-width: 900px`
    media query. Overflow at mobile is likely.
  - Greys on white: `.who #9a9a9a`, `.hint #a0a0a0`, `.state #8d8d8d`, `th #767676`.
    Several look under 4.5:1.
  - `public/index.html:16` ships `FIXME confirm rounding with finance.` to users.
  - `/api/orders` values move every request (`tick++`) → any pixel baseline over this
    page is nondeterministic by construction. Whatever I commit must not be a
    screenshot baseline.
