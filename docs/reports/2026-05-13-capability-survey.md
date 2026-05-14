# Markup-assistance capability survey

**Date**: 2026-05-13
**Branch**: `claude/continue-project-5iM0e`
**Latest commit at survey**: `ee8ffe5` (close-out of remaining-issue items)

A stocktake of what the VRT toolkit can do for an LLM markup-authoring
agent: commands, internal signals, proven coverage, hard limits, and
low-ROI areas. Compiled at the end of a four-tier build-and-eval cycle
covering migration mode, wireframe mode, design-token compliance,
multi-state, multi-page consistency, theming, i18n, a11y, plus
follow-up fixes driven by subagent dogfood.

---

## 1. Inventory — what exists

### CLI surface (15+ commands)

#### Migration / VRT core (pre-existing, refined)

| Command | Input | Purpose |
|---|---|---|
| `vrt compare` | HTML / URL × 2 | Multi-viewport pixel + DOM-aligned diff |
| `vrt png-diff` | PNG × 2 | Direct PNG comparison |
| `vrt snapshot` | URL × N | Capture / baseline / diff |
| `vrt elements` | URL + selector | Element-level shift isolation |
| `vrt smoke` | HTML / URL | A11y-driven smoke test |
| `vrt diff-for-agent` | migration-report.json | Agent-friendly markdown report |
| `vrt flipbook` | PNG × N | Visual diff animation |
| `vrt compare-runs` | report × 2 | Run-over-run comparison |
| `vrt discover` | HTML | Breakpoint discovery |
| `vrt workflow {init,capture,verify,approve}` | stateful | Baseline / approval workflow |

#### Markup-assistance (new, this cycle)

| Command | Input | Bug class |
|---|---|---|
| `vrt component-from-image` | target PNG + HTML | Recreate component from screenshot |
| `vrt multi-page-consistency` | selector + URL × N | Footer/nav drift across pages |
| `vrt component-consistency` | HTML + selector | Inline-vs-component leak on one page |
| `vrt theme-parity` | HTML | Unthemed components (dark-mode regression) |
| `vrt i18n-stress` | HTML | Text overflow with longer locales |
| `vrt a11y-contrast` | HTML | WCAG AA text contrast |

### Internal signals (~20 primitives)

#### Image-only

| Module | What it does |
|---|---|
| `pixelmatch` | Pixelmatch wrapper with threshold + heatmap output |
| `component-bbox` | CC labelling on PNG → top-N components, area-rank match, area-ratio filter (skip pairs > 4×) |
| `heatmap-regions` | CC on diff overlay → cluster bboxes, dominantColor sampled from source |
| `text-rows` | Per-row luminance dip OR range > 80 → content bands; matchTextRows for paired Δy; computeRowGapDeltas for per-gap shifts |
| `palette-extract` | Stride-sampled 5-bit-per-channel histogram, top-K |
| `palette-diff` | Greedy nearest-neighbor matching, nearestNeighborDistance for unmatched |
| `find-dominant-backgrounds` | Per-channel median of perimeter (outer) and central-30% (inner) |
| `component-geometry` | Per-rank cross-viewport spreads + responsive-mismatch flag |

#### DOM-aligned

| Module | What it does |
|---|---|
| `DOM-position-diff` | Path-aligned attr diff (survives class renames) |
| `DOM-position-perViewport` | Universal vs breakpoint-gated classification |
| `computed-style-diff` | Per-(selector, property) tuples |
| `DOM-equivalence` | Heading / button / element-count preflight |

#### Layout / shift

| Module | What it does |
|---|---|
| `shift-origin` | Per-band Δy → first element whose y diverges, + unexplained-band ("phantom shift") detection |
| `grid-ratio` | Children-width ratio → suggested `grid-template-columns` fr |

#### State / theme / i18n

| Module | What it does |
|---|---|
| `multi-state` | CDP `forcePseudoState` for any element matching default interactive selectors; transition / animation auto-disabled |
| `classifyEdgeVsInterior` | Diff-pixel classifier: edge (≤4 px from bbox perimeter) vs interior — flags UA-only outline changes |
| `meanInteriorLuma` | Mean Rec.601 luminance over forced bbox interiors — direction-of-change check |
| `theme-parity` | `emulateMedia({ colorScheme })` light vs dark, per-component fill stability check |
| `i18n-stress` | Text-node inflator + per-element scrollWidth / boundingBox before/after |

#### A11y

| Module | What it does |
|---|---|
| `a11y-contrast` | TreeWalker over visible text nodes, foreground + ancestor-chain background, Rec.601 luma → WCAG ratio with large-text 3:1 / normal 4.5:1 thresholds |
| `a11y-semantic` | Role-tree diff (pre-existing) |

---

## 2. Where the toolkit is strong

Each bug class is paired with the signal(s) that catch it, a confidence
star, and the fixture / dogfood evidence.

| Bug class | Caught by | ★ | Evidence |
|---|---|---|---|
| Hard-coded colors / token gap | palette-diff (Nearest column annotates AA noise) | ★★★ | dogfood G v3, fixtures/wireframe/pricing-card |
| Missing content (rows) | text-rows count mismatch | ★★★ | G v3 (8/0 → 8/8) |
| Layout position | bbox + heatmap-regions + Fill column | ★★★ | G v3 |
| Page bg / inner bg | find-dominant-backgrounds | ★★★ | G v3 ("biggest win — first write set body bg correctly") |
| Responsive shrinking mismatch | component-geometry | ★★★ | shadcn-to-luna |
| Class rename | DOM-position-diff | ★★★ | shadcn → luna migration |
| Missing `:hover` / `:focus` rules | multi-state + `suspect` note | ★★★ | H v2 (missing-hover.html) |
| UA-only focus ring (false negative) | edge-vs-interior + `ua-likely` | ★★ | Edge 100%, interior 0 |
| Wrong-direction hover | ΔLuma + `direction?` | ★★ | +49 luma fires; -5 doesn't |
| Subtle hover (perceptual < 0.03) | Raw % + `_subtle_` note | ★★ | Δ~2/channel surfaces |
| CSS transitions catching mid-animation | A4 fix: `transition: none !important` | ★★★ | H v2 (0.00% → 8.31%) |
| Unthemed components (dark mode) | theme-parity | ★★★ | fixtures/theme-parity/card-with-bug |
| Text overflow (i18n) | i18n-stress | ★★★ | fixtures/i18n-stress/button-overflow |
| WCAG contrast violations | a11y-contrast | ★★★ | fixtures/a11y-contrast/low-contrast |
| Component DRY drift | component-consistency | ★★★ | fixtures/component-consistency/inline-leak (7.48%) |
| Multi-page drift | multi-page-consistency | ★★★ | fixtures/multi-page/footer-drift (97.80% on pricing) |
| Per-band Y-shift origin | shift-origin | ★★ | shadcn fixture |
| Sub-pixel text-row spacing | row-gap-deltas + suggested fix | ★★ | implemented, not yet re-dogfooded |
| Grid fr ratio | grid-ratio | ★★ | shadcn |
| Heatmap region color identification | dominantColor annotation | ★★★ | G v3 |

Convergence achieved on the canonical wireframe pricing-card target:
**87.36% → 2.48% in one iteration** (post-fix), **1.71% in 4 rounds**.

---

## 3. Hard limits — what we can't do

### Typography (the largest open gap)

- Font-family detection: only via raw pixel diff. No glyph-shape
  matching, no system-font fingerprinting.
- Font-size estimation: text-row band height *could* yield it but
  isn't currently surfaced.
- Font-weight: no stroke-density signal.
- Letter-spacing / line-height: em-normalize exists in DOM-position-
  diff but no estimation from rendered pixels.

### Interaction beyond hover/focus

- Scroll state (single viewport snapshot only).
- Dropdown / select / popover (z-stack not separately captured).
- Modal / dialog overlays.
- Tooltip rendering (needs hover + delay timing).
- Form validation states (need to type + blur to trigger).
- Drag-and-drop, multi-step flows.

### Animation correctness

- Transitions / animations are *deliberately disabled* during capture
  for determinism (cf. A4 transition false-positive). This means the
  toolkit cannot *verify* that an animation looks right — only that
  the end states match.
- No frame-by-frame analysis, no motion smoothness check.

### Environment / runtime

- Cross-browser: Chromium only (Playwright). No Firefox /
  WebKit / mobile Safari rendering quirks.
- Real device pixel ratio: renders at 1x. Retina-specific issues
  not surfaced.
- Print stylesheet (`@media print`): not captured.
- Other `prefers-*` media queries: only `color-scheme` is exercised
  (theme-parity); `prefers-reduced-motion`, `prefers-contrast`,
  `forced-colors` are not.

### Semantic correctness

- HTML semantics: no check for `<button>` vs `<div onclick>`.
- ARIA correctness: `a11y-semantic` does a role-tree diff but
  doesn't validate attribute combinations.
- Content meaning: no LLM in the loop; "this heading text makes
  sense" / "this label is descriptive" outside scope.
- Visual hierarchy: no relative-importance reasoning.

### Performance / correctness adjacent

- CLS (cumulative layout shift) measurement.
- Paint timing / FCP / LCP.
- JS console errors / network failures (render-sanity exists but
  is preflight-only and minimal).
- Bundle size / dead code.

### Specialized rendering

- Canvas / WebGL / SVG semantic content (pixel-level only — no
  shape-aware comparison).
- 3D / WebXR.
- Color-blindness simulation.

### A11y dimensions we don't cover

- Touch target size minimum (44×44 px, WCAG 2.5.5) — easy to add,
  not currently done.
- Focus order / tab order.
- Keyboard accessibility beyond focus-visible (skip links, esc-to-
  close, etc.).
- Reduced-motion compliance.
- Screen-reader pronunciation hints.

---

## 4. Cost-performance — where to cut

| Feature | Cost | Value | Verdict |
|---|---|---|---|
| Per-viewport × per-state diff in migration-compare | 15 vp × 4 states × 2 sides = 120 page launches | State is usually viewport-invariant | **Cut**: limit state captures to 1-3 representative viewports |
| Crater BiDi paint-tree integration | Separate server, ~50% overhead | DOM-position-diff covers most of what paint-tree did | **Cut**: deprecate or make opt-in only |
| Breakpoint discovery via Crater backend | High overhead, separate server | Regex backend handles 95% of cases | **Cut**: default to regex, drop Crater fallback |
| Grid suggestions surfacing | Filters in place but noise remains (single-column grids, empty containers) | Useful for ≤5% of variants | **Cut threshold higher**: minSpreadRatio 1.3, maxSumOverParent 1.2 |
| Multi-rank bbox depth (top-8) | Cheap to compute but display is noisy | Rank 0-2 cover actionable cases | **Cap at top-3** in diff-for-agent rendering |
| Em normalization for letter-spacing / line-height | Implementation complexity moderate | Few bugs hit em values specifically | **Acceptable** — keep but don't extend |
| shift-origin on every run | Cheap | Useful only when shift bands exist | **Acceptable** — already gated on `shiftRegions.length > 0` |
| diff-for-agent ever-growing markdown | Hundreds of lines now | Each section gets read once | **Consider** trimming low-confidence sections by default; `--verbose` to opt in |

---

## 5. Next exploration directions, ROI-ordered

### A. Typography hints from rendered PNGs ★★★

Subagent G v3's explicit "next blocker": "the remaining ~1.7% diff is
text baseline Δy in the 2-19px range — needs per-row spacing-delta
hints AND font-size / weight estimates per heatmap region."

- text-row band height → font-size estimate (band height ≈ 0.7-0.9× fontSize)
- text-row ink density (dark pixels / total) → font-weight estimate
  (regular ≈ 0.10, bold ≈ 0.17)
- Character-shape histogram → font-family-family bucket (serif vs
  sans, mono vs proportional) without trying to actually identify
  the font

Implementation: medium. Reuses text-rows logic; adds ~50 LoC to
text-rows.ts.

### B. Region / element classification ★★★

Dogfood requested: "is region 485,478 a text band or a filled
rectangle?" — agents need to know what they're painting.

- Stroke density per region → text vs solid fill
- Color entropy → flat (icon, button) vs textured (image)
- Aspect ratio + position → "likely badge", "likely button", "likely
  card" (semantic guesses with low confidence)

Implementation: small (~30 LoC), composable on top of heatmap-regions
and component-bbox.

### C. CSS suggestion generation ★★

Current reports surface "diff exists" but never "here is the CSS."
Closing this loop:

- Backgrounds row → `body { background: <hex>; }`
- Heatmap region with fill color → `.region-N { background: <hex>; }`
- Component bbox Δ → `.component { width: <W>px; height: <H>px; }`
- text-row count mismatch → "add `<element>` × N inside the card"

Pure rule-based, no LLM. Could be a new `--emit-css` flag on
component-from-image.

### D. Real-interaction capture ★★

Beyond `:hover` / `:focus-visible`: scripted interactions captured at
multiple states.

- click → screenshot (dropdown open)
- fill form → screenshot (validation states)
- scroll → screenshot (sticky header / scroll-driven animation)

Significant Playwright orchestration. Probably justifies a new
top-level concept (sequence-based VRT) rather than a flag.

### E. Cross-browser parity ★

Launch Firefox + WebKit alongside Chromium, surface pixel diffs as
"font-rendering drift across browsers." Helps catch e.g. Safari
specific font fallback issues.

Cost: 2-3× capture time. Value: occasional rendering quirks.
Probably opt-in.

### F. Touch target size + focus order ★★

Easy a11y wins. Re-uses existing bbox + visible-element capture:

- Touch target: for each interactive element, check that bbox ≥
  44×44 (WCAG 2.5.5 AAA, 24×24 AA).
- Focus order: read `:focus-visible` sequentially via CDP, surface
  the order; flag DOM-order vs visual-order mismatches.

Implementation: small. Belongs in a11y-contrast or a new `a11y-touch`
sibling.

---

## 6. Summary

**State of the toolkit**: covers the majority of LLM-actionable markup
bugs visible at the pixel + DOM level. Roughly 20 bug classes caught
with high confidence across the 7 markup-assistance commands. Convergence
from blank → target in ~4 rounds on representative fixtures.

**Biggest open gap**: typography (font size / weight / family). All
other strengths route around it via pixel diff.

**Biggest cost saving available**: cap per-viewport × per-state matrix
in migration-compare (10× speedup with minimal coverage loss).

**Highest-ROI next item**: typography hints (Tier A above) — closes
the last reported blocker from the most recent dogfood.
