# agent-b — visual evidence of the card entrance animation

Goal: ONE small image a PR reviewer can read as "how the cards move over time".

## Round 1 — `check animation`, no image flags

```
node --experimental-strip-types src/cli/vlmkit.ts check animation \
  fixtures/dogfood-animation-2026-08-10/page/index.html
```

Produced: text findings only. `animations: 5 (evaluated 1, infinite 1)`.
The one evaluated animation is `div.spinner`. **The three card `rise`
animations — the ones the reviewer asked about — were not evaluated.** They
appear in the report only under `reducedMotion.remaining`, so the tool knows
they exist and chose not to sample them. No message says so or says why.

Requirements met: one image NO (no image at all), small N/A.

## Round 2 — add `--strip`

```
... check animation page/index.html --samples 6 --strip r2-strip.png
```

Produced: `r2-strip.png (368x66, 1 animation(s) x 6 sample(s))`, 8.4 KB.
Small: yes. One image: yes. **Useful: no** — it is six frames of the 28px
spinner. Zero cards. The success line prints "1 animation(s)" without
mentioning that 4 were dropped.

## Round 3 — try to catch the cards before they finish

```
... check animation page/index.html --samples 6 --wait-until domcontentloaded --strip r3-strip.png
```

Produced: byte-for-byte identical to r2-strip.png (both 8550 bytes). Still
`evaluated 1`. `--wait-until` does not move the animation-enumeration point.
There is no `--include-finished`, `--restart-animations`, `--time-scale` or
`--at <ms>` flag.

## Round 4 — confirm the cause, then produce the deliverable

Diagnostic copy in `probe/` (NOT the fixture): `rise` 250ms -> 2500ms, and
the stagger delays 60/120ms -> 600/1200ms so relative timing is preserved.
Nothing else changed.

```
... check animation attempts/agent-b/probe/index.html --samples 6 \
  --strip attempts/agent-b/card-entrance.webp --advisory
```

Produced: `card-entrance.webp (1496x484, 4 animation(s) x 6 sample(s))`,
32568 B = **31.8 KB**. Same sheet as PNG is 71441 B = 69.8 KB, so the `.webp`
extension alone is a 2.2x saving, lossless, no flag.

**Root cause confirmed: `check animation` frame-samples only animations still
running when it enumerates. A 250ms entrance animation is over before the tool
looks, so it is silently skipped.** Slowing it 10x makes all three cards
evaluate. The image therefore documents a time-dilated copy, not the fixture.

Requirements met: one image yes, small yes (31.8 KB), faithful — only with a
disclosure.

## Honest readability assessment of the final image

Works: the opacity 0->1 fade is obvious across all six cells of each row. The
10px translateY is visible but faint (10px inside a 123px-tall crop).

Does not work:
- **No labels in the image.** No row selector, no time/percentage on any cell.
  The selectors and sample fractions exist only in terminal output, which the
  reviewer does not get. Four unlabeled rows of near-identical cards.
- **The stagger is destroyed.** Each row is sampled over its OWN animation
  progress (fractions 0..1), not a shared wall clock, and each row is cropped
  to its own element. All three rows therefore look like they start together.
  A reviewer would conclude the cards animate simultaneously. They do not
  (0 / 60 / 120ms). The image actively misleads on the one property the
  reviewer is reviewing.
- A 4th row (the spinner) nobody asked about takes ~15% of the sheet; no flag
  to select which animations go into the strip.
