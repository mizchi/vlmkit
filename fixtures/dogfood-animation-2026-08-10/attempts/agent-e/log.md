# agent-e log

## Round 1 — baseline read + three fixes

Commands:

```
check animation index.html
check a11y focus index.html
check drift component index.html --selector ".card:not(.card--featured)"
check drift component index.html --selector ".card"      # diagnostic, not the gate
check integrity index.html
check animation --help
```

Output:

- `check animation` → `status: suspect`, exit 1. Three issues:
  - `no-visible-effect h1:nth-of-type(1): ... animation 'bump' (400ms) produced no
    visible pixel change at any sampled frame` (the keyframes animate `z-index`).
  - `reduced-motion-ignored ...: 5 animation(s) still run under
    'prefers-reduced-motion: reduce' emulation`.
  - `infinite-animation div.spinner: ... runs forever — the page never settles`.
- `check a11y focus` → exit 1, one finding:
  `[reverse] Focus moved left within the same row (from ...button#publish at x=684
  to ...button#save at x=44). Visual order is L-to-R; check tabindex or DOM order.`
- `check integrity` → `DEFECTS`, exit 1:
  `[page-overflow-x] @768,375: The page scrolls horizontally by 46px at 768px
  viewport width — caused by: #publish (130px wide; ...)`.
- `check drift component` on `.card:not(.card--featured)` → already exit 0
  (`3.37% Δ 0 / 0 ... this looks like different content`). The diagnostic run over
  all three `.card`s exit 1 on the featured one: `padding 16px → 30px` **plus**
  border/background colour.

Changes to `theme.css`:

1. `.toolbar` from `position: relative` + three absolute `left:` offsets to
   `display: flex; flex-wrap: wrap; gap: 16px; min-height: 56px`, and dropped
   `position: absolute` from `.btn`. DOM order (Publish, Save, Discard) now *is*
   the visual L-to-R order, which fixes the reverse tab jump. It also removes the
   `left: 660px` that caused the 46px horizontal overflow; `flex-wrap` keeps the
   3x130px row from overflowing at 375px. Added `flex-wrap` to `.cards` for the
   same reason.
2. Deleted `@keyframes bump` and `h1 { animation: bump ... }` — animating
   `z-index` renders nothing, so it was a dead animation.
3. Added `@media (prefers-reduced-motion: reduce)` zeroing
   `animation-duration/-delay/-iteration-count` and `transition-duration`
   globally. Motion is kept for everyone else, as the brief requires.

After round 1: a11y focus 0, integrity 0 (`CLEAN`), drift 0,
animation exit **0** but `status: warn` with the spinner still `x∞`.

## Round 2 — make the page settle

The brief's "never holds still long enough to screenshot" was still true even
though the gate exited 0, so I fixed it anyway: `.spinner` animation
`900ms linear infinite` → `900ms linear 3`.

`check animation` → `status: ok`, `settle: 2700ms`, `infinite 0`,
`reduced-motion: honored`, "No animation issues detected."

## Round 3 — the card that "doesn't match"

No gate flags this, because the success-criterion selector deliberately excludes
the featured card. Working from the diagnostic drift run, the featured card
differed in two independent ways: colour (`background-color`, `border-*-color`)
and geometry (`padding 16px → 30px`, `Δ +28 / 0` on the box). The brief requires
it to stay *visually distinguishable*, not to be a different size, so I removed
`padding: 30px` from `.card--featured` and kept the colours.

Re-running drift over all three `.card`s now reports `Δ 0 / 0` with only the five
colour properties listed — the geometry drift is gone, the intentional
distinguisher remains.

Final: all four gates exit 0.
