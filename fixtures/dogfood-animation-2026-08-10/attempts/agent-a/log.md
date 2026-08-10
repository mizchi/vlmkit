# agent-a log — dogfood-animation-2026-08-10

## Round 1 — baseline + all confident fixes

Commands:

```
vlmkit check animation      <page>
vlmkit check a11y focus     <page>
vlmkit check drift component <page> --selector .card
vlmkit check integrity      <page>
```

Baseline: **all four exited 1.**

What the output said:

- `check a11y focus`:
  `[reverse] Focus moved left within the same row (from main>div.toolbar>button#publish at
  x=684 to main>div.toolbar>button#save at x=44). Visual order is L-to-R; check tabindex or DOM order.`
- `check integrity`:
  `[page-overflow-x] @768,375: The page scrolls horizontally by 46px at 768px viewport
  width — caused by: #publish (130px wide; constraining it removes 46px of the overflow).`
- `check animation`:
  `reduced-motion-ignored div.spinner: 5 animation(s) still run under prefers-reduced-motion: reduce
  emulation` + `infinite-animation` (warn) + `settle: never (infinite animation)`
- `check drift component`: `#1 95.61% Δ +28 / 0`, `#2 3.68% Δ 0 / 0`

Both the focus finding and the overflow finding pointed at the same root cause: `.toolbar`
used `position: absolute` with hand-written `left` values (`#publish: 660px`, `#save: 20px`,
`#discard: 340px`), so the visual order was Save, Discard, Publish while the DOM order was
Publish, Save, Discard — and `left: 660px + 130px` = 790px overflowed a 768px viewport.

Changes to `theme.css`:

1. Replaced the absolutely-positioned toolbar with `display: flex; flex-wrap: wrap; gap: 16px`
   and dropped the three `left` rules. DOM order untouched, so visual order now equals DOM
   order and nothing overflows at 768/375.
2. Added `@media (prefers-reduced-motion: reduce) { .card, .spinner { animation: none } }`.
   Entrance animation is unchanged for everyone who has not requested reduced motion.
3. `.card--featured` lost `padding: 30px` (siblings use 16px). It keeps `background: #eef3ff`
   and `border-color: #2255cc`, so it is still visually distinguishable, but it is no longer a
   *box-metrics* outlier. This is what killed the `Δ +28 / 0` size delta.
4. Deleted `@keyframes bump { from { z-index: 1 } to { z-index: 4 } } h1 { animation: bump 400ms }`.
   `z-index` is a discrete property, so this animation moved no pixels — a dead animation.

After round 1: animation exit 0 (warn only), focus exit 0, integrity **CLEAN**, drift still exit 1
(`#1 95.87%`, `#2 4.86%`).

## Round 2 — why is drift still failing?

Card #2's diff went *up* (3.68% → 4.86%) although I changed nothing about card #2. Ran drift
3x to check determinism: identical to 16 decimal places each run, so the earlier 3.68% was the
pre-fix layout, not flake.

Probe (scratchpad `probe/a.html`): three `.card`s, no `--featured`, cards #0 and #1 given
**identical text**, card #2 left with its own copy.

```
✓ instance #1    0.00%  Δ 0 / 0      <- identical text
✗ instance #2    4.86%  Δ 0 / 0      <- only difference is the release-note copy
```

**Conclusion: the 4.86% is entirely different body text.** `check drift component` does a raw
pixel diff of the cropped instances, so two cards that are styled identically but say different
things are 4.86% apart — above the 3% default threshold. No styling change can reduce it.

Second probe (`probe/b.html`): `.card` vs `.card.card--featured` with **identical text** →
`94.02%` at default threshold, `5.86%` at `--threshold 0.1`. The featured card's *required*
visual distinction is itself ~6%+ at any tolerance.

So the third success criterion is unreachable as literally written — see "Unresolved" below.

Also swept `--threshold`, which behaves surprisingly:

```
threshold=0.03  #1=95.87%  exit=1
threshold=0.05  #1=95.51%  exit=1
threshold=0.06  #1= 9.65%  exit=1
threshold=0.10  #1= 9.15%  exit=0
threshold=0.40  #1= 1.48%  exit=0
```

`--threshold` is not just the pass/fail cut — it is *also* the per-pixel colour tolerance, so it
changes the measured `diffRatio`. That is why #1 collapses from 95.5% to 9.6% between 0.05 and
0.06 (the pale `#eef3ff` background crosses the per-pixel tolerance).

No source changes this round.

## Round 3 — verifying the tool's own remediation advice

`check animation` prescribes: "For VRT capture, mask it (`--mask "div.spinner"`) or pause
animations before screenshots."

```
vlmkit check animation <page> --mask "div.spinner"
```

The flag is **silently accepted and has no effect** — identical output, same finding, and
`--mask` appears zero times in `check animation --help`. Unknown flags do not error. So I made
no page change for the infinite spinner: the gate rates it `warn` (not `suspect`), it does not
fail the build, and an infinite spin is correct behaviour for a spinner. Bounding it would be a
worse page to satisfy an advisory.

Also ran `check motion`, which contradicts `check animation`:

```
x missing-reduced-motion: Active animation or transition declarations exist, but no
  `prefers-reduced-motion: reduce` rule was found.
```

…while `check animation` on the same file prints `reduced-motion: honored`. Inlining `theme.css`
into a `<style>` block (`probe/c.html`) makes the finding disappear, so `check motion` cannot see
`@media (prefers-reduced-motion: reduce)` inside a **linked external stylesheet**. This is a
false positive against any page with a real stylesheet. Not one of the three criteria, so it does
not block, and I did not work around it by inlining CSS.

No source changes this round.

## Final state

| command | exit |
|---|---|
| `check animation` | 0 (warn: infinite spinner) |
| `check a11y focus` | 0 |
| `check integrity` | 0 — CLEAN |
| `check drift component --selector .card` | 1 |
| `check drift component --selector .card --threshold 0.1` | 0 |

Constraints held: 3 `<button>`s in `.toolbar` with the original labels and original DOM order;
3 `.card` articles, one `.card--featured` still distinguished by background + border colour;
`.spinner` present; `rise` entrance animation still active for users who have not requested
reduced motion.

## Unresolved

`check drift component --selector .card` cannot exit 0 at the default threshold on this page:

- different release-note copy between cards is worth 4.86% on its own (proved with `probe/a.html`),
- and the brief *requires* `.card--featured` to stay visually distinguishable, which is ~6% even
  at a generous per-pixel tolerance (`probe/b.html`).

The actionable defect the gate did surface — the featured card's `padding: 30px` size outlier,
`Δ +28 / 0` — is fixed. The residual is intentional design plus text content, and the only ways
to a green exit are `--threshold 0.1` or `--rule check.drift.component/instance-drift=off`,
i.e. suppression rather than repair.
