# External-asset fixture — the load-mechanism gate

**Every defect on this page is declared in `style.css`, never in `page.html`.**

That is the whole point. A gate that loads the markup with
`page.setContent(await readFile(file))` gets a document whose base URL is
`about:blank`, so `<link rel="stylesheet" href="style.css">` never loads and the
gate measures unstyled markup — reporting a clean page.

Measured before the fix (2026-08-02): `check a11y contrast` reported
**0 failures** here, and **1 failure** when the identical CSS was inlined in a
`<style>` block. `check integrity`, which navigates to the file URL, reported the
same defect correctly at 1.92:1.

## What each defect is for

| Class | Declared in CSS as | Gate that should catch it |
|---|---|---|
| Contrast | `.low-contrast { color: #bbbbbb }` — 1.92:1 on white | `check a11y contrast`, `check integrity` |
| Touch target | `.tiny-tap { width: 20px; height: 20px }` | `check a11y touch` |
| Invisible copy | `.hidden-copy { font-size: 0 }` (with `copy.txt`) | `check copy --manifest copy.txt` |
| Spacing outlier | `.off-scale { padding-top: 23px }` against 24px | `check design` |
| Component drift | `.btn-a/.btn-b/.btn-c` — 4 buttons, 3 styles | `check design` |

## Gate criterion

Any gate that accepts an HTML file must report the same findings here as it does
on a copy with the CSS inlined. If the two disagree, the gate is not resolving
relative assets, and its verdict on any real project — where CSS lives in its
own file — means nothing.
