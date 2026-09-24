# Brief: visual review of the vlmkit landing page

- **Directory**: `examples/vlmkit-intro-page/` (the page at <https://mizchi.github.io/vlmkit/>)
- **Pattern**: product landing page — **review and repair**, not a rebuild
- **Languages**: English and Japanese (`?lang=en` / `?lang=ja`), light and dark (`?theme=light` /
  `?theme=dark`)

## Why this round exists

The landing page is gated — `check integrity` and `check a11y contrast` on four locale × theme
states, `check copy --manifest`, `check design` — and every one is green. What it has never had is a
record of anyone **looking** at it. Its earlier visual findings survive only as sentences in commit
messages, with no picture of what was looked at, so nobody can tell which judgments were made by
eye and whether they still hold. This round is the first one with pictures.

## The job

1. Serve the page: `node examples/vlmkit-intro-page/server.mjs` in the background (port 4190). It
   uses ES modules, so it needs the server; take shots of `http://127.0.0.1:4190/?lang=…&theme=…`.
2. Start the log in the page's own directory:
   `node examples/sites/judge.mjs examples/vlmkit-intro-page init --title "vlmkit landing page" --pattern "product landing page (review)" --brief examples/sites/briefs/landing-review.md`
3. Look at the whole page — full page at desktop (1280), tablet (768) and phone (375), in both
   languages and both themes — plus its interactive states: the language and theme toggles, the
   header on a phone, the command deck / scenario controls, every disclosure. Read every screen and
   write what you see. Judge it as the first page a developer sees of this project: does it say what
   vlmkit is and why they should care within one screen; is the hierarchy clear; does the Japanese
   version wrap and space as well as the English; is anything broken, cramped, clipped, misaligned,
   inconsistent or dated?
4. Run the page's existing gate matrix through the judge — `gate gates run --config vlmkit.gates.json`,
   `gate check copy http://127.0.0.1:4190 --manifest copy.txt`, `gate check design http://127.0.0.1:4190`
   (run from the page's directory, which the judge does for you) — and the gates it has never been
   through: `check composition`, `check color`, `check a11y focus`, `check a11y touch`,
   `check interactions`, `check breakpoints --sweep`, `scan scroll`.
5. Fix what you find in the page's own files (`index.html`, `styles.css`, `content.js`, `app.js`,
   `preferences.js`, `scenarios.js`, `copy.txt`). Keep its contract tests green —
   `pnpm exec vitest run examples/vlmkit-intro-page/` — and keep both languages in step: copy lives in
   `content.js`, and `copy.txt` is the manifest the page is held to.
6. Finish with a final round: the gate matrix and the new gates, full-page shots of all four states at
   desktop and phone, `check`, `done`.

## Limits

- Edit only `examples/vlmkit-intro-page/`. Do not touch `examples/solitaire/`, the Pages build script
  or the workflow files.
- The page has Playwright VRT baselines under `tests/vlmkit/` that were taken on macOS
  (`*-darwin.png`) and cannot be regenerated here. Do not try; say in your final reply which of them
  your changes would invalidate, so they can be re-taken on a Mac.
- The protocol's rules apply (`examples/sites/PROTOCOL.md`), except that this page predates them:
  it is allowed its ES modules and its server, and there is no brief "Required copy" beyond
  `copy.txt`.

## States to show (final round)

`en-light`, `en-dark`, `ja-light`, `ja-dark` full page at 1280 and 375; tablet in one state; the
header on a phone with any collapsed controls opened; the command deck on another scenario than the
default; keyboard focus visible on the header controls.
