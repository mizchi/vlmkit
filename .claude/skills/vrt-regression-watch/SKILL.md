---
name: vrt-regression-watch
description: Run vrt diff in a stateful loop where each run is compared against the previous run's persisted summary, surfacing a `⚠ REGRESSION` banner when the majority of viewports get worse. Designed for periodic CI gates (per-PR or scheduled) where you want "did this change make things worse" as a binary signal, not a one-shot snapshot. Stores summary at `.vrt/last-diff-for-agent.json` by default.
---

# vrt-regression-watch

The same `vrt diff agent` CLI exposes regression flags
(`--previous`, `--persist-summary`, `--no-history`,
`--fail-on-regression`). This skill explains *how* to wire them into a
recurring loop, what state lives where, and what counts as a
regression.

## Invocation

The `vrt` CLI in this repo is invoked **from source**:

```bash
node --experimental-strip-types src/cli/vrt.ts <command...>
# e.g. node --experimental-strip-types src/cli/vrt.ts diff agent report.json --previous prior.json
```

The published binary (`./dist/vrt.mjs` or a globally installed `vrt`)
may lag the source. If it rejects subcommands with
`Unknown command: diff`, the dist is stale — run `pnpm build` or use
the source form. All `vrt ...` invocations below assume one of
these two forms.

## When to use

- CI gate on every PR: "if this PR's diff is worse than main's
  reference, fail."
- Scheduled snapshot of a production URL: "alert me if the rendered
  output drifts."
- Long-running migration: "after each round, did we make forward
  progress or regress?"

## When NOT to use

- One-shot diff with no history: `vrt-visual-diff` (use `--no-history`
  there if you want zero state).
- CSS auto-repair: `vrt-css-fix-loop`.
- First-time setup with no prior baseline: the first run can't detect
  regression — it just establishes the summary. Run twice.

## How regression is detected

After each `vrt diff agent` run, the per-viewport diffRatio is written
to `.vrt/last-diff-for-agent.json`. On the next run:

1. Load that file as the comparison summary.
2. Compare each viewport's current diffRatio against its prior value.
3. If the **majority** of viewports got worse (current > prior by a
   relative threshold), emit the `### ⚠ REGRESSION` banner at the top
   of the Markdown.
4. If `--fail-on-regression` is set, exit 1.

The "majority of viewports" rule prevents a single jittery viewport
from triggering false alarms.

## Quickstart

```bash
# First run: establishes baseline. No banner possible.
vrt diff html before.html after.html --output reports/diff.json
vrt diff agent reports/diff.json --persist-summary .vrt/baseline.json

# Subsequent runs: compare against the persisted summary, fail if regressed
vrt diff html before.html after.html --output reports/diff.json
vrt diff agent reports/diff.json \
  --previous .vrt/baseline.json \
  --persist-summary .vrt/baseline.json \
  --fail-on-regression
```

The default state path is `.vrt/last-diff-for-agent.json`; the example
uses an explicit `.vrt/baseline.json` to show how to keep a stable
reference (e.g. "diff against main's last good run, not against the
PR's previous run").

## State lifecycle

| File | Written by | Read by | Lifetime |
|---|---|---|---|
| `.vrt/last-diff-for-agent.json` | `vrt diff agent` (auto, unless `--no-history`) | next `vrt diff agent` run | persists until manually removed |
| `report.json` | `vrt diff html` / `vrt migration compare` | `vrt diff agent` | per-run; can discard after the Markdown is produced |

Two retention strategies:

- **Local-rolling**: let `.vrt/last-diff-for-agent.json` rewrite each
  run. Catches per-PR regressions ("did this commit make it worse
  than the previous commit").
- **Branch-stable**: commit a snapshot of the JSON (or store it in
  CI artifacts) for `main`, then have PR jobs compare against that
  fixed reference. Catches "did this PR drift main from a known
  good."

## Per-PR CI gate pattern

```yaml
# .github/workflows/visual-regression.yml (sketch)
- name: Restore main's baseline
  uses: actions/cache@v4
  with:
    path: .vrt/baseline.json
    key: vrt-baseline-${{ github.base_ref }}

- name: Render current PR + diff
  run: |
    vrt diff html main.html pr.html --output reports/diff.json
    vrt diff agent reports/diff.json \
      --previous .vrt/baseline.json \
      --no-history \
      --fail-on-regression \
      --out reports/diff.md

- name: Comment on PR
  if: always()
  run: gh pr comment ${{ github.event.number }} --body-file reports/diff.md
```

Why `--no-history`: in CI you don't want the PR-run's summary to
clobber the cached main-summary; pass `--no-history` to skip writes,
or override with `--persist-summary <pr-specific-path>`.

## Flag reference

| Flag | Behaviour |
|---|---|
| `--previous <path>` | Explicit comparison source. Overrides default. |
| `--persist-summary <path>` | Override destination for this run's summary. |
| `--no-history` | Skip both load and write entirely (one-shot mode). |
| `--fail-on-regression` | Exit 1 when regression is detected. |

Default behaviour (none of the above): auto-load and auto-persist
`.vrt/last-diff-for-agent.json` — i.e. local-rolling.

## Reading the banner

```
### ⚠ REGRESSION

3 / 4 viewports got worse vs. previous run:

| viewport | prior | current | Δ |
|---|---|---|---|
| mobile  | 0.012 | 0.084 | +0.072 |
| tablet  | 0.008 | 0.041 | +0.033 |
| desktop | 0.002 | 0.029 | +0.027 |
| wide    | 0.001 | 0.001 |  0     |
```

The Δ column is absolute. A viewport is "worse" if Δ > 0 and the
relative increase exceeds the noise threshold (currently fixed in
`detectRegression`). Fix order is usually mobile → up; mobile
breakage is the most likely user-visible regression.

## Combining with masks

The same `--mask` arg from `vrt diff html` applies. **A regression
banner appearing on a viewport you don't actually care about (e.g.
`wide`) usually means you forgot to mask a flapping element on that
viewport.** Add the selector to `--mask` and re-run; if the banner
disappears, the original signal was noise.

## Failure modes

- First-ever run shows no banner → expected (no prior summary to
  compare). Run twice.
- Banner appears on every run, even with no changes → the page has
  unmaintained dynamic content; pass `--mask` for the flapping
  selectors.
- `--fail-on-regression` exits 1 but the banner says "0 viewports
  got worse" → there's a JSON-vs-Markdown drift bug; re-run with
  `DEBUG_VRT=1` and file an issue.
- Stale summary from months ago → manually remove
  `.vrt/last-diff-for-agent.json` (or your custom path) and re-run.

## Environment

No additional env vars beyond what `vrt diff agent` needs (none for
the pure pixel+CSD path).

## Related skills

- `vrt-visual-diff` — same CLI, no state. Use first to confirm the
  diff looks sensible before wiring it into a watch loop.
- `vrt-migration-eval` — produces `report.json` files that
  `vrt diff agent` can consume just like the html-diff path.
