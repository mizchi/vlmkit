# Changelog

All notable changes to this project will be documented in this file.
Dates are YYYY-MM-DD.

## Unreleased

## 0.8.0 — 2026-08-01

### Verified markup workflow

- Add contract-driven page scaffolding and deterministic `build page` /
  `verify markup` loops, including breakpoint, scroll, animation, copy,
  integrity, layout, and visual-equivalence checks.
- Add mock-image mode, stronger region pairing and presence analysis,
  attributed kickback diagnostics, and guarded Stage-2 auto-fix support.
- Harden markup verification against hidden text, occlusion, clipping,
  overflow, interaction regressions, and intentional-pattern false positives.

### Interaction verification and MCP

- Add accessibility event-state maps, handler-surface checks, and verified
  browser flows whose actions must satisfy explicit DOM post-conditions.
- Expose the deterministic verification surface through the bundled
  `vlmkit mcp` server while keeping the workspace MCP package internal.

### Packaging and reliability

- Bundle internal runtime packages into the root CLI and add a packed,
  clean-install markup-loop smoke test.
- Improve cold-start behavior, selector-heal calibration, package license
  coverage, and OpenRouter model selection.

## 0.7.0 — 2026-07-01

### Markup loop

- Add `vlmkit markup-loop init|observe|doctor|run` for drop-in
  real markup work: scaffold loop files, observe a live page with
  Playwright, check readiness, then run planner + generator + VRT gates.
- Add a reproducible local example under `examples/markup-loop-project/`
  that runs `init`, `observe`, `doctor`, and `run --dry-run` without an
  LLM API key.
- Ship `@mizchi/vlmkit-plan`, `@mizchi/vlmkit-generate`, and
  `@mizchi/vlmkit-heal` as runtime dependencies of the root package so
  installed agents can run the loop from a consuming project.

### Playwright generation

- Add planner and generator contracts for turning UI observations into
  gated Playwright smoke tests.
- Add guardrail context and VRT handoff summaries so generated tests can
  be evaluated and repaired without weakening the original scenario.

### A/B validation series (control vs vlmkit, external repo)

First controlled evaluation of the product claim "vlmkit makes a
coding agent better at visual repair": three runs on
`startbootstrap-agency` with a bare-handed control arm. Result: cost
parity once v1's friction was fixed, and a repair-quality edge for
vlmkit in v3 (3/5 vs 2/5 mutations, screenshot-free localization) via
the deterministic signal layer. The VLM `diff region` path was
net-negative in every run. Reports:
`docs/reports/2026-06-06-ab-external-synthesis.md` (+ v1/v2/v3).
Each fix below cites the agent complaint it answers
(`docs/issues-drafts/01-12`, 7 still open).

### `diff png`

- Reports baseline/current image dimensions and Δheight (a reflow
  indicator) in text and `--json` output. (draft 03)
- Per-region translation estimates: `shift: {dx, dy, confidence}` via
  mean-subtracted NCC of luminance profiles; semantic classifier
  reports "Content translated by (+36, +0) px" instead of
  `element-added` with meaningless identical color samples. (draft 04)
- `--elements-html <url>` / `--elements-json <path>` /
  `--elements-viewport <WxH>`: deterministic DOM hit-test attaches a
  `selectorCandidate` (selector, confidence, coverage) to every diff
  region — no VLM, no API key. (draft 07)
- Identical-hex color samples are omitted from descriptions; a
  measured in-place recolor is no longer masked by the wide-band
  "layout shift" shape hint.

### `diff region`

- Auto-downscales images so no edge exceeds `--max-image-edge`
  (default 7500; Anthropic rejects >8000px) and maps VLM bboxes back
  to original pixel coordinates. Fixes the crash on full-page mobile
  captures. (draft 01)
- `--max-tokens` default 600 → 1500; truncated responses
  (finish_reason=length or mid-JSON cut) retry once with doubled
  tokens. (draft 02)

### Internal

- `estimateRegionShift` in `@mizchi/vlmkit-core/region-shift.ts`.
- Region-bbox → DOM-selector matcher extracted to
  `@mizchi/vlmkit-markup/region-selector-match.ts` (shared by
  `diff png` and `vlm-region-diff`).
- `readPngDimensions` exported from `@mizchi/vlmkit-core/image-resize.ts`.
- A/B harness under `fixtures/ab-external/harness/` (seeded block
  deletion + value mutation `--mutate N [--subtle]`, deterministic
  capture, fixed scorer).

## 0.6.0 — 2026-05-19 (rebrand: vrt → vlmkit)

The project scope had grown well beyond visual regression. Markup
synthesis from screenshots, design-token / theme / a11y / i18n
audits, and a 2-stage VLM + LLM CSS auto-repair loop now account for
the majority of the surface. Rebrand the umbrella to **vlmkit**;
visual regression becomes one of several offered features.

### Breaking — package + CLI rename

| Old | New |
|---|---|
| GitHub repo `mizchi/vrt` | `mizchi/vlmkit` (auto-redirect in place) |
| `@mizchi/vrt` (root) | `@mizchi/vlmkit` |
| `@mizchi/vrt-core` | `@mizchi/vlmkit-core` |
| `@mizchi/vrt-capture` | `@mizchi/vlmkit-capture` |
| `@mizchi/vrt-ai` | `@mizchi/vlmkit-ai` |
| `@mizchi/vrt-markup` | `@mizchi/vlmkit-markup` |
| CLI binary `vrt` | `vlmkit` |
| `dist/vrt.mjs` | `dist/vlmkit.mjs` |
| Deprecation prefix `[vrt deprecated]` | `[vlmkit deprecated]` |

The `vrt verb …` CLI form is no longer supported as a binary
shortcut — type `vlmkit verb …` instead. (Inside the `vlmkit` CLI
the deprecation shims from 0.5.0 still work, e.g. `vlmkit png-diff
--help` forwards to `vlmkit diff png`.)

### Repository structure

`@mizchi/vrt@0.5.0` on npm is now deprecated. The current package
under that name is `@mizchi/vlmkit`. A future minor version will
carve out `packages/vrt/` as a leaf package containing the VRT-
specific subset (`snapshot`, `diff html`, regression-watch,
`diff-pr`, `baseline`, `watch`); see Phase 2 plan in the repo.

### State files preserved

The `.vrt/` state directory name is unchanged — existing users'
`.vrt/last-diff-for-agent.json` continues to work.

### Verified

- 776 tests / 11 dist smoke probes pass on the new structure.
- `vlmkit diff html` against `fixtures/element-compare/` runs
  end-to-end.
- All cross-package imports resolve under the new `@mizchi/vlmkit-*`
  scope.

---

## 0.5.0 — 2026-05-19 (first public release)

The internal 0.4.x history is preserved in commits; npm publication
starts here. Two work streams since `0.4.0` rolled up under this
release: the **0.5.0 CLI restructure + dispatcher rewrite** (this
section) and the prior **design-md / markup-assistance** sections
below.

### CLI restructure — verb groups

Every command now lives under a verb group. Single-token names from
0.4.x remain as deprecation shims that print a one-line hint and
forward.

| Old | New |
|---|---|
| `vrt compare` | `vrt diff html` |
| `vrt png-diff` | `vrt diff png` |
| `vrt elements` | `vrt diff elements` |
| `vrt cross-browser` | `vrt diff browsers` |
| `vrt diff-for-agent` | `vrt diff agent` |
| `vrt compare-runs` | `vrt diff runs` |
| `vrt a11y-{contrast,touch,focus-order}` | `vrt check a11y {contrast,touch,focus}` |
| `vrt design-tokens` | `vrt check tokens` |
| `vrt theme-parity` | `vrt check theme` |
| `vrt perf` | `vrt check perf` |
| `vrt {component,multi-page}-consistency` | `vrt check drift {component,pages}` |
| `vrt interact` / `vrt explore` / `vrt smoke` | `vrt inspect {interact,explore,smoke}` |
| `vrt i18n-stress` / `vrt media-variants` | `vrt stress {i18n,media}` |
| `vrt component-extract` | `vrt scan component` |
| `vrt component-from-image` | `vrt build component` |
| `vrt flipbook` | `vrt snapshot flipbook` |
| `vrt migration {compare,blind,subagent}` | unchanged (already grouped) |
| `vrt snapshot`, `vrt workflow`, `vrt manifest`, `vrt watch`, `vrt diff-pr`, `vrt baseline` | unchanged |

### Dispatcher rewrite for bundled `dist/vrt.mjs`

`src/cli/cli.ts` previously routed leaves via
`import.meta.resolve(<source-relative-path>)`, which only worked from
the source tree. The bundled binary failed with
`ERR_MODULE_NOT_FOUND` on every leaf. Rewritten in this release:

- SPECS is a `{ name, loader }` map where `loader` is a
  `() => import("literal-path")` closure. tsdown statically discovers
  the import and code-splits each leaf into a chunk under `dist/`.
- A per-leaf signal (`__VRT_DISPATCHER_LEAF__=<name>`) replaces the
  earlier `process.argv` swap. Each leaf's CLI-entry guard checks the
  env var against its *own* name, so cross-leaf static imports
  (e.g. `diff-pr.ts` ↔ `media-variants.ts` for shared types) don't
  accidentally fire a sibling's `main()`.
- `scripts/smoke-dist.sh` runs strict by default and gates every
  documented subcommand.

### Workspace packages published

`@mizchi/vrt-core`, `@mizchi/vrt-capture`, `@mizchi/vrt-ai`, and
`@mizchi/vrt-markup` all 0.5.0. Each ships raw `.ts` via the `exports`
map — consumers need Node 24+ with `--experimental-strip-types`, or a
bundler that resolves `.ts` extensions. The packages expose both a
curated barrel and deep per-module exports (e.g.
`@mizchi/vrt-core/png-diff.ts`).

### Agent skills (APM-distributable)

Five skill packs at `.claude/skills/`:

- `vrt-visual-diff` — `vrt diff html` → `vrt diff agent` workflow.
- `vrt-migration-eval` — `vrt migration compare|blind|subagent`.
- `vrt-markup-synth` — five DOM/pixel-based signal tools (no VLM).
- `vrt-regression-watch` — stateful `--previous` / `--persist-summary`.
- `vrt-css-fix-loop` — VLM + LLM 2-stage repair loop.

Install via `apm install mizchi/vrt/.claude/skills/<name>` (or pin to
`@v0.5.0`).

### Diff-report filename

`vrt diff html` / `vrt migration compare` now write both
`diff-report.json` (canonical, prefer this) and
`migration-report.json` (legacy alias, byte-identical). Pinning the
canonical name lets the legacy alias be removed in a future major.

### Repo / task-runner

Migrated from `justfile` to `Taskfile.pkl` (pkfire). Doc snippets
across the repo and CLAUDE.md now read `pkf run <task>`. Tasks that
take positional flags carry `acceptsArgs = true`; tasks with named
params use the `--<param> <value>` syntax.

---

## 0.5.0 — design-md scenario branch (2026-05-15)

A single branch of work — `claude/design-md-scenario-2026-05-15` —
turning vrt from a single-shot diff tool into a complete UI-regression
workflow. Driven by 9 closed-loop subagent runs (a → i) against a
DESIGN.md → HTML/CSS reproduction scenario; each run surfaced
friction, each friction got closed in code.

### Headlines

- **18 GitHub issues filed and closed** (#22 – #36, plus 3 drafts
  shipped as `vrt manifest` / `vrt watch` / `vrt diff-pr`).
- **38 commits, 183 tests across 32 suites.**
- Closed-loop floor moved from **10.3% mobile** (agent-a, original
  vrt) to **0.2% mobile** (agent-d, post-fix) on a 5-round budget;
  3-round budget reached **3.45% mobile** (agent-f).
- 4 a11y gate layers + 2 quality-extension gates added to the CI
  surface, all with manifest suppression.

### New top-level CLIs

| Command | Purpose |
|---|---|
| `vrt manifest add/list/rm/check` | Author the approval manifest. Per-rule kinds: `visual` (default), `a11y-contrast`, `a11y-touch`, `a11y-focus-order`, `a11y-semantic`, `media-variant`, `cross-browser`. `--from-run <output-dir>` synthesizes rules from a recent compare's wireframe-fix candidates. |
| `vrt watch <baseline> <variant>` | File-watcher inner-loop with round-vs-round delta (newly-introduced / resolved / persisted suggestions + zero-crossing detection). |
| `vrt diff-pr {pin,verify,post}` | CI gate. Per-route diff against pinned baselines; per-viewport thresholds; optional a11y + media-variants + cross-browser gates. |
| `vrt baseline {pin,verify,post,list,rm}` | Canonical alias over `vrt diff-pr` with two extra utilities (`list` / `rm`) for inspecting baseline state. |

### Wireframe fix suggestions (new "what to edit" layer)

When DOM correspondence is missing, vrt's compare now emits actionable
fix candidates with a layered scope hierarchy:

```
STRUCTURAL  >  REFLOW  >  HIGH-IMPACT  >  DIVERGENT  >  MAG-DIVERGENT  >  SUBSET  >  (all)
```

- `[STRUCTURAL]` — 3+ child suggestions share a parent path with
  heterogeneous deltas; names the specific parent layout-strategy
  mismatch (e.g. `display: flex (now) → grid (target)`); flags
  conflicting child margins that will compound with the new gap.
- `[REFLOW]` — one viewport's magnitude is ≥ 3× others; suggestion
  steers toward typography upstream rather than spacing tokens.
- `[HIGH-IMPACT]` — one suggestion's magnitude dominates the set
  (≥ 12px AND ≥ 1.5× the next-largest).
- `[DIVERGENT]` — opposite-sign deltas across viewports; needs a
  media query.
- `[MAG-DIVERGENT]` — same sign but materially different magnitudes;
  suggestion includes predictive overshoot ("applying 40px globally
  would overshoot mobile by 16px").
- `[SUBSET]` — observation covers only some viewports.

Plus per-suggestion annotations:

- `current → target` notation on candidate CSS rules — agent reads
  arrow left-to-right matching the natural edit direction.
- `[cascades to siblings]` on box-size-mutating candidates.
- `⚠ component height differs intrinsically` when bbox heights
  themselves differ.
- `⚠ N suggestions converge on .selector` (same-selector cumulative
  overshoot).
- `⚠ cross-edit: A + B all cascade-affect` (multi-selector cascade).

### CI gate layers (`vrt diff-pr`)

- **Visual diff**: per-route per-viewport pixel ratio against pinned
  baseline; per-route threshold overrides.
- **a11y gate**: contrast (WCAG 2.1) / touch-target size / focus-
  order (Tab cycling) / semantic (heading hierarchy / form-label /
  image-alt). Findings demoted by manifest rules.
- **Media-variants gate**: forced-colors / reduced-motion / print /
  rtl / zoom-200. Suspect / warn verdict counts gate.
- **Cross-browser gate**: chromium / firefox / webkit. Auto-skip on
  CI runners that don't have all three.

All gates emit a unified markdown `summary.md` suitable for
`gh pr comment --body-file`.

### Cross-round signals

- `vrt compare --against-previous <output-dir>`: emits per-viewport
  diff% change, newly-introduced / resolved suggestions, and
  zero-crossing detection (a component flipped sign → damp ~50%).
- `vrt watch` emits the same delta on every save event.

### Render correctness

- `vrt compare` file-mode no longer produces a false 0% PASS when
  the same `<link>` href fails to resolve on both sides (#22 — the
  bug that bit the first two agents in round 1).
- Render-sanity warnings (font 404, stylesheet 404) promoted to a
  red banner at the top; variant side now probed alongside baseline.
- Symmetric failures downgrade to a single dimmed line so diff
  numbers stay readable.

### Triptych output

Every per-viewport compare now emits a `<route>-<viewport>-triptych.png`
with `BASELINE | VARIANT | HEATMAP` panels labeled in color.

### DESIGN.md token integration

Pass `--tokens <path>` to `vrt compare` and hex pairs in the palette
diff back-resolve to token names; bbox magnitudes snap to the
nearest declared spacing token.

### Issues closed

| # | Title | Severity |
|---|---|---|
| #22 | False 0% PASS in `vrt compare` file-mode (3 stacked bugs) | critical |
| #23 | Token-aware fix candidates in wireframe mode | major |
| #24 | `BASELINE / VARIANT / HEATMAP` triptych PNG per viewport | minor |
| #25 | Default-on computed-style + DOM-position diff | major |
| #26 | Reverse hex → DESIGN.md token lookup | major |
| #27 | Render-sanity banner + variant probe | major |
| #28 | `migration-report.json` state-leak (duplicate of #22) | minor |
| #29 | Viewport scope tags (DIVERGENT / SUBSET) | major |
| #30 | Wireframe suggestions name candidate CSS selector | major |
| #31 | MAG-DIVERGENT classification | minor |
| #32 | Symmetric sanity banner downgrade | minor |
| #33 | Text-reflow detection (REFLOW scope) | major |
| #34 | Cross-suggestion overshoot aggregation | major |
| #35 | STRUCTURAL parent layout-strategy detail | minor |
| #36 | Cross-edit interaction warning (multi-selector cascade) | minor |

Plus three drafts shipped as new CLIs (`vrt manifest` / `vrt watch` /
`vrt diff-pr`).

### Reports

Detailed analysis of each validation run is under
`docs/reports/2026-05-15-design-md-scenario-v{1..9}.md`. Each
report quotes the agent's friction verbatim and records what was
fixed in response.

## 0.5.0 — Markup-assistance toolkit (2026-05-13)

A new suite of commands focused on the LLM-agent markup-authoring loop:
build from screenshot, verify a11y / theme / i18n / cross-browser
regressions, enforce design-system scales. The full scenario coverage
matrix is at `docs/reports/2026-05-13-scenario-matrix.md`; the
capability survey at `docs/reports/2026-05-13-capability-survey.md`.

### New commands

- `vrt component-from-image <target.png> <current.html>` — build a
  component from a target screenshot, iterate until pixel diff is
  low. Surfaces structured signals: bbox matches with IoU, heatmap
  region clusters with dominant fill + content-kind classification,
  text-row Δy with per-gap spacing-fix table, typography hints
  (estimated font-size / weight bucket), palette diff with
  near-neighbor distance, dominant background colors, and a
  multi-state pass (`--states hover focus-visible …`) that surfaces
  `suspect` / `_subtle_` / `ua-likely` / `direction?` flags. Optional
  `--device-scale-factor` for retina target captures.

- `vrt theme-parity <html>` — render under
  `prefers-color-scheme: light` and `dark`, flag components whose
  fill is identical across themes (hard-coded colors that defeat
  the theme switch).

- `vrt media-variants <html>` — render under five user-preference
  variants in one pass: `forced-colors`, `reduced-motion`, `print`,
  `rtl`, `zoom-200`. Each gets a heuristic verdict combining pixel
  delta with stylesheet-text static analysis (catches missing
  `@media (prefers-reduced-motion: reduce)`, `forced-color-adjust:
  none` opt-outs, physical-property usage that breaks RTL).

- `vrt cross-browser <html|url>` — render in Chromium, Firefox,
  WebKit. Engines not installed in the local Playwright cache
  auto-skip with `npx playwright install` hints.

- `vrt i18n-stress <html>` — inflate every text node by a factor
  (default 1.4× ≈ German), detect horizontal overflow / wrap / parent
  bounds violations. Dedupes ancestor reports.

- `vrt design-tokens <html|url>` — scale-conformance for
  `border-radius`, `padding`, `margin`, `z-index`, `box-shadow`.
  Configurable scales via CLI flags or JSON config. Per-violation
  report with nearest in-scale replacement.

- `vrt a11y-contrast <html>` — walks every visible text node,
  computes WCAG AA contrast ratio (4.5:1 normal, 3:1 large text),
  surfaces failures with foreground/background hex pairs.

- `vrt a11y-touch <html|url>` — interactive elements below
  44×44 (`--level AAA`) or 24×24 (`--level AA`) flagged with
  cluster-spacing check.

- `vrt a11y-focus-order <html|url>` — drives Tab through the page,
  detects visual-order mismatches (reverse / trap / skip-row).

- `vrt multi-page-consistency --selector <sel> --urls ... | --files ...` —
  drift check: same component across N pages.

- `vrt component-consistency <html> --selector <sel>` — drift check:
  N instances of selector on one page (catches inline-vs-component
  leak after refactors).

- `vrt interact <html|url> --sequence <path.json>` — scripted
  Playwright action sequence (snapshot / click / hover / focus /
  blur / press / type / fill / select / scroll / wait /
  waitForSelector). Per-transition pixel diff + heatmap regions.
  Per-row "dead" flag for actions that produced no visible change
  (selector miss or no-op detection).

- `vrt perf <html|url>` — Web-Vitals visual-stability check via
  in-page PerformanceObserver. Captures CLS / LCP / FCP / TTFB in
  ~3s without a Lighthouse dependency. CLS-source attribution
  surfaces the specific element triggering layout shift; LCP-element
  identity points at the largest contentful node. For full Web
  Vitals (TBT, INP, bundle size) defer to Lighthouse / PageSpeed.

### Infrastructure

- All new CLIs registered under the unified `vrt` dispatcher
  (`src/cli/vrt.ts` + `src/cli/router.ts`). Fixed a long-standing
  dispatcher bug where `process.argv[1]` was a relative path,
  silently breaking each module's `isCliEntry` check in dev mode.
- Smoke test (`scripts/smoke-all-clis.sh`) — runs every
  markup-assistance CLI on its fixture, asserts exit 0 + expected
  output. 15/15 PASS at HEAD.
- New fixtures under `fixtures/` for every command, each engineered
  to exercise a specific bug class:
  - `wireframe/pricing-card/` (component-from-image)
  - `multi-state/hover-button/` (multi-state)
  - `multi-page/footer-drift/` (multi-page-consistency)
  - `component-consistency/inline-leak/` (component-consistency)
  - `theme-parity/card-with-bug/` (theme-parity)
  - `i18n-stress/button-overflow/` (i18n-stress)
  - `media-variants/card/` friendly + hostile (media-variants)
  - `design-tokens/off-scale/` (design-tokens)
  - `a11y-contrast/low-contrast/`, `a11y-touch/small-targets/`,
    `a11y-focus-order/reversed/`, `typography/wrong-size-weight/`,
    `interact/dropdown-form/`

### Reports for review

- `docs/reports/2026-05-13-capability-survey.md` — what the toolkit
  can and can't do, ROI-ranked next directions.
- `docs/reports/2026-05-13-scenario-matrix.md` — 97 markup-flow
  scenarios × coverage status (currently 44 ✅ / 32 🟡 / 10 ❌ / 11 ⚪
  = 89% useful coverage).
- `docs/reports/2026-05-13-comprehensive-dogfood.md` — subagent
  evaluation of the integrated toolkit; identified 3 follow-up
  improvements (all shipped).

## 0.4.0 — Prior releases

(See git history for changes before this entry was added.)
