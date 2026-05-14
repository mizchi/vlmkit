# Markup-flow scenario coverage matrix

**Date**: 2026-05-13
**Branch**: `claude/continue-project-5iM0e`
**Goal**: enumerate the realistic markup-authoring scenarios an LLM
agent encounters, evaluate vrt coverage for each, identify clusters
of missing capability.

Legend:

- ✅ — full coverage, shipped + dogfooded
- 🟡 — partial / works but with caveats
- ❌ — not covered today; would need new work
- ⚪ — out of scope (vrt isn't the right tool)

## A. Build / create

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| A1 | Build component from PNG screenshot | ✅ | `component-from-image` |
| A2 | Build component from Figma export | ✅ | `component-from-image` (PNG export from Figma = same flow) |
| A3 | Build component from hand-drawn wireframe (rough) | 🟡 | `component-from-image` works, but text-row detection assumes typeset text — hand drawing fails the band-luminance check |
| A4 | Build component from competitor visual reference | ✅ | `component-from-image` |
| A5 | Build full page from design spec doc | 🟡 | Per-component yes; no multi-component composition signal |
| A6 | Build from text description (LLM gen) | ⚪ | No reference image to diff against; out of scope |
| A7 | Build landing page matching "looks like X" | 🟡 | Works if X is a screenshot; vague descriptions out of scope |

## B. Migration / refactor

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| B1 | Tailwind → vanilla CSS | ✅ | `compare` (migration mode) |
| B2 | CSS-in-JS → CSS modules | ✅ | `compare` — same flow, class-rename map handles auto-generated → semantic |
| B3 | Bootstrap → Tailwind | ✅ | `compare` |
| B4 | shadcn → custom design system | ✅ | `compare`, validated on `shadcn-to-luna` fixture |
| B5 | Inline styles → CSS classes | ✅ | `compare` |
| B6 | Float-based → Flex/Grid layout | 🟡 | `compare` catches the result; `grid-ratio` infers fr; doesn't suggest the float-vs-flex decision itself |
| B7 | Custom → standardized component library (MUI etc.) | ✅ | `compare` + `component-consistency` for catching missed instances |
| B8 | BEM → utility-first (e.g., Atomic CSS) | ✅ | `compare`, class-rename map |
| B9 | SASS → vanilla CSS | ✅ | `compare` (output is CSS, not source) |
| B10 | Removing browser prefixes | ✅ | `compare` |
| B11 | Class-name rename (.btn → .button) | ✅ | `compare` + DOM-position-diff |
| B12 | Floats / clearfix → Grid | 🟡 | `compare` catches result; `grid-ratio` infers fr |

## C. Theming / variant

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| C1 | Add dark mode (prefers-color-scheme) | ✅ | `theme-parity` |
| C2 | Add high-contrast mode (forced-colors) | ❌ | No `forced-colors` emulation; would need Playwright `emulateMedia({ forcedColors: 'active' })` integration |
| C3 | Add reduced-motion variant | ❌ | We *disable* transitions for determinism; no way to verify reduced-motion CSS is correct |
| C4 | Add print stylesheet (@media print) | ❌ | No print-mode capture |
| C5 | White-label theming (brand color swap) | 🟡 | `theme-parity` + `palette-diff` together can detect — no dedicated tool |
| C6 | RTL layout (dir="rtl") | ❌ | No RTL emulation flag; would need `--rtl` opt-in |
| C7 | Locale-specific styling (CJK font fallback) | ❌ | No font-family detection beyond palette indirection |

## D. Responsive / device

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| D1 | Mobile / tablet / desktop breakpoint | ✅ | `compare` (auto-discover or `--fixed-viewports`), `component-geometry` for cross-vp |
| D2 | Landscape orientation | 🟡 | Pass any viewport, no orientation-specific emulation |
| D3 | Foldable / dual-screen | ⚪ | Edge case, no signal |
| D4 | Retina (2x DPI) rendering | ❌ | Playwright only at 1x in our tools |
| D5 | Touchscreen-on-desktop affordances | 🟡 | `a11y-touch` catches size; doesn't detect hover-only affordances on touch |

## E. Interaction / state

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| E1 | Hover state | ✅ | `component-from-image --states hover` + `interact` |
| E2 | Focus / focus-visible | ✅ | `component-from-image --states focus-visible` |
| E3 | Disabled state | 🟡 | Captured by `interact` if you script the disabled toggle; no first-class command |
| E4 | Loading state (spinners, skeletons) | 🟡 | `interact` w/ scripted toggle; no animation correctness |
| E5 | Error state (form validation) | ✅ | `interact` (validated on dropdown-form fixture: invalid email border) |
| E6 | Empty state | 🟡 | `interact` w/ scripted toggle |
| E7 | Dropdown / menu open | ✅ | `interact` |
| E8 | Modal / dialog open | ✅ | `interact` (just click the open trigger) |
| E9 | Carousel / slider transitions | ❌ | Transitions are disabled; mid-frame state not capturable |
| E10 | Accordion expand / collapse | ✅ | `interact` |
| E11 | Tooltip on hover (delay-gated) | 🟡 | `interact` with `hover` + `wait` works; awkward to script |
| E12 | Toast notification fade in/out | ❌ | Transitions disabled; no frame sequence |
| E13 | Tab switch | ✅ | `interact` |

## F. A11y / inclusive

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| F1 | WCAG contrast (text + icons) | ✅ | `a11y-contrast` (text); icons not covered |
| F2 | Touch target size (44×44 / 24×24) | ✅ | `a11y-touch` |
| F3 | Focus order matches visual order | ❌ | Deferred from a11y-touch; Tab-sequence capture needed |
| F4 | ARIA attribute correctness | 🟡 | `a11y-semantic` (pre-existing) does some role-tree diff |
| F5 | Screen-reader-only content visible to AT | ⚪ | Out of scope (requires AT integration) |
| F6 | Keyboard nav (Tab / Esc / Enter) | 🟡 | `interact` with `press` action; no first-class "tab through all interactives" |
| F7 | Color blindness simulation | ❌ | Could be added with CSS filter injection |
| F8 | 200% browser zoom usability | ❌ | No zoom emulation |
| F9 | Reduced motion compliance | ❌ | Tied to C3 |
| F10 | Caption / alt-text presence | ⚪ | Static analysis, not visual |

## G. Performance / quality (not VRT's core lane)

| # | Scenario | Coverage |
|---|---|---|
| G1 | CLS measurement | ❌ |
| G2 | LCP / FCP | ❌ |
| G3 | Bundle size | ⚪ |
| G4 | FOUC detection | ❌ |
| G5 | Image lazy-loading correctness | ❌ |

These are not what vrt is for; CWV tools cover them. Listed for honesty.

## H. Cross-environment

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| H1 | Firefox + WebKit parity vs Chromium | ❌ | Survey Tier E; deferred |
| H2 | iOS Safari vs Android Chrome | ❌ | Requires real device or mobile emulation |
| H3 | OS-specific font rendering | ❌ | Tied to H1 |
| H4 | Network-throttled rendering | ❌ | No throttle flag |

## I. Content variations

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| I1 | Long text / i18n inflation | ✅ | `i18n-stress` |
| I2 | Short / empty content | 🟡 | `interact` to drive empty state; no first-class command |
| I3 | Special chars / emoji rendering | 🟡 | `compare` + `i18n-stress` partial |
| I4 | Different image aspect ratios | 🟡 | `component-from-image` handles per fixture |
| I5 | XSS-safe rendering of UGC | ⚪ | Security, not visual |
| I6 | Pluralization (1 item vs N items) | ❌ | Could combine `interact` + `i18n-stress` |

## J. Component library / design system work

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| J1 | Cross-page component drift | ✅ | `multi-page-consistency` |
| J2 | Inline-vs-component drift (one page) | ✅ | `component-consistency` |
| J3 | Variant rendering (size, color props) | 🟡 | `interact` to script + `component-consistency` to compare |
| J4 | Storybook story diff | ⚪ | Use Chromatic / Loki |
| J5 | Slot composition correctness | 🟡 | `interact` for content injection + `compare` |

## K. Bug-finding / QA

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| K1 | Reproduce user-reported bug from screenshot | 🟡 | `component-from-image` with user's screenshot as target |
| K2 | Off-by-1-pixel hunt | ✅ | bbox Δ + heatmap regions |
| K3 | Overflow / clipping | ✅ | `i18n-stress`, `compare` |
| K4 | z-index stacking issue | 🟡 | Visible in pixel diff; not directly identified |
| K5 | Layout shift on JS load (post-hydration) | 🟡 | `interact` with `wait` + `snapshot` before/after captures it |
| K6 | Asset 404 / broken images | 🟡 | `render-sanity` in migration-compare picks up failed requests |
| K7 | Subtle font-render regression (system font fallback) | 🟡 | `typography` (size/weight bucketing) catches buckets; family detection deferred |

## L. Dev loop integration

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| L1 | Pre-commit visual check | ✅ | `compare` + `workflow approve` |
| L2 | PR visual diff | 🟡 | `compare-runs`, `snapshot` workflow |
| L3 | Live monitoring (prod regressions) | ⚪ | Out of scope; use commercial VRT |
| L4 | Hot-reload validation | ⚪ | Should be near-instant — vrt's ~30s/page too slow for that |

## M. Design system enforcement (composable from existing)

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| M1 | Color token compliance | ✅ | `palette-diff` |
| M2 | Spacing scale (4px grid) | 🟡 | `compare` exposes spacing; no first-class "all margins must be 4n px" check |
| M3 | Typography scale compliance | ✅ | Typography hints + `palette-diff` comparison |
| M4 | Border radius scale | ❌ | Would need radius extraction |
| M5 | Shadow tier compliance | ❌ | Would need shadow extraction |
| M6 | Z-index layer compliance | ❌ | Would need DOM enumeration + classification |

## N. Specialty / edge

| # | Scenario | Coverage |
|---|---|---|
| N1 | Canvas / WebGL content | ⚪ |
| N2 | SVG icon rendering correctness | 🟡 (pixel-only) |
| N3 | Animation / transition correctness | ❌ (we disable them) |
| N4 | Video player UI | 🟡 (pixel-only) |
| N5 | Form autofill state | 🟡 (`interact` + scripted) |
| N6 | Sortable / sticky table | 🟡 (`interact`) |
| N7 | Infinite scroll | 🟡 (`interact` with scroll + repeated snapshots) |

---

## Coverage summary

| Tier | ✅ Full | 🟡 Partial | ❌ Missing | ⚪ Out-of-scope |
|---|---|---|---|---|
| A. Build/create | 3 | 3 | 0 | 1 |
| B. Migration/refactor | 10 | 2 | 0 | 0 |
| C. Theming/variant | 1 | 1 | 4 | 0 |
| D. Responsive/device | 1 | 2 | 1 | 1 |
| E. Interaction/state | 6 | 5 | 2 | 0 |
| F. A11y/inclusive | 2 | 2 | 4 | 2 |
| G. Performance | 0 | 0 | 4 | 1 |
| H. Cross-env | 0 | 0 | 4 | 0 |
| I. Content variations | 1 | 3 | 1 | 1 |
| J. Component lib | 2 | 2 | 0 | 1 |
| K. Bug-finding | 1 | 6 | 0 | 0 |
| L. Dev loop | 1 | 1 | 0 | 2 |
| M. Design system | 2 | 1 | 3 | 0 |
| N. Specialty | 0 | 4 | 1 | 2 |
| **Total** | **30** | **32** | **24** | **11** |

**Full coverage: ~31%. Partial: ~33%. Missing (not out-of-scope): ~25%.**

## Missing-scenario clusters (high-ROI next work)

Looking at the **24 ❌ missing** scenarios, three concrete clusters
emerge:

### Cluster 1: Media-query variants (5 items)

C2 (forced-colors), C3 (reduced-motion), C4 (print), C6 (RTL),
F8 (200% zoom).

All five fit the same shape: render the page under a different
**emulateMedia** / viewport / dir setting, diff against the
default. A generalized `vrt media-variants <html>` command could
cover all five with one implementation. Playwright already has
the primitives:

- `emulateMedia({ forcedColors: 'active' })`
- `emulateMedia({ reducedMotion: 'reduce' })`
- `emulateMedia({ media: 'print' })`
- HTML `dir="rtl"` injection
- `setViewportSize` with proportional scale for zoom emulation

### Cluster 2: Cross-environment (4 items)

H1 (Firefox/WebKit), H2 (mobile browsers), H3 (OS fonts), H4 (network).

H1-H3 collapse to one command: `vrt cross-browser <html>` that
launches the same page in chromium / firefox / webkit and diffs
the results. Survey Tier E.

### Cluster 3: Design-system measurement (3 items)

M4 (border radius), M5 (shadow), M6 (z-index).

These require DOM enumeration + value extraction + scale-conformance
check. A `vrt design-tokens <html> --scale "4,8,12,16,24,32"` style
command could enforce design-token discipline.

### Smaller misses

- **A3 hand-drawn wireframe**: text-row detector assumes typeset
  text. Could add a `--rough` mode that uses different stripe-detection
  thresholds.
- **D4 retina rendering**: pass `deviceScaleFactor: 2` to Playwright
  options. Trivial flag.
- **E9 carousel / E12 toast (transition mid-frame)**: requires
  frame-by-frame capture (multi-snapshot at known delays). New
  `vrt animate` command — adjacent to `interact`.
- **F3 focus order**: deferred from a11y-touch. `Tab`-sequence
  capture via CDP, surface DOM-order vs visual-order mismatch.
- **G1-G5 performance**: out of vrt's lane; defer to CWV tools.

## Recommendation

In priority order:

1. **Cluster 1 (`vrt media-variants`)** — single command unlocks
   forced-colors / reduced-motion / print / RTL / zoom. ★★★ ROI.
2. **Cluster 2 (`vrt cross-browser`)** — Firefox + WebKit parity is
   the explicit survey Tier E request. ★★ ROI.
3. **Cluster 3 (`vrt design-tokens`)** — high-value for design-system
   teams; medium effort. ★★ ROI.
4. **F3 focus order** — small follow-up to a11y-touch. ★ ROI.
5. **A3 hand-drawn `--rough` mode** — niche; defer.

## What would full coverage look like?

After clusters 1-3 + F3 ship, the coverage matrix becomes:

| ✅ | 🟡 | ❌ | ⚪ |
|---|---|---|---|
| **42** (+12) | **29** (-3) | **9** (-15) | **11** |

Of the remaining 9 missing, 5 are performance (CWV territory, ⚪),
2 are animation mid-frame (specialized), 1 is foldable/dual-screen
(rare), 1 is hand-drawn wireframes (niche). At that point vrt
covers roughly **42 + 29 = 71 of 97 in-scope scenarios = 73%**,
with the explicit gaps being either deliberately out of lane or
substantial new directions.
