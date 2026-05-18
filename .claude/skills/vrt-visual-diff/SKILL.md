---
name: vrt-visual-diff
description: Compare two rendered pages (URL pairs or local HTML) and produce a structured Markdown report tailored for coding agents — pixel diff per viewport, per-section diffRatio, computed-style diff split into universal vs. breakpoint-gated, and worst-viewport screenshot paths. Use when the agent just made a UI change and needs to know whether it altered visible output, where it altered it, and which CSS properties drove the change. Works on a single HTML/URL pair without baseline state.
---

# vrt-visual-diff

Two-step workflow:

1. `vrt diff html <baseline> <variant>` — Playwright-driven capture +
   pixel diff + computed-style snapshot. Writes `report.json`.
2. `vrt diff agent report.json` — formats the JSON into one Markdown
   summary an agent can read in a single context window.

The Markdown report layers signal hierarchies so a fresh agent can skim
top-down:

- **Verified deltas (computed-style)** — selector × property changes
  confirmed by DOM, not just pixels. Universal pairs (differ on every
  viewport) come first, breakpoint-gated pairs (differ on a strict
  viewport subset, i.e. a missing `@media` rule) come second.
- **Per-section diffRatio** — pixel diff scoped to each component
  bounding box. Distinguishes "hero shifted" from "every component
  shifted".
- **Per-viewport diffRatio** — raw pixel diff per breakpoint, with
  worst-viewport PNG path inline so the agent can `Read` the image.
- **Heuristic fix candidates** — `selector { property: a → b }` hints
  from the migration compare engine.
- **Regression banner** — if a prior run's summary exists and the
  majority of viewports got worse, a `### ⚠ REGRESSION` block sits
  at the top.

## When to use

- Agent edited CSS / HTML / a component file and wants a one-shot read
  of "what visibly changed."
- Reviewing a refactor PR: "is this a no-op visually, or did it shift
  something?"
- Comparing two URLs (e.g. dev server vs. preview deploy).

## When NOT to use

- Running on a schedule with no prior diff: use `vrt-regression-watch`
  instead (handles `.vrt/last-diff-for-agent.json` lifecycle).
- Component synthesis from screenshots: use `vrt-markup-synth`.
- CSS auto-repair loop: use `vrt-css-fix-loop`.

## Quickstart

```bash
# Local HTML pair
vrt diff html before.html after.html --output reports/diff.json
vrt diff agent reports/diff.json > reports/diff.md

# URL pair (e.g. before/after a code change on the dev server)
vrt diff html \
  --url http://localhost:3000/ \
  --current-url http://localhost:8080/ \
  --output reports/diff.json
vrt diff agent reports/diff.json

# Mask dynamic regions (animation / live data) to suppress false positives
vrt diff html before.html after.html \
  --mask ".marquee-container,.hero-badge,[data-testid='live-counter']" \
  --output reports/diff.json
```

## Useful flags on `vrt diff agent`

| Flag | Purpose |
|---|---|
| `--out <path>` | Write Markdown to a file instead of stdout |
| `--max-viewports N` | Show top-N worst viewports inline (default 1) |
| `--variant <file>` | Restrict report to one variant when comparing N variants |
| `--show-unverified` | Include heuristic fix rows whose value already matches baseline (✗ rows). Default hides them. |
| `--no-history` | Don't load or persist `.vrt/last-diff-for-agent.json` (one-shot mode for CI) |

For regression tracking flags (`--previous`, `--persist-summary`,
`--fail-on-regression`), use `vrt-regression-watch` — the same CLI
exposes them but the watch skill explains the persistence model.

## How to read the report

```
## Verified deltas (computed-style) × viewport
### Universal pairs        ← fix the base rule
### Breakpoint-gated pairs ← fix or add @media rule

## Per-section diffRatio   ← which component changed, not just "the page"
### card-hero    diffRatio 0.124  (worst on mobile)
### card-footer  diffRatio 0.003  (negligible)

## Per-viewport
### mobile      diffRatio 0.082  → diff-mobile.png
### desktop     diffRatio 0.001
```

**Triage order**: universal pairs > breakpoint-gated > per-section >
raw per-viewport. The first non-empty row is almost always the actual
change to inspect.

## Masking is load-bearing

`vrt diff html` re-runs the page in headless Chromium; any animation,
clock, marquee, ad slot, or hash-randomized class will flap on every
run. Pass `--mask <css-selectors>` for everything that isn't
deterministic. Diff% < 0.05 on a clean page with no mask is rare —
treat unexpected baseline noise as a missing mask, not a real diff.

## Environment

No env vars required for pixel + CSD path. The report is purely
deterministic — no VLM / LLM is involved unless the migration-compare
upstream invokes it (which `vrt diff html` does not by default).

## Outputs at a glance

| File | Source | Consumer |
|---|---|---|
| `report.json` | `vrt diff html` | machine input to `vrt diff agent` |
| Markdown (stdout or `--out`) | `vrt diff agent` | the calling agent |
| `diff-<viewport>.png` | `vrt diff html` | linked in markdown for direct `Read` |
| `.vrt/last-diff-for-agent.json` | `vrt diff agent` | next run, for regression detection (skip with `--no-history`) |

## Failure modes

- `vrt diff html` errors with "browser not found" → run
  `npx playwright install chromium` once.
- Report shows 0 deltas but the agent expected changes → check the
  variant URL is actually the new build (build cache hits are common).
- Universal pairs section empty but breakpoint-gated full → the change
  is media-query-conditional, the base rule didn't move.
