# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/dashboard/target.png` (1440×900)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/dashboard/current.html`

**Pixel diff**: 17.53% (227173 of 1296000 pixels)

**Landscape diff**: 1.06% coarse (98.94% similarity, 2/160 changed cells, 16×10 grid)

**Goal**: `app` (Practical app) — **pass**

Practical app pass: landscape 1.06% <= 3.00%, pixel 17.53% <= 25.00%

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/dashboard/target.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/dashboard/reports/component/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/dashboard/reports/component/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r7 c1 | 90,630 90×90 | 10.7% | `#c2ccc3` ink 0.19 | `#a2b2ae` ink 0.30 |
| r7 c3 | 270,630 90×90 | 8.3% | `#a89fb3` ink 0.34 | `#9b879b` ink 0.42 |
| r9 c3 | 270,810 90×90 | 7.9% | `#e4e2e3` ink 0.10 | `#f8f8f4` ink 0.01 |
| r9 c1 | 90,810 90×90 | 7.9% | `#dbe2e0` ink 0.11 | `#f4f4f0` ink 0.03 |
| r9 c4 | 360,810 90×90 | 7.3% | `#e3e8df` ink 0.08 | `#f8f8f4` ink 0.01 |
| r9 c2 | 180,810 90×90 | 7.1% | `#e0e6de` ink 0.09 | `#f5f5f1` ink 0.02 |
| r6 c4 | 360,540 90×90 | 6.5% | `#ccdcd5` ink 0.14 | `#bacec2` ink 0.20 |
| r7 c2 | 180,630 90×90 | 5.8% | `#adb591` ink 0.29 | `#9ca882` ink 0.35 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

No layout rows detected.

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 101.9 | `region "Conversion chart"` | 34,447 463×421 | fluid measured 461px | content | none | block | 7.7% | 100.0% | 8 landscape cell(s), 3 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 100.0 | `region "KPI summary"` | 34,301 1046×128 | fluid measured 1044px | content | none | grid | 0.0% | 100.0% | 0 landscape cell(s), 2 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 100.0 | `region "Pipeline table"` | 515,447 565×421 | fluid measured 563px | content | none | block | 0.0% | 100.0% | 0 landscape cell(s), 2 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 96.9 | `search "Lead filters"` | 34,186 1372×97 | fluid measured 1370px | content | none | grid | 0.0% | 96.9% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 85.1 | `main "Revenue operations"` | 0,74 1440×826 | fluid measured 1440px | content | none | grid | 7.7% | 83.2% | 8 landscape cell(s), 8 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Scrollport inspector

Explicit scrollport candidates from `data-scrollport`, `data-vlmkit-scrollport`, `data-ui-scrollport`, or `data-scroll-region`. This is separate from visual matching: an app shell can pass landscape diff while the actual scroll container is wrong.

| Status | Name | Box | Overflow | Client | Scroll | Reason |
|---|---|---|---|---|---|---|
| ok | `pipeline-table` | 516,504 563×350 | auto/auto | 563×350 | 600×350 | independent scrollport |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #0 | 510,462 554×432 | 515,447 565×421 | -15 / +5 / +11 / -11 | 0.877 |
| #1 | 36,462 454×432 | 34,447 463×421 | -15 / -2 / +9 / -11 | 0.892 |
| #2 | 36,310 1028×132 | 34,301 1046×128 | -9 / -2 / +18 / -4 | 0.831 |
| #3 | 36,193 1368×97 | 34,186 1372×97 | -7 / -2 / +4 / 0 | 0.863 |
| #4 | 1084,310 320×398 | 1098,301 308×390 | -9 / +14 / -12 / -8 | 0.891 |
| #5 | 0,0 1440×76 | 0,0 1440×74 | 0 / 0 / 0 / -2 | 0.974 |
| #6 | 1296,131 108×42 | 1298,126 108×42 | -5 / +2 / 0 / 0 | 0.762 |
| #7 | 282,32 65×12 | 272,31 65×12 | -1 / -10 / 0 / 0 | 0.634 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 515,447 | 565×421 | 20454 | `#ffffff` | `text` |
| 510,463 | 554×431 | 18077 | `#ffffff` | `text` |
| 35,424 | 1029×18 | 15138 | `#ffffff` | `filled-rect` |
| 53,791 | 425×54 | 14876 | `#d7e3dc` | `text`? |
| 34,301 | 1046×128 | 13710 | `#ffffff` | `text` |
| 34,447 | 463×420 | 13129 | `#f4f1e9` | `text` |
| 36,863 | 454×31 | 12080 | `#ffffff` | `text` |
| 34,186 | 1372×94 | 11416 | `#fffdf8` | `text` |

## Text-row Δy

Target has 16 text rows; current has 16.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #1 | 124 | 119 | -5px |
| #2 | 158 | 153 | -5px |
| #3 | 218 | 211 | -7px |
| #4 | 252 | 245 | -7px |
| #5 | 340 | 330 | -10px |
| #6 | 381 | 371 | -10px |
| #7 | 410 | 398 | -12px |
| #8 | 434 | 422 | -12px |
| #9 | 454 | 441 | -13px |
| #10 | 492 | 476 | -16px |
| #11 | 516 | 502 | -14px |
| #12 | 541 | 526 | -15px |

**Typography mismatches** — per-row font-size / weight estimated from band height and ink density. Estimates are heuristic (snapped to nearest UI bucket); large jumps (e.g. 16px → 24px, regular → bold) are reliable.

| Rank | Target | Current | Kind |
|---|---|---|---|
| #1 | 36px bold | 32px bold | size |
| #12 | 13px regular | 14px regular | size |

**Spacing fixes** — per-gap delta between consecutive text rows. The fix is on the *preceding* element: if the gap above row #N is +6px, reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.

| Above → Below | Target gap | Current gap | Δgap | Suggested fix |
|---|---|---|---|---|
| #0 → #1 | 86px | 82px | -4px | add 4px to preceding element's bottom space |
| #2 → #3 | 60px | 58px | -2px | add 2px to preceding element's bottom space |
| #4 → #5 | 88px | 85px | -3px | add 3px to preceding element's bottom space |
| #6 → #7 | 29px | 27px | -2px | add 2px to preceding element's bottom space |
| #9 → #10 | 38px | 35px | -3px | add 3px to preceding element's bottom space |
| #10 → #11 | 24px | 26px | +2px | reduce preceding element's bottom space by 2px |
| #13 → #14 | 143px | 133px | -10px | add 10px to preceding element's bottom space |
| #14 → #15 | 153px | 148px | -5px | add 5px to preceding element's bottom space |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#f4f1e9` | `#f4f1e9` |
| inner (content) | `#ffffff` | `#ffffff` |

## State diff

Each row: current HTML rendered with the named state applied, diffed against the default render. Pseudo-classes are forced on interactive elements; `scrolled` scrolls contract-targeted scrollports.

- **Perceptual %**: pixelmatch at threshold 0.03 — what the eye would notice. Filters anti-aliasing and subpixel jitter.
- **Raw %**: any pixel where any RGB channel changed by ≥ 4. Catches subtle hover effects (Δ10/channel shifts) that the perceptual filter swallows.
- **Edge %**: of all diff pixels, fraction within 4px of any applied target bbox perimeter. High = outline-only change (likely UA default focus ring); low = interior fill/text changed (author CSS).
- **ΔLuma**: change in mean interior luminance of the applied elements (state minus default). Negative = elements got darker; positive = lighter. Typical `:hover` darkens (−5 to −30); a *large positive ΔLuma* on an already-light state is a wrong-direction-shift suspect.
- **Note**: `suspect` when both diff metrics are essentially zero. `ua-likely` when only the outline changed and the interior is untouched (catches missing author `:focus-visible` rules that the UA default hides). `direction?` when ΔLuma > +15 on a state that conventionally darkens.

| State | Perceptual % | Raw % | Edge % | ΔLuma | Applied | Note |
|---|---|---|---|---|---|---|
| `scrolled` | 0.00% | 0.00% | — | — | 0 |  |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
/* row #1: font-size: 36px; */
/* row #12: font-size: 13px; */
/* row #0: add margin-bottom by ~4px (target gap 86, current 82) */
/* row #2: add margin-bottom by ~2px (target gap 60, current 58) */
/* row #4: add margin-bottom by ~3px (target gap 88, current 85) */
/* row #6: add margin-bottom by ~2px (target gap 29, current 27) */
/* row #9: add margin-bottom by ~3px (target gap 38, current 35) */
/* row #10: reduce margin-bottom by ~2px (target gap 24, current 26) */
/* region 515,447 565×421: color: #ffffff (text) */
/* region 510,463 554×431: color: #ffffff (text) */
/* region 35,424 1029×18: background: #ffffff */
/* region 53,791 425×54: color: #d7e3dc (text) */
/* region 34,301 1046×128: color: #ffffff (text) */
/* region 34,447 463×420: color: #f4f1e9 (text) */
```

## Suggested next step

1. Start with decoration inside the `region "Conversion chart"` landmark. The coarse layout is relatively stable; fix local paint, media, and text details.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
