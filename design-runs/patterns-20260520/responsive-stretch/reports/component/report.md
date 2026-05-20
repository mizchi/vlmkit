# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/responsive-stretch/target.png` (1440×900)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/responsive-stretch/current.html`

**Pixel diff**: 7.41% (96055 of 1296000 pixels)

**Landscape diff**: 0.67% coarse (99.33% similarity, 0/160 changed cells, 16×10 grid)

**Goal**: `app` (Practical app) — **pass**

Practical app pass: landscape 0.67% <= 3.00%, pixel 7.41% <= 25.00%

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/responsive-stretch/target.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/responsive-stretch/reports/component/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/responsive-stretch/reports/component/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r3 c14 | 1260,270 90×90 | 6.4% | `#c1cac1` ink 0.20 | `#d5d8cf` ink 0.14 |
| r2 c14 | 1260,180 90×90 | 6.2% | `#c6ccc4` ink 0.19 | `#d9dbd1` ink 0.13 |
| r5 c2 | 180,450 90×90 | 5.7% | `#d1dcd1` ink 0.12 | `#e4e7de` ink 0.07 |
| r2 c6 | 540,180 90×90 | 5.4% | `#cbcac2` ink 0.18 | `#d9d7cf` ink 0.12 |
| r4 c14 | 1260,360 90×90 | 4.8% | `#d0d7ce` ink 0.15 | `#e0e1d8` ink 0.10 |
| r4 c2 | 180,360 90×90 | 4.2% | `#a0bdb1` ink 0.27 | `#92b4a8` ink 0.31 |
| r4 c3 | 270,360 90×90 | 3.4% | `#dce1d9` ink 0.10 | `#d0dad2` ink 0.13 |
| r5 c1 | 90,450 90×90 | 3.4% | `#dae1d7` ink 0.09 | `#e6e8df` ink 0.06 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

No layout rows detected.

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 101.4 | `complementary "Responsive preview"` | 830,128 470×353 | fluid measured 468px | bounded min 330px | none | grid | 5.8% | 100.0% | 3 landscape cell(s), 3 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 101.2 | `region "Responsive guardrails"` | 140,531 1160×184 | fluid measured 1160px | content | none | grid | 5.0% | 100.0% | 2 landscape cell(s), 4 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 75.0 | `region "Wideframe"` | 140,122 1160×365 | fluid measured 1160px | content | none | grid | 4.8% | 73.8% | 8 landscape cell(s), 3 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 50.5 | `main "Wideframe"` | 0,70 1440×830 | fluid measured 1440px | content | none | grid | 4.9% | 49.3% | 8 landscape cell(s), 8 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 1.4 | `banner` | 0,0 1440×70 | fluid measured 1440px | bounded min 70px | none | flex | 0.0% | 1.4% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #0 | 130,72 1310×828 | 140,70 1300×830 | -2 / +10 / -10 / +2 | 0.99 |
| #1 | 0,0 1440×71 | 0,0 1440×69 | 0 / 0 / 0 / -2 | 0.972 |
| #2 | 131,537 378×181 | 534,532 372×182 | -5 / +403 / -6 / +1 | 0 |
| #3 | 531,537 378×181 | 141,532 371×182 | -5 / -390 / -7 / +1 | 0 |
| #4 | 931,537 378×181 | 928,532 371×182 | -5 / -3 / -7 / +1 | 0.92 |
| #5 | 300,415 172×46 | 310,407 172×46 | -8 / +10 / 0 / 0 | 0.637 |
| #6 | 1169,795 140×46 | 1159,793 140×46 | -2 / -10 / 0 / 0 | 0.799 |
| #7 | 128,195 97×59 | 138,196 92×56 | +1 / +10 / -5 / -3 | 0.812 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 830,128 | 480×360 | 6982 | `#f1e8db` | `text` |
| 863,193 | 418×233 | 6633 | `#205248` | `text` |
| 0,69 | 1440×3 | 4075 | — | `filled-rect` |
| 933,536 | 377×183 | 3585 | `#fdfcfa` | `text` |
| 130,536 | 374×183 | 3581 | `#fcfcfa` | `text` |
| 530,543 | 380×176 | 3158 | `#fdfdfb` | `text` |
| 1037,189 | 214×217 | 3075 | `#83cfb5` | `text`? |
| 927,531 | 370×177 | 2753 | `#fdfcf9` | `text` |

## Text-row Δy

Target has 8 text rows; current has 8.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #2 | 326 | 321 | -5px |
| #3 | 569 | 563 | -6px |
| #4 | 661 | 658 | -3px |
| #5 | 685 | 682 | -3px |
| #6 | 811 | 809 | -2px |
| #7 | 836 | 834 | -2px |

**Typography mismatches** — per-row font-size / weight estimated from band height and ink density. Estimates are heuristic (snapped to nearest UI bucket); large jumps (e.g. 16px → 24px, regular → bold) are reliable.

| Rank | Target | Current | Kind |
|---|---|---|---|
| #1 | 16px light | 13px light | size |

**Spacing fixes** — per-gap delta between consecutive text rows. The fix is on the *preceding* element: if the gap above row #N is +6px, reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.

| Above → Below | Target gap | Current gap | Δgap | Suggested fix |
|---|---|---|---|---|
| #1 → #2 | 162px | 157px | -5px | add 5px to preceding element's bottom space |
| #3 → #4 | 92px | 95px | +3px | reduce preceding element's bottom space by 3px |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#f3eee4` | `#f3efe4` |

_(target outer and inner are the same; page is a single solid background.)_

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
body { background: #f3eee4; }
/* row #1: font-size: 16px; */
/* row #1: add margin-bottom by ~5px (target gap 162, current 157) */
/* row #3: reduce margin-bottom by ~3px (target gap 92, current 95) */
/* region 830,128 480×360: color: #f1e8db (text) */
/* region 863,193 418×233: color: #205248 (text) */
/* region 933,536 377×183: color: #fdfcfa (text) */
/* region 130,536 374×183: color: #fcfcfa (text) */
/* region 530,543 380×176: color: #fdfdfb (text) */
```

## Suggested next step

1. Start with decoration inside the `complementary "Responsive preview"` landmark. The coarse layout is relatively stable; fix local paint, media, and text details.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
