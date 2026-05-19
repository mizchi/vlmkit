# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/desktop.png` (1536×1024)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/implementation/page.html`

**Pixel diff**: 18.42% (289758 of 1572864 pixels)

**Landscape diff**: 2.14% coarse (97.86% similarity, 9/176 changed cells, 16×11 grid)

**Goal**: `app` (Practical app) — **pass**

Practical app pass: landscape 2.14% <= 3.00%, pixel 18.42% <= 25.00%

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/desktop.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/desktop/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/desktop/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r7 c13 | 1248,651 96×93 | 20.9% | `#a7b5ae` ink 0.28 | `#e6e5dc` ink 0.07 |
| r8 c11 | 1056,744 96×93 | 12.1% | `#f4f2ed` ink 0.03 | `#ced7d1` ink 0.14 |
| r5 c5 | 480,465 96×93 | 11.2% | `#dbdeda` ink 0.11 | `#bac4c2` ink 0.24 |
| r5 c6 | 576,465 96×93 | 10.7% | `#dde0dc` ink 0.10 | `#bec7c6` ink 0.23 |
| r7 c12 | 1152,651 96×93 | 10.3% | `#a7b5ae` ink 0.28 | `#c6cec5` ink 0.17 |
| r2 c7 | 672,186 96×93 | 9.0% | `#faf9f7` ink 0.01 | `#e0e3e1` ink 0.09 |
| r5 c3 | 288,465 96×93 | 8.5% | `#d3d0c1` ink 0.16 | `#e7e5da` ink 0.07 |
| r8 c12 | 1152,744 96×93 | 8.1% | `#f3f2f0` ink 0.03 | `#dadfda` ink 0.10 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 39.0 | `region "Follow the notes"` | 1020,538 360×245 | fluid-unbounded | content | none | block | 14.0% | 100.0% | 4 landscape cell(s), 2 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 23.5 | `region "Blog content"` | 156,383 1224×895 | fluid-unbounded | content | none | grid | 11.7% | 47.1% | 7 landscape cell(s), 6 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 20.2 | `main "Engineering notes for systems that outlive the sprint."` | 106,112 1324×1186 | bounded max 1324px | content | none | block | 11.3% | 35.3% | 8 landscape cell(s), 7 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 12.3 | `region "Engineering notes for systems that outlive the sprint."` | 156,156 760×199 | bounded max 760px | content | none | block | 9.0% | 13.2% | 1 landscape cell(s), 1 heatmap region(s) | fix landmark geometry / spacing / section placement |

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 9.1 | `banner` | 106,0 1324×112 | bounded max 1324px | content | none | flex | 0.0% | 9.1% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 1.4 | `complementary "Topics"` | 1020,129 360×369 | fluid-unbounded | content | none | block | 0.0% | 1.4% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 147,380 | 825×356 | 94867 | `#fbf9f4` | `text` |
| 1012,493 | 397×472 | 36429 | `#fbfaf8` | `text` |
| 1061,655 | 302×44 | 10963 | `#375a50` | `text` |
| 464,480 | 341×46 | 6602 | `#faf9f4` | `text`? |
| 468,444 | 319×40 | 6143 | `#faf9f4` | `text`? |
| 155,41 | 306×44 | 5557 | `#faf9f7` | `text`? |
| 156,186 | 219×91 | 5130 | `#fbfaf8` | `text` |
| 467,526 | 280×44 | 5018 | `#faf9f4` | `text` |

## Text-row Δy

Target has 1 text rows; current has 18.

**Count mismatch** — current is missing rows of content (or has spurious extras). Add the missing elements before tweaking CSS.

| Rank | Target y | Current y | Δy |
|---|---|---|---|
| #0 | 512 | 64 | -448px |

**Typography mismatches** — per-row font-size / weight estimated from band height and ink density. Estimates are heuristic (snapped to nearest UI bucket); large jumps (e.g. 16px → 24px, regular → bold) are reliable.

| Rank | Target | Current | Kind |
|---|---|---|---|
| #0 | 72px light | 48px light | size |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#faf9f7` | `#fbfaf8` |

_(target outer and inner are the same; page is a single solid background.)_

## Palette diff

`Nearest` column: Euclidean RGB distance to the closest color on the other side. ≤ 30 = likely AA / quantization noise; > 60 = real palette gap.

| Side | Color | Share | Nearest |
|---|---|---|---|
| extra | `#143434` | 1.5% | 173 |
| extra | `#dcd4cc` | 0.7% | 24 (near, likely AA) |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
body { background: #faf9f7; }
/* HTML: remove 17 row(s) of content — target has 1, current has 18 */
/* row #0: font-size: 72px; */
/* region 147,380 825×356: color: #fbf9f4 (text) */
/* region 1012,493 397×472: color: #fbfaf8 (text) */
/* region 1061,655 302×44: color: #375a50 (text) */
/* region 464,480 341×46: color: #faf9f4 (text) */
/* region 468,444 319×40: color: #faf9f4 (text) */
/* region 155,41 306×44: color: #faf9f7 (text) */
```

## Suggested next step

1. Start with the `region "Follow the notes"` landmark. Its coarse landscape cells changed, so fix section geometry, spacing, and placement before chasing local colors.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
