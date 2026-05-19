# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/mobile.png` (864×1821)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/implementation/page.html`
DPR hint: portrait target 864×1821 looks like a 2x mobile mock; try `--dpr 2` to render at 432×911 CSS px.

**Pixel diff**: 32.03% (503909 of 1573344 pixels)

**Landscape diff**: 4.64% coarse (95.36% similarity, 18/128 changed cells, 8×16 grid)

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/mobile.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/mobile-no-dpr/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/mobile-no-dpr/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r11 c5 | 540,1251 108×114 | 26.9% | `#fbfaf8` ink 0.01 | `#abbcb3` ink 0.26 |
| r15 c5 | 540,1707 108×114 | 20.1% | `#c3c9c4` ink 0.21 | `#faf9f7` ink 0.00 |
| r15 c3 | 324,1707 108×114 | 19.3% | `#c6ccc7` ink 0.19 | `#fbfaf8` ink 0.00 |
| r15 c1 | 108,1707 108×114 | 19.2% | `#c6ccc7` ink 0.20 | `#fafaf9` ink 0.01 |
| r15 c6 | 648,1707 108×114 | 19.1% | `#c6ccc7` ink 0.20 | `#faf9f7` ink 0.00 |
| r15 c4 | 432,1707 108×114 | 18.9% | `#c6ccc7` ink 0.19 | `#faf9f7` ink 0.00 |
| r14 c3 | 324,1593 108×114 | 18.8% | `#c9cdc7` ink 0.18 | `#fbfaf9` ink 0.00 |
| r14 c4 | 432,1593 108×114 | 16.4% | `#ced2cc` ink 0.16 | `#faf9f7` ink 0.00 |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #2 | 64,504 733×367 | 479,1282 173×44 | +778 / +415 / -560 / -323 | 0 |
| #3 | 65,1546 732×213 | 154,781 74×110 | -765 / +89 / -658 / -103 | 0 |
| #4 | 703,648 47×49 | 261,1570 96×27 | +922 / -442 / +49 / -22 | 0 |
| #5 | 593,631 171×145 | 80,86 75×34 | -545 / -513 / -96 / -111 | 0 |
| #6 | 0,152 864×4 | 454,1100 360×245 | +948 / +454 / -504 / +241 | 0 |
| #7 | 181,598 68×27 | 0,154 864×1 | -444 / -181 / +796 / -26 | 0 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 21,174 | 821×1243 | 382569 | `#fdfdfb` | `text` |
| 91,1670 | 680×75 | 30650 | `#2b4b3b` | `text`? |
| 65,1535 | 732×230 | 3718 | `#fcfaf5` | `text`? |
| 55,38 | 174×41 | 3584 | `#fbfbfa` | `text`? |
| 89,241 | 106×95 | 3302 | `#fbfbfa` | `text` |
| 252,1570 | 112×27 | 2572 | `#faf7f1` | `filled-rect` |
| 703,648 | 47×49 | 2215 | `#e8e1d4` | `text` |
| 0,152 | 864×4 | 2128 | — | `filled-rect` |

## Text-row Δy

Target has 34 text rows; current has 55.

**Count mismatch** — current is missing rows of content (or has spurious extras). Add the missing elements before tweaking CSS.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #0 | 58 | 83 | +25px |
| #1 | 122 | 191 | +69px |
| #2 | 154 | 206 | +52px |
| #3 | 217 | 251 | +34px |
| #4 | 273 | 296 | +23px |
| #5 | 323 | 343 | +20px |
| #6 | 382 | 371 | -11px |
| #7 | 416 | 385 | -31px |
| #8 | 446 | 434 | -12px |
| #9 | 558 | 451 | -107px |
| #10 | 606 | 466 | -140px |
| #11 | 704 | 482 | -222px |

**Typography mismatches** — per-row font-size / weight estimated from band height and ink density. Estimates are heuristic (snapped to nearest UI bucket); large jumps (e.g. 16px → 24px, regular → bold) are reliable.

| Rank | Target | Current | Kind |
|---|---|---|---|
| #0 | 48px light | 72px light | size |
| #1 | 22px light | 11px bold | both |
| #3 | 13px medium | 48px regular | both |
| #4 | 48px regular | 48px light | weight |
| #5 | 48px regular | 28px light | both |
| #6 | 24px regular | 16px medium | both |
| #7 | 24px regular | 13px regular | size |
| #8 | 18px medium | 16px light | both |
| #9 | 18px light | 10px bold | both |
| #10 | 40px regular | 10px bold | both |
| #11 | 72px light | 16px regular | both |
| #12 | 24px regular | 10px bold | both |

**Spacing fixes** — per-gap delta between consecutive text rows. The fix is on the *preceding* element: if the gap above row #N is +6px, reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.

| Above → Below | Target gap | Current gap | Δgap | Suggested fix |
|---|---|---|---|---|
| #0 → #1 | 64px | 108px | +44px | reduce preceding element's bottom space by 44px |
| #1 → #2 | 32px | 15px | -17px | add 17px to preceding element's bottom space |
| #2 → #3 | 63px | 45px | -18px | add 18px to preceding element's bottom space |
| #3 → #4 | 56px | 45px | -11px | add 11px to preceding element's bottom space |
| #4 → #5 | 50px | 47px | -3px | add 3px to preceding element's bottom space |
| #5 → #6 | 59px | 28px | -31px | add 31px to preceding element's bottom space |
| #6 → #7 | 34px | 14px | -20px | add 20px to preceding element's bottom space |
| #7 → #8 | 30px | 49px | +19px | reduce preceding element's bottom space by 19px |
| #8 → #9 | 112px | 17px | -95px | add 95px to preceding element's bottom space |
| #9 → #10 | 48px | 15px | -33px | add 33px to preceding element's bottom space |
| #10 → #11 | 98px | 16px | -82px | add 82px to preceding element's bottom space |
| #11 → #12 | 113px | 14px | -99px | add 99px to preceding element's bottom space |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#fefdfb` | `#faf9f7` |

_(target outer and inner are the same; page is a single solid background.)_

## Palette diff

`Nearest` column: Euclidean RGB distance to the closest color on the other side. ≤ 30 = likely AA / quantization noise; > 60 = real palette gap.

| Side | Color | Share | Nearest |
|---|---|---|---|
| missing | `#244434` | 1.3% | 23 (near, likely AA) |
| extra | `#143434` | 0.7% | 23 (near, likely AA) |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
body { background: #fefdfb; }
/* HTML: remove 21 row(s) of content — target has 34, current has 55 */
/* row #0: font-size: 48px; */
/* row #1: font-size: 22px; font-weight: 300; */
/* row #3: font-size: 13px; font-weight: 500; */
/* row #4: font-weight: 400; */
/* row #5: font-size: 48px; font-weight: 400; */
/* row #6: font-size: 24px; font-weight: 400; */
/* row #0: reduce margin-bottom by ~44px (target gap 64, current 108) */
/* row #1: add margin-bottom by ~17px (target gap 32, current 15) */
/* row #2: add margin-bottom by ~18px (target gap 63, current 45) */
/* row #3: add margin-bottom by ~11px (target gap 56, current 45) */
/* row #4: add margin-bottom by ~3px (target gap 50, current 47) */
/* row #5: add margin-bottom by ~31px (target gap 59, current 28) */
/* region 21,174 821×1243: color: #fdfdfb (text) */
/* region 91,1670 680×75: color: #2b4b3b (text) */
/* region 65,1535 732×230: color: #fcfaf5 (text) */
/* region 55,38 174×41: color: #fbfbfa (text) */
/* region 89,241 106×95: color: #fbfbfa (text) */
/* region 252,1570 112×27: background: #faf7f1 */
```

## Suggested next step

1. Open the target and current PNGs side-by-side. Use the heatmap region table to localize diff areas.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
