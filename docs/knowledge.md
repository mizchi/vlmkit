# CSS VRT Detection Patterns — Experimental Findings

## Goal

Large-scale cross-renderer diff verification + a11y-based smoke testing.

- **Chromium vs Crater**: Benchmark + auto-detect cross-browser engine diffs
- **Website v1 vs v2**: Regression verification during UI library rewrites
- **Cloudflare Workers**: Run VRT without Chromium via crater WASM + API
- **Diff Approval**: Declare and manage acceptable diff patterns (tolerance, expires, issue linkage)
- **A11y Smoke Test**: Enumerate interactive elements from a11y tree, perform random/reasoning-based operations to detect crashes

## Experiment Overview

Randomly delete 1 CSS property from a GitHub repo page-like HTML (237 CSS declarations), benchmarking whether the VRT pipeline can detect it. Results from 60 trials (2 runs).

## Detection Signals and Effectiveness

| Signal | Standalone Detection Rate | Role |
|--------|--------------------------|------|
| **Visual diff** (pixel) | 77% | Baseline. Detects layout, color, and size changes |
| **Computed style diff** | 73% | Detects CSS changes invisible to pixels. **Complementary to visual** |
| **Hover emulation** | 7% | Always-on `:hover` rules, compared via computed style |
| **A11y diff** | 17% | Only element disappearance via `display: none` etc. Nearly useless for CSS changes |
| **Multi-viewport** | +7% | 2 viewports (desktop 1280 + mobile 375) to catch misses |
| **All signals combined** | **93%** | **+23%** improvement from pixel-only (70%) |

### Signal Combination Effects

```
pixel only (1 viewport)       → 70%
+ multi-viewport (2 vp)       → 77%  (+7%)
+ computed style diff          → 87%  (+10%)
+ hover emulation             → 93%  (+6%)
+ wide viewport (3 vp)        → 95%  (+2%)
+ semantic tag collection      → 97%  (+2%)
                         Total: +27%
```

### Hover Emulation Mechanism

CSS `:hover` doesn't fire via JS `dispatchEvent` (browser internal state). So:

1. Collect rules containing `:hover` from `<style>` elements on the page
2. Duplicate the rules with `:hover` removed from selectors → inject as new `<style>`
3. Get `getComputedStyle` in this state (hover styles always applied)
4. Remove the injected `<style>`

This detects `:hover` style presence/absence as computed style differences.

## Detection Rate by Category

| Category | Detection Rate | n | Notes |
|----------|---------------|---|-------|
| **layout** | 100% | 13 | display, flex, align-items — always detectable |
| **sizing** | 100% | 6 | width, height — always detectable |
| **spacing** | 80% | 10 | padding, margin — misses subtle changes |
| **typography** | 77% | 17 | font-size, color are reliable. text-decoration is flaky |
| **visual** | 75% | 12 | Misses background when similar to parent color |

### Always Detected Properties (100%, n>=2)

`display`, `font-size`, `color`, `margin-left`, `border-radius`, `height`, `width`, `font-weight`, `align-items`

### Flaky Properties (unstable detection)

| Property | Detection Rate | Cause | After hover emulation |
|----------|---------------|-------|----------------------|
| `background` | 50% | Zero pixel diff when parent has similar color | Partially improved via computed style diff |
| `text-decoration` | 56% → **100%** | Hover-only styles invisible in static capture | Solved by hover emulation |
| `padding` | 67% | Inner space difference doesn't show with little content | Improved via computed style diff |

## Detection Rate by Selector Type

| Type | Detection Rate | n | Notes |
|------|---------------|---|-------|
| **class** (`.foo`) | 97% | 38 | Almost certainly detected |
| **compound** (`.foo .bar`) | 65% | 20 | Descendant selectors are context-dependent, easier to miss |
| **pseudo-class** (`:hover`) | 0% | 1 | Fundamentally invisible in static capture |

## Undetected Pattern Classification

### Before hover emulation (60 trials)

| Reason | Count | Ratio | Mitigation |
|--------|-------|-------|------------|
| **hover-only** | 5 | 56% | Solved by hover emulation |
| **unknown** | 3 | 33% | Element doesn't exist on page / computed value unchanged |
| **same-as-parent** | 1 | 11% | Partially detectable via computed style diff |

### After hover emulation (30 trials)

Undetected: 2/30 (6.7%) — **all hover-only cases resolved**

| Reason | Count | Example |
|--------|-------|---------|
| **unknown** | 2 | `.readme-body code { background: #eff1f3 }`, `.main { margin: 0 auto }` |

### Detailed Analysis of "unknown"

- `.readme-body code { background: #eff1f3 }` — `<code>` used inline, only exists within `<pre><code>` in the fixture HTML. Difference between `<pre>`'s background `#f6f8fa` and `<code>`'s `#eff1f3` is too subtle
- `.main { margin: 0 auto }` — `max-width: 1280px` with viewport=1280px so auto margin is zero. Same on mobile since no max-width constraint
- `.readme-body code { padding: 2px 6px }` — Little text inside inline `<code>`, padding difference absorbed by surroundings

## Detection Rate by Viewport

| Viewport | Detection Rate | Exclusive |
|----------|---------------|-----------|
| desktop (1280px) | 70% | 6 cases (detected only on desktop) |
| mobile (375px) | 62% | 1 case (detected only on mobile) |

Desktop has higher detection rate because: layout uses full width, making spacing/sizing differences more visible. On mobile, the sidebar is hidden (`@media` with `width: 100%`), collapsing some elements.

## Computed Style Diff Effectiveness

Examples detected by computed style diff but not by pixel diff:

| Declaration | Reason |
|-------------|--------|
| `.file-table .date { white-space: nowrap }` | Content too short for wrapping, but computed value changes |
| `.readme-header { background: #f6f8fa }` | Same as parent background color so zero pixel diff, but computed `background-color` changes to `transparent` |
| `.lang-list { flex-wrap: wrap }` | Too few items to need wrapping, but computed value `wrap` → `nowrap` difference is detectable |

## The Last 3% Barrier — Dead Code Problem

Reached 96.7% detection. Remaining 1 undetected case:

`.readme-body code { background: #eff1f3 }` — **effectively dead code**.

Chain of causes:
1. `<code>` on the page only exists within `<pre><code>`
2. `.readme-body pre code { background: none }` overrides it
3. Therefore `.readme-body code { background: #eff1f3 }` has no visual effect on any element
4. No difference in computed style either (`pre code` override takes priority)

**This is not a VRT limitation but dead code in the CSS itself**.

### Dead Code Detection

Introduced a heuristic to classify as `dead-code` when computed style diff = 0 AND visual diff = 0 across all viewports. This reduces `unknown` cases and distinguishes between "can't detect" and "doesn't need detection".

**Dead code should be treated as outside VRT's detection scope**. The effective detection rate, excluding CSS dead code, approaches **100%**.

## Multi-Fixture Comparison (90 trials, 3 fixtures)

| Fixture | Detection Rate | Declarations | Characteristics |
|---------|---------------|-------------|-----------------|
| **page** (GitHub-like) | 96.7% | 237 | Flexbox-based, simple selectors |
| **form-app** (settings page) | 90.0% | 228 | :focus/:hover/:disabled/:checked, toggle switch, form validation |
| **dashboard** | 83.3% | 276 | CSS Grid, var(), animation, filter, ::before/::after |
| **Total** | **90.0%** | 741 | |

Reasons for dashboard's lower detection rate:

### Newly Discovered Undetected Patterns

| Pattern | Example | Classification | Mitigation |
|---------|---------|---------------|------------|
| **vendor pseudo-element** | `::-webkit-scrollbar-track { background: transparent }` | same-as-default | transparent is browser default |
| **animation-delay** | `.stat-card:nth-child(2) { animation-delay: 0.05s }` | dead-code | Animation already completed at static capture time. Detectable right after initial load, but not after `networkidle` wait |
| **grid-column** | `.topbar { grid-column: 2 }` | dead-code | `@media (max-width: 768px)` changes grid-template-columns, but other viewports have the same column structure |
| **:focus styles** | `input:focus { border-color: var(--accent) }` | hover-only | Hover emulation covers `:focus`, but `var()` resolution timing issues |
| **CSS custom properties (var())** | `border-color: var(--accent)` | hover-only | var() references change in computed style comparison, but specificity conflicts can occur during hover emulation style injection |

### Detection by CSS Feature (60 trials, 2 fixtures)

| CSS Feature | Detection Rate | Notes |
|-------------|---------------|-------|
| flexbox | 100% | All display, align-items, gap etc. detected |
| CSS Grid | High | grid-template-columns detected. grid-column tends to be dead-code |
| transition | N/A | transition property itself has no static impact. Target property changes are detectable |
| animation | **Low** | delay/duration of completed animations undetectable. Separated as `animation` category |
| var() | High | Computed style uses resolved values, so comparison works |
| filter/backdrop-filter | High | Detectable via computed style. Separated as `transform` category |
| :hover | **Partial** | 100% for page fixture with hover emulation. Some gaps on dashboard due to `getComputedStyle` rendering timing |
| :focus | **Low** | Covered by hover emulation for `:focus` too, but same timing issues |
| ::before/::after | Undetected | Pseudo-element computed style capture not implemented |
| ::-webkit-* | Low | Vendor prefixes often have transparent default |
| :nth-child() | dead-code | Subtle value changes like animation-delay invisible in static capture |
| CSS custom properties (:root) | **Low** | Variable definitions like `--accent-hover: #60a5fa` undetectable unless the usage site's computed style changes |
| object-fit | dead-code | No cover effect when img is square |
| grid-column | dead-code | Same layout when declaration matches grid auto-placement |
| scrollbar styles | same-as-default | Vendor pseudo-elements often default to transparent |

## Large-Scale Test Results (90+60 trials)

Additional 60-trial testing on dashboard revealed the following new patterns:

### CSS Custom Properties Detection Limits

Deleting `:root { --accent-hover: #60a5fa }` doesn't cause direct computed style changes.
- `:root` styles are only CSS variable definitions
- Computed styles of elements referencing the variable fall back to fallback or default values when the variable becomes undefined
- However, inconsistencies can occur in `getComputedStyle` evaluation timing

**Mitigation idea**: Search for `var()` usage sites of CSS variables and track computed styles of those elements

### Hover Emulation Limits (Playwright + getComputedStyle)

Cases confirmed where `getComputedStyle` returns `transparent` even after setting inline styles.
`evaluate` may run before CSS recalculation completes after DOM construction via `page.setContent`.

**Interim finding**: Hover emulation works 100% for simple structures (page fixture) but is unstable on complex pages with CSS Grid + var() + many rules (dashboard).

### Complete List of Undetected Patterns (9/90)

| # | Fixture | Declaration | Reason | Root Cause | Mitigation |
|---|---------|-------------|--------|------------|------------|
| 1 | page | `.readme-body code { background }` | dead-code | Specificity override by `pre code` | CSS refactoring |
| 2 | dashboard | `.topbar { grid-column: 2 }` | dead-code | Same as grid auto-placement | Redundant declaration → recommend removal |
| 3 | dashboard | `.stat-card:nth-child(2) { animation-delay }` | dead-code | Already completed at networkidle | Animation detection is fundamentally difficult |
| 4 | dashboard | `.avatar { width: 32px }` | dead-code | Same as img natural size | Change natural size in fixture HTML → resolved |
| 5 | dashboard | `::-webkit-scrollbar-track { background }` | same-as-default | `transparent` is default | Legitimate same-as-default |
| 6 | dashboard | `input:focus { border-color: var(--accent) }` | hover-only | Specificity conflict in :focus hover emulation | Room for improvement |
| 7 | form-app | `.check-desc { color }` | dead-code | Same as parent's color | Legitimate dead-code |

### Resolution History of Previously Undetected Cases

| Issue | Detection Rate Impact | Resolution |
|-------|----------------------|------------|
| `margin: 0 auto` (viewport=max-width) | 93%→97% | **Added wide viewport (1440px)** |
| computed style missing class-less elements | 87%→90% | **Also collected semantic tags** |

## Crater Evaluation — Practicality as VRT Backend

### Benchmark Results

| Backend | Detection Rate (page fixture) | Signals |
|---------|------------------------------|---------|
| Chromium | **96.7%** | pixel + computed style + hover emulation |
| Crater | **60.0%** | pixel + **paint tree diff** |
| Crater (pixel only) | 50.0% | pixel only (no paint tree) |

**Paint tree diff effect: +10%** (50% → 60%). 3 cases detected by paint tree but not by pixel:

- `border-radius` — No pixel rendering difference, but paint tree has `br` property → detected via diff
- `align-items` — Looks like same layout in pixels, but paint tree node coordinates change → detected
- `background` (same as parent color) — Zero pixel diff, but paint tree `bg` property changes → detected

This is **crater-specific detection capability not available in Chromium**. Paint tree provides signal equivalent to Chromium's computed style diff.

### Prescanner Architecture

crater is best used as a prescanner that tolerates false negatives. Chromium eliminates false positives, so they're not a problem.

```
[CSS Change]
  │
  ▼
[crater paint tree diff]  ← Fast (<1s startup, pixel+paint tree)
  │
  ├── Diff found → DETECTED (crater alone is sufficient)
  │              Most cases end here. No Chromium needed
  │
  └── No diff → [Chromium precise verification]  ← Only when needed
                  pixel + computed style + hover emulation
                  → DETECTED or PASS
```

**Benefits**:
- 60% of cases detected by crater don't need Chromium → faster CI
- crater false positives eliminated by Chromium → no accuracy loss
- crater-specific signals (paint tree `bg`, `br`, etc.) complement Chromium blind spots

**False negative risk**:
Currently all 40% missed by crater prescanner fall back to Chromium, so no false negatives occur.
False negative rate when using prescanner alone = 40% (expected to decrease with crater #18-22 fixes).

**False positive rate: 0%** (measured):
Paint tree is perfectly identical across multiple renders of the same HTML. Confirmed across all 3 viewports (1440/1280/375).
crater rendering is fully deterministic.
Chromium pixel comparison can produce false positives from anti-aliasing and font rendering noise, but crater paint tree diff doesn't have this issue.

**Prescanner evaluation**:
- False positive rate: 0% → no unnecessary Chromium fallbacks
- False negative rate: 40% → Chromium catches what crater misses (to decrease with crater #18-22 fixes)
- Deterministic: same output for same input → zero test flakiness

### Speed Benchmark

**Per-operation speed comparison**:

| Operation | Crater | Chromium | Multiplier |
|-----------|--------|----------|------------|
| Startup/connect | 4ms | 418ms | **105x** |
| setContent | 13ms | 662ms | **51x** |
| setContent (warm) | 41ms | 559ms | **14x** |
| Paint tree retrieval | 18ms | — | crater-specific |
| Paint tree diff | <1ms | — | crater-specific |
| Screenshot | 325ms (RGBA) + 36ms (PNG) | 76ms (PNG) | Chromium is faster |
| Computed style | — | 5ms | Chromium only |

**Prescanner strategy measurement** (15 trials):

| Strategy | Total time | ms/trial | Speedup |
|----------|-----------|----------|---------|
| Chromium only | 9,366ms | 624ms | — |
| Crater prescanner + Chromium fallback | 5,638ms | 376ms | **1.66x (40% reduction)** |

7 of 15 trials (47%) detected by crater alone → completed without launching Chromium.
Remaining 8 fell back to Chromium.

**Speedup will increase further as crater core improvements (#18-22) reduce false negative rate**:

```
Current (40% false negatives): 1.66x speedup
20% false negatives:           ~2.5x speedup (estimated)
10% false negatives:           ~4x speedup (estimated)
0% false negatives:            ~10x speedup (Chromium not needed)
```

### Strengths

| Aspect | Rating | Details |
|--------|--------|---------|
| **Portability** | ◎ | No Chromium required. Runs on Node 24+ / Deno. Can build as WASM component. No X11/GPU needed in CI |
| **Startup speed** | ◎ | BiDi server startup < 1s. Fast compared to Chromium cold start (several seconds) |
| **Selector-targeted rendering** | ○ | `elementScreenshot` API available (defined in BiDi protocol). Implementation is bounding box + crop, but more control flexibility than Chromium |
| **Flexibility** | ◎ | Self-built, so easy to iterate. Full access to paint backend, layout engine, CSS parser |
| **Memory** | ○ | MoonBit/WASM-based. Smaller footprint than Chromium (~300MB), estimated 50-100MB |
| **Paint tree access** | ◎ | `capturePaintTree()` retrieves internal paint tree as JSON. Unique feature not in Chromium |
| **Raw RGBA output** | ◎ | `capturePaintData()` retrieves raw pixel data. No PNG encode/decode overhead |

### Weaknesses (current)

| Aspect | Rating | Details |
|--------|--------|---------|
| **CSS rendering accuracy** | △ | text-decoration not implemented, border-radius/font-weight/margin accuracy issues (mizchi/crater#18-22) |
| **Text rendering** | △ | Known differences in text wrapping precision, font-weight, inline layout |
| **computed style** | ✗ | `script.evaluate` works, but DOM's `getComputedStyle` equivalent is incomplete |
| **hover/focus state** | ✗ | BiDi input API (click/hover) implemented, but CSS :hover reflection unverified |
| **JavaScript compatibility** | △ | QuickJS-based. React/Preact partially works (preact-compat tests available) |

### Use Cases

**Currently effective scenarios**:

1. **Layout verification** — flexbox, grid, block layout calculation is highly accurate (WPT 99.2%). Reliable for detecting display/width/height/padding/flex changes
2. **Lightweight CI VRT** — Detect basic layout breakage without launching Chromium. Use as first-pass filter, then precise Chromium verification when diffs found
3. **Paint tree diff** — Compare paint trees (JSON) instead of pixels. Can directly detect CSS property-level changes
4. **Component-level VRT** — Render HTML snippets for individual component verification. Storybook-like usage

**Scenarios requiring Chromium**:

1. Accurate text-decoration / font-weight rendering needed
2. Visual verification of border-radius
3. Computed style diff / hover emulation needed
4. External JavaScript (React, Vue, etc.) execution needed

### Future Possibilities

- **Paint tree diff**: Implemented. Empirical data shows +10% detection rate. Detects border-radius, align-items, background (same color) without pixels
- **WASM standalone**: Distributing layout engine as WASM enables VRT in browsers or Edge Functions. Deployable beyond CI to editor integration and PR preview
- **Per-CSS-property verification**: crater's self-built CSS parser enables computing "layout diff when this property is enabled/disabled". Foundation for mutation testing

## Migration VRT Results

### Reset CSS Switch (normalize.css → each reset)

| Variant | wide (1440) | desktop (1280) | bp-above (769) | mobile (375) |
|---------|-------------|----------------|----------------|--------------|
| modern-normalize | 0.9% | 1.0% | 2.0% | 2.6% |
| no-reset (browser default) | 1.6% | 1.7% | 2.5% | 3.6% |
| destyle | 6.6% | 6.8% | 8.2% | 12.0% |

Diff causes identified by agent:

**modern-normalize (0.9-2.6%)**:
- Global `box-sizing: border-box` application → form element widths change
- `h1 { margin: 0.67em 0 }` present in normalize but not in modern-normalize → vertical shift below h1
- Fix: single line `h1 { margin-top: 0.67em }` resolves the most prominent diff

**destyle (6.6-12.0%)** — **drop-in replacement not possible**:
- `list-style: none` → list markers disappear
- Heading font-size/font-weight/margin all reset
- `appearance: none` removes native form element rendering
- Layering destyle on top of normalize defeats the purpose

**no-reset (1.6-3.6%)**:
- Missing `font-family: inherit` for form elements → browser default fonts
- `h1` margin is browser default (larger than normalize)

**Recommended migration path**: modern-normalize is easiest. Only need `h1 { margin-top: 0.67em }` + box-sizing impact check.

### Tailwind → vanilla CSS

**Initial → agent analysis → after fix**:

| Viewport | Initial | After fix | Improvement |
|----------|---------|-----------|-------------|
| wide (1440) | 1.1% | **0.3%** | -73% |
| desktop (1280) | 1.2% | **0.3%** | -75% |
| mobile (375) | 5.8% | **0.6%** | -90% |

3 bugs identified by agent:
1. **inline `display:none`** overrides CSS media query → Amount column always hidden
2. **Unspecified line-height** — Tailwind's `text-*` includes line-height but vanilla only has font-size → cumulative vertical shift
3. **Preflight compatibility** — button/input `font-family: inherit` etc.

After fix application, below 1.3% across all viewports. Remaining differences are subtle at breakpoint boundaries (769/768/640px).

## vrt + subagent Evaluation

**Demonstrated that the "VRT diff → agent analysis → fix code generation → re-verification" loop works practically.**

### Tailwind → vanilla CSS

- Agent identified 5 bugs (2 critical)
- 1 round of fixes reduced mobile diff 5.8% → 0.6% (90% reduction)
- Auto-generated Tailwind `text-*` → `line-height` mapping table
- Accurately pointed out inline style vs media query specificity issue

### Reset CSS migration

- Identified diff causes at CSS rule level for all 3 reset variants
- Explained destyle's incompatibility with 3 points: `list-style`, `appearance`, `font-weight`
- Narrowed the fix needed for modern-normalize migration to 1 line (`h1 { margin-top: 0.67em }`)
- Fully enumerated compensation CSS to reach 0% diff

### Blind test (without showing after)

> Details: `docs/reports/2026-04-01-tailwind-migration-blind-test.md`

Generated vanilla CSS without seeing after.html, using only before.html (Tailwind) + VRT diff.

| Iteration | desktop | mobile | Action |
|-----------|---------|--------|--------|
| 0 (no CSS) | 1.7% | 36.7% | — |
| 1 (initial CSS) | 0.3% | 0.6% | Tailwind class → CSS conversion |
| 3 (final) | **0.0%** | **0.0%** | td:last-child font-size fix |

**Achieved pixel-perfect across all 7 viewports in 3 rounds, 58 tool calls (632s).**

#### CSS Migration Findings

| Finding | Content |
|---------|---------|
| **line-height is most important** | Tailwind `text-sm` = font-size + line-height set. Converting only font-size causes cumulative vertical shift |
| **Partial application trap** | When class is applied to only some elements, bulk CSS conversion over-applies |
| **Preflight version differences** | Subtly different between CDN vs PostCSS. font-smoothing, font-family |
| **Heatmap effective for cause identification** | Not just diff %, but spatial pattern (table row shifts, etc.) provides clues |
| **Easy conversions** | layout (flex/grid), colors, spacing, border → nearly 1:1 mapping |
| **Difficult conversions** | line-height, text-decoration, partial application, Preflight compatibility |

### Evaluation Summary

| Metric | Result |
|--------|--------|
| Bug identification accuracy | High — accurately identifies causes at CSS property level |
| Fix code quality | High — achieved 0.0% in blind test |
| Migration judgment validity | High — correctly determined destyle incompatibility, recommended modern-normalize |
| Loop rounds | 3 rounds to pixel-perfect |
| Agent efficiency | 58 tool calls / 632s ≈ 10 min. Work that would take a human several hours |

**vrt functions sufficiently as a foundation for "generating code that makes migration work".**

### Reset CSS blind test (E3)

> Details: `docs/reports/2026-04-04-e3-reset-css-blind-test.md`

Had the agent blindly write app CSS compensation for normalize.css → modern-normalize switch.

| | Initial diff | After fix | Rounds | Tool calls | Time |
|---|---|---|---|---|---|
| Reset CSS (normalize → modern-normalize) | 2.6% | **0.0%** | **1** | **6** | **54s** |
| Tailwind → vanilla CSS (comparison) | 36.7% | 0.0% | 3 | 58 | 632s |

Fix: added 1 line `*, *::before, *::after { box-sizing: content-box; }`.
Canceled modern-normalize's global `border-box` to restore normalize.css's box model.

## CSS Migration Fix Pattern Collection

Systematized from 2 blind tests + 2 regular evaluations: frequent diff causes and fix patterns in CSS migration.

### Pattern 1: box-sizing difference

| | Symptom | Cause | Fix |
|---|------|------|------|
| **Detection** | Overall layout-shift. Prominent on mobile | Reset CSS applies `border-box` globally (modern-normalize, Tailwind Preflight) | Cancel with `*, ::before, ::after { box-sizing: content-box }`, or adjust widths accounting for padding/border |
| **VRT hint** | Spatial pattern is global (all elements shift by a few px) | | |
| **Difficulty** | Low — 1 line fix | | |

### Pattern 2: Missing line-height

| | Symptom | Cause | Fix |
|---|------|------|------|
| **Detection** | Cumulative vertical shift of text lines. Prominent on mobile | Tailwind `text-sm` = font-size + line-height set. Writing only font-size in vanilla CSS causes line-height to inherit from body | Explicitly specify line-height for each text size |
| **VRT hint** | Horizontal stripe pattern per text line in heatmap | | |
| **Difficulty** | Medium — mapping table needed | | |

Tailwind line-height mapping:
```
text-xs  (0.75rem)  → line-height: 1rem
text-sm  (0.875rem) → line-height: 1.25rem
text-base (1rem)    → line-height: 1.5rem
text-lg  (1.125rem) → line-height: 1.75rem
text-xl  (1.25rem)  → line-height: 1.75rem
text-2xl (1.5rem)   → line-height: 2rem
```

### Pattern 3: inline style vs CSS specificity

| | Symptom | Cause | Fix |
|---|------|------|------|
| **Detection** | Specific element always hidden/shown | `style="display:none"` takes priority over CSS media query (`@media (min-width: 640px)`) | Remove inline style, control via CSS class |
| **VRT hint** | Element missing at specific viewport only | | |
| **Difficulty** | Low — structural issue. HTML fix, not CSS | | |

### Pattern 4: Partial application (class on only some elements)

| | Symptom | Cause | Fix |
|---|------|------|------|
| **Detection** | Subtle table row height differences | Tailwind `text-sm` applied to first 3 columns only, last column uses body default. Applying `font-size: 0.875rem` to all columns in vanilla CSS is excessive | Limit with selector like `td:not(:last-child) { font-size: 0.875rem }` |
| **VRT hint** | Table row heights shift uniformly (2px/row × N rows = cumulative) | | |
| **Difficulty** | High — need to read before's class structure | | |

### Pattern 5: Preflight / reset CSS default differences

| | Symptom | Cause | Fix |
|---|------|------|------|
| **Detection** | List markers disappear, form element appearance changes | Aggressive resets like destyle apply `list-style: none`, `appearance: none` | Explicitly restore needed defaults: `ul { list-style: disc }`, `select { appearance: auto }` |
| **VRT hint** | Very large diff (6-12%). Concentrated on specific element types | | |
| **Difficulty** | High — not drop-in replaceable. Close to reimplementing normalize | | |

### Pattern 6: Missing heading margin-top

| | Symptom | Cause | Fix |
|---|------|------|------|
| **Detection** | All content below h1 shifts upward | normalize.css sets `h1 { margin: 0.67em 0 }`. modern-normalize doesn't. App CSS specifies only `margin-bottom`, so `margin-top` differs | Add `h1 { margin-top: 0.67em }` |
| **VRT hint** | Cumulative downward shift starting from h1 position | | |
| **Difficulty** | Low — 1 line fix | | |

### Pattern 7: font-smoothing difference

| | Symptom | Cause | Fix |
|---|------|------|------|
| **Detection** | Subtle pixel diff across all text (<0.5%) | Tailwind Preflight (PostCSS) includes `-webkit-font-smoothing: antialiased` but CDN version doesn't | Explicitly specify or remove font-smoothing to unify |
| **VRT hint** | Diff is global but very small ratio | | |
| **Difficulty** | Low — 1 line, but version-dependent | | |

### Fix Pattern Application Order

Recommended order for fixing CSS migration diffs:

1. **box-sizing** — affects everything. Align first
2. **heading/block margin** — resolve upward cumulative shift
3. **line-height** — resolve text line vertical shift
4. **inline style → CSS** — resolve specificity issues
5. **Partial application fixes** — limit selectors
6. **Preflight defaults** — list markers, form elements
7. **font-smoothing** — final fine-tuning

Applying in this order ensures diff decreases reliably at each step, and VRT loop converges quickly.

### Image Size Mismatch Handling

Initial testing revealed "100% diff across entire page when heights differ".
Fixed to compare only the common region with pixelmatch, counting the excess area as additional diff.
This prevents full-page diff when heights differ by only a few pixels.

## pixelmatch Implementation Comparison

Comparison with identical images. 500x500 = 250,000 pixels.

| Implementation | 500x500 | 1280x900 | 1920x1080 |
|----------------|---------|----------|-----------|
| **npm pixelmatch v7** (JS) | **0.56ms** | **2.52ms** | **4.50ms** |
| mizchi/pixelmatch (MoonBit JS) | 1.94ms | ~9ms (est.) | ~16ms (est.) |
| mizchi/pixelmatch (MoonBit WASM-GC) | 1.11ms | ~5ms (est.) | ~9ms (est.) |

npm pixelmatch v7 is fastest (C algorithm JS implementation).
MoonBit WASM-GC is ~1.7x faster than JS version but can't match npm v7.

**Bottleneck is PNG encode (153ms/call), not pixelmatch**. crater's `capturePaintData` (raw RGBA) can skip PNG encode/decode.

| Operation | Time | Notes |
|-----------|------|-------|
| pixelmatch 1280x900 | 2.5ms | Fast. Not a bottleneck |
| PNG encode 1280x900 | 153ms | **Biggest bottleneck** |
| PNG decode 1280x900 | 73ms | Second biggest |
| paint tree diff (125 nodes) | 0.07ms | crater-specific. Extremely fast |

**Optimization direction**: Compare raw RGBA without going through PNG. Already possible with crater prescanner.

## Findings Summary

### High-Impact Methods (implemented)

| Method | Improvement | Mechanism |
|--------|------------|-----------|
| **Multi-viewport** | +7→+9% | 3 viewports: wide(1440) + desktop(1280) + mobile(375) |
| **Computed style diff** | +10% | Compare all elements including semantic tags via `getComputedStyle` |
| **Hover emulation** | +6% | Inject `:hover` rules as always-on `<style>` → computed style diff |
| **Dead-code classification** | Accuracy improvement | Zero diff across all viewports → exclude as dead code |

### CSS Property Detection Ease Ranking (final, 60 trials)

```
100%  display, font-size, color, text-decoration, width, height
      align-items, border-radius, margin-*, font-weight, flex
 90%  background, padding (context-dependent)
  0%  Dead code (overridden rules / no target elements)
```

### Final Detection Rate (90 trials, 3 fixtures, 741 CSS declarations)

```
VRT detection rate:      92.2%  (83/90)
Undetected breakdown:    dead-code 71%, same-as-default 14%, hover-only 14%

By fixture:
  page (GitHub-like):     96.7%  (29/30) — 1 dead-code
  form-app (settings):    96.7%  (29/30) — 1 dead-code
  dashboard:              83.3%  (25/30) — 3 dead-code, 1 same-as-default, 1 hover-only
```

### By Property Category (90 trials)

```
100%  spacing (9), typography (20), layout (17)
 91%  visual (33)  — background same-color issue
 71%  sizing (7)   — natural size equals dead-code
  0%  animation (1) — invisible in post-completion capture
```

### Always Detected (100%, n>=2)

`font-size` (9), `color` (9), `text-decoration` (6), `display` (5), `border-radius` (4), `padding` (4), `gap` (4), `border-bottom` (4), `align-items` (3), `height` (3)

### Flaky (unstable)

- `width` 50% — dead-code when natural size equals CSS width
- `background` 82% — same as parent color, `pre code` override, etc.

## A/B Controlled Evaluation — control vs vlmkit on an external repo (2026-06-05/06)

First evaluation with a **control arm**: same CSS-regression repair
task on `startbootstrap-agency` (never in any vlmkit fixture), one
fresh agent bare-handed (playwright/pngjs/pixelmatch allowed), one
with vlmkit. Three runs, escalating difficulty. Full series:
`docs/reports/2026-06-06-ab-external-synthesis.md`.

| run | regression | cost | repair completeness |
|---|---|---|---|
| v1 | 1 block deleted | vlmkit **1.8× slower** (diff region crash + truncation workarounds) | tie |
| v2 | 3 value mutations | parity (after drafts 01–03 fixed) | tie |
| v3 | 5 subtle mutations | parity | **vlmkit 3/5 vs 2/5**, no screenshots needed |

Standing conclusions:

- **Agent-facing value lives in the deterministic signal layer**
  (colorSamples, region bboxes, `shift {dx,dy}`, Δheight,
  `--elements-html` selector candidates). All agent praise across
  three runs attaches to it. Three independent control agents
  specified region→selector mapping as their top missing tool before
  it shipped.
- **`diff region` (VLM) was net-negative in every run that tried it**
  — wrong selector attribution, fabricated deltas (drafts 06/09).
  Steer agents to `diff png` until those land.
- **Static-capture "pixel-perfect" ≠ fully repaired.** Blind spots
  observed: JS state classes (navbar-shrink), engine-specific rules
  (`:-moz-placeholder`), sub-threshold deltas. State-aware /
  cross-engine capture is the strongest feature argument from the
  series.
- Top open item: draft 10 — colorSample must sample **differing
  pixels only** (whole-region median reported `#ffffff → #ffffff`
  over a real `#212529 → #090353` change).

## VLM Model Comparison

### 2026-05-19 — haiku vs UI-TARS re-bench (post-0.5.0 release)

Single-pair re-bench against the canonical hard case after the 0.5.0
release. Both models **FIXED in round 1** on `seed 11 (.readme-body pre
{6 props})`.

| Model | bench latency | bench CHANGEs | fix-loop VLM | fix-loop CHANGEs | LLM | Fixes | Round to FIXED |
|---|---:|---:|---:|---:|---:|---:|---:|
| `bytedance/ui-tars-1.5-7b` | 1352ms | 3 | 2765ms | 5 | 5002ms | 6/6 | **1** |
| `claude:claude-haiku-4-5-20251001` | 4180ms | 10 | 2562ms | 11 | 5772ms | 6/6 | **1** |

Stage-2 LLM (fixed): `claude-sonnet-4-20250514`. Initial diff 4.1% →
0.0% in both runs.

**Insight**: Haiku works fine **as a Stage-1 VLM** even though its
format diverges from the canonical CHANGE shape. The previous "use
only when VLM output isn't consumed by Stage-2 LLM" caveat (from
2026-04-04) was too conservative. UI-TARS-with-5-CHANGEs also passes,
below the 7-15 guideline.

Full report: `docs/reports/2026-05-19-vlm-haiku-vs-uitars.md`.

### 2026-05-18 — 8-way bench (prior baseline)

### Single-call latency / output bench (`pkf run vlm-bench`, generated heatmap 1.7% diff, n=1)

| Model | Latency | Tokens | Output | Notes |
|-------|--------:|-------:|-------:|-------|
| **bytedance/ui-tars-1.5-7b** | **1163ms** | 789 | 176ch / 3 CHANGEs | UI-domain-trained, brief but structured |
| google/gemini-2.5-flash-lite | 1937ms | 1640 | 706ch | ⚠ hallucinates `red → red` uniformly |
| **qwen/qwen3-vl-30b-a3b-instruct** | 1992ms | 810 | 533ch / 9 CHANGEs | **emits hex codes** (`#FF4500 → #FF0000`) |
| amazon/nova-lite-v1 | 2381ms | 1911 | 371ch / 9 CHANGEs | stable baseline |
| claude:claude-haiku-4-5-20251001 | 3510ms | 996 | 966ch / 12 CHANGEs | **structured + severity**, ~$0.002/call (~10000× OR cheap) |
| nvidia/nemotron-nano-12b-v2-vl:free | 4594ms | 3584 | 630ch | narrative, no structure, FREE |
| meta-llama/llama-4-scout | 6960ms | 1394 | 1169ch | ⚠ **regressed since 2026-04-04** (was 1.0s) |
| meta-llama/llama-4-maverick | 26815ms | 1650 | 2395ch | ❌ "image not available" + methodology only |

Full report: `docs/reports/2026-05-18-vlm-claude-vs-openrouter-vs-newcomers.md`.

### Earlier reference: Fix Loop Results (2026-04-04, hard case: `.readme-body pre` 6 props, 4.1% diff)

Stage-2 (LLM, CSS-diff aware) decides FIXED, so the VLM speed/output below is the
only meaningful axis; FIXED rate was 1r ✅ for every entry except `gpt-4.1-nano`.

| Model | Fix | Speed | Cost/call | Monthly (21K/day) | CHANGE count |
|-------|-----|-------|-----------|-------------------|-------------|
| **meta-llama/llama-4-scout** | ✅ 1r | **1.0s** | $0.14e-7 | **$0.09** | 11 |
| **amazon/nova-lite-v1** | ✅ 1r | 2.3s | $0.14e-7 | $0.09 | 7 |
| qwen/qwen3-vl-235b-a22b (MoE) | ✅ 1r | 3.2s | $0.25e-7 | $0.16 | 8 |
| amazon/nova-2-lite-v1 | ✅ 1r | 3.5s | $1.38e-7 | $0.87 | 27 |
| google/gemini-3-flash-preview | ✅ 1r | 5.1s | $1.20e-7 | $0.76 | 10 |
| qwen/qwen3-vl-8b-instruct | ✅ 1r | 7.0s | $0.30e-7 | $0.19 | 28 |
| bytedance-seed/seed-1.6-flash | ✅ 1r | 8.6s | $0.49e-7 | $0.31 | 10 |
| openai/gpt-5-nano | ✅ 1r | 10.1s | $0.24e-7 | $0.15 | 0 |
| google/gemma-4-31b-it | ✅ 1r | 40.5s | $0.10e-7 | $0.06 | — |
| openai/gpt-4.1-nano | ❌ | 1.2s | — | — | — |

> **Note**: The 2026-04-04 `llama-4-scout` 1.0s no longer reproduces (2026-05-18: 6.96s + conversational output). Either the model behind that OpenRouter ID changed, or its routing degraded. Treat the 04-04 table as historical.

### Image Resolution and Token Cost

| Resolution | Tokens | Cost multiplier |
|------------|--------|----------------|
| 800x600 (full) | 499 | 1x |
| 400x300 (medium) | 132 | 0.26x |
| 200x150 (low) | 94 | 0.19x |

Color (color/grayscale/binary) does not affect token count.

### Resolution Presets by Viewport

| Preset | Size | Target viewport |
|--------|------|----------------|
| low | 375x320 | mobile (375-640px) |
| medium | 640x480 | tablet/desktop (768-1280px) |
| high | 1280x900 | wide (1440px+) |

### 2-Stage Pipeline

```
Stage 1 (VLM, cheap): heatmap → structured diff (CHANGE: element | property | before | after)
Stage 2 (LLM, precise): structured diff + CSS source + CSS text diff → FIX: selector | property | value
```

**Passing CSS text diff directly to Stage 2 makes VLM quality differences irrelevant.** All models reach the same fix result.

### Cost Estimation (10,000 pages/day)

| Configuration | AI/month | Rendering/month | Total |
|---------------|----------|-----------------|-------|
| Crater + llama-4-scout | $0.09 | $0 | **$0.09** |
| Crater + free model | $0 | $0 | **$0** |
| Chromium + llama-4-scout | $0.09 | $168 | $168 |

### Rendering Cost Comparison (10,000 pages/day, 80,500 renders)

| | Chromium | Crater pixel | Crater paint tree | Crater batch |
|---|---|---|---|---|
| Speed/VP | 600ms | 50ms | 18ms | 10ms |
| CPU/day | 13.5h | 1.1h | 0.4h | 0.2h |
| Speedup | 1x | 12x | 33x | 60x |

### Total Monthly by Infrastructure (AI $0.10 + Compute)

| Configuration | Monthly |
|---------------|---------|
| Self-hosted + Crater | **$0.10** |
| Fly.io + Crater paint tree | **$0.14** |
| Fly.io + Crater pixel | $0.21 |
| CF Workers + Crater WASM | $1 |
| GH Actions + Crater paint tree | $6 |
| GH Actions + Crater pixel | $16 |
| GH Actions + Chromium | $193 |

## Markup Agent KPI — rounds / tokens (2026-07-27)

auto-markup / dynamic-markup 系のエージェント実行を横比較するための
2 主要 KPI と計測プロトコル。S5 から正式運用。

### 定義

| KPI | 定義 | 記録者 |
|---|---|---|
| **rounds**(収束効率) | 「計測ツール実行 → 修正」の 1 サイクル = 1 ラウンド。`build page` / `build component` / ゲート再実行など、レポートを見て HTML を直した回数 | エージェント自己申告(最終レポートに 1 行/ラウンド) |
| **tokens**(コスト) | サブエージェントの総消費トークン(vision 込み) | **ドライバー(親)** — ハーネスの usage(`subagent_tokens`)から転記。サブエージェント自身は自分のトークン数を観測できない |

補助指標: tool calls、wall time、最終ピクセル diff、ゲート通過数。
派生指標: **tokens / round** — ラウンドが減ってもトークンが増えて
いれば 1 ラウンドが肥大している(不要な全画面再読み込み等)。

### Goodhart ガード

rounds / tokens は **done 条件(構成収束 AND ゲート green AND
マスク済み最終 diff)を満たしたランのみ**比較対象にする。
未収束のまま停止したランは「安いラン」ではなく「失敗ラン」。
S5 で Haiku が missing/extra を残して 3 ラウンドで自己宣言停止した
ケースがまさにこれで、KPI 表では品質列を併記して読む。

### ベースライン(S1-S5、Haiku 単独、API キーなし)

| Run | rounds | tokens | tool calls | wall time | 最終 px diff | 品質メモ |
|---|---:|---:|---:|---:|---:|---|
| S1 landing | 4 | —(未計測) | 23 | 112s | 1.40% | build page 6/6 |
| S2 dashboard | 10 | — | — | — | 6.2% | 8/8 ×2vp(うち 6 ラウンドはツールバグ下) |
| S3 auth form | 6 | — | 27 | 133s | 2.6-3.3% | 3 状態一致 |
| S4 theme | 4 | — | 65 | 302s | 5.6-6.6% | unthemed 0/8 |
| S5 promo v1 | 3 | **76,769** | 54 | 231s | 6.3-8.0% | ゲート 4/4 だが構成未収束(done 条件未達)|
| S5 promo r2 | 12 | 221,686 | 102 | 684s | —(未達で終了) | 失敗。`build page` のアニメ途中キャプチャ(幻デルタ)を発見 → 修正 |
| S5 promo r3 | 8 | 375,941 | 138 | 918s | **2.65% / 7.51%(desktop/mobile)** | **初の done 達成**。検証者差し戻し ×2 + 校正ランが決め手 |
| S5 promo r4 | 12 | 177,354 | 151 | 758s | —(未達で終了) | 失敗。**handoff 差し戻しの計測ラン**: 15k tokens/round(resume は ~67k)と 4 倍安いが、1 回の大きなサマリでは残差の名指し漏れ(パネル高)が最後まで直らず |
| S6 catalog | 12 | 176,283 | 93 | 707s | —(未達で終了) | 失敗(実ページ級は 12 ラウンド予算超え)。leg-2 は **`verify markup` の printed verdict 駆動で初の「成功を偽らない」最終報告** |
| S5 promo r5 | 21 | **187,051** | 89 | 810s | **5.60% / 10.53%** | **done(2 例目)**。`verify markup` 駆動 — to-done tokens が r3 比 **-50.2%**、tokens/round 8.9k(r3 は 47k)。leg-1 で thrash(1/2 到達→退行→5 ラウンド空転)を台帳が検出 → トレンド表示・root-cause 優先をツールに実装 → leg-3 は 3 ラウンドで収束 |
| S7 mock(@2x 単体入力) | 43 | 556,216 | 156 | — | 3.81% | **done(mock-markup モード初回実証)**。膠着2件はツール盲点(ペアリング・抽出連結性)と判明 → fill/hairline ゲート + pixel-presence 降格で恒久修正。修正後は 1-3 ラウンドで収束 |
| S7-fresh Haiku(修正済みツール) | 12 | 69,644 | 48 | 354s | 7.30% | 失敗(6/8 で 1px 線エンドゲーム未突破 — Haiku のモデル上限と確定)。構造崩壊はなし |
| S7-fresh **Sonnet**(修正済みツール) | **9** | 147,848 | 76 | 1092s | **2.85%** | **done — 初の完全自律(差し戻しゼロ)**。単価3倍×tokens2.1倍 ≈ 6倍/ラン。修正前 S7 比 tokens -73% |
| S8 edit Haiku(クリーン) | 1 | **44,501** | — | — | — | **done + 最小差分検証 PASS**。edit モードは Haiku 領域(正解 CSS の大半が入力に含まれ、エンドゲームが発生しない) |
| S8 edit Sonnet | 0 | 68,495 | — | — | — | done + PASS だが**汚染ラン**(fixture の作問コメントが正解リストとして漏洩)— 参考値 |
| S9 scrollpage Haiku | 12 | 77,621 | — | — | — | 失敗(composition 膠着)。ただし**挙動系は完全達成**(check scroll ok: sticky/snap/fixed 全部 green)— 静的と動的で難度が分離した初の例 |
| S9 scrollpage **Sonnet 継続レグ** | 6 | 199,876 | 99 | 1663s | 4.98% | 失敗(1 extra 残し)。diff 18.3%→4.98%、missing/extra 2/2→0/1、高さ許容内、scroll green 維持。残差 = 段落 reflow(1 行増で記事ブロックが ~20px 沈む)。**検証者目視でコピー誤り 3 件を追加検出**(© 2025/2026、`·` 区切り欠落、Imlil→Imili 等の転記 typo)— composition には写らない |
| S9-fresh Haiku(帰属+kind+copy gate) | 11 | 77,332 | 61 | 444s | 20.11% | 失敗 — **帰属付き kickback でも Haiku の壁(fixed 座標系+相互作用 gap)は不変**(null result、膠着 3 点も tokens も元 S9 とほぼ同一)。copy gate 自己レビューは「同じ目」問題で Imlil typo を素通し(PASSED と虚偽報告)— キーレスモードは転記者と別の読み手が必須と skill 改訂 |
| S9-replay **Sonnet**(帰属あり、同一開始状態) | **3** | 181,294 | 80 | 1616s | 6.77% | **DONE — 帰属なしの元エスカレーション(6r/199,876/未達)と同一開始状態・同ヒント・同予算のリプレイで rounds -50%、未達→達成に反転**。© 年号も crop 直読で自発修正。帰属は「診断能力のあるモデルを加速する」(Haiku には効かない — S9-fresh の null result と対称) |
| S11 interactive Haiku | 8 | 57,820 | 31 | 263s | 1.03% | 失敗(静的 3 残差)。**interactions standalone は ok だが、検証者の --reference 契約が ArrowRight roving 誤実装を検出** — standalone と自己レビューの両方をすり抜けた。合理化 5 例目もペア画像で反証 |
| S11 interactive **Sonnet 継続レグ** | 5 | 139,720 | 71 | 986s | 0.70% | **挙動契約 satisfied**(stale index バグ特定・修正)。静的は 1 extra(視覚等価を検証者が確認)で予算内正直停止。隠れ状態コピーの carrier 欠落(作問ミス)も検証者ソース突合で発見 |
| S12 heavy-interactive Haiku | 7 | 55,187 | 34 | 260s | 0.51% | 失敗(静的 3 残差、「フォントレンダリング」合理化 6 例目)。ただし**重量級パターン(modal dialog trap + menu focus/arrows/Escape 返還)を brief から一発実装、契約 satisfied** |
| S12 heavy-interactive **Sonnet 継続レグ** | 2 | 119,079 | 49 | 1102s | **0.24%** | **DONE — 静的 + 挙動契約の両立を達成した初のシナリオ**。ピクセル実測駆動(border #fda4af/#9f1239 をサンプリングで特定)。letter-spacing -0.4px の連結成分適合は要ウォッチ(2 例目) |
| S13 widgets Haiku | 8 | 62,632 | 25 | 278s | 21.65% | 失敗(listbox 全幅レンダリング=合理化 7 例目をペア画像で反証)。composites+handlers standalone は ok だが **accessible name 契約が aria-labelledby 欠落を検出**(standalone・自己レビュー素通り) |
| S13 widgets **Sonnet 継続レグ** | 4 | 138,205 | 68 | 979s | **1.52%** | **DONE — 静的 + interaction 契約 + surface 契約の三重達成は初**。extractor の top-8 ランキング席取りを読んで ordering 誤検出を解消(要ウォッチ 3 例目: 分割適合)。surface 契約の委譲偽陽性 1 件は検証者が即修正 |
| S10 realshot **Sonnet** | 2 | 58,103 | — | — | 36%(advisory) | **done(劣化キャプチャ宣言モード初実証)**。dpr2+JPEG 実スクショ 1 枚入力。diff 36% は写真領域のグラデ近似による設計値 — 構図・コピー・パレットは目視一致 |
| S14a creative Haiku(参照なし) | 1 | 31,616 | 9 | 69s | —(target 不在) | **DONE — 参照なし創造モード初実証**(done 条件 = check integrity CLEAN×3 + copy manifest 0 missing)。integrity は初稿 clean、修正駆動は copy gate のみ(details 内 2 行)。検証フェーズ(別読み手: gate 再実行・3 幅目視・verify flow で details 開閉実証)で gate 沈黙欠陥 0。**pixel target が無い創造タスクでは Haiku の壁(1px エンドゲーム)が発生しない** |
| S14a-stress creative Haiku(高密度ブリーフ) | 1 | 30,499 | 5 | 52s | —(target 不在) | **DONE — 負荷ブリーフ(固定サイドバー+3 段階規律+非分割トークン)でも初稿 CLEAN**。DOM 実測で全レイアウト規律充足を確認。結論: 作成ランでは kickback 追従を計測できない(明確なブリーフ+現行 Haiku は初稿 clean が定常) |
| S14a-fix repair Haiku(既知欠陥 6 種の修理) | 2 | 29,616 | 10 | 57s | —(target 不在) | **CLEAN — kickback 追従 7/7**(diff 監査: 全修正が名指しセレクタ、削除逃げ 0、figure/caption 保全)。r2 で dedupe に隠れていた 375 図版オーバーフローが顕在化→修正。**帰属 kickback の決定論ナビゲーションは修理タスクなら Haiku でも完全に機能**(参照ありでは Sonnet 限定だった加速効果) |
| S15 zero-shot product page Haiku(実世界パターン) | 2(自称)/ 5 iter(台帳) | 49,704 | 28 | 188s | —(target 不在) | **DONE — 5 ゲート同時達成を別読み手検証**(integrity CLEAN / copy 0 missing / scroll / handlers / interactions 各 0 suspect)。パンくず・セール価格・radio バリアント・ステッパー・ARIA タブ・閉 FAQ・375 sticky バー・スペック表を brief から一発実装。**disclosure-state sweep 初実戦: 30 行中 11 行が revealed-only で初稿から 0 missing — S14a で観測した open-既定誘導が消滅**。ラウンド自称 2 vs 台帳 5 iter の乖離あり(KPI は台帳から取ること)。gate 沈黙欠陥 0(sticky の fullPage 重なりは撮影アーティファクトと判別)。`docs/reports/2026-07-31-s15-zero-shot-product-page.md` |
| S16 zero-shot dashboard Haiku(表操作系) | 2 write(台帳) | 56,226 | 20 | 266s | —(target 不在) | **DONE — 5 ゲート + 実挙動プローブ全通過を別読み手検証**。ソートは実並び替え(aria-sort 昇降 + キーボード Enter)、aria-pressed フィルタは実絞り込み(Paid→3 行)、375 ハンバーガー drawer、**表はコンテナ内横スクロール(438>341px)でページ overflow 0** — 実世界の表パターン規律を保持。integrity は初稿 CLEAN、修正は copy 7→0 の 1 回のみ。エージェントの warn 解釈(「プローブは並び替えを観測できない」)は誤り — 再プローブで実挙動確認、**ツール内部についてのエージェント推論は鵜呑みにせず再測定**。gate 沈黙欠陥 0(5 パス連続)。`docs/reports/2026-07-31-s16-zero-shot-dashboard.md` |

トークン計測は S5 が初(それ以前のランは usage を記録していなかった)。
r2/r3 の tokens はセグメント合算 — 差し戻し(resume)はトランスクリプト
再投入を再課金されるため後半セグメントが重い。**r4 で実測済み**:
handoff(検証者サマリ付き新規エージェント)は ~15k tokens/round と
resume(~67k)の約 1/4。ただし r4 は done 未達 — コストは handoff、
収束性は「新鮮な計測付きの小さな標的差し戻しを繰り返す」方が勝る。
差し戻し文面から漏れた残差は直らない(r4 のパネル高)。done 達成ランの実測(8 rounds / 375.9k)を受けて、複数
ターゲットの tokens ターゲットは「初回セグメント ≤150k、差し戻し込み
≤400k」を暫定値とする。詳細:
`docs/reports/2026-07-27-dynamic-markup-skill-haiku-s5.md` の
「再挑戦 r2 / r3」節(早期自己宣言に効いた対策 = 差し戻し + 校正ラン、
効かなかった対策 = skill 文言・プロンプト明示、も同節)。

### 初期ターゲット(ベースライン由来、要改訂)

- 単一 viewport ページ: **≤5 rounds / ≤80k tokens**
- 複数ターゲット(viewport / state / motion 付き): **≤12 rounds / ≤150k tokens**
- done 条件を満たした上での超過は fixture 難度シグナル、
  未達のままの KPI 好成績は無効

記録の運用: 各実証レポート(docs/reports/)の結果表に rounds /
tokens 列を必ず含め、この節のベースライン表に 1 行追記する。
**rounds は 2026-07-28 から自己申告でなく `.vlmkit/run-ledger.jsonl`
(全ループツールが自動追記)で監査する。** done 判定は
`vlmkit verify markup`(verdict + 校正フロア + 全残差キックバック)に
一本化 — 検証者ツーリングの詳細と S6 の結果は
`docs/reports/2026-07-28-verifier-tooling-and-s6.md`。

### Selector-heal calibration (2026-07-30)

`vrt interact --heal-all` labels **strong** suggestions at confidence `>= 0.40`
and **weak** ones at `>= 0.15`. These are precision-first thresholds: a
fixture-derived corpus found that the former 0.30 strong cutoff promoted a
wrong sibling. The corpus, exact scores, and reproduction command are in
[`docs/reports/2026-07-30-selector-heal-calibration.md`](reports/2026-07-30-selector-heal-calibration.md).

### check integrity — 参照なし欠陥ゲートの S14b/S14c 結果 (2026-07-30)

設計: `docs/design/creative-markup-eval.md`。参照(target 画像・manifest)
なしで判定可能な欠陥 9 クラスの決定論ゲート。

- **S14b mutation 検知率: 9/9 (100%)** — JS 構築失敗 / post-load 例外 /
  404 画像 / テキスト衝突(負マージン + 同層 absolute の両方)/ テキスト
  切れ / 潰れコンテナ(float)/ page-overflow-x / 404 stylesheet
  (+unstyled-page 連鎖)/ 375px 限定オーバーフローの viewport 帰属。
  注入は自明ケースなので 100% が合格線(設計どおり)。
- **S14c 偽陽性(自作分): 0** — hero オーバーレイ / ellipsis 切り詰め /
  高さ 0 位置決めアンカー / aria-hidden 装飾は verdict clean のまま
  `exempted` に理由付きで記録される(免除はツールの判定として可視)。
- **実装知見**: Chromium は 404 の `<link rel=stylesheet>` にも空の
  CSSStyleSheet を付ける(`link.sheet != null`)— DOM 側では死んだ
  stylesheet を検知できず、wire(requestfailed / 非 OK response)が
  唯一の信頼できる検知点。同様に、テキストのみのページはグリフが
  minArea 未満で components 0 になるため、degenerate 判定は pixel 単独
  でなく DOM textBlocks との AND が必要。
- **初回 dogfood**: S8 edit fixture(1280 で DONE 検証済み)に 375px で
  67px の実在オーバーフロー(`div.plans` 帰属)— 参照ありゲートは target
  が存在しない幅に盲目、というこのゲートの存在理由をそのまま実証。
- **S14c 外部 dogfood(同日)**: 5 実ページミラーで免除ルールの穴 4 クラス
  を発見・修正 — ①image replacement / sr-only(csszengarden で 6 誤 fail;
  判別軸は「部分切れ=欠陥 / 完全隠し=パターン」で、直下テキスト rects と
  要素 box の交差面積を実測)、②scroll-scan 委譲が免除済みセレクタを
  clipped-content で再報告、③cross-origin リソース失敗は warn(danluu の
  CF beacon)、④総 CSS ルール数 <5 は意図的ミニマル(danluu)。真の陽性
  1 件(HN の 36px 横スクロール @768)。詳細:
  `docs/reports/2026-07-30-integrity-external-dogfood.md`。
- S14a は同日実施済み(台帳参照)。Layer B は**凍結(需要ゲート)**:
  決定論降格(A10-A12 + layout contract)で残余が B3 + 複合背景 + 美観
  まで縮小し、S14a 全ランで gate 沈黙欠陥 0 のため、実観測を着手条件に
  変更。同日、`unstyled-page` の UA 指紋 warn 分岐を撤去(真陽性 0 /
  偽陽性 1 — danluu 特例ごと削除、wire 検知 fail 分岐が本命を担う)。
  VLM 意味ラベリング bench も未実装のままクローズ(決定論 kind で需要
  充足、消費者不在)。
- **Layer A 第 2 陣(2026-07-30)**: B 軸から 4 判断を決定論降格 —
  A10 container-protrusion(painted parent からの in-flow はみ出し;
  positioned badge / 負マージン breakout は exempt)、A11 invisible-text /
  low-contrast-text(単色背景のみ、αブレンド+累積 opacity、複合背景は
  集約 exempt 行で明示スキップ;**視覚的に隠れたテキストは自要素+祖先
  クリップ交差で除外** — zen garden の閉じたドロップダウン内白文字を
  invisible と誤報した偽陽性 2 クラスを実測修正)、A12 near-misalignment
  (兄弟が正確に揃う軸から 2-8px 外れ=事故、warn)、`check layout
  --contract`(ブリーフ構造要求の宣言照合、MCP 9 本目)。全ミラー+全
  fixture で偽陽性 0、attempt-stress の #changelog low-contrast warn
  (2.56:1)は真の陽性。バッテリー 31 テスト。

### check copy — disclosure-state sweep (2026-07-31)

S14a で観測した gate 誘導(copy manifest がレンダリング済みテキストのみ
照合のため、`<details>` 内の必須 copy がエージェントに「open 既定で出荷」
を選ばせる — 追記13)の根治。`check copy` は既定で開示状態を掃引する:
閉じた `<details>` を open(DOM プロパティ、累積)、未選択 `[role=tab]`
と `[aria-expanded=false]` をクリック(ページ JS が発火)し、各状態の
`body.innerText` を捕捉(cap 30、超過は明示カウント)。manifest 行は
既定表示 → 開示状態の順で照合し、開示状態でのみ見つかった行は
**provenance 付き PASS**(`revealed: "…" ← details "Refund policy"`)+
「この gate のために open 既定に倒すな」の行内注意。隠れ placeholder は
suspect のまま(閉じたパネル内の lorem ipsum もバグ)。`--target` の
bbox クロップは既定状態のみ(スクリーンショットは既定状態のため)。
オプトアウト `--no-states`。innerText はレイアウト済みテキストだけを
返すので「その状態でユーザーが読める文」と正確に一致するのが要点。
限界: 純 CSS タブ(radio input 方式)と hover 開示は掃引対象外。
