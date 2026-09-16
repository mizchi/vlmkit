# v3: the readers, frozen

The v1 and v2 rounds ended with the same open item: **nobody had looked at a
slide.** Every check in the loop reads the page or the figure's geometry, and
the two defects that reached a delivered deck were visible on the slide and
invisible to all of them.

v3 is the A/B that answers it. One deck — writer `f`'s, from v2 — rendered
twice:

- **arm A**: the pre-fix builder (`git show e6e316d^`), i.e. the deck exactly as
  `f` delivered it. Three bullets end mid-sentence and their tails are hoisted
  above the list as loose paragraphs.
- **arm B**: the same `deck.md` with the current builder. One sentence per
  bullet.

Four readers, each shown one arm's PNGs and nothing else — no HTML, no
`copy.txt`, no `slides.json`, no repo. Two models, two arms:

| reading | model | arm | read | fidelity | splits diagnosed | issues reported |
|---|---|---|---|---|---|---|
| `reading-r1.json` | sonnet | A (as delivered) | 19/21 | **0.70** | 1 | 7 |
| `reading-r2.json` | haiku | A (as delivered) | 19/21 | **0.70** | 1 | 2 |
| `reading-r3.json` | sonnet | B (fixed) | 21/21 | **1.00** | 0 | 0 |
| `reading-r4.json` | sonnet→haiku | B (fixed) | 21/21 | **1.00** | 0 | 0 |

Both readers of the broken arm caught it; neither reader of the fixed arm had
anything to report. `slides.json` is arm B's sheet — the ground truth both arms
were scored against, which is what `--sheet` exists for.

`arm-a/slide-04.png` and `arm-b/slide-04.png` are the same slide in both
renders: the worst one, three hoisted fragments in A, clean in B. Re-score any
reading here with

```sh
node .claude/skills/d2-slides/assets/deck-review.mjs <a-build> \
  --answers fixtures/d2-slides-scenario/v3/reading-r1.json \
  --sheet   fixtures/d2-slides-scenario/v3/slides.json
```

Report: `docs/reports/2026-09-16-d2-slides-v3.md`.
