# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/expressive-menu/target.png` (1440×900)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/expressive-menu/current.html`

**Pixel diff**: 7.30% (94617 of 1296000 pixels)

**Landscape diff**: 2.54% coarse (97.46% similarity, 11/160 changed cells, 16×10 grid)

**Goal**: `expressive-menu` (Expressive menu) — **pass**

Expressive menu pass: landscape 2.54% <= 5.00%, expressive selected ok, menu text ok, items 5, composition 6 layers/9 shapes, diagonal ok, contrast ok

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/expressive-menu/target.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/expressive-menu/reports/component/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/expressive-menu/reports/component/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r0 c9 | 810,0 90×90 | 26.2% | `#ebe8e0` ink 0.05 | `#a8a59e` ink 0.33 |
| r1 c9 | 810,90 90×90 | 17.5% | `#f7f4ec` ink 0.00 | `#d1c5bd` ink 0.19 |
| r3 c13 | 1170,270 90×90 | 14.6% | `#635c5a` ink 0.62 | `#8c807b` ink 0.47 |
| r7 c14 | 1260,630 90×90 | 12.1% | `#bab7b1` ink 0.25 | `#9c9993` ink 0.38 |
| r5 c1 | 90,450 90×90 | 9.8% | `#737270` ink 0.54 | `#5a5957` ink 0.64 |
| r5 c14 | 1260,450 90×90 | 9.5% | `#e2d5cf` ink 0.12 | `#c8beb7` ink 0.21 |
| r6 c1 | 90,540 90×90 | 8.9% | `#7e7d7a` ink 0.50 | `#676663` ink 0.59 |
| r7 c6 | 540,630 90×90 | 8.8% | `#f6f3eb` ink 0.01 | `#e1dcd3` ink 0.10 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 33.5 | `main "Night Dispatch"` | 514,143 863×614 | fluid-unbounded | content | none | block | 11.8% | 86.9% | 5 landscape cell(s), 3 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 25.0 | `banner` | 70,36 1300×70 | bounded max 1300px | bounded min 70px | none | flex | 24.2% | 3.2% | 2 landscape cell(s), 1 heatmap region(s) | fix landmark geometry / spacing / section placement |
| 16.3 | `navigation "Primary commands"` | 50,168 461×520 | fluid-unbounded | content | none | grid | 9.4% | 27.8% | 2 landscape cell(s), 3 heatmap region(s) | fix landmark geometry / spacing / section placement |

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 87.1 | `region "Dispatch status"` | 70,770 1300×98 | fluid-unbounded | content | none | grid | 0.0% | 87.1% | 0 landscape cell(s), 4 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Expressive menu inspector

Current DOM evidence for poster-like menu surfaces. This checks semantic menu text and explicit composition metadata instead of asking pixel diff to reproduce every slash, sticker, and overlap exactly.

| Gate | Status |
|---|---|
| Selected state visible | ok |
| Focusable menu items | 5 |
| Semantic menu text | ok |
| Composition layers | 6 |
| Composition shapes | 9 |
| Diagonal / layered evidence | ok |
| High contrast | ok |

## Component bbox diff

Largest non-background regions, matched by area-rank between target and current. Δ shows position / size differences.

| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |
|---|---|---|---|---|
| #1 | 952,778 429×98 | 949,771 422×99 | -7 / -3 / -7 / +1 | 0.851 |
| #2 | 60,51 58×36 | 70,53 56×36 | +2 / +10 / -2 / 0 | 0.66 |
| #3 | 225,57 49×24 | 237,60 40×23 | +3 / +12 / -9 / -1 | 0.589 |
| #4 | 169,61 28×20 | 140,59 35×26 | -2 / -29 / +7 / +6 | 0.089 |
| #5 | 147,57 21×27 | 190,60 20×23 | +3 / +43 / -1 / -4 | 0 |
| #6 | 132,57 14×24 | 215,59 14×24 | +2 / +83 / 0 / 0 | 0 |
| #7 | 210,57 14×24 | 176,63 13×19 | +6 / -34 / -1 / -5 | 0 |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 533,210 | 834×528 | 9005 | `#f7f4ec` | `text` |
| 462,370 | 101×414 | 4427 | `#d90512` | `text` |
| 802,0 | 42×166 | 3820 | `#f7f4ec` | `text`? |
| 60,779 | 407×121 | 3238 | `#111111` | `text` |
| 968,778 | 412×97 | 2890 | `#111111` | `text`? |
| 511,778 | 423×98 | 2660 | `#111111` | `text`? |
| 101,515 | 174×252 | 2608 | `#f7f4ec` | `text` |
| 112,588 | 356×59 | 2509 | `#181818` | `text`? |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#050505` | `#070707` |
| inner (content) | `#f7f4ec` | `#f8f3e9` |

## Forced-state diff

Each row: current HTML rendered with the named pseudo-class forced on all interactive elements, diffed against the default render.

- **Perceptual %**: pixelmatch at threshold 0.03 — what the eye would notice. Filters anti-aliasing and subpixel jitter.
- **Raw %**: any pixel where any RGB channel changed by ≥ 4. Catches subtle hover effects (Δ10/channel shifts) that the perceptual filter swallows.
- **Edge %**: of all diff pixels, fraction within 4px of any forced bbox perimeter. High = outline-only change (likely UA default focus ring); low = interior fill/text changed (author CSS).
- **ΔLuma**: change in mean interior luminance of the forced elements (state minus default). Negative = elements got darker; positive = lighter. Typical `:hover` darkens (−5 to −30); a *large positive ΔLuma* on an already-light state is a wrong-direction-shift suspect.
- **Note**: `suspect` when both diff metrics are essentially zero. `ua-likely` when only the outline changed and the interior is untouched (catches missing author `:focus-visible` rules that the UA default hides). `direction?` when ΔLuma > +15 on a state that conventionally darkens.

| State | Perceptual % | Raw % | Edge % | ΔLuma | Forced | Note |
|---|---|---|---|---|---|---|
| `:hover` | 5.35% | 6.01% | 0% | +63.4 | 5 | **direction?** — `:hover` lightened by 63 luma; verify this matches the intended hover direction |
| `:focus-visible` | 5.35% | 6.01% | 0% | +63.4 | 5 |  |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
body { background: #050505; }
/* content container should use background: #f7f4ec */
/* region 533,210 834×528: color: #f7f4ec (text) */
/* region 462,370 101×414: color: #d90512 (text) */
/* region 802,0 42×166: color: #f7f4ec (text) */
/* region 60,779 407×121: color: #111111 (text) */
/* region 968,778 412×97: color: #111111 (text) */
/* region 511,778 423×98: color: #111111 (text) */
```

## Suggested next step

1. Start with the `main "Night Dispatch"` landmark. Its coarse landscape cells changed, so fix section geometry, spacing, and placement before chasing local colors.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
