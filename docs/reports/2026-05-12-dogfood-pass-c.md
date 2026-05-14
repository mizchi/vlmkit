# Dogfood Pass C — Markdown-only iteration, no PNG reads

**Date**: 2026-05-12 (same day as Pass A/B)
**Agent**: Claude (this session)
**Goal**: Validate that the tooling added today (`vrt diff-for-agent`,
`--computed-style`, per-band shift, `vrt compare-runs`) actually
reduces the agent's iteration count and information footprint.

## Constraints (different from Pass B)

1. **Worse starting CSS.** Pass B's starting CSS was system-ui +
   `#ccc` borders — recognizable design defaults. Pass C uses:
   - `font-family: 'Comic Sans MS'`
   - `border: 2px dashed magenta` everywhere
   - `border-radius: 20px` on cards, `30px` on buttons, `2px` on the
     pill (intentionally inconsistent)
   - `.luna-layout / .luna-actions / .luna-field / .luna-metrics`
     all set to `display: block` (instead of flex/grid)
   - `line-height: 1.7` body, `font-style: italic` on `.luna-panel-note`
   - magenta accent everywhere

2. **Markdown only.** No `Read` calls on the PNG files. The only
   signal the agent consumes is the `vrt diff-for-agent` Markdown
   blob plus the migration-compare terminal summary.

3. **Same DOM as baseline.** The HTML body is untouched
   `after-blank.html`; only the `<style id="target-css">` block
   differs.

## Results

### Pass C iter 1 → iter 2

| Viewport | Iter 1 | Iter 2 | Δ | Status |
|---|---|---|---|---|
| mobile | 34.08% | 0.000% | -34.08% | IMPROVED |
| below-768 | 31.72% | 0.000% | -31.72% | IMPROVED |
| sample-546 | 27.94% | 0.000% | -27.94% | IMPROVED |
| sample-1162 | 27.76% | 0.000% | -27.76% | IMPROVED |
| desktop | 27.27% | 0.000% | -27.27% | IMPROVED |
| wide | 26.56% | 0.000% | -26.56% | IMPROVED |
| at-1024 | 26.39% | 0.000% | -26.39% | IMPROVED |
| below-1024 | 19.29% | 0.000% | -19.29% | IMPROVED |
| at-768 | 15.06% | 0.000% | -15.06% | IMPROVED |
| sample-813 | 14.71% | 0.000% | -14.71% | IMPROVED |

**0.000% across all 10 viewports in iteration 2.** 10/10 IMPROVED,
0 REGRESSED. Net Δ −250.78%.

### Wall time

- Pass B: 4 minutes / 2 iterations (PNG reads + side-by-side diff)
- Pass C: **~1.5 minutes / 2 iterations** (Markdown-only)

The reduction comes from cutting out two `Read` calls per round
(baseline.png + current.png) plus the eye-walk over 17 visible
deltas; the Markdown report enumerates the deltas as a table the
agent can patch from directly.

## What signal carried the patch

### Verified deltas (computed-style diff) — primary signal

The CSD section listed 66 (selector, property, baseline, variant)
tuples grouped under three selectors (`#title`, `#owner`, `#notes`).
That gave me **exact values** to plug into `.luna-input` /
`.luna-textarea`:

```
padding 4px → 11px 13px
border-color magenta → rgb(226, 232, 240)
border-style dashed → solid
border-radius 0 → 12px
color rgb(0,0,0) → rgb(15, 23, 42)
font-size 13.33px → 16px
font-family monospace → Inter, system-ui, sans-serif
line-height normal → 24px
```

These tuples eliminate the "guess the value" step the agent would
otherwise need to do by eyeballing PNGs.

### Heuristic candidates with ✓ verified — secondary signal

```
.luna-actions       { display }  10 viewports  ✓
.luna-field         { display }  10 viewports  ✓
.luna-layout        { display }  10 viewports  ✓
.luna-metric strong { display }  10 viewports  ✓
.luna-metrics       { display }  10 viewports  ✓
```

Every candidate marked ✓ — the CSD confirms the heuristic's guess
this time. Tells me block→flex/grid for those four containers and
inline→block on the metric value. Concise, actionable.

(In Pass B with my prior iter-1 CSS — which already had `display:
flex` — these same heuristic candidates would be marked `—`
because the computed-style didn't differ. That's the reconciliation
working as intended.)

### Per-band shifts — tertiary signal

```
mobile: [0–240]:+7px [480–720]:-97px [960–1200]:+118px [1200–1454]:+120px
desktop: [0–240]:+55px [240–480]:-23px [480–720]:+26px [720–1047]:+48px
```

Confirms my hero / first-card region is short (Comic Sans + small
font-size compress the top), and downstream content shifts up or
down by ~100px because cards are also smaller. Useful as a sanity
check — I'd expect any successful patch to zero out these bands.
Not strictly necessary for the fix (CSD already implies the issue),
but reassuring.

## What was *not* in the report

The computed-style snapshot only covers 3 selectors here (`#title`,
`#owner`, `#notes` — the form inputs with `id` attributes). It
doesn't capture:

- `.luna-pill` (background + text-transform + letter-spacing)
- `.luna-hero h1` (font-size hierarchy)
- `.luna-panel` (border-radius / box-shadow / border-color)
- `.luna-action-primary` (background color)
- `.luna-overlay` / `.luna-modal` (radii, dark backdrop)

For those I had to fall back on intuition + my memory of the
luna design system from earlier passes today (Inter + slate +
soft shadow + 18px radius). With a truly cold agent (no prior
session context), the iter 2 patch would likely have some of
these wrong and would need an iter 3.

**Concrete follow-up wish-list item:** widen
`captureComputedStyleSnapshotInDom`'s selector coverage. Today
it captures semantic tags + IDs but not class selectors used by
component CSS. Broadening to "all elements with a class attribute"
would have surfaced the pill + panel + action deltas as
verified entries, eliminating the guesswork.

## Comparison summary across all three passes

| Pass | Starting CSS | Information channel | Iters | Wall time | 0.00% achieved |
|---|---|---|---|---|---|
| A | Read shadcn source | sed rewrite | 1 | < 1 min | ✓ |
| B | system-ui / gray | PNG side-by-side + terminal table | 2 | ~4 min | ✓ |
| C | Comic Sans / magenta | `vrt diff-for-agent` Markdown only | 2 | **~1.5 min** | ✓ |

The headline: **dropping PNG inspection in favor of Markdown
saved ~60% wall time at the same iter count, even with a
materially worse starting point.**

## Contamination disclosure

I'd already iterated on this fixture twice today (Pass A, Pass B)
and once for the data collection. The exact luna spec values
(`--radius: 18px`, `padding: 11px 16px`, gradient stops, etc.) are
in my working memory regardless of what the report shows. A
genuinely cold agent's numbers would be worse for the
not-in-CSD selectors. The fair claim is: **the tooling improves
the deltas it surfaces**, not "the tooling reduces iter count by
a constant factor regardless of agent priors."

## What the tooling needs next (informed by Pass C)

1. **Broader computed-style selector coverage.** Today the capture
   set is narrow (semantic tags + IDs). Adding class-based selectors
   (extracted from the variant's CSS, perhaps) would make CSD
   coverage match the visual deltas an agent actually sees.
2. **Cropped image excerpts in the agent report.** When CSD doesn't
   cover a delta, the agent still needs a visual. The current
   "Worst-diff viewport (open these PNGs side-by-side)" section
   lists paths but doesn't excerpt them. Inlining a base64 crop of
   the worst diff region (using the existing `regions` data from
   `generateDiffReport`) would let an agent stay in-Markdown for
   uncovered deltas.
3. **A "what changed since last iter" diff inside `diff-for-agent`**
   (the agent already has `vrt compare-runs`, but inlining a tiny
   "previously fixed: …" line in the iter-N report would close the
   loop without spawning a second tool).

The first two are small follow-ups; the third is mostly stylistic.

## Artifacts

- `test-results/dogfood-c/passC-iter1.html` — Comic Sans / magenta start
- `test-results/dogfood-c/passC-iter2.html` — Markdown-only patch (0.00%)
- `test-results/dogfood-c/iter1/migration-report.json` — full report
- `test-results/dogfood-c/iter2/migration-report.json` — clean report

Both iter HTML files are committed under
`fixtures/migration/shadcn-to-luna/dogfood-2026-05-12/passC-iter{1,2}.html`
so they can be re-run end-to-end.
