# Test SPEC

129 tests across 1 module(s) — 129 pending, 0 active

## `./`

### `Spec.pkl`

- [ ] **200 percent browser zoom usability** — verifies: F8
  > `media-variants --variants zoom-200` flags scrollWidth regressions at 2× zoom.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **A11y tree diff between two renders** — verifies: CORE-003
  >   Capture Playwright's accessibility snapshot for each side of
  >   the compare and surface structural changes — role / name /
  >   level diffs that pure pixel diff misses.
  - contributes to: GOAL-CORE-DIFF
  - body: _not yet implemented_

- [ ] **ARIA attribute correctness** [draft] — verifies: F4
  > Partial: `a11y-semantic` exists pre-v2 but has narrow rule coverage; full ARIA compliance is not yet a single-CLI check.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Accordion expand or collapse** — verifies: E10
  > `interact` drives the toggle and snapshots both states.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Agent-editable helpers layer** (minor) [draft] — verifies: O9
  > Not implemented: no `.vrt-agent/` convention for agent-authored helpers separate from project source.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Agent-friendly diff Markdown summary** — verifies: MIG-002
  >   `vrt diff-for-agent <migration-report.json>` collapses a
  >   compare report into a worst-first table with selector +
  >   property aggregation. Default consumer is a subagent fix
  >   pass.
  - contributes to: GOAL-MIGRATION-VERIFICATION, GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Alternate bench backends: Crater BiDi and Prescanner** (minor) — verifies: BENCH-003
  >   `--backend crater` and `--backend prescanner` route the bench
  >   through alternative renderers. Crater requires a running
  >   `crater bidi` server; Prescanner is in-process.
  > Smoke coverage: `vlmkit check crater` verifies the Crater BiDi backend
  > contract and skips cleanly when the external server is not running.
  - contributes to: GOAL-CSS-CHALLENGE
  - body: _not yet implemented_

- [ ] **Animation or transition correctness** ⊘ deprecated (minor) — verifies: N3
  > Preserved for matrix-row parity.
  - contributes to: GOAL-MARKUP-FIDELITY
  - deprecated: Out of scope per v2 matrix: transitions are intentionally disabled for determinism — mid-frame correctness is fundamentally incompatible.
  - body: correctness remains out of scope; detection exists as `vlmkit check motion`, which samples CSSOM animation / transition declarations and running vs paused animation state.

- [ ] **Asset 404 or broken images** (minor) [draft] — verifies: K6
  > Partial: `render-sanity` in `compare` flags pages with missing-image placeholders; no dedicated network-error gate.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Bug-repro fixture auto-generation** (minor) [draft] — verifies: O11
  > Not implemented: could combine `component-extract` with a `compare` baseline + delta, but no command stitches them today.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Build a card from a blank starter until diff under 3 percent** (critical) — verifies: FIDELITY-001
  >   `vrt component-from-image` against the pricing-card target
  >   reports bbox / heatmap / palette / typography signals; iteration
  >   converges the diff under 3% in <5 rounds on a representative
  >   fixture.
  - contributes to: GOAL-MARKUP-FIDELITY
  - depends on: CORE-001
  - decisions: 1 entry(ies)
  - body: _not yet implemented_

- [ ] **Build component from Figma export** — verifies: A2
  > Same engine as A1; `--device-scale-factor 2` handles retina Figma exports.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Build component from PNG screenshot** — verifies: A1
  > `vrt component-from-image` accepts a PNG target and renders the agent's HTML for pixel-diff iteration. Same engine drives A1-A4.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Build component from competitor visual reference** (minor) — verifies: A4
  > Same engine as A1; treats any PNG as a reference target regardless of provenance.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Build component from hand-drawn wireframe** (minor) [draft] — verifies: A3
  > Partial: the text-row detector currently assumes typeset text. Hand-drawn glyphs need a sketch-tolerant text classifier — not yet implemented.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Build from natural-language description** ⊘ deprecated (minor) — verifies: A6
  > Marked out-of-scope in v2 matrix; preserved here for one-to-one matrix mapping.
  - contributes to: GOAL-MARKUP-FIDELITY
  - deprecated: Out of scope per v2 matrix: no reference image means no vrt signal applies. The scenario stays here only so the matrix-row link is mechanical; no successor.
  - body: _not yet implemented_

- [ ] **Build full page from design-spec document** (minor) [draft] — verifies: A5
  > Partial: per-component fidelity works; there is no multi-component composition / layout-stitch CLI yet.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Build landing page matching a visual reference** (minor) [draft] — verifies: A7
  > Partial: works when X is a screenshot (A1 flow); no first-class 'inspired by URL' command yet.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Bundle size analysis** ⊘ deprecated (minor) — verifies: G3
  > Preserved for matrix-row parity.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - deprecated: Out of scope per v2 matrix: bundle analyzers and Lighthouse cover this lane; vrt has no asset-pipeline integration.
  - body: _not yet implemented_

- [ ] **Bundled per-target check via skill run** — verifies: L5
  > `vrt skill run <name> --against <html|url>` aggregates all configured checks for the target into one report.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **CLS detection via in-page PerformanceObserver** — verifies: K5
  > `vrt perf` wires up a PerformanceObserver inside the page and reports CLS / LCP / FCP without depending on Lighthouse.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **CSS challenge bench delete-and-detect** — verifies: BENCH-001
  >   `vrt bench` (alias `pkf run css-bench`) randomly deletes a
  >   CSS property or selector block, runs the chosen detection
  >   backend, and accumulates a per-trial pass/fail record into
  >   `data/*.jsonl`.
  - contributes to: GOAL-CSS-CHALLENGE
  - body: _not yet implemented_

- [ ] **Canvas or WebGL content** ⊘ deprecated (minor) — verifies: N1
  > Preserved for matrix-row parity.
  - contributes to: GOAL-MARKUP-FIDELITY
  - deprecated: Out of scope per v2 matrix: pixel-only diff cannot reason about render-target state inside Canvas / WebGL contexts.
  - body: _not yet implemented_

- [ ] **Caption or alt-text presence** ⊘ deprecated (minor) — verifies: F10
  > Preserved for matrix-row parity.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - deprecated: Out of scope per v2 matrix: requires static-HTML analysis, not a visual signal. Use an HTML linter.
  - body: _not yet implemented_

- [ ] **Carousel or slider transitions** ⊘ deprecated (minor) — verifies: E9
  > Preserved for matrix-row parity.
  - contributes to: GOAL-MARKUP-FIDELITY
  - deprecated: Out of scope per v2 matrix: transitions are intentionally disabled for determinism; mid-frame capture would require a separate animation-first toolkit.
  - body: _not yet implemented_

- [ ] **Color blindness simulation** (minor) [draft] — verifies: F7
  > Not implemented: could be added via a CSS-filter wrapper around `compare`.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Color tokens conform to declared palette** — verifies: M1
  > `vrt design-tokens` flags rendered colors that fall outside the declared palette — catches off-scale hex values before they leak into the token catalog.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Compare-runs aggregates multiple VRT runs** (minor) — verifies: MIG-004
  >   `vrt compare-runs` diffs two prior vrt runs against each other
  >   (e.g. iter 0 vs iter 1 of a fix loop) so progress per round is
  >   visible at a glance.
  - contributes to: GOAL-MIGRATION-VERIFICATION, GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Computed style diff across hover and focus states** — verifies: CORE-002
  >   `getComputedStyle` capture for both rest and pseudo-states
  >   (`:hover`, `:focus`) plus per-property delta surfacing.
  >   Embedded inside `vrt compare` rather than exposed as its own
  >   CLI; the report.md groups deltas by selector + property.
  - contributes to: GOAL-CORE-DIFF
  - body: _not yet implemented_

- [ ] **Cross-browser parity across Chromium / Firefox / WebKit** — verifies: H1
  > `vrt cross-browser` renders the same HTML in all three engines and reports per-engine pixel diff against Chromium. `--allow-skipped` keeps CI green when WebKit isn't installed.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Cross-page component drift** — verifies: J1
  > `vrt multi-page-consistency` diffs the same component selector across N pages and surfaces the outlier.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Cumulative Layout Shift measurement** — verifies: G1
  > `vrt perf` reads CLS from an in-page PerformanceObserver.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Dark mode parity: every component responds to color-scheme** (critical) — verifies: C1
  > `vrt theme-parity` flips `prefers-color-scheme`, diffs every component, and surfaces ones that didn't update (forgot a `--var` or hard-coded a hex).
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Detection report aggregates accumulated bench runs** (minor) — verifies: BENCH-002
  >   `vrt report` reads the jsonl history and emits per-fixture +
  >   per-backend detection-rate tables. Last measured: 96.7% on
  >   the canonical fixture set (docs/knowledge.md).
  - contributes to: GOAL-CSS-CHALLENGE
  - depends on: BENCH-001
  - body: _not yet implemented_

- [ ] **Different image aspect ratios** (minor) [draft] — verifies: I4
  > Per-fixture today; no aspect-ratio sweep CLI.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Disabled state** (minor) [draft] — verifies: E3
  > Scriptable via `interact` (set the attribute then snapshot); no first-class disabled-sweep CLI.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Dropdown or menu open** — verifies: E7
  > Trigger the toggle via `interact` or `explore`; both engines diff the open vs closed state.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [x] **Element-level shift-isolated diff** — verifies: CORE-004
  >   `vrt elements` diffs per-element bounding boxes after isolating
  >   cascading layout shift; useful when a single element moves and
  >   pixel diff would otherwise blame everything downstream.
  - contributes to: GOAL-CORE-DIFF
  - body: implemented as `vrt diff elements` and `vrt diff component` in `packages/vlmkit-core/src/element-compare.ts`

- [ ] **Empty state** (minor) [draft] — verifies: E6
  > Scriptable via `interact` (set state then snapshot); no first-class empty-state CLI.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Extract a single component from a page screenshot** — verifies: A8
  >   Given a full-page PNG, `vrt component-extract` finds the major
  >   non-background components, classifies each (text / filled-rect /
  >   icon / image), and crops the chosen rank to a standalone PNG
  >   suitable for use as a target in `vrt component-from-image`.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **FOUC detection** (minor) [draft] — verifies: G4
  > Partial: LCP element identity from `perf` hints at FOUC; no dedicated unstyled-paint window detector.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Focus and focus-visible state** — verifies: E2
  > `component-from-image --states focus-visible` plus `a11y-focus-order` verify focus visibility.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Foldable or dual-screen rendering** ⊘ deprecated (minor) — verifies: D3
  > Preserved for matrix-row parity; no successor.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - deprecated: Marked out-of-scope per v2 matrix: edge-case device class with no install base justifying tooling investment.
  - body: _not yet implemented_

- [ ] **Form autofill state** (minor) [draft] — verifies: N5
  > Partial: `interact` plus scripted fill drives the values; the browser autofill UI itself is not capturable in headless.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Form validation state diff from invalid to valid** — verifies: E5
  >   `vrt interact` drives a form sequence through deliberate
  >   invalid → valid transitions (bad email, short password, then
  >   corrections) and pixel-diffs each transition so reviewers can
  >   see the validation-state visuals (red borders, error messages,
  >   enabled submit button) actually change as expected.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **HTTP API server exposes compare / reason / smoke endpoints** (minor) — verifies: API-001
  >   `vrt api serve [--port N]` starts a Hono server with
  >   /api/compare, /api/compare-renderers, /api/reason,
  >   /api/smoke-test, /api/status. Lets a browser extension or
  >   editor plugin drive vrt without spawning a Node child.
  - contributes to: GOAL-API
  - body: _not yet implemented_

- [ ] **Hot-reload validation** ⊘ deprecated (minor) — verifies: L4
  > Preserved for matrix-row parity.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - deprecated: Out of scope per v2 matrix: per-iteration browser launch is too slow for the inner dev loop.
  - body: _not yet implemented_

- [ ] **Hover state diff** — verifies: E1
  > `component-from-image --states hover` plus `interact` cover hover-state diffs.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Image lazy-loading correctness** (minor) [draft] — verifies: G5
  > No scroll-driven test today; would need viewport-window snapshots tied to scroll events.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Infinite scroll** (minor) [draft] — verifies: N7
  > Partial: `interact` scroll plus repeated snapshots covers the visible work; no scroll-load timing harness.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Inline-vs-component drift on a single page** — verifies: J2
  > `vrt component-consistency` screenshots every selector match on the page and diffs each against the reference — catches the still-inline call site after a botched extract-to-component refactor.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Keyboard navigation Tab Esc Enter** — verifies: F6
  > `interact press` action drives keyboard sequences; `a11y-focus-order` verifies the resulting traversal.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **LCP and FCP measurement** — verifies: G2
  > `vrt perf` reports both core paint timings from the same observer wiring as G1.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **LLM judgment on rendered output** (minor) [draft] — verifies: O12
  > Not implemented as a CLI: `vlm-bench` exercises VLM judgment internally but there is no `vrt judge` user-facing surface.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **LLM-synthesised CSS patch from structured diff** — verifies: AIFIX-002
  >   Stage 2: the structured diff is fed to an LLM that returns a
  >   CSS patch; the patch is applied and re-verified against the
  >   target. Loop bails when diff < threshold or max-rounds hits.
  - contributes to: GOAL-AI-FIX-LOOP
  - depends on: AIFIX-001, CORE-001
  - body: _not yet implemented_

- [ ] **Landscape orientation** (minor) [draft] — verifies: D2
  > Partial: any viewport works; there is no explicit orientation switch CLI.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Live monitoring of production regressions** ⊘ deprecated (minor) — verifies: L3
  > Preserved for matrix-row parity.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - deprecated: Out of scope per v2 matrix: commercial VRT vendors own this lane; vrt is build-time / dev-loop.
  - body: _not yet implemented_

- [ ] **Live snapshot of an agent session** (minor) [draft] — verifies: O10
  > Not implemented: no session log of agent actions; record-replay would need a wrapper around the CLI surface.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Loading state** (minor) [draft] — verifies: E4
  > Scriptable via `interact` (snapshot before resolve); no spinner / skeleton dedicated CLI.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Locale-specific styling: CJK font fallback** (minor) [draft] — verifies: C7
  > Font-family detection is not yet implemented; cannot identify whether the right CJK fallback fired.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Mechanical smoke covers every markup-assistance CLI** (critical) — verifies: SMOKE
  >   `scripts/smoke-all-clis.sh` runs every markup-assistance CLI on
  >   its canonical fixture and asserts exit 0 + expected output. The
  >   pkspec Test.pkl mirror provides the same gate with the added
  >   Pkl-typed expectations.
  > Partial: `inspect smoke` now records a11y snapshots across operations and reports
  > `a11y-regression` when interactive targets or landmarks fully disappear.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - decisions: 1 entry(ies)
  - body: partial implementation in `packages/vlmkit-markup/src/inspect/smoke-runner.ts`

- [ ] **Media variants: forced-colors / reduced-motion / print / RTL / zoom-200** — verifies: C2-C6
  > `vrt media-variants` sweeps the five hostile-user-preference media queries in one command and reports per-variant diffs.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Migration compare across viewports** (critical) — verifies: MIG-001
  >   `vrt compare <before> <after>` (or `--dir + --baseline +
  >   --variants`) sweeps every viewport, emits report.md, .json
  >   and per-viewport heatmaps. Smoke-tested via the
  >   `compare` entry in Test.pkl.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: BEM to utility-first** — verifies: B8
  > Same `vrt compare` engine with class-rename map.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: Bootstrap to Tailwind** — verifies: B3
  > Same engine as B1 / B2.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: CSS-in-JS to CSS modules** — verifies: B2
  > Same `vrt compare` engine; class-rename map maps auto-generated to semantic class names.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: SASS to vanilla CSS** — verifies: B9
  > Operates on compiled CSS output, not source.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: Tailwind to vanilla CSS** — verifies: B1
  > `vrt compare` migration mode handles utility-first → vanilla CSS by ignoring class-name churn.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: class-name rename** (minor) — verifies: B11
  > DOM-position-diff carries the rename across the page graph.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: custom to standardized component library** — verifies: B7
  > `vrt compare` plus `component-consistency` catches missed instances.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: float-based to Flex or Grid layout** (minor) [draft] — verifies: B6
  > Partial: `compare` catches result; `grid-ratio` infers fr units but doesn't suggest the float-vs-flex decision itself.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: floats or clearfix to Grid** (minor) [draft] — verifies: B12
  > Partial: result is caught; the float-to-grid transformation itself isn't suggested by tooling.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: inline styles to CSS classes** — verifies: B5
  > Same `vrt compare` engine.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: removing browser prefixes** (minor) — verifies: B10
  > Same engine.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Migration: shadcn to custom design system** — verifies: B4
  > Validated on the `shadcn-to-luna` fixture.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Mobile tablet desktop breakpoint sweep** — verifies: D1
  > `vrt compare` accepts per-viewport configs; `component-geometry` reports bbox shifts across breakpoints.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Modal or dialog open** — verifies: E8
  > `interact` drives the open click + backdrop + close sequence.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Multi-viewport snapshot baseline capture** (critical) — verifies: SNAP-001
  >   `vrt snapshot <url1> [url2]` captures every URL across the
  >   configured viewport set on first run; subsequent runs diff
  >   against the baseline. Masks via `--mask <selector,...>`
  >   exclude animated regions.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - body: _not yet implemented_

- [ ] **Network-throttled rendering** (minor) [draft] — verifies: H4
  > No throttle flag today; Playwright supports it but no vrt CLI surface yet.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **OS-specific font rendering** (minor) [draft] — verifies: H3
  > Partial: rolled into the H1 cross-browser diff; no dedicated font-rendering harness.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Off-by-one-pixel hunt** — verifies: K2
  > Bbox-Δ plus heatmap regions surface single-pixel drift; the report's worst-row table sorts these to the top.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Overflow or clipping detection** — verifies: K3
  > `vrt i18n-stress` flags overflow / wrap regressions; `compare` plus heatmap catches generic clipping.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **PNG pixel diff with heatmap overlay** (critical) — verifies: CORE-001
  >   `vrt png-diff <baseline> <current>` uses pixelmatch v7 plus a
  >   heatmap renderer to report per-region intensity. Smoke test
  >   `png-diff` in Test.pkl exercises the identity (0%) path.
  - contributes to: GOAL-CORE-DIFF
  - body: _not yet implemented_

- [ ] **PR visual diff** (minor) [draft] — verifies: L2
  > Partial: `vrt compare-runs` diffs two prior runs; no first-class PR-comment integration.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - body: _not yet implemented_

- [ ] **Page declares actions via window.__vrtActions / data-vrt-action** — verifies: O1
  >   `vrt explore` auto-discovers actions the page advertises and
  >   diffs each transition. Shaped like the WebMCP proposal but
  >   doesn't depend on the unfinished spec.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Paint tree diff via Crater BiDi backend** (minor) — verifies: CORE-005
  >   Optional Crater-backed paint-tree comparison; ~1.66x speedup
  >   vs pixelmatch on the dogfood corpus with 0% false positive.
  >   Off by default (`--no-paint-tree`).
  > `vlmkit check crater` smoke-tests paint tree capture before relying
  > on this optional backend.
  - contributes to: GOAL-CORE-DIFF, GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Per-domain skill libraries** (minor) [draft] — verifies: O7
  > Not implemented: no global skill registry. Each project carries its own `.vrt-skills/` today; cross-project reuse needs a publish path.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Pluralization 1 item vs N items** (minor) [draft] — verifies: I6
  > Scriptable via `interact`; no first-class pluralization-sweep command.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Pre-commit visual check** — verifies: L1
  > `vrt compare` plus `vrt workflow approve` slot into a pre-commit hook for baseline-driven visual gating.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - body: _not yet implemented_

- [ ] **Radius / spacing / z-index / shadow-tier conformance** — verifies: M4-M6
  > Same `design-tokens` CLI covers radius / spacing / z-index / shadow tiers via per-bucket configurable scales.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [x] **Reduced motion compliance** — verifies: F9
  > `media-variants --variants reduced-motion` does the static-stylesheet sweep; `vlmkit check motion` adds CSSOM motion sampling and flags active motion without `prefers-reduced-motion: reduce`.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: implemented by `packages/vlmkit-markup/src/stress/media-variants.ts` and `packages/vlmkit-markup/src/style/motion-detect.ts`

- [ ] **Reproduce user bug from screenshot** — verifies: K1
  > `vrt component-extract` crops the bug region from the user-supplied screenshot; `vrt component-from-image` drives the rebuild loop.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Reset CSS comparison: normalize vs modern-normalize vs destyle** (minor) — verifies: MIG-003
  >   Canonical fixture set (`fixtures/migration/reset-css`) +
  >   `pkf run migration-reset` task that diffs three reset CSSes
  >   against `no-reset.html`. Provides the domain reference for
  >   reset-CSS selection.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Retina 2x DPI rendering** (minor) — verifies: D4
  > `vrt component-from-image --device-scale-factor 2` renders at 2× for retina parity.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **SVG icon rendering** (minor) [draft] — verifies: N2
  > Partial: pixel diff works; semantic structure of the SVG is not analyzed.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Screen-reader-only content** ⊘ deprecated (minor) — verifies: F5
  > Preserved for matrix-row parity.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - deprecated: Out of scope per v2 matrix: requires assistive-technology integration; not a visual signal.
  - body: _not yet implemented_

- [ ] **Selector miss in vrt interact triggers healer correction** — verifies: O2
  > When a step selector fails to match, the healer scans the DOM for near-misses and prints `did you mean <selector>?` with confidence scores instead of a bare timeout.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Self-healing across multiple runs** (minor) [draft] — verifies: O6
  > Partial: the healer is advisory only and does not persist fixes across runs. Accumulation would require a session log keyed to the source selector.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Short or empty content** (minor) [draft] — verifies: I2
  > Scriptable via `interact` (set content then snapshot); no first-class CLI.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Skill playbook fans out N checks over one target** — verifies: O3-O5
  > `vrt skill run <name> --against <html|url>` reads `.vrt-skills/<name>.json` and runs every check in the playbook against the target, aggregating into one report.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Slot composition** (minor) [draft] — verifies: J5
  > Partial: `interact` plus `compare` can drive each slot fill; no slot-aware CLI.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Snapshot approve workflow promotes current to baseline** — verifies: SNAP-002
  >   `vrt snapshot approve` renames every `*-current.png` to
  >   `*-baseline.png`. Used after an intentional UI change is
  >   reviewed.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - depends on: SNAP-001
  - body: _not yet implemented_

- [ ] **Snapshot fix-prompt generates subagent-ready Markdown** — verifies: SNAP-003
  >   Reads `snapshot-report.json` and renders a worst-first task
  >   list suitable for piping into a subagent / inline LLM. Honors
  >   `--limit N` so the prompt stays focused.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW, GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Snapshot stability measures false-positive rate** — verifies: SNAP-004
  >   `vrt snapshot stability` re-runs the same snapshot N times
  >   against a single URL and reports the per-frame diff. Drives
  >   the mask-coverage tuning loop for sites with carousels or
  >   counters.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - body: _not yet implemented_

- [ ] **Sortable or sticky table** (minor) [draft] — verifies: N6
  > Partial: `interact` drives sort clicks and scroll; no table-specific signal.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Spacing scale conformance** — verifies: M2
  > `vrt design-tokens --spacing-scale` flags margin and padding values that fall outside the declared scale, e.g. a stray 5px on a 4px grid.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Special chars and emoji rendering** (minor) [draft] — verifies: I3
  > Partial: `compare` plus `i18n-stress` can drive this but no emoji-specific assertion.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Storybook story diff** ⊘ deprecated (minor) — verifies: J4
  > Preserved for matrix-row parity.
  - contributes to: GOAL-DESIGN-SYSTEM
  - deprecated: Out of scope per v2 matrix: Chromatic and Loki cover this lane with Storybook-native integration vrt doesn't have.
  - body: _not yet implemented_

- [ ] **Subtle font-render regression** (minor) [draft] — verifies: K7
  > Partial: typography hints catch size and weight buckets; pixel-level subpixel rendering drift slips through.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Tab order matches visual reading order** — verifies: F3
  > `vrt a11y-focus-order` walks Tab traversal and compares against the bbox-sorted visual order.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Tab switch** — verifies: E13
  > `interact` drives the tab-click sequence and pixel-diffs each panel state.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Toast notification fade in or out** ⊘ deprecated (minor) — verifies: E12
  > Preserved for matrix-row parity.
  - contributes to: GOAL-MARKUP-FIDELITY
  - deprecated: Out of scope per v2 matrix: transitions are disabled; the fade frames are unreachable.
  - body: _not yet implemented_

- [ ] **Tooltip on hover with delay** (minor) [draft] — verifies: E11
  > Partial: `interact` hover + wait does the job; no tooltip-specific helper yet.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **Touch target size meets WCAG 2.5.5 AAA / 2.5.8 AA** (critical) — verifies: F2
  > `vrt a11y-touch` flags interactive elements below the 24px AA / 44px AAA minimum hit area.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Touchscreen-on-desktop affordances** (minor) [draft] — verifies: D5
  > Partial: `a11y-touch` + `a11y-focus-order` cover the discoverable parts; no first-class CLI.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **TypeScript client mirrors the HTTP surface** (minor) — verifies: API-002
  >   `VrtClient` in `src/api/client.ts` is the typed in-process
  >   client; one method per HTTP endpoint with shared input/output
  >   types from `src/api/api-types.ts`.
  - contributes to: GOAL-API
  - body: _not yet implemented_

- [ ] **Typography scale compliance** — verifies: M3
  > Typography hints surface the size and weight buckets observed; comparison against the declared scale catches off-scale glyphs.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **VLM benchmarking: cost / latency / CHANGE count per model** (minor) — verifies: AIFIX-003
  >   `vrt vlm-bench` queries OpenRouter for candidate VLMs and
  >   runs each against the fix-loop hard case (seed 11). Outputs
  >   a Markdown comparison table used to choose the default model.
  - contributes to: GOAL-AI-FIX-LOOP
  - body: _not yet implemented_

- [ ] **VLM-extracted structured diff from before/after PNG** — verifies: AIFIX-001
  >   Stage 1 of the 2-stage pipeline: a vision-language model is
  >   shown the diff image and returns a structured list of
  >   CHANGE entries (selector + property + delta). Default
  >   VLM is meta-llama/llama-4-scout (docs/knowledge.md).
  - contributes to: GOAL-AI-FIX-LOOP
  - body: _not yet implemented_

- [ ] **Variant rendering across props** (minor) [draft] — verifies: J3
  > Partial: combine `interact` (drive prop changes) with `component-consistency` (diff each variant) — no first-class props-matrix CLI.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Video player UI** (minor) [draft] — verifies: N4
  > Partial: pixel-only; player chrome diffs work; playback state does not.
  - contributes to: GOAL-MARKUP-FIDELITY
  - body: _not yet implemented_

- [ ] **WCAG AA text contrast scan** (critical) — verifies: F1
  > `vrt a11y-contrast` reports every text/background pair under the AA threshold, with the hex pair the agent can paste into a fix.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **WebMCP-native discovery when spec ships** (minor) [draft] — verifies: O8
  > Partial: the discovery layer in `explore` abstracts the source, but the WebMCP wire format itself is not yet implemented.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **White-label theming: brand color swap** (minor) [draft] — verifies: C5
  > Partial: `theme-parity` + `palette-diff` together catch brand-token drift; no dedicated white-label CLI.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **Workflow init / capture / verify / approve loop** — verifies: WORKFLOW-001
  >   Stateful component-graph driven workflow: init writes
  >   baselines, capture takes current, verify diffs, approve
  >   promotes. Companion commands: `graph`, `affected`,
  >   `introspect`, `spec-verify`, `expect`.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - body: _not yet implemented_

- [ ] **XSS-safe rendering of user-generated content** ⊘ deprecated (minor) — verifies: I5
  > Preserved for matrix-row parity.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - deprecated: Out of scope per v2 matrix: security check, not a visual signal. Use an XSS scanner.
  - body: _not yet implemented_

- [ ] **Z-index stacking issues** (minor) [draft] — verifies: K4
  > Partial: visible in pixel diff; not directly identified as a stacking problem by any current CLI.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **i18n text inflation: no overflow or wrap at 1.4x word length** — verifies: I1
  > `vrt i18n-stress` substitutes button / link text with 1.4× longer strings and flags overflow or wrap-to-second-line.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

- [ ] **iOS Safari vs Android Chrome parity** (minor) [draft] — verifies: H2
  > Partial via `cross-browser webkit`; no mobile-emulation profile bundling.
  - contributes to: GOAL-VARIANT-RESILIENCE
  - body: _not yet implemented_

## Spec implementation index

- **A1** — Build component from PNG screenshot
  - code: `packages/vrt-markup/src/component/component-from-image.ts`
- **A2** — Build component from Figma export
  - code: `packages/vrt-markup/src/component/component-from-image.ts`
- **A3** — Build component from hand-drawn wireframe
  - _No active implementation._
- **A4** — Build component from competitor visual reference
  - code: `packages/vrt-markup/src/component/component-from-image.ts`
- **A5** — Build full page from design-spec document
  - _No active implementation._
- **A6** — Build from natural-language description ⊘ deprecated
  - _No active implementation._
- **A7** — Build landing page matching a visual reference
  - _No active implementation._
- **A8** — Extract a single component from a page screenshot
  - _No active implementation._
- **AIFIX-001** — VLM-extracted structured diff from before/after PNG
  - code: `packages/vrt-ai/src/reasoning-pipeline.ts`
- **AIFIX-002** — LLM-synthesised CSS patch from structured diff
  - code: `src/experiments/css-challenge/fix-loop.ts`
- **AIFIX-003** — VLM benchmarking: cost / latency / CHANGE count per model
  - code: `src/experiments/benchmark/vlm-bench.ts`
- **API-001** — HTTP API server exposes compare / reason / smoke endpoints
  - code: `src/api/api-server.ts`
- **API-002** — TypeScript client mirrors the HTTP surface
  - code: `src/api/client.ts`
- **B1** — Migration: Tailwind to vanilla CSS
  - code: `src/compare.ts`
- **B10** — Migration: removing browser prefixes
  - code: `src/compare.ts`
- **B11** — Migration: class-name rename
  - code: `src/compare.ts`
- **B12** — Migration: floats or clearfix to Grid
  - _No active implementation._
- **B2** — Migration: CSS-in-JS to CSS modules
  - code: `src/compare.ts`
- **B3** — Migration: Bootstrap to Tailwind
  - code: `src/compare.ts`
- **B4** — Migration: shadcn to custom design system
  - code: `src/compare.ts`
- **B5** — Migration: inline styles to CSS classes
  - code: `src/compare.ts`
- **B6** — Migration: float-based to Flex or Grid layout
  - _No active implementation._
- **B7** — Migration: custom to standardized component library
  - code: `src/compare.ts`
- **B8** — Migration: BEM to utility-first
  - code: `src/compare.ts`
- **B9** — Migration: SASS to vanilla CSS
  - code: `src/compare.ts`
- **BENCH-001** — CSS challenge bench delete-and-detect
  - code: `src/experiments/css-challenge/css-challenge-bench.ts`
- **BENCH-002** — Detection report aggregates accumulated bench runs
  - code: `src/experiments/detection/detection-report.ts`
- **BENCH-003** — Alternate bench backends: Crater BiDi and Prescanner
  - code: `src/experiments/css-challenge/css-challenge-bench.ts`
- **C1** — Dark mode parity: every component responds to color-scheme
  - _No active implementation._
- **C2-C6** — Media variants: forced-colors / reduced-motion / print / RTL / zoom-200
  - _No active implementation._
- **C5** — White-label theming: brand color swap
  - _No active implementation._
- **C7** — Locale-specific styling: CJK font fallback
  - _No active implementation._
- **CORE-001** — PNG pixel diff with heatmap overlay
  - _No active implementation._
- **CORE-002** — Computed style diff across hover and focus states
  - code: `src/experiments/migration/migration-compare.ts`
- **CORE-003** — A11y tree diff between two renders
  - code: `src/experiments/migration/migration-compare.ts`
- **CORE-004** — Element-level shift-isolated diff
  - code: `packages/vrt-core/src/element-compare.ts`
- **CORE-005** — Paint tree diff via Crater BiDi backend
  - code: `src/experiments/migration/migration-paint-tree.ts`
- **D1** — Mobile tablet desktop breakpoint sweep
  - code: `src/compare.ts`
- **D2** — Landscape orientation
  - _No active implementation._
- **D3** — Foldable or dual-screen rendering ⊘ deprecated
  - _No active implementation._
- **D4** — Retina 2x DPI rendering
  - code: `packages/vrt-markup/src/component/component-from-image.ts`
- **D5** — Touchscreen-on-desktop affordances
  - _No active implementation._
- **E1** — Hover state diff
  - code: `packages/vrt-markup/src/component/component-from-image.ts`
- **E10** — Accordion expand or collapse
  - code: `packages/vrt-markup/src/inspect/interact.ts`
- **E11** — Tooltip on hover with delay
  - _No active implementation._
- **E12** — Toast notification fade in or out ⊘ deprecated
  - _No active implementation._
- **E13** — Tab switch
  - code: `packages/vrt-markup/src/inspect/interact.ts`
- **E2** — Focus and focus-visible state
  - code: `packages/vrt-markup/src/component/component-from-image.ts`
- **E3** — Disabled state
  - _No active implementation._
- **E4** — Loading state
  - _No active implementation._
- **E5** — Form validation state diff from invalid to valid
  - _No active implementation._
- **E6** — Empty state
  - _No active implementation._
- **E7** — Dropdown or menu open
  - code: `packages/vrt-markup/src/inspect/interact.ts`
- **E8** — Modal or dialog open
  - code: `packages/vrt-markup/src/inspect/interact.ts`
- **E9** — Carousel or slider transitions ⊘ deprecated
  - _No active implementation._
- **F1** — WCAG AA text contrast scan
  - _No active implementation._
- **F10** — Caption or alt-text presence ⊘ deprecated
  - _No active implementation._
- **F2** — Touch target size meets WCAG 2.5.5 AAA / 2.5.8 AA
  - _No active implementation._
- **F3** — Tab order matches visual reading order
  - _No active implementation._
- **F4** — ARIA attribute correctness
  - _No active implementation._
- **F5** — Screen-reader-only content ⊘ deprecated
  - _No active implementation._
- **F6** — Keyboard navigation Tab Esc Enter
  - code: `packages/vrt-markup/src/inspect/interact.ts`
- **F7** — Color blindness simulation
  - _No active implementation._
- **F8** — 200 percent browser zoom usability
  - code: `packages/vrt-markup/src/stress/media-variants.ts`
- **F9** — Reduced motion compliance
  - code: `packages/vrt-markup/src/stress/media-variants.ts`
- **FIDELITY-001** — Build a card from a blank starter until diff under 3 percent
  - _No active implementation._
- **G1** — Cumulative Layout Shift measurement
  - code: `src/util/perf.ts`
- **G2** — LCP and FCP measurement
  - code: `src/util/perf.ts`
- **G3** — Bundle size analysis ⊘ deprecated
  - _No active implementation._
- **G4** — FOUC detection
  - _No active implementation._
- **G5** — Image lazy-loading correctness
  - _No active implementation._
- **H1** — Cross-browser parity across Chromium / Firefox / WebKit
  - _No active implementation._
- **H2** — iOS Safari vs Android Chrome parity
  - _No active implementation._
- **H3** — OS-specific font rendering
  - _No active implementation._
- **H4** — Network-throttled rendering
  - _No active implementation._
- **I1** — i18n text inflation: no overflow or wrap at 1.4x word length
  - _No active implementation._
- **I2** — Short or empty content
  - _No active implementation._
- **I3** — Special chars and emoji rendering
  - _No active implementation._
- **I4** — Different image aspect ratios
  - _No active implementation._
- **I5** — XSS-safe rendering of user-generated content ⊘ deprecated
  - _No active implementation._
- **I6** — Pluralization 1 item vs N items
  - _No active implementation._
- **J1** — Cross-page component drift
  - code: `packages/vrt-markup/src/stress/multi-page-consistency.ts`
- **J2** — Inline-vs-component drift on a single page
  - _No active implementation._
- **J3** — Variant rendering across props
  - _No active implementation._
- **J4** — Storybook story diff ⊘ deprecated
  - _No active implementation._
- **J5** — Slot composition
  - _No active implementation._
- **K1** — Reproduce user bug from screenshot
  - code: `packages/vrt-markup/src/component/component-extract.ts`
- **K2** — Off-by-one-pixel hunt
  - code: `src/compare.ts`
- **K3** — Overflow or clipping detection
  - code: `packages/vrt-markup/src/stress/i18n-stress.ts`
- **K4** — Z-index stacking issues
  - _No active implementation._
- **K5** — CLS detection via in-page PerformanceObserver
  - _No active implementation._
- **K6** — Asset 404 or broken images
  - _No active implementation._
- **K7** — Subtle font-render regression
  - _No active implementation._
- **L1** — Pre-commit visual check
  - code: `src/workflow-cli.ts`
- **L2** — PR visual diff
  - _No active implementation._
- **L3** — Live monitoring of production regressions ⊘ deprecated
  - _No active implementation._
- **L4** — Hot-reload validation ⊘ deprecated
  - _No active implementation._
- **L5** — Bundled per-target check via skill run
  - code: `src/skill-cli.ts`
- **M1** — Color tokens conform to declared palette
  - _No active implementation._
- **M2** — Spacing scale conformance
  - code: `packages/vrt-markup/src/style/design-tokens.ts`
- **M3** — Typography scale compliance
  - code: `src/typography-hints.ts`
- **M4-M6** — Radius / spacing / z-index / shadow-tier conformance
  - _No active implementation._
- **MIG-001** — Migration compare across viewports
  - _No active implementation._
- **MIG-002** — Agent-friendly diff Markdown summary
  - code: `src/cli/commands/diff-for-agent-cli.ts`
- **MIG-003** — Reset CSS comparison: normalize vs modern-normalize vs destyle
  - doc: `docs/reset-css-comparison.md`
- **MIG-004** — Compare-runs aggregates multiple VRT runs
  - code: `src/cli/commands/compare-runs-cli.ts`
- **N1** — Canvas or WebGL content ⊘ deprecated
  - _No active implementation._
- **N2** — SVG icon rendering
  - _No active implementation._
- **N3** — Animation or transition correctness ⊘ deprecated
  - _No active implementation._
- **N4** — Video player UI
  - _No active implementation._
- **N5** — Form autofill state
  - _No active implementation._
- **N6** — Sortable or sticky table
  - _No active implementation._
- **N7** — Infinite scroll
  - _No active implementation._
- **O1** — Page declares actions via window.__vrtActions / data-vrt-action
  - _No active implementation._
- **O10** — Live snapshot of an agent session
  - _No active implementation._
- **O11** — Bug-repro fixture auto-generation
  - _No active implementation._
- **O12** — LLM judgment on rendered output
  - _No active implementation._
- **O2** — Selector miss in vrt interact triggers healer correction
  - _No active implementation._
- **O3-O5** — Skill playbook fans out N checks over one target
  - _No active implementation._
- **O6** — Self-healing across multiple runs
  - _No active implementation._
- **O7** — Per-domain skill libraries
  - _No active implementation._
- **O8** — WebMCP-native discovery when spec ships
  - _No active implementation._
- **O9** — Agent-editable helpers layer
  - _No active implementation._
- **SMOKE** — Mechanical smoke covers every markup-assistance CLI
  - _No active implementation._
- **SNAP-001** — Multi-viewport snapshot baseline capture
  - code: `src/cli/commands/snapshot.ts`
- **SNAP-002** — Snapshot approve workflow promotes current to baseline
  - code: `src/cli/commands/snapshot.ts`
- **SNAP-003** — Snapshot fix-prompt generates subagent-ready Markdown
  - code: `packages/vrt-markup/src/heal/fix-prompt.ts`
- **SNAP-004** — Snapshot stability measures false-positive rate
  - code: `src/vrt/snapshot/stability.ts`
- **WORKFLOW-001** — Workflow init / capture / verify / approve loop
  - code: `src/cli/router.ts:WORKFLOW_ALIAS_COMMANDS`
