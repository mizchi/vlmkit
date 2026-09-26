# Changelog

All notable changes to this project will be documented in this file.
Dates are YYYY-MM-DD.

## 0.23.0 — 2026-09-23

- Add `vlmkit-anim why` to explain canvas size, layering, container allocation and edge routing.
- Include the elements responsible for oversized canvases and crossings in `check` diagnostics.
- Size container bands by their content and share canvas estimation between module maps and diagrams.
- Add `check composition` to detect spacing, alignment and heading-hierarchy inconsistencies.
- Add `check color` to inspect palette roles, text-field boundaries and links distinguished only by colour.
- Add `check grounding` with actionable screenshot coordinates, numbered markers (`--mark`), coordinate
  hit testing (`--at`) and scroll guidance for clipped targets.
- Add `check grounding --after` to map the screen that clicks, hovers and scrolls leave, not only the first
  load, and to report what the last action changed and where its click landed. Map labels are no longer cut
  before the word that tells two targets apart, a row its scroll container cuts is measured on the strip
  that is painted, and each finding names its map row.
- Add `check copy --forbid <file>` to detect prohibited copy, including hidden text.
- Add a provider-neutral zoom loop to `@mizchi/vlmkit-ai` (`analyzeWithZoom`, `runZoomLoop`): a vision model
  crops and magnifies the full-resolution original through a `zoom` tool, over OpenAI-compatible,
  Anthropic and Gemini APIs, or a plain-text `ZOOM` protocol for models without function calling.
  `vlm-bench --zoom` asks each model with and without it.
- Add `check responsive`, a property-based responsive check: the page's media queries partition the width
  range, generated viewports (plus height, `--text-scale` and colour scheme) are checked with the integrity
  layout judges and a new `text-starved` rule, and each failure is shrunk to its exact width range, anchored
  to a breakpoint (whose move is tried before it is suggested) and explained by the declaration that causes it.
- Add bundled workflows for explanatory animations, code-grounded diagrams, D2 diagrams and HTML slide decks,
  with figure fact checks and slide review tools.
- Install the agent skills inside Claude Code with `/plugin marketplace add mizchi/vlmkit`, alongside the
  existing APM and skills-CLI routes.
- Fix contrast checks for modern CSS colours such as `oklch()` and `lab()`.
- Reduce false positives in composition and grounding checks.
- Fix wrapped bullets, blockquotes and ordered lists in generated slide decks.
- Add `@mizchi/vlmkit-judge`, the browser-independent judges behind `check composition`, `check color`,
  `check design` and `check integrity`; existing import paths re-export them unchanged.

## 0.22.0 — 2026-09-09

- Add `@mizchi/vlmkit-anim/remark` to embed animated or still scenes in Markdown.
- Add `vlmkit-anim import mermaid` for flowcharts, sequence diagrams and state diagrams, with diagnostics
  for unsupported features.
- Automatically size diagram canvases and improve nested-container layout and edge routing.
- **Breaking:** remove the `cluster` layout option; nested group structure now controls container layout.

## 0.21.0 — 2026-09-09

- Add `vlmkit-anim diff` to visualise added, removed, moved and relabelled modules and dependencies.
- Add `diff --expect` to validate changes against a fact sheet.
- Support dashed outlines on module and diagram nodes.

## 0.20.0 — 2026-09-09

- Add `vlmkit-anim review --still` to export a figure, its facts and a review brief, and score reader answers.
- Detect overlapping containers and improve container-label placement, arrow spacing and annotation routing.

## 0.19.0 — 2026-09-09

- Add sequence diagrams with calls, returns, asynchronous messages, activation bars, loops and alternatives.
- Support nested groups in module maps and diagrams, including parent and cycle validation.
- Validate sequence message order with `check --expect` and detect activation bars obscuring text.

## 0.18.0 — 2026-09-08

- Add flowcharts with decision branches, traversal animation and fact-sheet validation.
- Add Gantt charts with task dependencies, milestones, owners and status updates.
- Support cascading schedule changes with `slip` and `cascade: true`.

## 0.17.0 — 2026-09-08

- Extend `check --expect` to graph, state-machine and distributed scenes.
- Add `vlmkit-anim facts` to generate module-map fact sheets from a directory's import graph.
- Accept qualified message references in `after` to disambiguate repeated labels.
- Fix state-machine spacing, token placement and graph-label collisions.

## 0.16.0 — 2026-09-08

- Expand canvases in any direction to accommodate annotations on their requested side.
- Route callout pointers around labels and boxes, including pointers attached to bent edges.
- Warn when an annotation cannot be placed on its explicitly requested side.

## 0.15.0 — 2026-09-08

- Add `accent`, `bad` and `muted` tones to modules, nodes and edges.
- Add `implements` dependency arrows and `equals` relations.
- Include accent highlights in fact-sheet validation.

## 0.14.0 — 2026-09-07

- Improve label sizing and wrapping for CJK, Hangul, emoji and other Unicode text.
- Route state-machine transitions around intervening states and keep labels clear of nodes.
- Reduce false crossing reports for hidden strokes and keep relation labels within the canvas.

## 0.13.0 — 2026-09-07

- Add shared annotations: values, callouts, snapshots, groups, text and relations.
- Add `compose` scenes for multiple panes and `modules` scenes for dependency maps.
- Add `vlmkit-anim repo` and `pr` to generate repository and branch-change visualisations.
- Add `still`, `layout` and `review` for cropped figures, collision diagnostics and visual review.
- Add `check --expect` to validate module maps against facts, including forbidden dependencies and highlights.
- Improve automatic annotation placement, dependency layering and edge routing.

## 0.12.0 — 2026-09-05

- Introduce `@mizchi/vlmkit-anim`, a standalone explanatory-animation tool with 14 scene kinds,
  semantic checks, narration, SVG frames, HTML playback, contact sheets and video export.
- Support typed scene authoring and scene modules in `.ts` / `.mjs`, alongside JSON.
- Extract `@mizchi/vlmkit-animation-eval`, shared by `check animation` and `vlmkit-anim eval`.
- **Import changes:** move `@mizchi/vlmkit-markup/style/animation-eval.ts` to
  `@mizchi/vlmkit-animation-eval`, `stable-selector.ts` to `@mizchi/vlmkit-core/stable-selector.ts`,
  and `rule-prose.ts` to `@mizchi/vlmkit-core/plugin/rule-prose.ts`.

## 0.11.1 — 2026-08-18

- Fix delegated drag detection, including detached sources and Escape cancellation.
- Suppress `dragover-not-prevented` when the source/target search is incomplete and raise its pair limit.
- Add `--probe dblclick`, unintended text-selection checks and drag-ghost legibility diagnostics.
- Wait for painted frames before taking mid-gesture screenshots.
- Exclude `auto` margins and screen-reader-only spacing from token violations; reject non-PNG palette inputs clearly.
- Add skill version checks and OpenAI-agent configuration guidance using the OpenRouter provider.
- Publish the playable solitaire demo and fix its drag feedback, stock-state cues and mobile navigation.

## 0.11.0 — 2026-08-16

- Add real drag, wheel, hover, touch, context-menu and text-input probes through `scan handlers --probe`.
  Detect intercepted gestures, missing feedback, inaccessible hover content and cancellation failures.
- Add animated PNG output to `snapshot strip` and `check animation --strip`.
- Apply rule settings consistently to all gate reports.
- Fix contrast deduplication and alpha compositing; report gradient/image backgrounds as unmeasurable.
- Reduce false collision and focus-order findings for clipped text, multi-column layouts and pinned controls.
- Detect class- and attribute-based themes, with a `--dark-selector` override.
- Wait for fonts, client rendering and finite animations before measuring pages.
- Fix installed-package CLI execution, workflow path resolution, route configuration, masks and `file://` inputs.
- Make `diff-pr` report failed captures, missing viewports, readiness timeouts and failed pin/post operations.
- Improve handler diagnostics, JavaScript-error attribution, flag validation and help output.

**Compatibility changes**

- Contrast checks may now fail pages whose defects were previously lost during deduplication.
- `check a11y touch` defaults to AA (24px), with inline and spacing exceptions; use `--level AAA` for 44px.
- Replace direct use of the removed capture spec and `vrt` / `vrt-update` tasks with `workflow capture`.
  `workflow init --config <absolute-path>` writes beside that config; capture exits 1 for non-2xx routes.
- Put subcommands before positional arguments. Ambiguous model names now raise `MULTIPLE_MATCHES`; use a full ID.
- Rename the `vrt-test`, `vrt-demo*` and `vrt-help` pkfire tasks to `vlmkit-*`.
- `composeFilmstrip` treats non-positive `maxWidth` as uncapped; OpenRouter token totals fall back to
  prompt plus completion tokens when the provider omits the total.

## 0.10.0 — 2026-08-14

- Add custom gate plugins through `@mizchi/vlmkit-core/plugin` and `/plugin/browser`, plus reusable
  deterministic collectors and judges through `@mizchi/vlmkit-markup/rules`.
- Add per-rule severity settings, expiring exceptions, `vlmkit rules`, `bench gates` and `--timing`.
- Add `gates init`, managed `webServer` configuration, structured batch results and `--ledger` / `--no-ledger`.
- Add component-scoped VRT with `check story`, `build gallery`, corresponding MCP tools and a bundled workflow.
- Add screenshot strips, optional WebP output, HAR recording/replay and `diff png --ignore-region`.
- Add selector-specific exceptions for design, contrast, touch-target and component-drift checks.
- Report measurement coverage, skipped judgements, warnings and stale HAR fixtures explicitly.
- Fix local asset loading, animation sampling, overflow attribution, interaction results and rule suppression.
- Fix CLI dispatch, source/flag parsing, workflow error handling and duplicate run-ledger entries.

**Compatibility changes**

- Gate JSON uses `{ gate, command, verdict, counts, findings, suppressed, retuned, report }`;
  read the previous payload from `.report`. MCP results are unchanged.
- Suspect findings now exit 1 for motion, animation, touch, focus, component/page drift, i18n, media and
  scroll-scan gates. Use `--advisory` to keep reporting without failing; `--fail-on-suspect` is a no-op.
- `check perf` uses exit 1 for poor results and exit 0 for warnings; exit 2 is removed and `--strict` is a no-op.
- Resolve paths in `vlmkit.gates.json` relative to that file. A11y and component-drift output directories
  gain per-source subdirectories; set `--output-dir` to retain a fixed path.
- Integrity contrast uses 4.5:1 for normal text and 3:1 for large text, with findings grouped by colour pair.
- Use CLI commands instead of executing gate measurement modules. Imported command modules no longer
  auto-run; call their exported runners. Snapshot and workflow runners return exit codes.
- Import gate argv helpers from `@mizchi/vlmkit-core/plugin`. Remove uses of `formatGateVerdict`,
  `computeLandscapeClampByte` and `ExploreOptions.strict`; CLI `--strict` for exploration remains available.
- `parseCraterSmokeArgs` no longer handles help or returns `json`; the gate runner owns those options.
- `vlmkit gates` rejects unknown commands and missing required flags before running a plan.

## 0.9.1 — 2026-08-04

- Add `--timeout`, `--wait-until` and `--har` to integrity and design checks.
- Add `check design --exclude` for vendor-owned subtrees.
- Make contrast failures exit 1 and keep installed skill templates out of consumer test discovery.
- Reuse the consumer's Playwright via a `>=1.61 <2` peer dependency and improve browser-install errors.
- Simplify top-level help and refresh the introduction with installation and verification examples.
- **Breaking:** remove deprecated CLI/workflow aliases and `diff region`; use grouped commands and
  deterministic `diff png --elements-html`, integrity or equivalence checks.
- **Breaking:** remove `checkA11yTree`, `evaluateDomEquivalence`, `deriveComponentContractRuntime`
  and the ignored `minOverlapRatio` option.
- **Breaking:** use only `.vlmkit/`, `vlmkit.config.*`, `VLMKIT_*` and `diff-report.json`;
  legacy `vrt` discovery and `migration-report.json` support are removed.

## 0.9.0 — 2026-08-02

- Add reference-free design checks, concurrent/sharded `batch` runs and declarative `vlmkit.gates.json` plans.
- Add reasoned integrity exceptions, expiring suppressions and authenticated-page support via `--storage-state`.
- Add URL support to a11y/design checks and JSON output to a11y/i18n checks.
- Fix relative asset loading, redirect detection and premature measurement of client-rendered pages.
- Improve text-collision, occlusion and overflow attribution; detect copy inside open shadow roots.
- Fix viewport-specific exceptions, numeric flag validation, truncated reports and mixed JSON/prose output.
- **Breaking:** copy, asset, scroll and breakpoint checks fail on suspect findings by default;
  use `--advisory` to opt out. Malformed or empty `verify flow` definitions are rejected before execution.
- Known limitation: some command output still references the old `vrt` name.

## 0.8.1 — 2026-08-01

- Publish compiled JavaScript and declarations for all public workspace packages, preserving deep imports.
- Fix planner/generator executable targets and include the markup package's generated MoonBit runtime.

## 0.8.0 — 2026-08-01

- Add contract-driven page scaffolding and deterministic `build page` / `verify markup` loops.
- Add breakpoint, scroll, animation, copy, integrity, layout and visual-equivalence checks.
- Add mock images, stronger region matching and guarded Stage-2 auto-fixes.
- Add event-state maps, handler checks and browser flows with explicit DOM post-conditions.
- Expose deterministic verification through `vlmkit mcp` and bundle internal runtimes into the root CLI.
- Improve verification of hidden text, occlusion, clipping, overflow and interactions.

## 0.7.0 — 2026-07-01

- Add `markup-loop init|observe|doctor|run` and ship planner, generator and healer runtime packages.
- Add contracts for generating and repairing Playwright smoke tests from UI observations.
- Add image dimensions, height deltas, region translation estimates and DOM selector candidates to `diff png`.
- Improve recolour classification and omit uninformative identical-colour samples.
- Downscale oversized inputs to `diff region`, restore original coordinates and retry truncated responses.

## 0.6.0 — 2026-05-19 (rebrand: vrt → vlmkit)

- **Breaking:** rename `@mizchi/vrt` and `@mizchi/vrt-*` packages to `@mizchi/vlmkit` and `@mizchi/vlmkit-*`.
- **Breaking:** replace the `vrt` binary and `dist/vrt.mjs` with `vlmkit` and `dist/vlmkit.mjs`.
- Move the repository to `mizchi/vlmkit` and deprecate the old npm package.
- Preserve `.vrt/` state and deprecated subcommand shims in this release.

## 0.5.0 — 2026-05-19 (first public release)

- Publish the root CLI and core, capture, AI and markup workspace packages.
  Library exports are TypeScript and require Node.js 24+ with type stripping or a compatible bundler.
- Group commands under `diff`, `check`, `inspect`, `stress`, `scan`, `build` and `snapshot`;
  retain old command names as forwarding aliases with deprecation notices.
- Fix command dispatch in the bundled CLI.
- Add five installable skills for visual diff, migration evaluation, markup synthesis, regression watch and CSS repair.
- Use `diff-report.json` as the canonical report name while retaining the `migration-report.json` alias.
- Migrate repository tasks from `justfile` to `Taskfile.pkl` (`pkf run`).

## 0.5.0 — design-md scenario branch (2026-05-15)

- Add approval manifests, file watching, pinned baselines and `diff-pr` CI verification.
- Add visual, accessibility, media-variant and cross-browser gates with Markdown summaries.
- Add selector-specific CSS suggestions for structural changes, reflow and viewport-dependent differences.
- Add cross-run change tracking, baseline/variant/heatmap triptychs and DESIGN.md token matching.
- Fix false passes caused by missing stylesheets and improve render-failure diagnostics.

## 0.5.0 — Markup-assistance toolkit (2026-05-13)

- Add screenshot-driven component generation with layout, typography, palette and interaction-state comparisons.
- Add theme parity, media-variant, cross-browser and internationalisation checks.
- Add design-token validation, contrast checks, touch-target checks and keyboard-focus analysis.
- Add component consistency checks within and across pages.
- Add scripted interaction capture and visual-stability metrics, including CLS, LCP, FCP and TTFB.
- Register the commands in the unified CLI and fix development-mode dispatch.

## 0.4.0 — Prior releases

See git history for earlier changes.
