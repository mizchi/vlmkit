# CSS regression repair — arm: TREATMENT (vlmkit allowed)

## Task

The page served at **http://localhost:4322/** has a CSS regression.
The three PNGs under `baselines/` in this directory show how the page
MUST look (full-page captures at viewports 1280x800, 768x900, 375x700).

Restore the page's appearance by editing **only**
`workspace/css/styles.css`. Do not edit `index.html` or any JS.

## Success criterion

Max per-viewport diff ratio **< 0.01 (1%)** as measured by the fixed
scorer (commands below). You can self-check at any time.

## Verify loop (run from the vlmkit repo root)

```bash
# capture current state (3 viewports)
node fixtures/ab-external/harness/capture.mjs \
  --url http://localhost:4322/ \
  --out-dir test-results/ab-external/seed-1/treatment/current

# score vs baselines
node fixtures/ab-external/harness/score.mjs \
  --baseline-dir test-results/ab-external/seed-1/treatment/baselines \
  --current-dir  test-results/ab-external/seed-1/treatment/current
```

## Allowed tools

- **The vlmkit CLI** — this is the tool under evaluation. Run it as:

  ```bash
  node /Users/mz/ghq/github.com/mizchi/vlmkit/dist/vlmkit.mjs <group> <cmd> --help
  ```

  Commands likely useful here (explore `--help` yourself):
  - `vlmkit diff png <baseline.png> <current.png>` — pixel diff +
    heatmap + clustered regions (no API key needed).
  - `vlmkit diff region --baseline <png> --variant <png>
    --elements-html http://localhost:4322/ --format markdown` — VLM
    names changed regions + suggests selectors. `OPENROUTER_API_KEY`
    is available in your environment.
  - `vlmkit diff html` / `vlmkit diff agent` — URL/file pair diff with
    an agent-friendly Markdown report (needs both sides renderable;
    you only have baseline PNGs, so judge applicability yourself).
- `capture.mjs` / `score.mjs` above (neutral pixel tooling).
- Reading the baseline / current / heatmap PNGs directly.
- Editing `workspace/css/styles.css`.

## FORBIDDEN — read this carefully

- The original template source. This page is built from an OSS
  template; fetching its source from the network or from disk is
  cheating. Concretely, do NOT access:
  - `/Users/mz/ghq/github.com/startbootstrap/` (any path under it)
  - `test-results/ab-external/pristine/`, `.../scratch/`,
    `.../seed-scan/`, `.../baselines/` (top-level one),
    `.../seed-1/answer-key.json`, `.../seed-1/control/`
  - Any network fetch (WebFetch/WebSearch/curl to the internet),
    except the localhost page and VLM API calls made by vlmkit itself.
- `git` operations to recover file history.
- Reading vlmkit's *source* to mine fixture HTML (running the CLI is
  fine; `cat`-ing fixture files under the vlmkit repo is not).

## Budget

**5 rounds.** One round = one batch of CSS edits + one capture+score.
Stop when the success criterion is met or the budget is exhausted.
Log each round (1 line: what you changed, resulting max diff) to
`test-results/ab-external/seed-1/treatment/log.md`.

## Deliverable (final message, < 300 words)

1. Final score JSON (all 3 viewports).
2. Rounds used; one line per round.
3. Which vlmkit signal helped most (concrete example) — and which
   vlmkit output was noise or misleading.
4. What was missing from vlmkit — be specific; this friction is the
   primary deliverable.
5. Total wall-clock feel: where did you spend the most time?
