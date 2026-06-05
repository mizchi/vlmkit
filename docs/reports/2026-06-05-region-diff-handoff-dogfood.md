# Region diff handoff dogfood (2026-06-05)

## Scenario

Added `fixtures/migration/region-diff-handoff/` with a stable migration page:

- `before.html`: primary CTA background is `#2d69ec`.
- `after.html`: the same `.cta` button background changes to `#f04b4b`.
- DOM, copy, layout, metrics, and secondary action stay unchanged.

This is a focused dogfood case for `migration compare --region-diff`: the
ordinary screenshot diff is small and local, but the handoff should produce an
agent-usable selector/property change.

## Command

```bash
node src/experiments/migration/migration-compare.ts \
  --dir fixtures/migration/region-diff-handoff \
  --baseline before.html \
  --variants after.html \
  --output-dir test-results/dogfood/region-diff-handoff \
  --no-discover \
  --max-viewports 1 \
  --random-samples 0 \
  --region-diff \
  --region-diff-format both \
  --region-diff-max-tokens 800 \
  --no-paint-tree \
  --no-computed-style \
  --no-dom-position-diff \
  --no-component-bbox \
  --no-triptych \
  --no-dom-equivalence \
  --no-baseline-sanity
```

`migration compare` currently uses the three standard viewports when discovery
is disabled, so this produced wide, desktop, and mobile artifacts.

## Result

`Region diff handoff: 3/3 viewport artifact(s)`

All three viewport summaries identified the same change:

| Viewport | Selector | Property | From | To | Selector confidence |
|---|---|---|---|---|---|
| wide | `.cta` | `background-color` | `#366fed` | `#f15353` | medium |
| desktop | `.cta` | `background-color` | `#356fed` | `#f15252` | high |
| mobile | `.cta` | `background-color` | `#316cec` | `#f04f4f` | high |

The report stored these under `diff-report.json.regionDiffs`, with per-viewport
JSON and Markdown artifacts:

- `after-wide-region-diff.{json,md}`
- `after-desktop-region-diff.{json,md}`
- `after-mobile-region-diff.{json,md}`

## Finding

The first run exposed a selector matching weakness: wide viewport initially
matched the VLM bbox to the large ancestor `.launch-panel` because the model's
bbox started slightly above the actual button. The selector scorer now penalizes
huge ancestor elements when they only cover a tiny fraction of their own area,
so a partially overlapped concrete control can win.

The follow-up run confirmed wide now resolves to `.cta`.

## Diff-for-agent handoff

Follow-up command:

```bash
node src/cli/commands/diff-for-agent-cli.ts \
  test-results/dogfood/region-diff-handoff/diff-report.json \
  --no-history \
  --max-viewports 1
```

`diff-for-agent` now renders a `VLM region diff (selector/property handoff)`
section immediately after the viewport diff table. On this dogfood report it
surfaces:

| Viewport | Selector | Property | Baseline → Variant |
|---|---|---|---|
| wide | `.cta` | `background-color` | `#366fed` → `#f15353` |
| desktop | `.cta` | `background-color` | `#356fed` → `#f15252` |
| mobile | `.cta` | `background-color` | `#316cec` → `#f04f4f` |

This is the intended operator experience: the ordinary diff table still says
`layout-shift` / `spacing`, but the next visible section gives the actionable
CSS target before the agent has to inspect PNGs.
