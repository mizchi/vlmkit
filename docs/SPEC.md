# Test SPEC

60 tests across 2 module(s) — 40 pending, 20 active

## `./`

### `Spec.pkl`

- [ ] **A11y tree diff between two renders** — verifies: CORE-003
  >   Capture Playwright's accessibility snapshot for each side of
  >   the compare and surface structural changes — role / name /
  >   level diffs that pure pixel diff misses.
  - contributes to: GOAL-CORE-DIFF
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
  - contributes to: GOAL-CSS-CHALLENGE
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

- [ ] **Element-level shift-isolated diff** — verifies: CORE-004
  >   `vrt elements` diffs per-element bounding boxes after isolating
  >   cascading layout shift; useful when a single element moves and
  >   pixel diff would otherwise blame everything downstream.
  - contributes to: GOAL-CORE-DIFF
  - body: _not yet implemented_

- [ ] **Extract a single component from a page screenshot** — verifies: A8
  >   Given a full-page PNG, `vrt component-extract` finds the major
  >   non-background components, classifies each (text / filled-rect /
  >   icon / image), and crops the chosen rank to a standalone PNG
  >   suitable for use as a target in `vrt component-from-image`.
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

- [ ] **Inline-vs-component drift on a single page** — verifies: J2
  > `vrt component-consistency` screenshots every selector match on the page and diffs each against the reference — catches the still-inline call site after a botched extract-to-component refactor.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **LLM-synthesised CSS patch from structured diff** — verifies: AIFIX-002
  >   Stage 2: the structured diff is fed to an LLM that returns a
  >   CSS patch; the patch is applied and re-verified against the
  >   target. Loop bails when diff < threshold or max-rounds hits.
  - contributes to: GOAL-AI-FIX-LOOP
  - depends on: AIFIX-001, CORE-001
  - body: _not yet implemented_

- [ ] **Mechanical smoke covers every markup-assistance CLI** (critical) — verifies: SMOKE
  >   `scripts/smoke-all-clis.sh` runs every markup-assistance CLI on
  >   its canonical fixture and asserts exit 0 + expected output. The
  >   pkspec Test.pkl mirror provides the same gate with the added
  >   Pkl-typed expectations.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - decisions: 1 entry(ies)
  - body: _not yet implemented_

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

- [ ] **Multi-viewport snapshot baseline capture** (critical) — verifies: SNAP-001
  >   `vrt snapshot <url1> [url2]` captures every URL across the
  >   configured viewport set on first run; subsequent runs diff
  >   against the baseline. Masks via `--mask <selector,...>`
  >   exclude animated regions.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - body: _not yet implemented_

- [ ] **PNG pixel diff with heatmap overlay** (critical) — verifies: CORE-001
  >   `vrt png-diff <baseline> <current>` uses pixelmatch v7 plus a
  >   heatmap renderer to report per-region intensity. Smoke test
  >   `png-diff` in Test.pkl exercises the identity (0%) path.
  - contributes to: GOAL-CORE-DIFF
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
  - contributes to: GOAL-CORE-DIFF, GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Radius / spacing / z-index / shadow-tier conformance** — verifies: M4-M6
  > Same `design-tokens` CLI covers radius / spacing / z-index / shadow tiers via per-bucket configurable scales.
  - contributes to: GOAL-DESIGN-SYSTEM
  - body: _not yet implemented_

- [ ] **Reset CSS comparison: normalize vs modern-normalize vs destyle** (minor) — verifies: MIG-003
  >   Canonical fixture set (`fixtures/migration/reset-css`) +
  >   `pkf run migration-reset` task that diffs three reset CSSes
  >   against `no-reset.html`. Provides the domain reference for
  >   reset-CSS selection.
  - contributes to: GOAL-MIGRATION-VERIFICATION
  - body: _not yet implemented_

- [ ] **Selector miss in vrt interact triggers healer correction** — verifies: O2
  > When a step selector fails to match, the healer scans the DOM for near-misses and prints `did you mean <selector>?` with confidence scores instead of a bare timeout.
  - contributes to: GOAL-AGENT-ERGONOMICS
  - body: _not yet implemented_

- [ ] **Skill playbook fans out N checks over one target** — verifies: O3-O5
  > `vrt skill run <name> --against <html|url>` reads `.vrt-skills/<name>.json` and runs every check in the playbook against the target, aggregating into one report.
  - contributes to: GOAL-AGENT-ERGONOMICS
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

- [ ] **Tab order matches visual reading order** — verifies: F3
  > `vrt a11y-focus-order` walks Tab traversal and compares against the bbox-sorted visual order.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Touch target size meets WCAG 2.5.5 AAA / 2.5.8 AA** (critical) — verifies: F2
  > `vrt a11y-touch` flags interactive elements below the 24px AA / 44px AAA minimum hit area.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **TypeScript client mirrors the HTTP surface** (minor) — verifies: API-002
  >   `VrtClient` in `src/vrt-client.ts` is the typed in-process
  >   client; one method per HTTP endpoint with shared input/output
  >   types from `src/api-types.ts`.
  - contributes to: GOAL-API
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

- [ ] **WCAG AA text contrast scan** (critical) — verifies: F1
  > `vrt a11y-contrast` reports every text/background pair under the AA threshold, with the hex pair the agent can paste into a fix.
  - contributes to: GOAL-A11Y-COMPLIANCE
  - body: _not yet implemented_

- [ ] **Workflow init / capture / verify / approve loop** — verifies: WORKFLOW-001
  >   Stateful component-graph driven workflow: init writes
  >   baselines, capture takes current, verify diffs, approve
  >   promotes. Companion commands: `graph`, `affected`,
  >   `introspect`, `spec-verify`, `expect`.
  - contributes to: GOAL-SNAPSHOT-WORKFLOW
  - body: _not yet implemented_

- [ ] **i18n text inflation: no overflow or wrap at 1.4x word length** — verifies: I1
  > `vrt i18n-stress` substitutes button / link text with 1.4× longer strings and flags overflow or wrap-to-second-line.
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

- [x] **compare** — verifies: MIG-001, CORE-002, CORE-003, SMOKE
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

- [x] **form-validation-diff** — verifies: E5, SMOKE
  > Drive a signup form through invalid → valid states and diff each transition.
  - body: `cmd` (exit 0 expected)

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

- [x] **png-diff** — verifies: CORE-001, SMOKE
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
- **AIFIX-001** — VLM-extracted structured diff from before/after PNG
  - code: `src/vrt-reasoning-pipeline.ts`
- **AIFIX-002** — LLM-synthesised CSS patch from structured diff
  - code: `src/fix-loop.ts`
- **AIFIX-003** — VLM benchmarking: cost / latency / CHANGE count per model
  - code: `src/vlm-bench.ts`
- **API-001** — HTTP API server exposes compare / reason / smoke endpoints
  - code: `src/api-server.ts`
- **API-002** — TypeScript client mirrors the HTTP surface
  - code: `src/vrt-client.ts`
- **BENCH-001** — CSS challenge bench delete-and-detect
  - code: `src/css-challenge-bench.ts`
- **BENCH-002** — Detection report aggregates accumulated bench runs
  - code: `src/detection-report.ts`
- **BENCH-003** — Alternate bench backends: Crater BiDi and Prescanner
  - code: `src/css-challenge-bench.ts`
- **C1** — Dark mode parity: every component responds to color-scheme
  - test: `Test.pkl` — theme-parity
- **C2-C6** — Media variants: forced-colors / reduced-motion / print / RTL / zoom-200
  - test: `Test.pkl` — media-variants
- **CORE-001** — PNG pixel diff with heatmap overlay
  - test: `Test.pkl` — png-diff
- **CORE-002** — Computed style diff across hover and focus states
  - test: `Test.pkl` — compare
  - code: `src/migration-compare.ts`
- **CORE-003** — A11y tree diff between two renders
  - test: `Test.pkl` — compare
  - code: `src/migration-compare.ts`
- **CORE-004** — Element-level shift-isolated diff
  - code: `src/element-compare.ts`
- **CORE-005** — Paint tree diff via Crater BiDi backend
  - code: `src/migration-paint-tree.ts`
- **E5** — Form validation state diff from invalid to valid
  - test: `Test.pkl` — form-validation-diff
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
- **MIG-001** — Migration compare across viewports
  - test: `Test.pkl` — compare
- **MIG-002** — Agent-friendly diff Markdown summary
  - code: `src/diff-for-agent-cli.ts`
- **MIG-003** — Reset CSS comparison: normalize vs modern-normalize vs destyle
  - doc: `docs/reset-css-comparison.md`
- **MIG-004** — Compare-runs aggregates multiple VRT runs
  - code: `src/compare-runs-cli.ts`
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
  - test: `Test.pkl` — form-validation-diff
  - test: `Test.pkl` — i18n-stress
  - test: `Test.pkl` — interact
  - test: `Test.pkl` — media-variants
  - test: `Test.pkl` — multi-page-consistency
  - test: `Test.pkl` — perf
  - test: `Test.pkl` — png-diff
  - test: `Test.pkl` — skill-pricing-card
  - test: `Test.pkl` — theme-parity
- **SNAP-001** — Multi-viewport snapshot baseline capture
  - code: `src/snapshot.ts`
- **SNAP-002** — Snapshot approve workflow promotes current to baseline
  - code: `src/snapshot-approve.ts`
- **SNAP-003** — Snapshot fix-prompt generates subagent-ready Markdown
  - code: `src/snapshot-fix-prompt.ts`
- **SNAP-004** — Snapshot stability measures false-positive rate
  - code: `src/snapshot-stability.ts`
- **WORKFLOW-001** — Workflow init / capture / verify / approve loop
  - code: `src/vrt-command-router.ts:WORKFLOW_ALIAS_COMMANDS`
