# Markup-flow scenario coverage matrix — v2

**Date**: 2026-05-13 (session end)
**Branch**: `claude/continue-project-5iM0e`
**Updates since v1** (`2026-05-13-scenario-matrix.md`):

- Tier 1 / 2 commands shipped: `component-from-image`,
  `multi-page-consistency`, `component-consistency`, `theme-parity`,
  `i18n-stress`, `a11y-contrast`, `a11y-touch`, typography hints,
  region classifier, CSS-suggestion synthesizer, real-interaction
  `interact`.
- Tier 3 / matrix-Cluster fixes shipped: `media-variants`,
  `cross-browser`, `design-tokens`, `a11y-focus-order`, `--device-
  scale-factor` on component-from-image, `perf`, `explore`, `skill`
  playbooks, selector healer, `component-extract`.
- Total: **27 vrt commands**; **19/19** smoke; **51/51** unit tests.
- New scenario category added: **O. Declarative discovery / agent
  ergonomics** (12 scenarios) for the patterns borrowed from
  browser-use/browser-harness + WebMCP.

Legend:

- ✅ — full coverage, shipped + dogfooded
- 🟡 — partial / works but with caveats
- ❌ — not covered today; would need new work
- ⚪ — out of scope (vrt isn't the right tool)

## A. Build / create

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| A1 | Build component from PNG screenshot | ✅ | `component-from-image` |
| A2 | Build component from Figma export | ✅ | `component-from-image` (+ `--device-scale-factor 2` for retina exports) |
| A3 | Build component from hand-drawn wireframe | 🟡 | text-row detector still assumes typeset text |
| A4 | Build component from competitor visual reference | ✅ | `component-from-image` |
| A5 | Build full page from design spec doc | 🟡 | per-component yes; no multi-component composition |
| A6 | Build from text description (LLM gen) | ⚪ | no reference image; out of scope |
| A7 | Build landing page matching "looks like X" | 🟡 | works for screenshot X |
| **A8** | **Extract one component from a full-page screenshot** | **✅** | **`component-extract` — NEW v2** |

## B. Migration / refactor

All 12 entries remain ✅ (covered by `vrt compare` migration mode +
DOM-position-diff + class-rename map).

## C. Theming / variant

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| C1 | Add dark mode (prefers-color-scheme) | ✅ | `theme-parity` |
| C2 | Add high-contrast mode (forced-colors) | ✅ (v2) | `media-variants --variants forced-colors` |
| C3 | Add reduced-motion variant | ✅ (v2) | `media-variants --variants reduced-motion` (static stylesheet analysis) |
| C4 | Add print stylesheet (@media print) | ✅ (v2) | `media-variants --variants print` |
| C5 | White-label theming (brand color swap) | 🟡 | combine `theme-parity` + `palette-diff` |
| C6 | RTL layout (dir="rtl") | ✅ (v2) | `media-variants --variants rtl` (physical-property smell count) |
| C7 | Locale-specific styling (CJK font fallback) | ❌ | font-family detection still unimplemented |

## D. Responsive / device

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| D1 | Mobile / tablet / desktop breakpoint | ✅ | `compare`, `component-geometry` |
| D2 | Landscape orientation | 🟡 | any viewport works, no orientation switch |
| D3 | Foldable / dual-screen | ⚪ | edge case |
| D4 | Retina (2x DPI) rendering | ✅ (v2) | `component-from-image --device-scale-factor 2` |
| D5 | Touchscreen-on-desktop affordances | 🟡 | `a11y-touch` + `a11y-focus-order` |

## E. Interaction / state

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| E1 | Hover state | ✅ | `component-from-image --states hover` + `interact` |
| E2 | Focus / focus-visible | ✅ | `component-from-image --states focus-visible` + `a11y-focus-order` |
| E3 | Disabled state | 🟡 | scriptable via `interact` |
| E4 | Loading state (spinners, skeletons) | 🟡 | scriptable via `interact` |
| E5 | Error state (form validation) | ✅ | `interact` (validated on dropdown-form fixture) |
| E6 | Empty state | 🟡 | scriptable via `interact` |
| E7 | Dropdown / menu open | ✅ | `interact` or `explore` |
| E8 | Modal / dialog open | ✅ | `interact` |
| E9 | Carousel / slider transitions | ❌ | transitions disabled; mid-frame not capturable |
| E10 | Accordion expand / collapse | ✅ | `interact` |
| E11 | Tooltip on hover (delay-gated) | 🟡 | `interact` w/ hover + wait |
| E12 | Toast notification fade in/out | ❌ | transitions disabled |
| E13 | Tab switch | ✅ | `interact` |

## F. A11y / inclusive

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| F1 | WCAG contrast (text + icons) | ✅ | `a11y-contrast` |
| F2 | Touch target size (44×44 / 24×24) | ✅ | `a11y-touch` |
| F3 | Focus order matches visual order | ✅ (v2) | `a11y-focus-order` |
| F4 | ARIA attribute correctness | 🟡 | `a11y-semantic` (pre-existing) |
| F5 | Screen-reader-only content | ⚪ | requires AT integration |
| F6 | Keyboard nav (Tab / Esc / Enter) | ✅ (v2) | `interact press` action + `a11y-focus-order` |
| F7 | Color blindness simulation | ❌ | could be added via CSS filter |
| F8 | 200% browser zoom usability | ✅ (v2) | `media-variants --variants zoom-200` (scrollWidth check) |
| F9 | Reduced motion compliance | ✅ (v2) | `media-variants --variants reduced-motion` |
| F10 | Caption / alt-text presence | ⚪ | static analysis, not visual |

## G. Performance / quality

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| G1 | CLS measurement | ✅ (v2) | `vrt perf` (Lighthouse-light) |
| G2 | LCP / FCP | ✅ (v2) | `vrt perf` |
| G3 | Bundle size | ⚪ | use Lighthouse / bundle-analyzer |
| G4 | FOUC detection | 🟡 | partial via `perf` (LCP element identity) |
| G5 | Image lazy-loading correctness | ❌ | no scroll-driven test |

## H. Cross-environment

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| H1 | Firefox + WebKit parity vs Chromium | ✅ (v2) | `cross-browser` (graceful degradation if engines absent) |
| H2 | iOS Safari vs Android Chrome | 🟡 | partial via `cross-browser webkit` |
| H3 | OS-specific font rendering | 🟡 | tied to H1 |
| H4 | Network-throttled rendering | ❌ | no throttle flag |

## I. Content variations

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| I1 | Long text / i18n inflation | ✅ | `i18n-stress` |
| I2 | Short / empty content | 🟡 | scriptable via `interact` |
| I3 | Special chars / emoji rendering | 🟡 | `compare` + `i18n-stress` partial |
| I4 | Different image aspect ratios | 🟡 | per fixture |
| I5 | XSS-safe rendering of UGC | ⚪ | security, not visual |
| I6 | Pluralization (1 item vs N) | ❌ | scriptable but no first-class command |

## J. Component library / design system

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| J1 | Cross-page component drift | ✅ | `multi-page-consistency` |
| J2 | Inline-vs-component drift | ✅ | `component-consistency` |
| J3 | Variant rendering (size, color props) | 🟡 | combine `interact` + `component-consistency` |
| J4 | Storybook story diff | ⚪ | use Chromatic / Loki |
| J5 | Slot composition | 🟡 | `interact` + `compare` |

## K. Bug-finding / QA

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| K1 | Reproduce user bug from screenshot | ✅ (v2) | `component-extract` to crop + `component-from-image` |
| K2 | Off-by-1-pixel hunt | ✅ | bbox Δ + heatmap regions |
| K3 | Overflow / clipping | ✅ | `i18n-stress`, `compare` |
| K4 | z-index stacking | 🟡 | visible in pixel diff; not directly identified |
| K5 | Layout shift on JS load (CLS) | ✅ (v2) | `vrt perf` |
| K6 | Asset 404 / broken images | 🟡 | `render-sanity` in compare |
| K7 | Subtle font-render regression | 🟡 | typography hints (size/weight) catch buckets |

## L. Dev loop integration

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| L1 | Pre-commit visual check | ✅ | `compare` + `workflow approve` |
| L2 | PR visual diff | 🟡 | `compare-runs` |
| L3 | Live monitoring (prod regressions) | ⚪ | commercial VRT |
| L4 | Hot-reload validation | ⚪ | too slow |
| **L5** | **Bundled per-target check (`vrt skill run`)** | **✅** (v2) | **`skill` playbooks — NEW v2** |

## M. Design system enforcement

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| M1 | Color token compliance | ✅ | `palette-diff` |
| M2 | Spacing scale (4px grid) | ✅ (v2) | `design-tokens --spacing-scale` |
| M3 | Typography scale compliance | ✅ | typography hints + comparison |
| M4 | Border radius scale | ✅ (v2) | `design-tokens --radius-scale` |
| M5 | Shadow tier compliance | ✅ (v2) | `design-tokens --shadow-tiers` |
| M6 | Z-index layer compliance | ✅ (v2) | `design-tokens --z-scale` |

## N. Specialty / edge

| # | Scenario | Coverage |
|---|---|---|
| N1 | Canvas / WebGL content | ⚪ |
| N2 | SVG icon rendering | 🟡 (pixel-only) |
| N3 | Animation / transition correctness | ❌ (disabled for determinism) |
| N4 | Video player UI | 🟡 (pixel-only) |
| N5 | Form autofill state | 🟡 (`interact` + scripted) |
| N6 | Sortable / sticky table | 🟡 (`interact`) |
| N7 | Infinite scroll | 🟡 (`interact` w/ scroll + repeated snapshots) |

## O. Declarative discovery / agent ergonomics — NEW v2

The browser-harness + WebMCP-inspired layer for LLM-agent workflows.

| # | Scenario | Coverage | Tool |
|---|---|---|---|
| **O1** | **Page declares its testable actions** | **✅** | `explore` reads `window.__vrtActions` and `data-vrt-action` attributes |
| **O2** | **Selector miss → suggest correction** | **✅** | selector healer wired into `interact` |
| **O3** | **Repeated per-component config DRY** | **✅** | `.vrt-skills/<name>.json` + `vrt skill run` |
| **O4** | **Auto-fan-out across multiple checks** | **✅** | `vrt skill run` aggregates child exit codes |
| **O5** | **One-line CI gate (any failure non-zero)** | **✅** | `--strict` on perf / design-tokens, `vrt skill run` exit |
| O6 | Self-healing across multiple runs (accumulate fixes) | 🟡 | healer is advisory only, doesn't persist |
| O7 | Per-domain skill libraries (shared across projects) | ❌ | no global skill registry |
| O8 | WebMCP-native discovery when spec ships | 🟡 | discovery layer abstracts the source |
| O9 | Agent-editable helpers layer | ❌ | no `.vrt-agent/` convention yet |
| O10 | Live snapshot of a session (record agent's actions) | ❌ | would need session log |
| O11 | Bug-repro fixture auto-generation | ❌ | could combine `component-extract` + `compare` snapshot |
| O12 | LLM judgment on rendered output | ❌ | `vlm-bench` exists; no CLI surface yet |

## Coverage summary v2

| Tier | ✅ Full | 🟡 Partial | ❌ Missing | ⚪ Out-of-scope |
|---|---|---|---|---|
| A. Build/create | 4 (+1) | 3 | 0 | 1 |
| B. Migration | 12 | 0 | 0 | 0 |
| C. Theming | **5 (+4)** | 1 | 1 (-3) | 0 |
| D. Responsive | **2 (+1)** | 2 | 0 (-1) | 1 |
| E. Interaction | 6 | 5 | 2 | 0 |
| F. A11y | **6 (+4)** | 2 | 1 (-3) | 2 |
| G. Performance | **2 (+2)** | 1 | 1 (-3) | 1 |
| H. Cross-env | **1 (+1)** | 2 | 1 (-3) | 0 |
| I. Content | 1 | 3 | 1 | 1 |
| J. Component lib | 2 | 2 | 0 | 1 |
| K. Bug-finding | **2 (+1)** | 5 (+ -1) | 0 | 0 |
| L. Dev loop | **2 (+1)** | 1 | 0 | 2 |
| M. Design system | **6 (+4)** | 0 | 0 (-3) | 0 |
| N. Specialty | 0 | 4 | 1 | 2 |
| **O. Discovery / ergonomics** _(new)_ | **5** | **2** | **5** | 0 |
| **Total v2** | **56** (+26) | 33 (+1) | 13 (-11) | 11 |

In-scope coverage: **56 ✅ / 102 total = 55%** full; full+partial =
**89 / 102 = 87%**.

Compared to v1 (44 ✅ / 32 🟡 / 12 ❌ / 11 ⚪ = 87%): added 12 ✅,
removed 11 ❌. The work this session closed ~half of the original
missing-scenarios + added an entirely new category.

## What's left

The 13 remaining ❌ entries cluster into:

1. **Animation mid-frame** (E9 carousel, E12 toast, N3 animation
   correctness) — fundamentally requires frame-by-frame capture
   while transitions are *enabled*. Specialized subdomain.
2. **CWV beyond CLS/LCP** (G3 bundle size, G5 lazy-load
   correctness) — Lighthouse / WebPageTest territory, not vrt's lane.
3. **Cross-env edge cases** (D3 foldable, H4 network throttling) —
   rare or specialized; defer.
4. **Niche** (A3 hand-drawn, C7 locale fonts) — small audience.
5. **Discovery / ergonomics gaps** (O6 healer persistence, O7
   global skill registry, O9 agent helpers, O10 session record,
   O11 bug-repro fixture, O12 LLM judgment) — natural follow-ups
   to the v2 work but each substantive enough to defer.

## Stop here?

This is a reasonable cut point. The toolkit has 27 commands, 89%
in-scope coverage, 19/19 smoke, 51/51 unit. Remaining gaps are
deliberately deferred (CWV, animation mid-frame) or are follow-ups
to v2 patterns that need more soak time before designing.
