# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/mobile.png` (864×1821)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/implementation/page.html`
Capture: DPR 2 (432×911 CSS px)

**Pixel diff**: 22.57% (355241 of 1574208 pixels)

**Landscape diff**: 2.52% coarse (97.48% similarity, 12/128 changed cells, 8×16 grid)

**Goal**: `app` (Practical app) — **pass**

Practical app pass: landscape 2.52% <= 3.00%, pixel 22.57% <= 25.00%

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/mobile.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/mobile/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/mobile/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r15 c2 | 216,1707 108×114 | 11.8% | `#c2c9c4` ink 0.21 | `#9cb0a5` ink 0.31 |
| r14 c1 | 108,1593 108×114 | 11.4% | `#d1d3cc` ink 0.16 | `#f0eee6` ink 0.04 |
| r15 c5 | 540,1707 108×114 | 10.9% | `#c3c9c4` ink 0.21 | `#9fb3a8` ink 0.30 |
| r14 c2 | 216,1593 108×114 | 10.3% | `#c7cbc5` ink 0.19 | `#e4e4db` ink 0.08 |
| r15 c6 | 648,1707 108×114 | 10.2% | `#c6ccc7` ink 0.20 | `#a4b7ac` ink 0.28 |
| r14 c6 | 648,1593 108×114 | 9.6% | `#d3d7d0` ink 0.14 | `#efede4` ink 0.03 |
| r8 c5 | 540,910 108×114 | 9.4% | `#faf9f7` ink 0.01 | `#dee3e0` ink 0.10 |
| r15 c3 | 324,1707 108×114 | 9.2% | `#c6ccc7` ink 0.19 | `#a8b9af` ink 0.27 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 34.0 | `region "Recent notes"` | 64,913 736×515 | fluid-unbounded | content | none | grid | 9.4% | 98.1% | 1 landscape cell(s), 2 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 33.1 | `region "Blog content"` | 64,515 736×1373 | fluid-unbounded | content | none | grid | 10.4% | 91.0% | 8 landscape cell(s), 5 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 29.8 | `region "Follow the notes"` | 64,1594 736×294 | fluid-unbounded | content | none | grid | 10.5% | 77.2% | 7 landscape cell(s), 1 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 25.7 | `main "Engineering notes for systems that outlive the sprint."` | 0,150 864×1806 | bounded max 1324px | content | none | block | 10.4% | 61.4% | 8 landscape cell(s), 7 heatmap region(s) | fix landmark geometry / spacing / section placement |

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 70.6 | `complementary "Topics"` | 64,1460 736×102 | fluid-unbounded | content | none | flex | 0.0% | 70.6% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 10.2 | `region "Engineering notes for systems that outlive the sprint."` | 64,202 736×287 | bounded max 760px | content | none | block | 0.0% | 10.2% | 0 landscape cell(s), 2 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 4.8 | `banner` | 0,0 864×150 | bounded max 1324px | content | none | grid | 0.0% | 4.8% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #1 | 65,942 732×470 | 64,966 736×462 | +24 / -1 / +4 / -8 | 0.913 |
| #2 | 64,504 733×367 | 64,514 736×366 | +10 / 0 / +3 / -1 | 0.946 |
| #3 | 65,1546 732×213 | 0,148 864×2 | -1398 / -65 / +132 / -211 | 0 |
| #4 | 703,648 47×49 | 308,39 85×38 | -609 / -395 / +38 / -11 | 0 |
| #5 | 593,631 171×145 | 348,608 119×23 | -23 / -245 / -52 / -122 | 0 |
| #6 | 0,152 864×4 | 594,626 172×144 | +474 / +594 / -692 / +140 | 0 |
| #7 | 181,598 68×27 | 498,255 76×42 | -343 / +317 / +8 / +15 | 0 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 56,1490 | 752×331 | 142185 | `#fcfbfa` | `text` |
| 64,504 | 745×437 | 35420 | `#fefdfb` | `text` |
| 64,942 | 736×477 | 19325 | `#fefdfb` | `text` |
| 65,252 | 343×45 | 6852 | `#fdfdfb` | `text`? |
| 63,38 | 152×41 | 3628 | `#f4f3f2` | `text`? |
| 98,590 | 151×41 | 3124 | `#f9f9f6` | `text`? |
| 348,598 | 156×33 | 3021 | `#fcfbf7` | `text`? |
| 65,303 | 142×43 | 2988 | `#fdfbf8` | `text`? |

## Text-row Δy

Target has 34 text rows; current has 33.

**Count mismatch** — current is missing rows of content (or has spurious extras). Add the missing elements before tweaking CSS.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #0 | 58 | 62 | +4px |
| #1 | 122 | 117 | -5px |
| #2 | 154 | 217 | +63px |
| #3 | 217 | 272 | +55px |
| #4 | 273 | 326 | +53px |
| #5 | 323 | 396 | +73px |
| #6 | 382 | 434 | +52px |
| #7 | 416 | 468 | +52px |
| #8 | 446 | 566 | +120px |
| #9 | 558 | 686 | +128px |
| #10 | 606 | 829 | +223px |
| #11 | 704 | 930 | +226px |

**Typography mismatches** — per-row font-size / weight estimated from band height and ink density. Estimates are heuristic (snapped to nearest UI bucket); large jumps (e.g. 16px → 24px, regular → bold) are reliable.

| Rank | Target | Current | Kind |
|---|---|---|---|
| #0 | 48px light | 48px regular | weight |
| #1 | 22px light | 24px regular | size |
| #2 | 10px bold | 20px bold | size |
| #3 | 13px medium | 48px regular | both |
| #5 | 48px regular | 28px regular | size |
| #6 | 24px regular | 28px regular | size |
| #7 | 24px regular | 22px medium | both |
| #8 | 18px medium | 20px regular | both |
| #9 | 18px light | 72px light | size |
| #10 | 40px regular | 24px medium | both |
| #11 | 72px light | 24px regular | both |
| #13 | 16px light | 28px regular | both |

**Spacing fixes** — per-gap delta between consecutive text rows. The fix is on the *preceding* element: if the gap above row #N is +6px, reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.

| Above → Below | Target gap | Current gap | Δgap | Suggested fix |
|---|---|---|---|---|
| #0 → #1 | 64px | 55px | -9px | add 9px to preceding element's bottom space |
| #1 → #2 | 32px | 100px | +68px | reduce preceding element's bottom space by 68px |
| #2 → #3 | 63px | 55px | -8px | add 8px to preceding element's bottom space |
| #3 → #4 | 56px | 54px | -2px | add 2px to preceding element's bottom space |
| #4 → #5 | 50px | 70px | +20px | reduce preceding element's bottom space by 20px |
| #5 → #6 | 59px | 38px | -21px | add 21px to preceding element's bottom space |
| #7 → #8 | 30px | 98px | +68px | reduce preceding element's bottom space by 68px |
| #8 → #9 | 112px | 120px | +8px | reduce preceding element's bottom space by 8px |
| #9 → #10 | 48px | 143px | +95px | reduce preceding element's bottom space by 95px |
| #10 → #11 | 98px | 101px | +3px | reduce preceding element's bottom space by 3px |
| #11 → #12 | 113px | 67px | -46px | add 46px to preceding element's bottom space |
| #12 → #13 | 103px | 29px | -74px | add 74px to preceding element's bottom space |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#fefdfb` | `#fefdfb` |

_(target outer and inner are the same; page is a single solid background.)_

## Palette diff

`Nearest` column: Euclidean RGB distance to the closest color on the other side. ≤ 30 = likely AA / quantization noise; > 60 = real palette gap.

| Side | Color | Share | Nearest |
|---|---|---|---|
| missing | `#244434` | 1.3% | 23 (near, likely AA) |
| extra | `#143434` | 2.3% | 23 (near, likely AA) |
| extra | `#2c5c54` | 1.9% | 40 (close) |
| extra | `#dcd4cc` | 1.4% | 28 (near, likely AA) |
| extra | `#5c6464` | 0.9% | 75 |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
/* HTML: add 1 row(s) of content — target has 34, current has 33 */
/* row #0: font-weight: 300; */
/* row #1: font-size: 22px; font-weight: 300; */
/* row #2: font-size: 10px; */
/* row #3: font-size: 13px; font-weight: 500; */
/* row #5: font-size: 48px; */
/* row #6: font-size: 24px; */
/* row #0: add margin-bottom by ~9px (target gap 64, current 55) */
/* row #1: reduce margin-bottom by ~68px (target gap 32, current 100) */
/* row #2: add margin-bottom by ~8px (target gap 63, current 55) */
/* row #3: add margin-bottom by ~2px (target gap 56, current 54) */
/* row #4: reduce margin-bottom by ~20px (target gap 50, current 70) */
/* row #5: add margin-bottom by ~21px (target gap 59, current 38) */
/* region 56,1490 752×331: color: #fcfbfa (text) */
/* region 64,504 745×437: color: #fefdfb (text) */
/* region 64,942 736×477: color: #fefdfb (text) */
/* region 65,252 343×45: color: #fdfdfb (text) */
/* region 63,38 152×41: color: #f4f3f2 (text) */
/* region 98,590 151×41: color: #f9f9f6 (text) */
```

## Suggested next step

1. Start with the `region "Recent notes"` landmark. Its coarse landscape cells changed, so fix section geometry, spacing, and placement before chasing local colors.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
