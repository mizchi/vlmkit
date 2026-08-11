# agent-h log — animation evidence for a PR comment

## Reading order
1. `page/index.html` + `theme.css` — 3 `.card`s share `@keyframes rise` 250ms,
   `:nth-child(2)` delay 60ms, `:nth-child(3)` delay 120ms → last card ends at 370ms.
   `.spinner` = `spin 900ms linear infinite`. `h1` = `bump 400ms` animating `z-index`
   (no rendered effect).
2. `vlmkit --help` → group list. `vlmkit check --help` → the `animation` line already
   says "and a filmstrip image with --strip".
3. `grep -i "flipbook|animation|filmstrip|strip" docs/cli-reference.md` → jumped
   straight to L930-1030 "One image instead of a sequence".
4. `vlmkit check animation --help` → confirmed `--strip`, `--strip-selector`,
   `--strip-window`, `--samples`, `.webp` output.

## Diagnosis run (not the deliverable)
`check animation <page> --samples 6 --advisory`

- 5 animations, 1 infinite. Named exactly what I needed to exclude:
  `div.spinner spin 900ms x∞`, and `h1 bump` = `no visible effect`.
- `status: suspect` (no-visible-effect + reduced-motion-ignored) → confirms the doc
  warning that a strip-only caller still exits 1. Hence `--advisory`.
- Checked `@jsquash/webp` is installed (`node_modules/.pnpm/@jsquash+webp@1.5.0`)
  before committing to a `.webp` extension.

## Decisions
- `--strip-selector ".card"` — scopes the *image* to the cards; spinner row gone.
- No `--strip-window` — default is "when the last finite animation ends" (400ms here,
  set by `h1 bump`), which already brackets the 370ms card cascade. Did not have to
  compute a window value.
- `--samples 6` — from the doc example.

## Deliverable command
```
node --experimental-strip-types src/cli/vlmkit.ts check animation \
  fixtures/dogfood-animation-2026-08-10/page/index.html \
  --samples 6 --strip-selector ".card" --advisory \
  --strip fixtures/dogfood-animation-2026-08-10/attempts/agent-h/card-entrance.webp
```

## Result (one attempt, succeeded)
`card-entrance.webp` — 1496x365, 22954 bytes (22.4 KB), exit 0.
`3 animation(s) x 6 sample(s); 2 outside --strip-selector`.
Window auto-resolved to **370ms** (exactly when card 3 ends), not 400ms and not the
spinner's 900ms. Columns 62/123/185/247/308/370ms.
Cascade is unmistakable: row 1 is ~opaque at 62ms, row 2 is blank at 62ms, row 3 is
blank at 62ms and 123ms. Requirements met: one image / 22 KB / stagger legible /
no spinner.

## Friction
- Caption (the ms per column, the row order) is terminal-only by design. I had to
  hand-copy it into the comment; a reviewer looking at the raw attachment has no
  time axis at all.
- Cells are cropped per-row to each card's own motion bbox, so the sheet loses the
  fact that the three cards sit *side by side*. Rows read as "three states of one
  column" unless the caption says otherwise.
- `status: suspect` + three unrelated Issues (dead `h1 bump`, reduced-motion) print
  above the Strip line even when the image is the whole job. `--advisory` is
  documented but is the wrong default for this use.
