# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/landing/target.png` (1440×960)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/landing/current.html`

**Pixel diff**: 8.00% (110596 of 1382400 pixels)

**Landscape diff**: 1.12% coarse (98.88% similarity, 5/176 changed cells, 16×11 grid)

**Goal**: `landing` (Landing page) — **pass**

Landing page pass: landscape 1.12% <= 3.00%, pixel 8.00% <= 30.00%, landing hero ok, CTA ok, next hint ok, media slot ok

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/landing/target.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/landing/reports/component/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/landing/reports/component/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r3 c5 | 450,261 90×88 | 9.8% | `#d0cfc7` ink 0.16 | `#eae7e0` ink 0.06 |
| r2 c11 | 990,174 90×87 | 9.1% | `#5a7974` ink 0.55 | `#758e89` ink 0.46 |
| r5 c11 | 990,436 90×87 | 8.8% | `#214f48` ink 0.74 | `#3a645c` ink 0.65 |
| r3 c11 | 990,261 90×88 | 8.1% | `#17413b` ink 0.79 | `#2f534e` ink 0.71 |
| r4 c11 | 990,349 90×87 | 8.1% | `#17413b` ink 0.79 | `#2f534e` ink 0.71 |
| r7 c11 | 990,610 90×88 | 6.7% | `#b8c4bb` ink 0.23 | `#ccd3cb` ink 0.16 |
| r6 c7 | 630,523 90×87 | 6.6% | `#bdc7c1` ink 0.20 | `#d1d7d0` ink 0.14 |
| r5 c7 | 630,436 90×87 | 6.6% | `#bec8c2` ink 0.20 | `#d2d7d1` ink 0.14 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

No layout rows detected.

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 102.0 | `complementary "Campaign preview"` | 682,144 699×590 | fluid-unbounded | bounded min 590px | none | grid | 7.9% | 100.0% | 7 landscape cell(s), 8 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 67.1 | `region "SignalDeck"` | 0,81 1440×724 | fluid-unbounded | content | none | grid | 8.0% | 65.1% | 8 landscape cell(s), 8 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 55.6 | `main "SignalDeck"` | 0,81 1440×879 | fluid-unbounded | content | none | grid | 8.0% | 53.6% | 8 landscape cell(s), 8 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Landing inspector

Current DOM evidence for landing-page first-viewport gates. Use `data-primary-cta`, `data-next-section`, and `data-media-slot` to make the intended regions explicit.

| Gate | Status |
|---|---|
| Hero visible | ok |
| Primary CTA visible | ok |
| Next section hint visible | ok |
| Media slot visible | ok |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #0 | 669,136 699×602 | 682,144 690×582 | +8 / +13 / -9 / -20 | 0.944 |
| #1 | 676,144 704×634 | 690,152 690×605 | +8 / +14 / -14 / -29 | 0.935 |
| #2 | 507,828 426×102 | 952,828 428×102 | 0 / +445 / +2 / 0 | 0 |
| #3 | 64,828 425×102 | 506,828 428×102 | 0 / +442 / +3 / 0 | 0 |
| #4 | 951,828 425×102 | 60,828 428×102 | 0 / -891 / +3 / 0 | 0 |
| #5 | 1096,200 253×136 | 1086,350 269×133 | +150 / -10 / +16 / -3 | 0 |
| #6 | 60,485 194×71 | 57,481 192×67 | -4 / -3 / -2 / -4 | 0.808 |
| #7 | 700,657 208×62 | 705,648 210×61 | -9 / +5 / +2 / -1 | 0.697 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 673,136 | 699×610 | 17981 | `#eef2ed` | `text` |
| 700,200 | 378×435 | 8516 | `#123d37` | `text` |
| 1086,496 | 269×133 | 3050 | `#fafcfb` | `text` |
| 920,658 | 209×61 | 2390 | `#fffaf0` | `text` |
| 1141,661 | 207×58 | 2334 | `#fffaf0` | `text` |
| 700,661 | 208×58 | 2212 | `#fffaf0` | `text` |
| 1374,148 | 6×572 | 2152 | `#e4e3db` | `filled-rect` |
| 708,649 | 207×58 | 2022 | `#fffaf0` | `text` |

## Text-row Δy

Target has 7 text rows; current has 7.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #0 | 49 | 47 | -2px |
| #1 | 171 | 177 | +6px |
| #3 | 678 | 670 | -8px |

**Spacing fixes** — per-gap delta between consecutive text rows. The fix is on the *preceding* element: if the gap above row #N is +6px, reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.

| Above → Below | Target gap | Current gap | Δgap | Suggested fix |
|---|---|---|---|---|
| #0 → #1 | 122px | 130px | +8px | reduce preceding element's bottom space by 8px |
| #1 → #2 | 246px | 239px | -7px | add 7px to preceding element's bottom space |
| #2 → #3 | 261px | 254px | -7px | add 7px to preceding element's bottom space |
| #3 → #4 | 179px | 187px | +8px | reduce preceding element's bottom space by 8px |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#f7f4ec` | `#f7f4ec` |
| inner (content) | `#e7c9b6` | `#e1c8b5` |

## Palette diff

`Nearest` column: Euclidean RGB distance to the closest color on the other side. ≤ 30 = likely AA / quantization noise; > 60 = real palette gap.

| Side | Color | Share | Nearest |
|---|---|---|---|
| extra | `#146c5c` | 0.6% | 62 |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
/* content container should use background: #e7c9b6 */
/* row #0: reduce margin-bottom by ~8px (target gap 122, current 130) */
/* row #1: add margin-bottom by ~7px (target gap 246, current 239) */
/* row #2: add margin-bottom by ~7px (target gap 261, current 254) */
/* row #3: reduce margin-bottom by ~8px (target gap 179, current 187) */
/* region 673,136 699×610: color: #eef2ed (text) */
/* region 700,200 378×435: color: #123d37 (text) */
/* region 1086,496 269×133: color: #fafcfb (text) */
/* region 920,658 209×61: color: #fffaf0 (text) */
/* region 1141,661 207×58: color: #fffaf0 (text) */
/* region 700,661 208×58: color: #fffaf0 (text) */
```

## Suggested next step

1. Start with decoration inside the `complementary "Campaign preview"` landmark. The coarse layout is relatively stable; fix local paint, media, and text details.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
