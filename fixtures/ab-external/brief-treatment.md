# CSS regression repair — arm: TREATMENT (vlmkit allowed), scenario v3

## Task

The page served at **http://localhost:4342/** has a CSS regression.
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
  --url http://localhost:4342/ \
  --out-dir test-results/ab-external/seed-42s/treatment/current

node fixtures/ab-external/harness/score.mjs \
  --baseline-dir test-results/ab-external/seed-42s/treatment/baselines \
  --current-dir  test-results/ab-external/seed-42s/treatment/current
```

## Allowed tools

- **The vlmkit CLI** — this is the tool under evaluation. Run it as:

  ```bash
  node /Users/mz/ghq/github.com/mizchi/vlmkit/dist/vlmkit.mjs <group> <cmd> --help
  ```

  Useful commands (explore `--help` yourself). New in this build:

  - `vlmkit diff png <baseline.png> <current.png> [--json]
    [--elements-html <url>] [--elements-viewport <WxH>]` — pixel diff
    with, per region: measured colorSamples (median hex on both
    sides), a **translation estimate** (`shift: {dx, dy}` — "content
    moved +36px right"), and — when `--elements-html` points at the
    live page — a **deterministic DOM selector candidate** per region
    (no VLM, no API key). Also reports image dimensions + height
    delta.
  - `vlmkit diff region ...` — VLM region naming (OPENROUTER_API_KEY
    is set; auto-downscales tall captures, auto-retries truncation).
    Judge for yourself whether it adds signal over `diff png`.
- `capture.mjs` / `score.mjs` above (neutral pixel tooling).
- Your own ad-hoc Node scripts using packages resolvable from the
  vlmkit repo root (`playwright`, `pngjs`, `pixelmatch`).
- Reading the baseline / current / heatmap PNGs directly.
- Editing `workspace/css/styles.css`.

## FORBIDDEN — read this carefully

- The original template source and anything that encodes the answer:
  - `/Users/mz/ghq/github.com/startbootstrap/` (any path under it)
  - `test-results/ab-external/pristine/`, `.../scratch/`,
    `.../seed-scan/`, `.../baselines/` (top-level one),
    `.../seed-1/` and `.../seed-23m/` (ALL of both — prior, different
    experiments whose workspaces encode this page's original CSS),
    `.../seed-42s/answer-key.json`, `.../seed-42s/control/`
  - `fixtures/ab-external/harness/inject-regression.mjs` (the
    regression generator) and `docs/reports/` / `docs/issues-drafts/`
  - Any network fetch (WebFetch/WebSearch/curl to the internet),
    except the localhost page and VLM API calls made by vlmkit itself.
- `git` operations to recover file history.
- Reading vlmkit's *source* (running the CLI is fine; `cat`-ing files
  under src/ or packages/ is not).

## Budget

**5 rounds.** One round = one batch of CSS edits + one capture+score.
Stop when the success criterion is met or the budget is exhausted.
Log each round (1 line: what you changed, resulting max diff) to
`test-results/ab-external/seed-42s/treatment/log.md`.

## Deliverable (final message, < 300 words)

1. Final score JSON (all 3 viewports).
2. Rounds used; one line per round.
3. Which vlmkit signal helped most (concrete) — and which vlmkit
   output was noise or misleading.
4. What was missing from vlmkit — be specific; this friction is the
   primary deliverable.
5. Where time went.
