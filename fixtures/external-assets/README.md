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
| Focus order | `#focus-a/b/c` absolutely positioned at x=700/20/360 | `check a11y focus` |
| Instance drift | `.tile--wrong { padding: 28px }` against `.tile`'s 12px | `check drift component --selector .tile` |

The last two rows were added on 2026-08-10 for the two gates that still read the
file through `setContent`. Both read **geometry** rather than a style value, so
the failure is not a degraded number — it is the opposite verdict:

| Gate | `setContent` (before) | navigation (after) |
|---|---|---|
| `check a11y focus` | **0 findings, exit 0** | `reverse` finding (x=700 → x=20), exit 1 |
| `check drift component` | 1.06% / 1.32%, `Δ 0 / 0`, exit 0 | 98.74%, `Δ +32 / +32`, exit 1 |

Unstyled, all three tiles are identical full-width boxes and the only difference
left is the glyphs "Alpha" / "Beta" / "Gamma" — which is what the ~1% was. The
`+32` is arithmetic from the CSS (28px padding against 12px, both sides), which
is why `external-assets-load.test.ts` asserts it exactly and leaves the
antialiasing-sensitive percentage alone.

## Gate criterion

Any gate that accepts an HTML file must report the same findings here as it does
on a copy with the CSS inlined. If the two disagree, the gate is not resolving
relative assets, and its verdict on any real project — where CSS lives in its
own file — means nothing.
