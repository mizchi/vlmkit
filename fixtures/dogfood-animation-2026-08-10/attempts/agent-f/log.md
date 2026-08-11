# agent-f — animation evidence for a PR comment

Target: `fixtures/dogfood-animation-2026-08-10/page/index.html`
Reviewer requirements: (1) one image, (2) small attachment, (3) answers
staggered-vs-simultaneous, (4) no loading spinner.

## Round 1

```bash
node --experimental-strip-types src/cli/vlmkit.ts check animation \
  fixtures/dogfood-animation-2026-08-10/page/index.html \
  --samples 6 --strip-selector '.card' \
  --strip fixtures/dogfood-animation-2026-08-10/attempts/agent-f/cards.webp \
  --advisory
```

Produced `cards.webp`, 1496x365, 23.4 KB, 3 rows x 6 columns.
Printed caption: `columns are 67ms / 133ms / 200ms / 267ms / 333ms / 400ms on the
page timeline (window 400ms, one shared clock)` and
`3 animation(s) x 6 sample(s); 2 outside --strip-selector`.

Requirements: (1) yes, one file. (2) yes, 23.4 KB. (3) yes — the cells form a
clear diagonal: at column 1 card 3 is still blank while card 1 is already
half-opaque. (4) yes — `--strip-selector '.card'` dropped the spinner row and the
dead `h1 bump` row (the "2 outside" in the output).

All four met on the first command. Kept a rough edge: the default window was
**400 ms**, set by `h1 bump` — an animation the same run reports as
`no visible effect`. The cards finish at 370 ms, so column 6 was a settled
duplicate of column 5.

## Round 2

```bash
node --experimental-strip-types src/cli/vlmkit.ts check animation \
  fixtures/dogfood-animation-2026-08-10/page/index.html \
  --samples 6 --strip-window 370 --strip-selector '.card' \
  --strip fixtures/dogfood-animation-2026-08-10/attempts/agent-f/cards-370.webp
```

`cards-370.webp`, 1496x365, **22.4 KB**. Columns now
`62 / 123 / 185 / 247 / 308 / 370 ms` — 370 = 120 ms delay + 250 ms duration,
which I had to derive myself from the CSS even though the run had already printed
every duration. Last column is now the real end state instead of a duplicate.
This is the shipped image.

Also confirmed: without `--advisory` the command exits **1** (the page has a dead
`bump` animation and ignores `prefers-reduced-motion`), even though the strip was
written successfully. Documented, but it means "make me an attachment" is a
failing command by default.

Requirements after round 2: all four, one file, 22.4 KB, cascade legible, no
spinner.
