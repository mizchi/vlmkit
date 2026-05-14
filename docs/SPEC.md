# Test SPEC

38 tests across 2 module(s) — 19 pending, 19 active

## `./`

### `Spec.pkl`

- [ ] **Build a card from a blank starter until diff under 3 percent** (critical) — verifies: FIDELITY-001
  >   `vrt component-from-image` against the pricing-card target
  >   reports bbox / heatmap / palette / typography signals; iteration
  >   converges the diff under 3% in <5 rounds on a representative
  >   fixture.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **CLS detection via in-page PerformanceObserver** — verifies: K5
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Color tokens conform to declared palette** — verifies: M1
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Cross-browser parity across Chromium / Firefox / WebKit** — verifies: H1
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Dark mode parity: every component responds to color-scheme** (critical) — verifies: C1
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Extract a single component from a page screenshot** — verifies: A8
  >   Given a full-page PNG, `vrt component-extract` finds the major
  >   non-background components, classifies each (text / filled-rect /
  >   icon / image), and crops the chosen rank to a standalone PNG
  >   suitable for use as a target in `vrt component-from-image`.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Form validation state diff from invalid to valid** [draft] — verifies: E5
  >   Draft — no canonical fixture yet. The underlying engine
  >   (`vrt interact`) is already shipped; once we have a fixture
  >   with deliberate validation states this scenario gets promoted
  >   to approved and Test.pkl drops the `pending = true` marker.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Inline-vs-component drift on a single page** — verifies: J2
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Mechanical smoke covers every markup-assistance CLI** (critical) — verifies: SMOKE
  >   `scripts/smoke-all-clis.sh` runs every markup-assistance CLI on
  >   its canonical fixture and asserts exit 0 + expected output. The
  >   pkspec Test.pkl mirror provides the same gate with the added
  >   Pkl-typed expectations.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Media variants: forced-colors / reduced-motion / print / RTL / zoom-200** — verifies: C2-C6
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Page declares actions via window.__vrtActions / data-vrt-action** — verifies: O1
  >   `vrt explore` auto-discovers actions the page advertises and
  >   diffs each transition. Shaped like the WebMCP proposal but
  >   doesn't depend on the unfinished spec.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Radius / spacing / z-index / shadow-tier conformance** — verifies: M4-M6
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Selector miss in vrt interact triggers healer correction** — verifies: O2
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Skill playbook fans out N checks over one target** — verifies: O3-O5
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Tab order matches visual reading order** — verifies: F3
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Touch target size meets WCAG 2.5.5 AAA / 2.5.8 AA** (critical) — verifies: F2
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **WCAG AA text contrast scan** (critical) — verifies: F1
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **i18n text inflation: no overflow or wrap at 1.4x word length** — verifies: I1
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

### `Test.pkl`

- [x] **a11y-contrast** — verifies: F1, SMOKE
  > WCAG AA text contrast scan on low-contrast fixture.
  - body: `cmd` (exit 0 expected)

- [x] **a11y-focus-order** — verifies: F3, SMOKE
  > Tab order matches visual reading order.
  - body: `cmd` (exit 0 expected)

- [x] **a11y-touch** — verifies: F2, SMOKE
  > Touch-target size scan, WCAG 2.5.5 and 2.5.8.
  - body: `cmd` (exit 0 expected)

- [x] **compare** — verifies: SMOKE
  > Migration compare (existing tool), shadcn fixture.
  - body: `cmd` (exit 0 expected)

- [x] **component-consistency** — verifies: J2, SMOKE
  > Inline-vs-component drift on a single page.
  - body: `cmd` (exit 0 expected)

- [x] **component-extract** — verifies: A8, SMOKE
  > Crop a single component from a page screenshot.
  - body: `cmd` (exit 0 expected)

- [x] **component-from-image** — verifies: FIDELITY-001, SMOKE
  > Rebuild a card from a blank starter against a target PNG.
  - body: `cmd` (exit 0 expected)

- [x] **component-from-image-typo** — verifies: FIDELITY-001, SMOKE
  > Same CLI on a fixture with wrong-size/weight typography.
  - body: `cmd` (exit 0 expected)

- [x] **cross-browser** — verifies: H1, SMOKE
  > Chromium / Firefox / WebKit parity.
  - body: `cmd` (exit 0 expected)

- [x] **design-tokens** — verifies: M1, M4-M6, SMOKE
  > Radius / spacing / z-index / shadow-tier conformance.
  - body: `cmd` (exit 0 expected)

- [x] **explore** — verifies: O1, SMOKE
  > Page advertises actions via __vrtActions / data-vrt-action.
  - body: `cmd` (exit 0 expected)

- [ ] **form-validation-diff** — verifies: E5 — tags: spec
  > Form validation state diff from invalid to valid. Pending: no canonical fixture yet; interact covers the underlying engine.
  - body: _not yet implemented_

- [x] **i18n-stress** — verifies: I1, SMOKE
  > 1.4x word inflation should not overflow or wrap.
  - body: `cmd` (exit 0 expected)

- [x] **interact** — verifies: O2, SMOKE
  > Drive a click/type sequence and diff each transition.
  - body: `cmd` (exit 0 expected)

- [x] **media-variants** — verifies: C2-C6, SMOKE
  > forced-colors / reduced-motion / print / RTL / zoom-200 sweep.
  - body: `cmd` (exit 0 expected)

- [x] **multi-page-consistency** — verifies: J2, SMOKE
  > Same selector across pages should render identically.
  - body: `cmd` (exit 0 expected)

- [x] **perf** — verifies: K5, SMOKE
  > CLS detection via in-page PerformanceObserver.
  - body: `cmd` (exit 0 expected)

- [x] **png-diff** — verifies: SMOKE
  > Existing PNG diff utility, identity check (0% diff).
  - body: `cmd` (exit 0 expected)

- [x] **skill-pricing-card** — verifies: O3-O5, SMOKE
  > Skill playbook fans out N checks over one target.
  - body: `cmd` (exit 0 expected)

- [x] **theme-parity** — verifies: C1, SMOKE
  > Dark-mode parity: every component responds to color-scheme.
  - body: `cmd` (exit 0 expected)

## Spec implementation index

- **A8** — Extract a single component from a page screenshot
  - test: `Test.pkl` — component-extract
- **C1** — Dark mode parity: every component responds to color-scheme
  - test: `Test.pkl` — theme-parity
- **C2-C6** — Media variants: forced-colors / reduced-motion / print / RTL / zoom-200
  - test: `Test.pkl` — media-variants
- **E5** — Form validation state diff from invalid to valid
  - _No active implementation._
- **F1** — WCAG AA text contrast scan
  - test: `Test.pkl` — a11y-contrast
- **F2** — Touch target size meets WCAG 2.5.5 AAA / 2.5.8 AA
  - test: `Test.pkl` — a11y-touch
- **F3** — Tab order matches visual reading order
  - test: `Test.pkl` — a11y-focus-order
- **FIDELITY-001** — Build a card from a blank starter until diff under 3 percent
  - test: `Test.pkl` — component-from-image
  - test: `Test.pkl` — component-from-image-typo
- **H1** — Cross-browser parity across Chromium / Firefox / WebKit
  - test: `Test.pkl` — cross-browser
- **I1** — i18n text inflation: no overflow or wrap at 1.4x word length
  - test: `Test.pkl` — i18n-stress
- **J2** — Inline-vs-component drift on a single page
  - test: `Test.pkl` — component-consistency
  - test: `Test.pkl` — multi-page-consistency
- **K5** — CLS detection via in-page PerformanceObserver
  - test: `Test.pkl` — perf
- **M1** — Color tokens conform to declared palette
  - test: `Test.pkl` — design-tokens
- **M4-M6** — Radius / spacing / z-index / shadow-tier conformance
  - test: `Test.pkl` — design-tokens
- **O1** — Page declares actions via window.__vrtActions / data-vrt-action
  - test: `Test.pkl` — explore
- **O2** — Selector miss in vrt interact triggers healer correction
  - test: `Test.pkl` — interact
- **O3-O5** — Skill playbook fans out N checks over one target
  - test: `Test.pkl` — skill-pricing-card
- **SMOKE** — Mechanical smoke covers every markup-assistance CLI
  - test: `Test.pkl` — a11y-contrast
  - test: `Test.pkl` — a11y-focus-order
  - test: `Test.pkl` — a11y-touch
  - test: `Test.pkl` — compare
  - test: `Test.pkl` — component-consistency
  - test: `Test.pkl` — component-extract
  - test: `Test.pkl` — component-from-image
  - test: `Test.pkl` — component-from-image-typo
  - test: `Test.pkl` — cross-browser
  - test: `Test.pkl` — design-tokens
  - test: `Test.pkl` — explore
  - test: `Test.pkl` — i18n-stress
  - test: `Test.pkl` — interact
  - test: `Test.pkl` — media-variants
  - test: `Test.pkl` — multi-page-consistency
  - test: `Test.pkl` — perf
  - test: `Test.pkl` — png-diff
  - test: `Test.pkl` — skill-pricing-card
  - test: `Test.pkl` — theme-parity
