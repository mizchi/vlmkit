# Component-from-image report

Target:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/game/target.png` (1280×720)
Current: `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/game/current.html`

**Pixel diff**: 0.95% (8799 of 921600 pixels)

**Landscape diff**: 0.03% coarse (99.97% similarity, 0/144 changed cells, 16×9 grid)

**Goal**: `canvas` (Canvas scene) — **pass**

Canvas scene pass: landscape 0.03% <= 6.00%, pixel 0.95% <= 35.00%, canvas nonblank ok, frame delta ok, input ok, state hook ok: window.__gameState, state fields ok: mode/frame/playerX/playerY/score/assetsReady

- Target:   `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/game/target.png`
- Current:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/game/reports/component/current.png`
- Heatmap:  `/Users/mz/ghq/github.com/mizchi/vlmkit/design-runs/patterns-20260520/game/reports/component/component_heatmap.png`

## Landscape cell diff

Coarse grid comparison of average color + ink density. Use this before pixel-perfect work: it answers whether the large page regions land in roughly the same places.

| Cell | Box | Score | Target | Current |
|---|---|---:|---|---|
| r7 c0 | 0,560 80×80 | 0.3% | `#132730` ink 0.86 | `#12262f` ink 0.87 |
| r7 c6 | 480,560 80×80 | 0.3% | `#132730` ink 0.86 | `#12262f` ink 0.87 |
| r7 c12 | 960,560 80×80 | 0.3% | `#132730` ink 0.86 | `#12262f` ink 0.87 |
| r7 c4 | 320,560 80×80 | 0.3% | `#12262f` ink 0.87 | `#132730` ink 0.86 |
| r7 c10 | 800,560 80×80 | 0.3% | `#12262f` ink 0.87 | `#132730` ink 0.86 |
| r7 c1 | 80,560 80×80 | 0.3% | `#132730` ink 0.86 | `#12262f` ink 0.87 |
| r7 c7 | 560,560 80×80 | 0.3% | `#132730` ink 0.86 | `#12262f` ink 0.87 |
| r7 c13 | 1040,560 80×80 | 0.3% | `#132730` ink 0.86 | `#12262f` ink 0.87 |

## Landmark drilldown

Current DOM landmarks are used as semantic lenses over the visual diff. This follows ARIA landmark practice: concrete roles such as `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `region`, `search`, and named `form` are used; `role="landmark"` itself is ignored.

The lanes are intentionally separate. Run the layout lane first until section placement is stable, then use the decoration lane for paint, media, and local text details.

### Layout lane

No layout rows detected.

### Decoration lane

| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |
|---:|---|---|---|---|---|---|---:|---:|---|---|
| 0.4 | `main "Skyline runner"` | 0,0 1280×720 | fluid measured 1280px | content | none | grid | 0.3% | 0.3% | 8 landscape cell(s), 8 heatmap region(s) | fix colors / media / text styling after layout stabilizes |

## Canvas inspector

Current DOM canvas evidence for interactive/game-like surfaces. This checks the rendered canvas, a short frame delta, and optional `window.__gameState` response to `ArrowRight`.

| Gate | Status |
|---|---|
| Canvas count | 1 |
| Nonblank canvas | ok |
| Frame delta | ok |
| Input response | ok |
| State hook | ok: `window.__gameState` |
| Required state fields | ok: `mode`, `frame`, `playerX`, `playerY`, `score`, `assetsReady` |

## Heatmap region clusters

Each cluster is a contiguous run of differing pixels. `Fill` is the dominant color sampled from the target inside the region. `Kind` is a pixel-only content-type guess (text / filled-rect / icon / image).

| Top-Left | Size | Hot pixels | Fill | Kind |
|---|---|---|---|---|
| 1,610 | 32×10 | 320 | `#294753` | `filled-rect` |
| 64,610 | 32×10 | 320 | `#10232c` | `filled-rect` |
| 97,610 | 32×10 | 320 | `#294753` | `filled-rect` |
| 160,610 | 32×10 | 320 | `#10232c` | `filled-rect` |
| 193,610 | 32×10 | 320 | `#294753` | `filled-rect` |
| 256,610 | 32×10 | 320 | `#10232c` | `filled-rect` |
| 289,610 | 32×10 | 320 | `#294753` | `filled-rect` |
| 352,610 | 32×10 | 320 | `#10232c` | `filled-rect` |

## Backgrounds

Direct samples of the page bg (image perimeter) and inner bg (central rectangle) — start here when setting `body` and content container background colors.

| Layer | Target | Current |
|---|---|---|
| outer (page) | `#102a38` | `#102937` |
| inner (content) | `#0e2532` | `#0e2532` |

## Suggested CSS patch

Aggregated from every actionable signal above. Each line is either a paste-ready declaration or a `/* hint */` describing the delta. Selectors are intentionally omitted (the tool can't see your DOM); apply each declaration to whichever element matches the described region or row.

```css
body { background: #102a38; }
/* region 1,610 32×10: background: #294753 */
/* region 64,610 32×10: background: #10232c */
/* region 97,610 32×10: background: #294753 */
/* region 160,610 32×10: background: #10232c */
/* region 193,610 32×10: background: #294753 */
/* region 256,610 32×10: background: #10232c */
```

## Suggested next step

1. Start with decoration inside the `main "Skyline runner"` landmark. The coarse layout is relatively stable; fix local paint, media, and text details.
2. Cross-check the palette table — missing colors are the design tokens the current rendering doesn't have (paste the hex values into your CSS).
3. If bbox deltas are large, the current element's dimensions don't match the target — adjust `width` / `padding` / `font-size` until they converge.
4. Re-run `vlmkit build component` and check that diff %, bbox deltas, heatmap regions, palette deltas all shrink toward zero.
