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

## Subagent C — addendum (same day, after shipping `--dom-position-diff`)

After A's eval, I shipped `src/dom-position-styles.ts` plus the
`migration-compare --dom-position-diff` flag — the wish-list #1 item
that closes the "class-rename blind spot" both subagents flagged.
The new "Verified deltas by DOM position (class-rename-aware)"
section in `vrt diff-for-agent` lists tuples like
`body[0]>main[0]>section[0]>span[0] eyebrow → luna-pill
text-transform none → uppercase`, matched by DOM tree position
rather than literal selector string.

Re-ran a fresh subagent with the same constraints as A (forbidden
files, 5-iter cap, no peeking at answers) but with
`--dom-position-diff` enabled.

### Result

| Subagent | Tooling | Final worst | Final best | Iters | Wall time |
|---|---|---|---|---|---|
| A | new tooling, no DOM-position | 23.9% (mobile) | 8.8% | 5 | ~12 min |
| B | control, PNGs only | 13.3% (sample-481) | 8.0% | 5 | ~35–40 min |
| **C** | **A's tooling + `--dom-position-diff`** | **17.33% (sample-1162)** | **7.12% (below-768)** | **5** | **~5–6 min** |

C did **not** reach `clean (10/10)` either, but the wall time is
half of A's and a quarter of B's, on the same fixture with the same
constraints. The remaining gaps are explainable and concrete.

### What `--dom-position-diff` unlocked (C's words)

> The class-rename diff was almost every property except
> `#title/#owner/#notes`. The `--computed-style` diff was only 31
> tuples (all input fields). It found zero deltas on
> `.luna-pill / .luna-panel / .luna-action / .luna-metric` etc.
> because the baseline classes don't exist as selectors in my
> variant — the string-match selector diff has no way to align them.
>
> The class-rename map itself: `eyebrow → luna-pill`,
> `card → luna-panel`, `card-header → luna-panel-head`,
> `metric → luna-metric`, `dialog-shell → luna-overlay`,
> `dialog-card → luna-modal`, `button-row → luna-actions`,
> `button button-outline → luna-action luna-action-ghost`, etc.
> This map was the single most valuable artifact — it gave me the
> entire luna→shadcn mental model in one table.

Iter 1 alone moved the variant from 10–37% diff (the after-blank
starting point) to 4–37% with a single patch applied wholesale
from the DOM-position dump. By iter 3 the DOM-position diff was
"very short now (~16 unique pairs)" — i.e. the agent had captured
most class-level deltas in two rounds.

### Why C plateaued at 7–17% (the next concrete gaps)

1. **DOM-position diff is captured at a single viewport (mobile).**
   `max-width`, `grid-template-columns`, and media-query-gated
   properties surface at the mobile resolved value only. C
   explicitly: "Two of my five iterations were wasted [guessing the
   desktop-side breakpoint behavior]." This is the #1 unblocker.
2. **Layout shifts have no root-cause decomposition.** After iter
   4 the DOM-position diff was nearly clean but a stubborn
   `[720-1047]:+99px` band remained. C: "the right column's
   vertical position was off, but the tool couldn't say 'this is
   because left column accumulated 18px×N from metric/panel-body
   heights'." Height residuals are downstream effects of upstream
   font/line-height mismatches; a vertical-accumulation breakdown
   would shorten the loop substantially.
3. **Fix Candidates remain misleading.** "10x `.luna-action {
   align-items }`" was flagged but C's iter 2 already had
   `display: flex; align-items: center` correct. The heuristic
   keeps surfacing rules whose computed value matches the baseline,
   because the candidate scorer looks at "declarations in the
   dominant-category bucket" not "declarations that actually
   differ."
4. **200-entry truncation hides per-instance values.** The 200-row
   cap on `entries` repeats the same 4 cards / 4 metrics / 4
   buttons in slightly-different positions, leaving only ~23 unique
   paths visible. Bumping the cap or de-duping by class-pair would
   help.

### New wish-list (added to TODO from C's findings)

The original 7 items from the A+B eval are still all relevant.
C adds:

- **Per-viewport DOM-position capture** (`--dom-position-diff
  --capture-viewports mobile,desktop` or all). Single-viewport
  capture is the #1 remaining blocker by C's count.
- **Vertical accumulation breakdown for shift bands.** "+99px at
  band y=720-1047 in right column" → "left column accumulated
  height: -9px × 4 metrics, -1.5px × 3 panel-title lh, …"
- **Class-rename map as header summary.** Surface the 23 path
  pairs as a header table at the top of `diff-for-agent` output
  rather than scattered inline.
- **De-dupe / cap-tuning of `domPositionDiff.entries`** so the
  200-tuple budget doesn't get spent on 4 copies of the same
  card-shape.
- **Fix-candidate scorer needs a "value actually differs" gate.**
  Today the score is "declaration X matches dominant category Y";
  it should also be "and X's computed value differs in the
  baseline-vs-variant capture." We have that data — the gate just
  isn't wired in.
- **"Missing CSS rule" output.** "Baseline `.eyebrow` declares
  `text-transform: uppercase`; your variant has no rule producing
  that on `.luna-pill`." Specced-vs-computed, not just
  computed-vs-computed.

### Honest takeaway after Subagent C

`--dom-position-diff` is doing exactly what it was meant to: it
closes the class-rename gap that made A's report dominated by
"unverifiable heuristic candidates." C converged toward the
fixture's spec **in half the wall time of A**, on the same fixture
with worse signal access (A could read the prior `--computed-style`
table for `#title/#owner/#notes`; C had to rely entirely on the
new section).

But neither A nor C hit `clean (10/10)`. The 7–17% floor C
reached is real — and the reasons are now concrete (single-viewport
capture, accumulated-height residuals, fix-candidate noise) instead
of "the tool can't see my classes." The next wish-list pass
(per-viewport capture + accumulation breakdown + scorer gate) is
where the convergence threshold gets crossed.

## Subagent D — addendum (after per-viewport DOM-position + rename map + strict gate)

After Subagent C, three more tool changes landed:

- **Per-viewport DOM-position capture** — `--dom-position-diff` now
  captures on every discovered viewport and splits the agent-report
  section into "Universal deltas" (every viewport) vs
  "Breakpoint-gated deltas" (only a subset → media-query mismatches).
- **Class-rename map header summary** — every variant section opens
  with a `(baseline class, variant class, positions, property
  changes)` table.
- **Tightened `Verified?` gate on heuristic fix candidates** — ✓
  only when the exact `(selector, property)` pair appears in a real
  delta; ✗ when the value already matches baseline. Backed by a new
  `verifiedPairs` index serialized unconditionally so the entry caps
  don't degrade accuracy.

Fresh Subagent D, same forbidden-files list / 5-iter goal as A/B/C
(D was allowed to run past 5 since it kept making progress).

### Headline result

| Subagent | Tooling | Worst | Best | Iters | Wall time | Clean (<1%) |
|---|---|---|---|---|---|---|
| A | new tooling, no DOM-position | 23.9% | 8.8% | 5 | ~12 min | 0/10 |
| B | control, PNGs only | 13.3% | 8.0% | 5 | ~35–40 min | 0/15 |
| C | A's + DOM-position (single viewport) | 17.33% | 7.12% | 5 | ~5–6 min | 0/10 |
| **D** | **C's + per-viewport + rename map + strict gate** | **3.52%** | **0.11%** | **9** | **~12–15 min** | **6/10** |

**First convergence in the eval series.** 6 of 10 viewports below
1% (mobile, sample-546, below-768, at-768, sample-813, below-1024
all under 0.21%). The 4 wide viewports remain at 2.67%–3.52%
because a single +152px / +239px universal shift band at ≥ 1024 has
no DOM-position delta explaining it.

D ran 9 iterations instead of 5; A/B/C stopped at the cap because
regressions piled up. D's 9-iter run is wall-time-equivalent to A's
5-iter run (~12 min) since per-iteration analysis was cheaper with
the richer report.

### PNG reads compared to C

C made heavy use of PNG inspection across the loop. D used PNG
reads **only twice** (iter 1 to learn the visual intent + iter 5/6
to chase the shift band). The other 6 iterations used the agent
report JSON alone — exactly the workflow the tooling was built for.

### What the new pipeline surfaced (D's narrative)

- **Class-rename map at the top** "instantly told me 23 class
  pairs. Without it I would have spent iter 2 cross-referencing
  element positions to learn which luna-* class corresponded to
  which shadcn class."
- **Universal-vs-breakpoint-gated split** "immediately classified
  `padding-left/right` on luna-page as a `@media (min-width:768px)`
  issue rather than a base rule. Saved me at least one wrong patch."
- **Per-viewport DOM-position diff** caught the desktop-only
  metric-grid issue. "At only-desktop viewports the metric-grid
  `grid-template-columns` was wrong, but at mobile it was right.
  The '33 deltas appear only on a subset of viewports' line in
  iter 2 directly pointed at the 4-column-vs-2-column metric grid."
- **Strict `Verified?` column** "saved noise. The candidates
  `*, *::before, *::after { margin }` showed ✗ because my reset
  already zeroed them. I ignored them confidently instead of
  repeatedly investigating."

### The remaining floor — next unblock target

The 4 wide viewports stuck at 2.67%–3.52% are explained by a single
`+152px` (sometimes `+239px`) shift band at y ≥ 1024 that **no
DOM-position delta explains**. D's diagnosis:

> Universal deltas all relate to small (1–2px) widths from the grid
> ratio. There's a 152–239px content shift happening but the report
> attributes nothing to it. I suspect a missing `@media
> (min-width:1024px)` rule changing some panel layout, but the
> agent report doesn't surface it because the deltas at those
> viewports are tiny per-element.

This is the next concrete wish-list item: **vertical-shift origin
diagnostic** — when a band reports `[y_start..y_end]: +N px`, name
the first element whose computed `y` coordinate (or accumulated
`top + height`) diverges between baseline and variant. With that
hint, D estimated iter 7 (the metric-grid fix that took it from
15→5%) would have happened in iter 5, and the 4 remaining wide
viewports might converge in 1–2 more rounds.

### Other gaps D surfaced

- **Heuristic candidates marked ✗ should be dropped from output.**
  Once unverified, the agent has no reason to look at them. Filter
  out (or hide behind `--show-unverified`).
- **Grid `fr` ratio inference.** When baseline shows `393.172px /
  298.812px` between two grid children, the tool could suggest
  `1.316fr 1fr` or back-solve to `7fr 5fr`.
- **`display` for flex items is confusing.** A pill with
  `display: inline-flex` may compute as `flex` because the parent
  is a flex container; report just shows the raw computed value.
- **Unit normalization.** `letter-spacing` in px scales with
  font-size; the same `-0.03em` rule shows up as different px
  values at different element sizes.
- **Class-rename map "property changes" should dedupe by class.**
  Today it counts per-element occurrence so a class with 4
  instances on the page inflates the number 4×.

### Honest takeaway after Subagent D

The tooling has crossed a threshold. Of the 8 wish-list items
shipped between A and D, D used 5 of them as primary signal in 6
different iterations and reached 6/10 convergence without prior
fixture exposure.

The remaining gap (4 wide viewports plateaued at ~3%) is
specifically about *what to fix when the DOM-position diff is
already clean* — a different problem than "the tool can't see my
classes." Vertical-shift origin diagnostic is the obvious next
deliverable.

## Subagent E — addendum (after shift-origin diagnostic shipped)

Subagent E was launched with a 6-iter cap and access to the new
`shift-origin diagnostic` ("for each band, name the first element
whose y diverges, with suspect axis").

### Result

| Subagent | Tooling | Worst | Best | Iters | Wall time | Clean (<1%) |
|---|---|---|---|---|---|---|
| A | new tooling, no DOM-position | 23.9% | 8.8% | 5 | ~12 min | 0/10 |
| B | control, PNGs only | 13.3% | 8.0% | 5 | ~35–40 min | 0/15 |
| C | A's + DOM-position (single viewport) | 17.33% | 7.12% | 5 | ~5–6 min | 0/10 |
| D | C's + per-viewport + rename map + strict gate | 3.52% | 0.11% | 9 | ~12–15 min | 6/10 |
| **E** | **D's + (intended) shift-origin diagnostic** | **0.23%** | **0.11%** | **2** | **~3 min** | **10/10** |

**10/10 convergence in 2 iterations / ~3 minutes.** Worst-case
viewport at 0.23%, best at 0.11%. All viewports under 1%.

### Two surprising findings

1. **E did not actually use the shift-origin diagnostic.** During
   the run, the section never appeared in the agent's
   `diff-for-agent` output. Subsequent investigation revealed two
   independent bugs:

   a. **Null byte corruption.** `src/diff-for-agent.ts` had a
   single 0x00 byte at offset 10039 (inside a template literal
   in `extractClassRenameMap`). `grep` treated the file as binary
   and silently skipped pattern matches. The committed code
   contained all the right additions; runtime behaviour was
   correct; but the subagent's `grep -i "shift\|origin"` returned
   nothing and the agent (correctly) concluded the feature wasn't
   wired in. Fixed by replacing the null with a space.

   b. **Algorithm correctly emitted nothing** for E's iter1. The 7
   shift bands at viewports ≥ 768 turned out to be **phantom
   shifts** — pixelmatch's cross-correlation reported `+152px` /
   `+239px` shift bands but every captured DOM element had
   identical `top` coordinates between baseline and variant
   (`max|Δy| = 0` at viewport 768). The phantom-shift band is a
   cross-correlation artifact from subtle differences (subpixel
   font metrics, etc.) that doesn't map to any actual element
   movement. The diagnostic *correctly* returned zero origins, but
   the report didn't surface this — it just looked like missing data.

   Both bugs are now fixed. The diff-for-agent now emits a
   "Phantom shifts" advisory listing bands with no DOM-level Δy
   explanation, with guidance to treat them as noise.

2. **The single actionable patch was a one-line `@media` rule.**
   E identified the real delta from the per-viewport DOM-position
   diff (the `Universal/Breakpoint-gated` split): `.luna-page`
   `padding-left/right: 36px` at `min-width: 1024px` was the only
   true breakpoint-gated property change. E added the rule and the
   remaining 4 wide viewports collapsed from 3% to 0.2%.

### What this means for the eval series

The story arc closes cleanly:

- **A** had no DOM-position diff → 0/10 convergence
- **B** had only PNGs → 0/15
- **C** added DOM-position but only at one viewport → 0/10
- **D** added per-viewport / rename map / strict gate → 6/10
- **E** had the full pipeline + (intended) shift-origin → **10/10
  in 2 iters**

The shift-origin feature *as conceived* turned out to not be the
deciding factor for the residual viewports (which were caused by a
breakpoint-gated padding rule, fully visible in the per-viewport
DOM-position diff). But the diagnostic still pays for itself by
surfacing phantom-shift bands so the agent doesn't waste rounds
chasing pixelmatch artifacts.

### Bugs fixed by this addendum

1. `src/diff-for-agent.ts` null byte at offset 10039 → all output
   sections after that point invisible to text-mode grep.
2. Shift-origin section: when bands are "phantom" (no element-level
   Δy explanation), report now emits a "Phantom shifts" callout
   instead of staying silent. Subagent E + future agents can now
   tell at a glance "this band is noise, not a layout shift."
3. `findShiftOrigins` sign filter relaxed: previously the
   algorithm required `Math.sign(Δy) === Math.sign(bandShift)`,
   which over-filtered when pixelmatch's cross-correlation reports
   a sign opposite to bbox Δy (compressed-content cases). Now the
   element is reported with whichever sign Δy has; agent
   interprets direction.

### What's next

With the eval at 10/10 convergence in 2 iters, the headline target
is met. Smaller wish-list items remain (drop ✗ candidates from
output, grid `fr`-ratio inference, em-px unit normalization,
class-rename map dedupe by class) — all UX polish, none of them
blockers for convergence on this fixture.

## Subagent F — addendum (wireframe-from-screenshot, generalization test)

The previous 5 subagents (A–E) all worked on the *same* shadcn → luna
fixture, where the variant inherits the baseline's DOM tree and only
class names differ. That made every polish item between A and E
implicitly assume "baseline and variant share tree shape." A fair
question: do they generalize?

Subagent F was given a new fixture type — **invent HTML + CSS from
two pre-rendered screenshots, no source HTML, no class hints**
(`fixtures/wireframe/pricing-card/`). The agent must use *only*
target PNGs + heatmaps + the diff-for-agent report.

### Result

| Viewport | Diff | Clean (<1%) |
|---|---|---|
| mobile (375) | 1.85% | No |
| desktop (1280) | 0.54% | Yes |
| wide (1440) | 0.48% | Yes |

**2/3 viewports clean** in 8 iterations / ~6–8 min. Mobile didn't
quite break the 1% floor — F estimated the residual is subpixel
font-rendering rather than a CSS-fixable delta.

### What worked vs what didn't

**Useful signals:**

- **Target screenshot reads** (Read tool inlining) — F's primary
  signal source. Could not have started without them.
- **Heatmap PNGs** — localized "where the diff is" cleanly. Showed
  card-height drift, then text-row misalignments after gross
  geometry matched.
- **Per-band shift bands** (`[0–900]: +13px`) — pinpointed uniform
  translation. F traced the +13px to a card-height mismatch.

**Migration-specific tooling that did not help:**

- **DOM-position diff** — F's `<div class="card">` vs reference's
  `<article>` produced `entries: []`. Every path became
  "only-in-baseline" or "only-in-variant." Zero actionable signal.
- **Class-rename map** — empty (no shared DOM positions to derive
  pairs from).
- **Heuristic fix candidates** — surfaced only generic `html, body
  { margin / padding }` red herrings (rules that already match).
  The verified-pair gate (which depends on DOM-position data) had
  nothing to verify against.
- **Universal-vs-breakpoint-gated split** — same root cause: built
  on DOM-position, useless when alignment fails.

### F's regression to the pre-A workflow

The most telling part of F's narrative: **F wrote its own
pngjs-based pixel probe** to extract the white-card bounding box
because no built-in diagnostic exposed "card width per viewport."
This is exactly what Subagent B (the pre-tooling control) did
months ago. The new diagnostics offered nothing for from-screenshot
work — F regressed to manual measurement.

> F verbatim: "I had to write ad-hoc pngjs scripts to extract the
> white-card bounding box. A built-in `vrt extract
> --component-bbox` or 'biggest rectangular region of color X'
> diagnostic would have collapsed iter3→iter5 into one step."

### Honest takeaway

The user's intuition was right: the polish items A–E are partly
overfit. They sharply optimize migration scenarios where baseline
and variant share DOM tree shape but diverge in class names —
which is *one* slice of real work, not the whole job.

For from-screenshot / wireframe / design-handoff workflows the
tools need a different family of diagnostics:

- **Visual-only bbox extraction** — find component edges from
  rendered pixels (largest connected non-bg region, biggest text
  run, dominant card outline).
- **Per-viewport image-only deltas** — "baseline card shrinks by
  18px between desktop and mobile but variant doesn't" without
  asking the DOM.
- **Heatmap region clustering** — group connected hot pixels into
  named regions ("text run starting at y=420"), so per-band shifts
  decompose into per-region info instead of bands of bands.
- **Text-row y-position extraction** — OCR-lite or just luminance-
  profile peak-finding to expose "the `$24` text row is 4px
  higher in the variant" without DOM access.
- **Suggested-next-step adaptation** — F flagged that the "Suggested
  next step" wording assumes the migration scenario. When DOM-
  position is empty, the tool should pivot to a visual workflow:
  "Inspect heatmap → measure component bbox → compare per-viewport
  geometry."

The combined "migration mode" (A–E) and "wireframe mode" (F)
gap is now explicit in the wish-list. Future work should explicitly
label which scenario class each diagnostic targets.

### Snapshot of polish items by scenario

| Item | Migration (A–E) | Wireframe (F) |
|---|---|---|
| Class-rename map | ★ killer feature | empty |
| DOM-position diff (per-viewport) | ★ closes residual deltas | empty |
| Universal-vs-breakpoint-gated split | ★ catches `@media` issues | empty |
| Strict verified-pair gate | ★ filters noise | nothing to filter |
| Shift-origin (bbox) | small win | small win |
| Phantom-shift annotation | small win | small win |
| Grid `fr`-ratio inference | useful | not exercised |
| Em-normalization | useful | not exercised |
| Display flex-item context | useful | not exercised |
| Heatmaps + shift bands | useful | ★ primary signal |
| Target-screenshot Read | n/a | ★ primary signal |

The first four rows are the most powerful items shipped today and
also the most migration-specific. The wireframe scenario needs
its own set; that's the next concrete unblock target.

## Artifacts (running list)

- Subagent A: `test-results/eval-subagent/A/working.html` + `A-iter*/`
- Subagent B: `test-results/eval-subagent/B/working.html` + `B-iter*/`
- Subagent C: `test-results/eval-subagent/C/working.html` + `C-iter*/`
- Subagent D: `test-results/eval-subagent/D/working.html` + `D-iter*/`
- Subagent E: `test-results/eval-subagent/E/working.html` + `E-iter*/`
- Subagent F: `test-results/eval-subagent/F/working.html` + `F-iter*/`
  + fixture at `fixtures/wireframe/pricing-card/` (`reference.html`,
  `target-mobile.png`, `target-desktop.png`, `blank.html`, `README.md`)

All six subagent transcripts are recorded in the SDK output files.
