# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/mobile.png` (864×1821)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/implementation/page.html`
Capture: DPR 2 (432×911 CSS px)

**Pixel diff**: 29.18% (459350 of 1574208 pixels)

**Landscape diff**: 5.54% coarse (94.46% similarity, 31/128 changed cells, 8×16 grid)

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/mobile.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/mobile/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/mobile/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r7 c2 | 216,796 108×114 | 23.6% | `#f9f9f7` ink 0.01 | `#b6c1bf` ink 0.25 |
| r15 c2 | 216,1707 108×114 | 22.0% | `#c2c9c4` ink 0.21 | `#fefefe` ink 0.00 |
| r15 c5 | 540,1707 108×114 | 21.3% | `#c3c9c4` ink 0.21 | `#fdfdfd` ink 0.01 |
| r15 c3 | 324,1707 108×114 | 20.9% | `#c6ccc7` ink 0.19 | `#ffffff` ink 0.00 |
| r15 c4 | 432,1707 108×114 | 20.8% | `#c6ccc7` ink 0.19 | `#ffffff` ink 0.00 |
| r7 c3 | 324,796 108×114 | 20.6% | `#fdfcfa` ink 0.00 | `#c2cbca` ink 0.21 |
| r14 c3 | 324,1593 108×114 | 18.6% | `#c9cdc7` ink 0.18 | `#fafafa` ink 0.02 |
| r14 c4 | 432,1593 108×114 | 18.4% | `#ced2cc` ink 0.16 | `#ffffff` ink 0.00 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 42.8 | `complementary "Topics"` | 64,1231 736×738 | fluid-unbounded | content | none | block | 20.3% | 90.0% | 6 landscape cell(s), 4 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 28.9 | `region "Blog content"` | 64,625 736×3892 | fluid-unbounded | content | none | block | 20.8% | 32.7% | 8 landscape cell(s), 5 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 28.5 | `main "Engineering notes for systems that outlive the sprint."` | 0,180 864×4457 | bounded max 1324px | content | none | block | 20.8% | 31.0% | 8 landscape cell(s), 6 heatmap region(s) | fix landmark geometry / spacing / section placement |

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 26.1 | `region "Engineering notes for systems that outlive the sprint."` | 64,232 736×333 | bounded max 760px | content | none | block | 0.0% | 26.1% | 0 landscape cell(s), 2 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 6.9 | `navigation "Primary"` | 64,120 736×58 | fluid-unbounded | content | none | flex | 0.0% | 6.9% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 6.2 | `banner` | 0,0 864×180 | bounded max 1324px | content | none | block | 0.0% | 6.2% | 0 landscape cell(s), 2 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #2 | 64,504 733×367 | 612,871 92×78 | +367 / +548 / -641 / -289 | 0 |
| #3 | 65,1546 732×213 | 0,178 864×2 | -1368 / -65 / +132 / -211 | 0 |
| #4 | 703,648 47×49 | 308,39 85×38 | -609 / -395 / +38 / -11 | 0 |
| #5 | 593,631 171×145 | 130,307 73×42 | -324 / -463 / -98 / -103 | 0 |
| #6 | 0,152 864×4 | 571,307 69×42 | +155 / +571 / -795 / +38 | 0 |
| #7 | 181,598 68×27 | 683,307 69×30 | -291 / +502 / +1 / +3 | 0 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 11,493 | 846×1328 | 270427 | `#fefdfb` | `text` |
| 91,1671 | 683×66 | 31562 | `#2b4a3b` | `text`? |
| 116,302 | 231×47 | 4807 | `#fdfcfa` | `text`? |
| 63,38 | 152×41 | 3568 | `#f4f3f2` | `text`? |
| 244,1565 | 154×40 | 2575 | `#fbf7f2` | `filled-rect` |
| 124,590 | 136×40 | 2328 | `#fdfbf8` | `text`? |
| 97,1738 | 667×5 | 2075 | `#f6f7f6` | `filled-rect` |
| 0,152 | 864×4 | 1896 | — | `filled-rect` |

## Text-row Δy

Target has 34 text rows; current has 20.

**Count mismatch** — current is missing rows of content (or has spurious extras). Add the missing elements before tweaking CSS.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #0 | 58 | 62 | +4px |
| #1 | 122 | 137 | +15px |
| #2 | 154 | 247 | +93px |
| #3 | 217 | 320 | +103px |
| #4 | 273 | 382 | +109px |
| #5 | 323 | 466 | +143px |
| #6 | 382 | 506 | +124px |
| #7 | 416 | 543 | +127px |
| #8 | 446 | 687 | +241px |
| #9 | 558 | 719 | +161px |
| #10 | 606 | 785 | +179px |
| #11 | 704 | 912 | +208px |

**Typography mismatches** — per-row font-size / weight estimated from band height and ink density. Estimates are heuristic (snapped to nearest UI bucket); large jumps (e.g. 16px → 24px, regular → bold) are reliable.

| Rank | Target | Current | Kind |
|---|---|---|---|
| #0 | 48px light | 48px medium | weight |
| #1 | 22px light | 24px regular | size |
| #2 | 10px bold | 20px bold | size |
| #3 | 13px medium | 56px regular | both |
| #4 | 48px regular | 56px regular | size |
| #5 | 48px regular | 28px regular | size |
| #6 | 24px regular | 28px regular | size |
| #7 | 24px regular | 22px medium | both |
| #8 | 18px medium | 20px medium | size |
| #9 | 18px light | 24px medium | both |
| #10 | 40px regular | 48px medium | both |
| #12 | 24px regular | 28px regular | size |

**Spacing fixes** — per-gap delta between consecutive text rows. The fix is on the *preceding* element: if the gap above row #N is +6px, reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.

| Above → Below | Target gap | Current gap | Δgap | Suggested fix |
|---|---|---|---|---|
| #0 → #1 | 64px | 75px | +11px | reduce preceding element's bottom space by 11px |
| #1 → #2 | 32px | 110px | +78px | reduce preceding element's bottom space by 78px |
| #2 → #3 | 63px | 73px | +10px | reduce preceding element's bottom space by 10px |
| #3 → #4 | 56px | 62px | +6px | reduce preceding element's bottom space by 6px |
| #4 → #5 | 50px | 84px | +34px | reduce preceding element's bottom space by 34px |
| #5 → #6 | 59px | 40px | -19px | add 19px to preceding element's bottom space |
| #6 → #7 | 34px | 37px | +3px | reduce preceding element's bottom space by 3px |
| #7 → #8 | 30px | 144px | +114px | reduce preceding element's bottom space by 114px |
| #8 → #9 | 112px | 32px | -80px | add 80px to preceding element's bottom space |
| #9 → #10 | 48px | 66px | +18px | reduce preceding element's bottom space by 18px |
| #10 → #11 | 98px | 127px | +29px | reduce preceding element's bottom space by 29px |
| #11 → #12 | 113px | 122px | +9px | reduce preceding element's bottom space by 9px |

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
| extra | `#143434` | 2.0% | 23 (near, likely AA) |
| extra | `#5c6464` | 1.2% | 75 |
| extra | `#dcd4cc` | 0.7% | 28 (near, likely AA) |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
body { background: #fefdfb; }
/* HTML: add 14 row(s) of content — target has 34, current has 20 */
/* row #0: font-weight: 300; */
/* row #1: font-size: 22px; font-weight: 300; */
/* row #2: font-size: 10px; */
/* row #3: font-size: 13px; font-weight: 500; */
/* row #4: font-size: 48px; */
/* row #5: font-size: 48px; */
/* row #0: reduce margin-bottom by ~11px (target gap 64, current 75) */
/* row #1: reduce margin-bottom by ~78px (target gap 32, current 110) */
/* row #2: reduce margin-bottom by ~10px (target gap 63, current 73) */
/* row #3: reduce margin-bottom by ~6px (target gap 56, current 62) */
/* row #4: reduce margin-bottom by ~34px (target gap 50, current 84) */
/* row #5: add margin-bottom by ~19px (target gap 59, current 40) */
/* region 11,493 846×1328: color: #fefdfb (text) */
/* region 91,1671 683×66: color: #2b4a3b (text) */
/* region 116,302 231×47: color: #fdfcfa (text) */
/* region 63,38 152×41: color: #f4f3f2 (text) */
/* region 244,1565 154×40: background: #fbf7f2 */
/* region 124,590 136×40: color: #fdfbf8 (text) */
```

## Suggested next step

1. Start with the `complementary "Topics"` landmark. Its coarse landscape cells changed, so fix section geometry, spacing, and placement before chasing local colors.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
