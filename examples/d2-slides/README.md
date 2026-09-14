# d2-slides — the worked example

`deck.md` is a real deck: eight slides about the `d2-diagram` validation rounds,
every figure a ```d2 fence laid out by TALA. `built/` is what the builder makes
from it, committed so the example can be opened and diffed without a `d2`
install.

```sh
pnpm deck:example        # = build-deck.mjs examples/d2-slides/deck.md --out examples/d2-slides/built
```

Open `built/index.html`; arrows and space move, `o` is the overview, `p` prints.

Run that after any edit to `deck.md`: `tests/d2-slides.test.mjs` compares the
committed manifest and slide structure against a fresh build, and the
`d2-slides` workflow compares every byte with the pinned `d2`. A committed
build that has drifted from its source is worse than no committed build.

## The gates, as run on this deck

```sh
npx vlmkit check integrity examples/d2-slides/built/index.html
#   verdict: CLEAN — 1280x800 ink 82.0%, 768x900 44.0%, 375x700 27.9%

npx vlmkit check integrity examples/d2-slides/built/print.html --viewports 1280
#   verdict: CLEAN — 8 components, 96 text blocks

npx vlmkit check copy examples/d2-slides/built/print.html \
  --manifest examples/d2-slides/built/copy.txt --allow-invisible unknown
#   manifest: 26 lines, missing 0

npx vlmkit check a11y contrast examples/d2-slides/built/print.html
#   inspected 133 text-bearing element(s) — 0 contrast failure(s)
```

Three of those were failures first, and the fixes are in the builder: a 1280px
stage centred as a grid item painted nothing at 375px, a percentage height
inside a padded frame clipped 114px on every slide, and a centred split layout
cut long bullets off at both ends. The skill file records each one.

All four runs are the `d2-slides` workflow's steps, which also proves the gates
still gate: it appends a sentence the deck never says to `copy.txt` (must report
`copy-missing`) and shortens `--stage-h` to 260px (must report
`clipped-content`), and fails if either exits 0.

## The copy gate's `unknown` invisibility, reproduced

`--allow-invisible unknown` is not decoration. Eight of this deck's 26 manifest
lines are reported as `copy-invisible (reason: unknown)` while being plainly on
the slide. It is reproducible with nothing but the builder:

```sh
cat > /tmp/probe/deck.md <<'EOF'
---
title: probe
---

## Split slide

- `d2 validate` reads **syntax**. The renderers draw whatever the file says.
- There is no `--expect`, no layout report, and no collision check.
- Worst: a reference to an id **not in scope creates a new shape**.

```d2
direction: right
a -> b
```
EOF
# → 3 invisible-only
```

The same three lines with the markup removed pass, and so do shorter lines that
carry the same markup, and so does one long line with markup among plain ones —
so it is neither wrapping, nor markup, nor the split layout on its own. The
`missing` count is unaffected in every case, which is why the deck's loop reads
that number and accepts the class.

Worth chasing in the copy gate rather than in the deck: a manifest line whose
rendered text is assembled from several inline children should not be reported
as text a user cannot see.
