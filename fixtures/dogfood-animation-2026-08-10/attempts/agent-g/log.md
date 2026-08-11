# agent-g log

## Round 1

Commands (all on my copy, from /home/user/vlmkit):

- `check animation <html>`
- `check a11y focus <html>`
- `check drift component <html> --selector .card`
- `check integrity <html>`
- `check drift component --help`, `check animation --help`, `--rules` on both

What the output said:

- animation: `status: suspect`, `settle: never (infinite animation)`,
  `reduced-motion: 5 animation(s) still running`. Three issues:
  `no-visible-effect h1:nth-of-type(1)` (the `bump` keyframes animate only
  `z-index`), `infinite-animation div.spinner` (warn), and
  `reduced-motion-ignored` with the literal remedy "Add
  `@media (prefers-reduced-motion: reduce)` and either set `animation: none`".
- a11y focus: `[reverse] Focus moved left within the same row (from
  ...button#publish at x=684 to ...button#save at x=44)`.
- drift component: instance #1 at 18.40%, listing `padding-*: 16px → 30px`
  plus `border-*-color` and `background-color`.
- integrity: `DEFECTS` — `[page-overflow-x] @768,375: The page scrolls
  horizontally by 46px ... caused by: #publish (extends to x=814px)`.

`--rules` was the load-bearing read: `instance-drift` is *suspect*,
`instance-content-differs` is *info*, `infinite-animation` is *warn*. So only
`instance-drift` can fail the drift gate, and warns do not exit 1.

Changes (all in `theme.css`):

1. Toolbar `position: relative` + three absolutely-positioned buttons at
   `left: 660/20/340` replaced with `display: flex; gap: 12px`. One edit fixes
   two findings: DOM order (Publish, Save, Discard, unchanged) now equals visual
   left-to-right order, so focus stops going backwards; and Publish no longer
   sits at x=660, which removes the 46px horizontal overflow. Flex items shrink,
   so 375px does not overflow either.
2. Deleted `@keyframes bump` and `h1 { animation: bump ... }` — animating
   `z-index` on the h1 paints nothing, which is exactly what
   `no-visible-effect` reported. The brief only requires an entrance animation
   on the cards.
3. Spinner `animation: spin 900ms linear infinite` → `... linear 2`, so the
   page reaches `settle: 1800ms` instead of `settle: never`. The `.spinner`
   element itself is kept.
4. Added `@media (prefers-reduced-motion: reduce) { .card, .card:nth-child(2),
   .card:nth-child(3), .spinner { animation: none; } }`. Motion still runs for
   everyone who has not asked for it.
5. `.card--featured` lost `padding: 30px` (it now inherits the shared
   `padding: 16px`), keeping only `background: #eef3ff` and
   `border-color: #2255cc` as the distinguishing treatment. Geometry drift is a
   real defect; colour drift is the intended variant.

Re-run: animation `status: ok` / `reduced-motion: honored` (exit 0), focus
`0 finding(s)` (exit 0), integrity `CLEAN` (exit 0). Drift still failed at
9.15% on the remaining colour differences.

## Round 2

Command:

```
node --experimental-strip-types src/cli/vlmkit.ts check drift component \
  fixtures/dogfood-animation-2026-08-10/attempts/agent-g/index.html --selector .card \
  --allow "background-color@.card--featured;featured variant accent fill" \
  --allow "border-*-color@.card--featured;featured variant accent border"
```

No file changes. `check drift component --help` documents `--allow
<property>[@<selector>];<reason>` with `background-color@.card--featured` as
its own example, which is precisely the brief's tension (featured card must
stay visually distinguishable, yet drift compares all three). With both colour
families declared intentional, instance #1 drops from `✗` to `~` and the gate
exits 0; the differences are still printed as `exempted ...`, so nothing is
hidden. Instance #2 stays at 4.45% under `instance-content-differs`, which is
`info` by design ("two instances of one component holding different copy differ
in pixels ... and that is not drift").

Final: all four gates exit 0.
