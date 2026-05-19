# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/desktop.png` (1536×1024)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/implementation/page.html`

**Pixel diff**: 19.06% (299806 of 1572864 pixels)

**Landscape diff**: 2.20% coarse (97.80% similarity, 9/176 changed cells, 16×11 grid)

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/target/desktop.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/desktop/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/blog-20260519/reports/desktop/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r7 c13 | 1248,651 96×93 | 20.9% | `#a7b5ae` ink 0.28 | `#e6e5dc` ink 0.07 |
| r8 c11 | 1056,744 96×93 | 12.3% | `#f4f2ed` ink 0.03 | `#cdd6d0` ink 0.14 |
| r5 c5 | 480,465 96×93 | 11.2% | `#dbdeda` ink 0.11 | `#bac4c2` ink 0.24 |
| r5 c6 | 576,465 96×93 | 10.7% | `#dde0dc` ink 0.10 | `#bec7c6` ink 0.23 |
| r7 c12 | 1152,651 96×93 | 10.3% | `#a7b5ae` ink 0.28 | `#c6cec5` ink 0.17 |
| r5 c3 | 288,465 96×93 | 9.7% | `#d3d0c1` ink 0.16 | `#e9e8de` ink 0.06 |
| r2 c7 | 672,186 96×93 | 9.3% | `#faf9f7` ink 0.01 | `#dfe3e0` ink 0.09 |
| r2 c8 | 768,186 96×93 | 8.3% | `#fcfaf8` ink 0.00 | `#e4e6e4` ink 0.08 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 40.0 | `region "Follow the notes"` | 1020,538 360×245 | fluid-unbounded | content | none | block | 15.0% | 100.0% | 3 landscape cell(s), 2 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 26.8 | `region "Blog content"` | 156,383 1224×813 | fluid-unbounded | content | none | grid | 12.5% | 57.3% | 6 landscape cell(s), 6 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 23.8 | `main "Engineering notes for systems that outlive the sprint."` | 106,112 1324×1104 | bounded max 1324px | content | none | block | 11.6% | 49.0% | 8 landscape cell(s), 7 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 12.1 | `region "Engineering notes for systems that outlive the sprint."` | 156,156 760×199 | bounded max 760px | content | none | block | 8.8% | 13.2% | 2 landscape cell(s), 1 heatmap region(s) | fix landmark geometry / spacing / section placement |

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 100.0 | `complementary "Topics"` | 1020,129 360×369 | fluid-unbounded | content | none | block | 0.0% | 100.0% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 9.1 | `banner` | 106,0 1324×112 | bounded max 1324px | content | none | flex | 0.0% | 9.1% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |
| 2.5 | `region "About"` | 1020,960 360×204 | fluid-unbounded | content | none | block | 0.0% | 2.5% | 0 landscape cell(s), 1 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 144,380 | 828×370 | 98585 | `#f8f7f2` | `text` |
| 1008,129 | 401×836 | 43273 | `#fbfaf8` | `text` |
| 1061,655 | 302×44 | 10963 | `#375a50` | `text` |
| 464,480 | 341×46 | 6602 | `#faf9f4` | `text`? |
| 468,444 | 319×40 | 6143 | `#faf9f4` | `text`? |
| 155,41 | 306×44 | 5555 | `#faf9f7` | `text`? |
| 156,186 | 219×91 | 5107 | `#fbfaf8` | `text` |
| 467,526 | 280×44 | 5018 | `#faf9f4` | `text` |

## Text-row Δy

Target has 1 text rows; current has 19.

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
| outer (page) | `#faf9f7` | `#faf9f7` |

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
/* HTML: remove 18 row(s) of content — target has 1, current has 19 */
/* row #0: font-size: 72px; */
/* region 144,380 828×370: color: #f8f7f2 (text) */
/* region 1008,129 401×836: color: #fbfaf8 (text) */
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
