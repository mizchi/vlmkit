# agent-d — one image showing the card entrance stagger

Page: `fixtures/dogfood-animation-2026-08-10/page/index.html`
(`.card { animation: rise 250ms }`, `:nth-child(2)` +60ms, `:nth-child(3)` +120ms,
plus an infinite 900ms `.spinner` and a dead `bump` on `h1`.)

## Round 1 — defaults

```
node --experimental-strip-types src/cli/vlmkit.ts check animation \
  fixtures/dogfood-animation-2026-08-10/page/index.html \
  --strip attempts/agent-d/r1.png
```

Produced `r1.png`, **1240x588, 63.2 KB**. 4 rows x 4 sample columns.
Caption printed: `columns are 225ms / 450ms / 675ms / 900ms on the page timeline
(window 900ms, one shared clock)`.

- one image: yes
- small: 63 KB, borderline
- answers staggered-or-simultaneous: **barely**. The default window is one
  iteration of the *slowest* animation, and the slowest is the infinite spinner
  (900ms). Every card is finished by 370ms, so only column 1 (225ms) holds any
  partial state; columns 2/3/4 are three identical copies of the settled page.
  9 of 12 card cells are wasted. A reviewer could squint at column 1 and infer a
  cascade, but the sheet mostly proves the animation is over.
- Exit code 1 (`status: suspect`) because of the page's own real defects
  (dead `bump`, ignored reduced-motion, infinite spinner). Correct, but it means
  a CI step that only wants an attachment fails; `--advisory` fixes that.

## Round 2 — window narrowed to the stagger

```
node --experimental-strip-types src/cli/vlmkit.ts check animation \
  fixtures/dogfood-animation-2026-08-10/page/index.html \
  --samples 6 --strip-window 380 --strip attempts/agent-d/r2.png --advisory
```

`r2.png`, **1496x484, 63.4 KB**. Caption: `columns are 63ms / 127ms / 190ms /
253ms / 317ms / 380ms (window 380ms, one shared clock)`.

Now a clean diagonal. Columns are shared page-clock instants, so the three card
rows are directly comparable:

- col 1 (63ms): 1.4.0 half-faded and low; 1.5.0 a barely-there ghost; 1.6.0 blank.
- col 2 (127ms): 1.4.0 nearly solid; 1.5.0 half-faded; 1.6.0 a ghost.

Staircase, unambiguously staggered. Requirements: one image yes, answers the
question yes, small still borderline.

## Round 3 — same sheet as lossless WebP

```
node --experimental-strip-types src/cli/vlmkit.ts check animation \
  fixtures/dogfood-animation-2026-08-10/page/index.html \
  --samples 6 --strip-window 380 --strip attempts/agent-d/cards.webp --advisory
```

`cards.webp`, **1496x484, 25.8 KB** — same pixels (lossless), 2.5x smaller than
the PNG. `@jsquash/webp` was already installed, so no cost. All three
requirements met. FINAL.

## Residual friction

- No way to scope the strip to the animation under review. Row 4 is the spinner
  (six ~34px circles plus a ~90px dead grey band under them, because the uniform
  cell height is set by the tallest card crop). ~20% of the sheet's height is
  irrelevant to the reviewer's question. `--max-animations 3` would not help:
  document order puts the dead `h1 bump` first, so capping at 3 drops card 3.
- The caption carrying the timestamps is printed to stdout only, never drawn in
  the image. Correct decision (font rendering is the thing this repo exists to
  catch) but it means the image alone does not say *when* the columns are.
- Row labels are `article:nth-of-type(1)` / `article.card.card--featured` /
  `article:nth-of-type(3)` — the featured card is named by class and its
  neighbours by index, so the reader has to work out that rows are in DOM order.
