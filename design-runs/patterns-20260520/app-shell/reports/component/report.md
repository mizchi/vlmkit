# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/app-shell/target.png` (1440×900)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/app-shell/current.html`

**Pixel diff**: 4.00% (51852 of 1296000 pixels)

**Landscape diff**: 0.14% coarse (99.86% similarity, 0/160 changed cells, 16×10 grid)

**Goal**: `app-shell` (App shell) — **fail**

App shell fail: landscape 0.14% <= 5.00%, scrollports 2/3 ok, 1 broken, expected 2/3 ok, 1 expected broken: messages

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/app-shell/target.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/app-shell/reports/component/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/app-shell/reports/component/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r9 c4 | 360,810 90×90 | 2.8% | `#252e39` ink 0.82 | `#2a3643` ink 0.79 |
| r9 c7 | 630,810 90×90 | 0.9% | `#212933` ink 0.84 | `#232c36` ink 0.83 |
| r9 c8 | 720,810 90×90 | 0.9% | `#212933` ink 0.84 | `#232c36` ink 0.83 |
| r9 c9 | 810,810 90×90 | 0.9% | `#212933` ink 0.84 | `#232c36` ink 0.83 |
| r9 c10 | 900,810 90×90 | 0.9% | `#212933` ink 0.84 | `#232c36` ink 0.83 |
| r9 c11 | 990,810 90×90 | 0.9% | `#212933` ink 0.84 | `#232c36` ink 0.83 |
| r9 c5 | 450,810 90×90 | 0.9% | `#262f39` ink 0.81 | `#28313c` ink 0.81 |
| r9 c6 | 540,810 90×90 | 0.8% | `#222b35` ink 0.83 | `#242d37` ink 0.82 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

No layout rows detected.

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 4.2 | `main` | 336,58 848×842 | fluid measured 848px | content | none | grid | 1.2% | 3.9% | 8 landscape cell(s), 8 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 1.6 | `region "Messages"` | 336,58 848×769 | fluid measured 848px | content | none | grid | 1.2% | 1.3% | 8 landscape cell(s), 4 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 0.4 | `complementary "Members"` | 1184,58 256×842 | fluid measured 255px | scrollport-y | y | block | 0.0% | 0.4% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 0.3 | `complementary "Workspace navigation"` | 72,0 264×900 | fluid measured 263px | content | none | grid | 0.0% | 0.3% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Scrollport inspector

Explicit scrollport candidates from `data-scrollport`, `data-vlmkit-scrollport`, `data-ui-scrollport`, or `data-scroll-region`. This is separate from visual matching: an app shell can pass landscape diff while the actual scroll container is wrong.

| Status | Name | Box | Overflow | Client | Scroll | Reason |
|---|---|---|---|---|---|---|
| ok | `channels` | 72,70 263×769 | auto/auto | 263×769 | 263×1050 | independent scrollport |
| broken | `messages` | 336,58 848×769 | visible/visible | 848×769 | 848×1335 | content overflows but overflow is not scrollable |
| ok | `members` | 1184,58 256×842 | auto/auto | 255×842 | 255×1207 | independent scrollport |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #5 | 390,861 42×12 | 386,861 42×12 | 0 / -4 / 0 / 0 | 0.826 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 416,828 | 742×16 | 10337 | `#26303b` | `filled-rect` |
| 418,885 | 739×8 | 5122 | `#26303b` | `filled-rect` |
| 1181,58 | 4×842 | 845 | — | `filled-rect` |
| 336,58 | 4×769 | 772 | — | `filled-rect` |
| 335,70 | 4×769 | 772 | — | `filled-rect` |
| 1180,58 | 1×769 | 769 | — | `unknown` |
| 374,858 | 66×15 | 431 | `#37424d` | `text` |
| 363,828 | 30×15 | 358 | `#26303b` | `icon` |

## Text-row Δy

Target has 21 text rows; current has 21.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #20 | 868 | 861 | -7px |

**Typography mismatches** — per-row font-size / weight estimated from band height and ink density. Estimates are heuristic (snapped to nearest UI bucket); large jumps (e.g. 16px → 24px, regular → bold) are reliable.

| Rank | Target | Current | Kind |
|---|---|---|---|
| #20 | 56px bold | 72px bold | size |

**Spacing fixes** — per-gap delta between consecutive text rows. The fix is on the *preceding* element: if the gap above row #N is +6px, reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.

| Above → Below | Target gap | Current gap | Δgap | Suggested fix |
|---|---|---|---|---|
| #19 → #20 | 53px | 46px | -7px | add 7px to preceding element's bottom space |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#202832` | `#202832` |
| inner (content) | `#2f3a47` | `#2f3a47` |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
/* row #20: font-size: 56px; */
/* row #19: add margin-bottom by ~7px (target gap 53, current 46) */
/* region 416,828 742×16: background: #26303b */
/* region 418,885 739×8: background: #26303b */
```

## Suggested next step

1. Start with decoration inside the `main` landmark. The coarse layout is relatively stable; fix local paint, media, and text details.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
