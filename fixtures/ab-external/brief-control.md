# CSS regression repair — arm: CONTROL (no vlmkit), scenario v3

## Task

The page served at **http://localhost:4341/** has a CSS regression.
The three PNGs under `baselines/` in this directory show how the page
MUST look (full-page captures at viewports 1280x800, 768x900, 375x700).

Restore the page's appearance by editing **only**
`workspace/css/styles.css`. Do not edit `index.html` or any JS.

## Success criterion

Max per-viewport diff ratio **< 0.01 (1%)** as measured by the fixed
scorer (commands below). You can self-check at any time.

## Verify loop (run from the vlmkit repo root)

```bash
node fixtures/ab-external/harness/capture.mjs \
  --url http://localhost:4341/ \
  --out-dir test-results/ab-external/seed-42s/control/current

node fixtures/ab-external/harness/score.mjs \
  --baseline-dir test-results/ab-external/seed-42s/control/baselines \
  --current-dir  test-results/ab-external/seed-42s/control/current
```

## Allowed tools

- `capture.mjs` / `score.mjs` above (neutral pixel tooling).
- Your own ad-hoc Node scripts using packages resolvable from the
  vlmkit repo root (`playwright`, `pngjs`, `pixelmatch`).
- Reading the baseline / current PNGs directly (you can view images).
- Editing `workspace/css/styles.css`.

## FORBIDDEN — read this carefully

- Any vlmkit CLI or library code: do NOT run or read anything under
  `/Users/mz/ghq/github.com/mizchi/vlmkit/dist/`,
  `/Users/mz/ghq/github.com/mizchi/vlmkit/src/`, or
  `/Users/mz/ghq/github.com/mizchi/vlmkit/packages/`.
- The original template source and anything that encodes the answer:
  - `/Users/mz/ghq/github.com/startbootstrap/` (any path under it)
  - `test-results/ab-external/pristine/`, `.../scratch/`,
    `.../seed-scan/`, `.../baselines/` (top-level one),
    `.../seed-1/` and `.../seed-23m/` (ALL of both — prior, different
    experiments whose workspaces encode this page's original CSS),
    `.../seed-42s/answer-key.json`, `.../seed-42s/treatment/`
  - `fixtures/ab-external/harness/inject-regression.mjs` (the
    regression generator) and `docs/reports/` / `docs/issues-drafts/`
  - Any network fetch (WebFetch/WebSearch/curl to the internet).
- `git` operations to recover file history.

## Budget

**5 rounds.** One round = one batch of CSS edits + one capture+score.
Stop when the success criterion is met or the budget is exhausted.
Log each round (1 line: what you changed, resulting max diff) to
`test-results/ab-external/seed-42s/control/log.md`.

## Deliverable (final message, < 300 words)

1. Final score JSON (all 3 viewports).
2. Rounds used; one line per round.
3. What signal helped you most (concrete example).
4. What tool you wished you had — be specific.
5. Where time went.
