# Subagent evaluation — does the new tooling help a fresh agent?

**Date**: 2026-05-12 (same day as Pass A/B/C self-dogfood + wish-list builds)
**Method**: Spawned two fresh `general-purpose` subagents in parallel. Both
were given the same task (write CSS at `test-results/eval-subagent/<X>/working.html`
so it matches the shadcn baseline) and the same forbidden-files list
(`before.html` style block, `after.html`, `after-reference.html`,
prior dogfood solutions, prior dogfood reports — i.e. nothing that
gives away the answer or its values). Both could run vrt commands,
read their own working file, read vrt output PNGs/JSONs. Both had a
cap of 5 iterations or `clean (N/N)` convergence.

The split:

- **Subagent A** — full access to today's new tooling:
  `vrt compare --computed-style`, `vrt diff-for-agent`,
  `vrt compare-runs`.
- **Subagent B** (control) — explicitly forbidden from the three
  commands above. Only `vrt compare` (no `--computed-style`) plus
  PNG reads, the terminal summary, and raw `migration-report.json`.

Why this matters: my own three dogfood passes earlier today are
contaminated — I'd already iterated on this fixture and the luna
spec values are in my working memory. A fresh subagent has zero
prior context and is the fair test.

## Headline result

**Neither subagent converged.** Both hit the 5-iteration cap with
diff ratios 8–25× the 1% target.

| Subagent | Final worst | Final best | Iters | Wall time | Notes |
|---|---|---|---|---|---|
| A (new tooling) | 23.9% (mobile) | 8.8% (below-768) | 5 | ~12 min | iter3 was a regression that got fully reverted |
| B (control, PNGs only) | 13.3% (sample-481) | 8.0% (sample-1761) | 5 | ~35–40 min | iter4+5 regressed; final was partial revert |

For reference (contaminated):

- My Pass B (PNGs, prior knowledge): 4 min, 2 iters, 0.00%
- My Pass C (Markdown only, more prior knowledge): 1.5 min, 2 iters, 0.00%

The contamination gap is large. Removing it (subagents A + B) drops
convergence from "0% in 2 rounds" to "8–24% after 5 rounds" with
either workflow. That gap is the real signal.

## The killer finding — A's blind spot is the migration use case

Subagent A's verbatim diagnosis:

> Verified-deltas don't cover class-renamed selectors. This is the
> biggest gap. The migration scenario *is* a class rename
> (`.card` → `.luna-panel`, `.metric` → `.luna-metric`). The tool
> aligns selectors by literal string, so all 30+ class-level styles
> produce zero verified rows. I was left guessing font sizes,
> paddings, gaps, max-widths from PNGs.

The `--computed-style` channel only captured `#title / #owner /
#notes` (the form inputs with IDs preserved across the rename). For
every other delta — pill, hero h1, panel, action, metric, overlay,
modal — the agent had no verified data and had to guess from PNG
reads, the same way Subagent B had to.

This makes `--computed-style` mostly useless for the *primary*
migration-VRT scenario it was designed for. It works fine when the
class names are preserved (in-place CSS refactor, the
`tailwind-to-vanilla` fixture); it fails the moment the variant
renames anything.

## Why both agents plateaued

Even with class-name-aligned verified deltas, both agents would
likely have struggled because:

- **Both lack a per-element / per-section diffRatio breakdown.**
  "Hero contributes 0.4%, Modal 4.0%, Panel 1.2%" would let them
  target the worst offender. Today the only granularity is
  per-viewport.
- **Neither tool surfaces the *cause* of a layout shift, only the
  effect.** `[0–240]:+10px` is a symptom; the cause could be page
  padding, hero gap, h1 size, pill height, or panel head padding.
  Each guess is a 70-second iteration. Both agents wasted iterations
  chasing the wrong cause.
- **Color-change category counts (e.g. "1 color-change") never name
  the colors.** Subagent B had to write a PIL probe to read pixel
  RGB from `before.png` to figure out the overlay color
  (`#8c9099` vs its `#6b7280`).

## Per-iteration regression pattern (both agents)

Both agents had at least one iteration that *increased* total
diff and required reverting. Subagent A's iter 3 added net +46%,
Subagent B's iter 4 added net ~+10%. Both reverted to a previous
state. Both wished for an automatic "your patch regressed N/N
viewports — revert?" prompt.

This is real signal: a coding-agent loop with five 70-second
iterations + zero regression alarms means roughly 20% of agent
budget is spent on patches that made things worse, then on undoing
them.

## Side-by-side: where each tool helped

### Subagent A — where `--computed-style` + `diff-for-agent` *did* help

- The 30+ tuples for `#title/#owner/#notes` were used verbatim in
  iter 2: exact `padding`, `min-height`, `border-radius`,
  `font-family`. Verified deltas dropped from 31 → 3 in one round.
  This is the workflow working as designed.
- The `Verified?` column on heuristic candidates let A ignore the
  `.luna-hero { display | flex-direction | gap }` candidates that
  kept appearing across iterations but never showed up in the
  verified table (they were unverifiable noise).

### Subagent B — where raw PNGs *did* help

- B's hand-rolled PIL pixel-probing harness extracted exact element
  positions, button heights, overlay colors. With 30–60 seconds of
  scripting per measurement, B reached a *more consistent* result
  than A (narrower range: 8–13% vs A's 8–24%) but spent ~3× the
  wall time. B's narrative is essentially "I built my own
  computed-style probe because the one provided couldn't see my
  classes."
- The `_heatmap.png` overlay was used effectively to localize the
  worst region (modal/overlay rectangle in B's iter 5).

## Combined wish-list (from both agents)

The new items both surfaced independently:

1. **Selector alignment across rename.** A's exact words: "I noticed
   `.card` (baseline) and `.luna-panel` (variant) share the same DOM
   coordinates and child count — here's a verified delta table
   assuming they're the same component." The whole class-rename
   migration use-case lives here.
2. **Per-element diffRatio.** Both agents asked for the same thing:
   "Hero 0.4%, Panel 1.2%, Modal 4.0%."
3. **Element bounding-box diff.** "Your `.luna-panel:nth-of-type(1)`
   is 50px taller than baseline; candidate properties: `padding`,
   `line-height`, `font-size`." A box-model breakdown of which CSS
   axis explains a height/width diff.
4. **Color samples.** "1 color-change" should say "`(80, 1040)` is
   `#6b7280`, baseline is `#8c9099`."
5. **Regression alarm + auto-revert offer.** When net Δ is positive
   across most viewports after a patch, surface it loudly.
6. **Per-viewport computed-style capture.** Today CSD is one
   global sample without a viewport label — both agents struggled
   to know which width produced a given value.

Items already on the wish-list that re-surfaced:

7. **Wider computed-style selector coverage** (extracted from the
   variant's CSS rather than hard-coded). Even before tackling
   class-rename alignment, capturing classes the variant declares
   would have covered iter-1 layout containers (`.luna-actions`,
   `.luna-field`) — which A's report described as "unverifiable
   heuristic candidates that became background noise."

## Honest takeaway

Today shipped 6 wish-list items, all individually correct and
covered by unit tests. The dogfood that motivated them (Pass A/B/C,
me as the agent) showed 2-iteration convergence and validated the
tools — but that was contaminated by 3 prior passes through the
same fixture. The subagent eval, run by agents with zero priors,
shows the tools genuinely help **only when selector identity is
preserved** between baseline and variant. The shadcn → luna fixture
is the migration scenario VRT exists for, and that scenario hits the
blind spot squarely.

This doesn't invalidate today's work — the per-band shifts, DOM
preflight, `compare-runs`, heuristic-verified reconciliation, and
flipbook are all useful — but the headline claim ("the agent can
converge in 2 iterations now") was overstated. The realistic claim
is: **the new tooling shrinks the *known-delta* search space; the
*unknown-delta* search space (renamed classes, untracked
properties) still requires PNG inspection + manual probing.**

The right next move, informed by this eval, is item (1) on the
combined list — DOM-position-based selector alignment so the
computed-style channel actually captures the class-renamed
selectors that make up the bulk of the migration.

## Artifacts

- `test-results/eval-subagent/A/working.html` — Subagent A's final CSS
- `test-results/eval-subagent/A-iter1..A-final/` — A's intermediate reports
- `test-results/eval-subagent/B/working.html` — Subagent B's final CSS
- `test-results/eval-subagent/B-iter1..B-iter-final/` — B's intermediate reports

Both subagent transcripts are recorded in the SDK output files.
