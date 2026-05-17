# E3: shadcn → luna Blind Test Scaffolding

**Date**: 2026-05-11
**Status**: Fixture + baseline measurement landed. The fix-loop run itself
requires an LLM API key (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.) and is
left to a follow-up session.

## Experiment Design

Following the same pattern as the Tailwind and Reset CSS blind tests, have an
agent rebuild luna's `luna-*` CSS from scratch while only seeing:

- `before.html` (shadcn — target visual appearance)
- `after-blank.html` (luna HTML structure + minimal reset only)
- VRT diff results across the discovered viewports
- Auto-extracted fix candidates

Reading the existing answer (`after.html` / `after-reference.html`) is
forbidden.

## Fixture Layout

```
fixtures/migration/shadcn-to-luna/
├── before.html              # shadcn classes (baseline appearance)
├── after.html               # luna classes + final CSS (already pixel-perfect with before)
├── after-reference.html     # archived copy of after.html (the answer)
└── after-blank.html         # luna HTML + minimal reset only (agent's starting point)
```

Each file keeps the existing `<style id="target-css">` marker so
`migration-fix-loop` can patch the variant in place.

## Baseline Measurement

`after.html` vs `before.html` (current answer):

| Viewport | mobile | sample-546 | below-768 | at-768 | sample-813 | below-1024 | at-1024 | sample-1162 | desktop | wide |
|---|---|---|---|---|---|---|---|---|---|---|
| Diff | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |

The existing luna CSS is already pixel-perfect with the shadcn baseline, so
the experiment cleanly measures whether the agent can reach the same result
from scratch.

`after-blank.html` vs `before.html` (agent's starting point):

| Viewport | mobile | sample-546 | below-768 | at-768 | sample-813 | below-1024 | at-1024 | sample-1162 | desktop | wide |
|---|---|---|---|---|---|---|---|---|---|---|
| Diff | 58.4% | 52.7% | 51.4% | 33.6% | 33.3% | 28.1% | 22.1% | 20.5% | 20.1% | 19.6% |

Diff categories at the starting point: 35 layout-shift, 19 color-change, 4 typography.

Notable fix candidates surfaced automatically:
- `*, *::before, *::after { margin }` (×10)
- `*, *::before, *::after { padding }` (×10)
- `body { line-height }` (×10)

The shift detector flags the large header offset (`+225px`) caused by the
missing layout CSS, indicating layout-shift is by far the dominant issue.

## How to Run the Blind Loop

```bash
# 1. Measure starting state
node --experimental-strip-types src/experiments/migration/migration-compare.ts \
  --dir fixtures/migration/shadcn-to-luna \
  --baseline before.html \
  --variants after-blank.html

# 2. Iteratively apply LLM fixes (requires API key)
ANTHROPIC_API_KEY=... node --experimental-strip-types src/experiments/migration/migration-fix-loop.ts \
  --report test-results/migration/migration-report.json \
  --variant after-blank.html \
  --in-place
```

`migration-fix-loop` picks the highest-diff viewport, asks the LLM for a
single CSS patch via `buildMigrationFixLoopPrompt`, applies it to
`<style id="target-css">`, and re-runs `migration-compare`. Repeat until
diff < 1% on every viewport or the loop reports convergence.

## Success Criteria

> diff < 1% within 3 rounds, no inspection of `after.html`.

Comparison anchor from prior experiments:

| Experiment | Initial mobile diff | Final | Rounds | Tool calls |
|---|---|---|---|---|
| Tailwind → vanilla | 36.7% | 0.0% | 3 | 58 |
| Reset CSS switch | 2.6% | 0.0% | 1 | 6 |
| shadcn → luna | **58.4%** (this run) | TBD | TBD | TBD |

The shadcn → luna setup has the largest starting diff of the three because
none of the luna-* classes resolve initially — every layout, color, and
typography rule must be reconstructed. This makes it the most stringent
replication of the Tailwind result.
