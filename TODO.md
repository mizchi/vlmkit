# TODO

## Vision

**Large-scale cross-renderer diff verification tool**.

Use cases:
- Chromium vs Crater (cross-browser engine diffs)
- Website v1 vs v2 (UI library rewrites)
- Design system version comparison

Runs on Cloudflare Workers with Crater. WebUI is in a separate repo.

## Done (65 items)

### Core Pipeline
- [x] 3-track parallel pipeline (Diff Intent / Visual Semantic / A11y Semantic)
- [x] Cross-validation matrix (Visual × A11y × Intent)
- [x] 2-tier expectations (short-cycle + long-cycle spec)
- [x] Introspect / Spec verify / Reasoning chains / Goal Runner
- [x] Visual pipeline: pixelmatch v7 + heatmap + image size mismatch handling

### CSS Challenge Bench
- [x] 3 fixtures (page / dashboard / form-app), 741 CSS declarations
- [x] Property deletion mode + Selector block deletion mode
- [x] Multi-viewport (wide 1440 + desktop 1280 + mobile 375)
- [x] Computed style diff (esbuild __name bug fixed)
- [x] Hover emulation (:hover/:focus rule always-on + Playwright fallback)
- [x] ::before/::after pseudo-element computed style
- [x] CSS Custom Properties var() tracking
- [x] Detection pattern DB (JSONL) + aggregation report
- [x] Property/selector classification, auto-classification of undetected reasons (dead-code, hover-only, etc.)
- [x] Chromium detection rate 93.3% (scoped)

### Crater Integration
- [x] Crater BiDi client + Paint tree diff (detection rate 60%, false positive 0%)
- [x] Prescanner mode (1.66x speedup)
- [x] Best-effort computed style capture via BiDi
- [x] Bench summary persistence + speedup report

### Migration VRT
- [x] migration-compare.ts: auto breakpoint discovery + quickcheck-style viewport generation
- [x] Reset CSS fixture (normalize / modern-normalize / destyle / no-reset)
- [x] Tailwind → vanilla CSS fixture + blind test (0.0% pixel-perfect achieved)
- [x] shadcn/ui → luna fixture
- [x] Diff approval system (tolerance, expires, issue linkage)
- [x] Auto-approve workflow (vrt-approve)

### Viewport Discovery
- [x] @media breakpoint extraction (regex + crater BiDi)
- [x] Boundary ±1px + random sample viewport generation
- [x] ResponsiveBreakpoint type (ge/gt/le/lt) + merge
- [x] crater getResponsiveBreakpoints BiDi API integration

### API / CLI
- [x] API type definitions (src/api-types.ts) — Compare, Smoke, Report, Status
- [x] Hono API server (/api/compare, /api/compare-renderers, /api/smoke-test, /api/status)
- [x] /api/compare computed style diff integration
- [x] VrtClient SDK (src/vrt-client.ts)
- [x] Unified CLI (src/vrt.ts) — compare, bench, report, discover, smoke, serve, status
- [x] GitHub Actions CI workflow (vrt-compare.yml)

### Smoke Test
- [x] A11y-driven random operations (Playwright getByRole)
- [x] Disabled element skipping
- [x] LLM reasoning mode
- [x] Console error / uncaught exception / crash monitoring
- [x] External navigation blocking
- [x] Seed-based reproducible randomization

### Performance
- [x] pixelmatch v6 → v7
- [x] pixelmatch native benchmark (85µs, 6.6x vs npm v7)
- [x] tsx → node --experimental-strip-types (esbuild removed)
- [x] benchmark.ts (deterministic API baseline measurement)

### CI / Integration
- [x] flaker VRT runner + adapters (migration, bench)
- [x] migration-report / bench-report artifact workflows

### Code Quality
- [x] TypeScript strict mode (tsconfig strict + verbatimModuleSyntax, 151 tsc errors → 0)
- [x] Shared module extraction (terminal-colors.ts 12 files, cli-args.ts 9 files, mask.ts)
- [x] Playwright page reuse (fix-loop), PNG IHDR header reading, Gemini SDK init optimization

### Snapshot / URL Compare
- [x] `vrt snapshot` command (URL → multi-viewport capture + baseline diff)
- [x] `vrt compare --url / --current-url` URL mode (page.goto based)
- [x] `--mask` selector masking (visibility: hidden to exclude dynamic content)
- [x] Project rename: vrt-harness → vrt

---

## Evaluation Phase — Next Steps

### E1. Dogfooding on external projects

Use vrt on real projects to verify practicality.

- [x] Add `vrt snapshot` command (URL → multi-viewport capture + baseline diff)
- [x] Add `vrt compare --url` URL mode (page.goto based)
- [x] luna.mbt dogfooding: false positive rate 0% (6 pages × 2 viewports)
- [x] sol.mbt dogfooding: false positive rate 20% (dynamic content on root page)
- [x] Record results in `docs/reports/2026-04-05-dogfood-luna-sol.md`
- [x] sample-webapp-2026 dogfood で出た snapshot UX を改善する
  - `snapshot` の label 生成が query string を見ないため、`/` と `/?severity=critical` が同じ baseline に潰れる
  - `--label` / route manifest / query-aware label のどれかで URL ごとの identity を安定化したい
- [x] `vrt snapshot` に CI 向け fail 条件を持たせる
  - sample では `snapshot-report.json` を読んで回帰判定する `scripts/vrt-snapshot.mjs` が必要だった
  - `--fail-on-diff`, `--fail-on-new-baseline`, `--max-diff-ratio` を CLI に持たせたい
- [x] `snapshot` 系の baseline approve を first-class にする
  - sample では `scripts/vrt-approve.mjs` で `*-current.png` を `*-baseline.png` にコピーしている
  - `vrt snapshot approve` もしくは `vrt snapshot --approve` が欲しい
- [x] 外部プロジェクト向けに `workflow` の route/spec coupling を外す
  - `e2e/vrt-capture.spec.ts` が `vrt.config.json` (`capture.routes`) / `VRT_CONFIG_PATH` / `VRT_CAPTURE_ROUTES` から routes を読むようになった
  - `vrt workflow init|capture --config <path> --base-url <url>` で外部プロジェクトから差し込み可能
- [x] `vrt snapshot` の config file を公式サポートする
  - sample では `vrt.config.json` に `baseUrl`, `routes`, `outputDir`, `threshold` を寄せて wrapper で解釈している
  - JSON/TOML の config を直接読めると導入がかなり軽くなる
- [ ] Run VRT in CI per PR, measure false positive rate
  - `vrt snapshot stability <urls> --iterations N --fail-above-rate R` measures the FP rate by capturing N times against a locked baseline.
  - `.github/workflows/vrt-stability.yml` runs the measurement nightly on the migration fixtures and uploads `stability-report.json` as an artifact.
  - Per-PR rollout in real downstream projects still pending — needs aggregation of multiple runs over time.
- [ ] Pass diff report to subagent for fix code generation, measure success rate
  - `vrt snapshot fix-prompt` ships a markdown / JSON task descriptor (URL, viewport, diff ratio with shift compensation, baseline/current/heatmap/HTML paths) ready to feed to a subagent.
  - Success-rate measurement on real PRs still pending (needs LLM API key + repeated runs).

### E2. Crater prescanner tracking

Measure detection rate improvement after crater-side fixes (#18-22).
**Status**: #18-22 all Open (no progress as of 2026-04-05). Waiting for crater-side fixes.

- [ ] Re-run bench after text-decoration #18 fix
- [ ] Track progress toward detection rate 60% → target 80%+
- [ ] Track progress toward prescanner speedup 1.66x → target 3x+

### E3. Blind test replication

Reproduce the Tailwind blind test with different fixtures/scenarios to confirm reproducibility.

- [ ] Blind test with shadcn → luna
  - Fixture scaffolding done: `after-reference.html` archived, `after-blank.html` provides minimal reset starting point.
  - Baseline diff measured at 19.6%–58.4% across 10 viewports (35 layout-shift, 19 color-change, 4 typography).
  - Loop run itself requires an LLM API key — see `docs/reports/2026-05-11-e3-shadcn-luna-blind-scaffold.md`.
- [x] Blind test with Reset CSS switch — see `docs/reports/2026-04-04-e3-reset-css-blind-test.md` (0.0% in 1 round)
- [ ] Success criteria: diff < 1% within 3 rounds

---

## Backlog (prioritize after evaluation)

### Infrastructure / Deploy
- [x] Cloudflare Browser Run CDP backend (`vrt snapshot --backend cloudflare`) — connects via `chromium.connectOverCDP` to `wss://api.cloudflare.com/.../browser-rendering/devtools/browser`. See `examples/vrt-snapshot-cloudflare.workflow.yml`.
- [ ] Cloudflare Workers entry point (`worker/`) — waiting on stable `env.BROWSER` binding
- [ ] Cloudflare Quick Actions REST backend (`/screenshot`, `/crawl` for route discovery)
- [ ] crater WASM backend (layout only — paint is future)
- [ ] Cloudflare R2 / KV / D1 storage
- [ ] npm package (`@mizchi/vrt-client`)
- [ ] OpenAPI spec

### Crater side (mizchi/crater)

**Rendering fixes**:
- [ ] text-decoration #18 / border-radius #19 / font-weight #20 / margin #21 / align-items #22

**VRT detection rate improvement (94.4% → 100%)**:
- [ ] Breakpoint-aware CSS rule mapping #33 — resolve media-scoped detection gaps
- [ ] Hover/focus state computed style #34 — resolve hover-only detection gaps
- [ ] Computed styles BiDi #26 — prescanner detection rate 60% → 80%+
- [ ] CSS rule usage tracking #27 — dead-code determination

**VRT optimization**:
- [ ] Paint tree diff API #23 / CSS mutation API #24 / Selector-scoped rendering #25
- [ ] Batch rendering #28
- [ ] VRT prescanner benchmark tracking #29

### Feature Extensions
- [ ] Component (selector) level comparison
- [ ] Enhanced diff classification (layout shift / color change / text change / element added/removed)
- [ ] Smoke test: Crater BiDi backend
- [ ] Smoke test: a11y tree consistency check after operations
- [ ] Animation detection (animation-play-state: paused / CSSOM diff)
- [ ] External stylesheet breakpoint discovery

### Agent-loop UX (from 2026-05-12 dogfood)

From `docs/reports/2026-05-12-dogfood-shadcn-luna.md`. Each item is a
small wrapper around already-built primitives, not a new subsystem.

- [x] `vrt diff-for-agent <migration-report.json>` — one-context-window
  Markdown summary combining diff %, dominant categories, fix candidates
  aggregated by `(selector, property)` with viewport coverage, and
  absolute paths to baseline/current/heatmap PNGs for the worst N
  viewports. Verified on the 2026-05-12 dogfood Pass B data
  (reproduces the table + 5 fix candidates the terminal truncated to 3).
- [x] DOM equivalence pre-flight in `migration-compare`. Captures
  heading texts, button texts, input values, and total element count
  on the first viewport of baseline + variant; emits warnings under
  `domEquivalence` when they drift. CLI: `--no-dom-equivalence` to
  skip, `--strict-dom-equivalence` to fail on warnings. Verified on
  the 2026-05-12 dogfood invented-DOM scenario (3 warnings fire
  correctly; clean DOM stays silent).
- [x] Per-band shift detection. `detectBandShifts` splits the diff
  image into ~240px-tall horizontal bands and runs mean-subtracted
  cross-correlation per band, gated by a peak-sharpness confidence
  metric. Surfaced in `MigrationCompareResult.shiftRegions` and
  printed by `vrt diff-for-agent` as e.g.
  `[480–720]:+22px [720–960]:-94px [960–1348]:+32px`, replacing the
  single-line global average with localized per-section offsets.
  Verified on the 2026-05-12 dogfood Pass B iter 1 data.
- [x] `vrt compare-runs <a.json> <b.json>` — pairwise migration-report
  diff sorted by absolute movement, with IMPROVED/REGRESSED/UNCHANGED/
  ADDED/REMOVED status per viewport and a category-summary "before →
  after" column. Verified on the 2026-05-12 dogfood data: shows
  10/10 viewports IMPROVED, net Δ -249.85%, every "1 layout-shift →
  no changes" transition recorded.
- [x] Computed-style channel in `migration-compare` (opt-in via
  `--computed-style`). Reuses the existing capture script; per-fixture
  baseline + variant snapshot are diffed into a `(selector, property,
  before, after)` list plus by-property + by-selector aggregates.
  Surfaced in `migration-report.json` under `computedStyleDiff` and
  rendered as a "Top properties / Top selectors" section in
  `vrt diff-for-agent`. Verified on dogfood Pass B iter 1: catches 46
  tuples (border colors, radius, font-family, font-size on
  `#notes/#owner/#title`) that pixel diff alone surfaced only as
  generic `layout-shift`.
### Wireframe / from-screenshot mode (from 2026-05-12 Subagent F)

Subagent F (the first non-migration eval) reached 2/3 viewports
clean on a "recreate from screenshots" task — but had to write
manual pngjs probes because the existing diagnostics all assume
shared DOM tree shape. The migration-mode polish items below
(DOM-position, class-rename map, universal-vs-breakpoint-gated,
verified-pair gate) gave zero signal on this scenario.

The wireframe mode needs visual-only diagnostics:

- [x] **Component bbox extraction.** `src/component-bbox.ts` runs
  on the captured PNGs (no DOM required): detect background via
  edge-pixel mode, build foreground mask, label connected
  components (two-pass union-find, 4-connectivity), filter
  `minArea`, sort by area desc. `matchComponents` pairs baseline
  ↔ variant by rank-after-sort and reports per-axis Δ + IoU.
  Wired into `migration-compare` (always on; `--no-component-bbox`
  to disable) — surfaces a "Component bbox diff" section in
  `vrt diff-for-agent`. 10 unit tests cover synthetic backgrounds
  + multi-component sorting + min-area filtering. Verified on
  both wireframe (Subagent F's exact scenario: baseline 343×370,
  variant 311×243, Δ -32W / -127H reported on one row) and
  migration (Pass B iter 1: 50 component deltas surfaced).
- [x] **Per-viewport geometry diff** without DOM access — "baseline
  card shrinks 18px between desktop and mobile but variant
  doesn't" inferred purely from screenshot dimensions.
  `src/component-geometry.ts` composes on top of `MatchedBbox[]`
  and flags `responsiveMismatch` when one side's per-axis spread
  exceeds the other's by ≥30px. Rendered as "Cross-viewport
  geometry profile" in `vrt diff-for-agent`. 5 unit tests +
  verified on shadcn→blank (8 responsive-mismatch flags
  surfaced).
- [x] **Heatmap region clustering** — group connected hot pixels
  in `*_heatmap.png` into named regions and report per-region
  shift instead of horizontal bands. Bands of bands lose
  resolution; region clusters preserve "this text run shifted up
  4px" granularity. `src/heatmap-regions.ts` reuses the
  union-find CC labeller from `component-bbox.ts` against a
  hot-red mask (red − max(g,b) ≥ 60). 5 unit tests + verified on
  shadcn→blank (24 region clusters) and wireframe pricing-card
  (18 clusters — *still works when component bbox matching
  fails*, the F-overfit case).
- [x] **Text-row y-position extraction** from rendered PNGs via
  luminance-profile peak detection — exposes "the `$24` text row
  is 4px higher in the variant" without needing DOM correspondence.
  `src/text-rows.ts` computes per-row mean luminance, treats rows
  ≥12 below the median as dark, and groups runs into bands.
  `matchTextRows` pairs by ordered index and emits Δy. Surfaces
  "Bands B / V" count mismatches even when no rows can be paired
  (variant body empty case). 8 unit tests + verified on shadcn
  (14/14 bands paired, Δy −45px..−421px across the page) and
  wireframe pricing-card (1/0, 1/0, 8/0 — exactly "agent's blank
  variant has 0 bands; target has 8" signal).
- [x] **Scenario-aware Suggested-next-step**. F's report
  highlighted that the current "Suggested next step" wording
  assumes the migration scenario. When DOM-position is empty,
  pivot to "inspect heatmap → measure bbox → compare per-viewport
  geometry." `diff-for-agent` now detects wireframe mode (no
  dom-position-diff, no computed-style-diff, no fix-candidates but
  bbox/geometry/heatmap/text-rows present) and emits a 5-step
  image-only playbook instead.

### Markup-assistance Tier 2 (2026-05-13)

Three more scenarios, each as a dedicated CLI to keep
migration-compare lean.

- [x] **Theme parity** (`vrt theme-parity`). Renders the same HTML
  twice via Playwright's `emulateMedia({ colorScheme: light/dark })`,
  extracts component bboxes, samples each bbox's dominant fill in
  both renders, and flags components whose fill is identical across
  themes (RGB distance < 16) as **unthemed** — hard-coded colors
  that don't reference a theme variable. Evaluated on a card with
  a deliberately unthemed alert banner (warm `#fef3c7` bg
  hard-coded) — surfaced 1 of 8 unthemed, exact bbox 370,280
  540×43 matching the buggy `.alert`. Theme pixel delta 97.9%
  (page does respond broadly).

- [x] **i18n / variable-length text stress** (`vrt i18n-stress`).
  Inflates every text node by a configurable factor (default 1.4×
  ≈ German), then samples per-element layout before vs after.
  Classifies overflow as `horizontal-overflow` (scrollWidth >
  clientWidth), `extends-beyond-parent` (right edge past parent),
  or `vertical-wrap` (height grew significantly). Dedupes
  ancestor reports so only the innermost broken element is
  surfaced. Evaluated on a fixture with `width: 200px` heading
  and `width: 120px` button: caught both overflows + classified
  the paragraph wrap as the harmless `vertical-wrap` case.

- [x] **Inline → componentized refactor** (`vrt component-consistency`).
  Single-page-multi-instance sibling of `multi-page-consistency`:
  captures every selector match on one page via
  `locator.screenshot()`, compares each to instance #0 (or
  `--reference-index N`). Catches "you converted 4 of 5 cards to
  `<Card />` but missed the 5th and it's drifted." Evaluated on a
  4-card grid where one has a `.legacy` modifier (smaller padding,
  dashed border): cleanly surfaced **instance #2 at 7.48% drift**;
  #1/#3 stayed below 0.3% (subpixel noise).

Beyond the migration / wireframe scenarios, the tool can serve
adjacent markup-authoring workflows. Each scenario is built and
evaluated incrementally.

- [x] **Design token / palette compliance.** `src/palette-extract.ts`
  stride-samples the rendered PNG into a 5-bit-per-channel histogram
  and returns the top-K dominant colors. `src/palette-diff.ts`
  greedy-matches baseline vs variant by RGB-Euclidean distance
  (≤12 → match) and surfaces *missing* (in baseline target but
  not the variant — agent forgot a token) and *extra* (in variant
  but not target — agent slipped in a hard-coded literal). 6 unit
  tests + evaluated on shadcn→blank (19 missing brand colors, 4
  extra default-browser colors) and wireframe pricing-card (13
  missing colors including `#2464ec` — the literal target button
  color, surfaced as a single hex the agent can paste).
- [x] **Multi-state capture** — capture `:hover` / `:focus` /
  `:focus-visible` / `:active` via CDP `CSS.forcePseudoState`,
  diff per state. `src/multi-state.ts` marks all interactive
  elements (`button`, `a[href]`, `[role=button]`, form controls)
  with a `data-vrt-state-marker` attribute, opens a CDP session,
  and calls `forcePseudoState` for each matched node. Pixelmatch
  threshold lowered to 0.03 for state diffs (the default 0.1
  filters hover's typical Δ10-30/channel color shifts). Opt-in
  via `--states hover focus-visible …`. diff-for-agent surfaces
  a "Forced-state diff" section showing default vs state vs
  induced-delta per viewport, and *defeats* the early "PASS"
  exit when default is 0% but state-diff is non-zero — the
  exact pattern of "agent forgot to wire up :hover". Verified
  on a synthetic hover-button fixture: default 0% on all 3 vps,
  hover +0.37%/+0.42%/0.00%, focus-visible +0.26%/+0.29%/+1.11%.
- [x] **Component-from-screenshot** — single-component subset of
  wireframe mode: small viewport, one bbox, multi-state. New CLI
  subcommand. `src/component-from-image.ts` takes a target PNG +
  current HTML, renders the HTML at the PNG's exact dimensions,
  pixel-diffs, and runs every image-only signal (bbox, heatmap,
  text-row, palette) plus an optional `--states` pass. Emits a
  self-contained markdown report. Multi-state in this mode compares
  state-vs-default *within the current HTML* (since the target is
  a static PNG) and flags `:hover induced 0%` on interactive
  elements as **suspect — state did not change rendering**.
  Verified on wireframe pricing-card (87% diff, target has 1 text
  row, current has 0; missing `#2464ec` etc.) and hover-button
  fixture (0% pixel diff, but `:hover` flagged suspect because no
  hover rule is wired up).
### Subagent dogfood follow-ups (2026-05-13)

Two parallel subagents (G v1+v2 on component-from-image, H on
multi-state) ran the new Tier 1 tools and reported back. G converged
the wireframe pricing-card to **1.34% / 1.49% in 3-5 rounds** —
palette + bbox-Δ + heatmap signals carried the agent most of the
way. H surfaced the suspect-flag false-positive that turned out to
be CSS transitions, not the threshold. Fixes applied:

- [x] **Text-row detector under-counts on real fixtures.** Was
  finding 1 row on the pricing-card target (CTA button); now finds
  8 (badge, heading, price, 4 features, button). Root cause: used
  per-row mean luma only, dominated by white background. Added a
  per-row `max − min` range condition: a row is "content" if its
  range ≥ 80 (text on bg) OR mean dips below median (solid band).
- [x] **Bbox matcher false-pairs across wildly different areas.**
  When variant lacks a region, area-rank-only pairing matched
  target's full card against variant's button and reported
  nonsense `Δ -329px height`. Added `maxAreaRatio` (default 4):
  skip pairs whose `max/min > 4×`. Both rank positions stay
  unmatched, which is honest.
- [x] **Giant image-wide heatmap region was noise on round 1.**
  CC pass produced one region covering 0,0 → W,H whenever pages
  diverged badly. Added `maxRegionFraction` (default 0.8): drop
  regions covering ≥80% of the image.
- [x] **Multi-state suspect false-positive from CSS transitions.**
  Subagent H added a correct `:hover { background: #1d4ed8 }` rule
  but the suspect flag stayed on. Root cause was `transition:
  background 0.15s` — the screenshot caught the button
  mid-animation, registering ~3% of the color change. Fix:
  `applyForcedPseudoState` now injects
  `* { transition: none !important; animation: none !important; }`
  before forcing the state. Repro went from 0.00% induced (false
  suspect) to 8.31% induced (cleared).
- [x] **Palette "missing" persists at low diff due to AA jitter.**
  Subagent G v1 noted that `#f4f4f4` showed as "missing" even
  after being in the CSS. Added a `Nearest` column to the palette
  diff: Euclidean RGB distance to the closest color on the other
  side. ≤ 30 annotated as _(near, likely AA)_; > 60 is a real
  palette gap. Lets the agent dismiss persistent low-diff noise.

### Tier 3 + CLI unification + re-dogfood (2026-05-13)

- [x] **A11y contrast scan** (`vrt a11y-contrast`). Renders the
  HTML in Playwright, walks every visible text node via an
  in-browser `TreeWalker`, samples computed-style foreground +
  effective ancestor background, classifies font size for the
  "large text" 3:1 vs normal text 4.5:1 WCAG AA threshold.
  Worst-ratio-first findings table with hex / ratio /
  required-AA columns. Fixture
  fixtures/a11y-contrast/low-contrast: 4 failures cleanly
  detected (1.47:1 `#d1d5db` on white, 1.80:1 `#93c5fd` on
  white, 2.54:1 `#9ca3af` on white as both body and large
  text); the body-grade `#4b5563` and the button pass.

- [x] **CLI unification.** All six markup-assistance CLIs +
  `diff-for-agent` + `flipbook` + `compare-runs` now registered
  under the unified `vrt` dispatcher
  (src/vrt-command-router.ts + src/vrt.ts). Fixed a
  long-standing bug in the dispatcher: `process.argv[1]` was
  being set to a *relative* module path
  (`./migration-compare.ts`) which made each module's
  `isCliEntry` strict check
  (`resolve(argv[1]) === fileURLToPath(import.meta.url)`)
  silently fail in dev mode. Now resolved to absolute via
  `fileURLToPath(new URL(modulePath, import.meta.url))` —
  every command runs correctly from `node src/vrt.ts <cmd>`
  AND from the built `dist/vrt.mjs`.

- [x] **Re-dogfood — component-from-image v2.** Blank pricing-card →
  target ran with the new Backgrounds + heatmap Fill + raw/perceptual
  signals. Round 1 → 2: **87.36% → 2.48%** (vs prior v1/v2 which hit
  4.13% / 1.80%). Final 1.71% in 4 rounds. Subagent verdict:
  "Backgrounds row was the single biggest win" — first write set
  `body { background: #f6f7fb }` correctly with zero palette guessing.
  "Heatmap Fill column gave me the button color (`#2563eb`) and badge
  background (`#dbeafe`) before I'd written a single line of CSS."
  All prior bugs (text-row undercount, giant heatmap, false-pair,
  palette persistent missing) confirmed NOT hit. Remaining blocker:
  sub-pixel vertical spacing — needs per-row spacing-delta hints
  ("row #3 is 4px low, adjust the preceding margin-bottom").

- [x] **Re-dogfood — multi-state v2.** missing-hover.html → cleared:
  **2 rounds** (vs 3 before). Transition fix confirmed working.
  Subagent verdict: trustworthy in real workflows now. Two open
  concerns documented for future work: (1) UA-default focus ring
  clears the suspect flag even without author CSS, (2) wrong-direction
  hover (light bg on dark button) not detected.

### Tier B follow-up + A4 polish (2026-05-13)

- [x] **Per-heatmap-region dominant color annotation.**
  `findHeatmapRegionsFromFile` now optionally takes a source image
  path; samples each region's interior via per-channel median and
  attaches `dominantColor: { hex, r, g, b }`. component-from-image
  passes the target PNG, so the heatmap table shows "region 485,478
  310×38 fill `#2563eb`" — closes the loop between "this region
  differs" and "paint this color there."
- [x] **Explicit dominant backgrounds row.** New
  `findDominantBackgrounds(rgba, width, height)` samples the image
  perimeter (page bg) and a central 30×30% rectangle (content bg)
  via per-channel median, returns both + a `same` flag for solid
  pages. Median replaces an earlier 4-bit mode-finder that collapsed
  `#ffffff` and `#f6f7fb` into the same bucket. component-from-image
  renders a "Backgrounds" section before the palette diff: target
  outer `#f6f7fb` / inner `#ffffff` vs current outer/inner —
  no longer buried in the "missing palette" list.
- [x] **Multi-rank bbox** — not a code change. Investigation showed
  the existing tools already render top-8 bbox ranks; the subagent
  hit "rank 0 only" because A2's area-ratio filter correctly
  skipped pairs when the variant lacked components. Once the agent
  has content, multiple ranks appear naturally.
- [x] **A4 follow-up — raw vs perceptual state diff.** Subagent H
  noted the binary suspect flag (`induced === 0`) is too coarse:
  it can't distinguish "no rule at all" from "rule whose effect is
  below pixelmatch's 0.03 perceptual threshold." Added a raw-pixel
  diff (any RGB channel Δ ≥ 4, no AA filter) alongside the
  perceptual %. Three states now:
    - `suspect` (both ≈ 0 → no author CSS)
    - `_subtle_` (perceptual ≈ 0 but raw fires → real change below
      perceptual threshold; e.g., `#2563eb → #2462ea`)
    - cleared (both register → unambiguous state)
  Verified: subtle hover Δ ~2/channel reports Perceptual 0.00% /
  Raw 4.29% → `_subtle_`; missing-hover reports 0.00% / 0.00% →
  `suspect`; normal hover (Δ ~5-30/channel) reports both non-zero.

- [x] **Multi-page consistency** — same component on N pages must
  render identically. Cross-page bbox / computed-style diff.
  `src/multi-page-consistency.ts` renders N URLs (or HTML files)
  in Playwright, screenshots each `--selector` match via
  `locator.screenshot()` (auto-crops to the element's bbox), and
  compares all candidates against the first one (the reference).
  Surfaces pixel diff, page-level bbox Δ (W/H of the live element,
  not the cropped image), palette missing/extra counts, heatmap
  cluster count per candidate. Verified on a synthetic footer-drift
  fixture (3 pages with shared `.footer` styles; one page has a
  scoped `body .footer { padding: 48px; background: #111827 }`
  override): blog 0.00% drift, pricing 97.80% drift + Δ height
  +34px + 1 missing + 1 extra color — exact catch of the bug.

### Agent-loop UX (from 2026-05-12 subagent eval)

From `docs/reports/2026-05-12-subagent-eval.md`. After items
1–4 below shipped, Subagent D reached **6/10 viewports converged
under 1%** — the first `clean` result from any subagent in this
fixture series. The remaining 4-viewport floor at 2.67–3.52%
comes from a single unexplained +152px / +239px universal shift
band at viewports ≥ 1024.

- [x] **Vertical-shift origin diagnostic.** `src/shift-origin.ts`
  captures per-element bounding boxes via a new
  `DOM_BBOX_BROWSER_SCRIPT`, then matches by DOM path against the
  per-band shifts already produced by `detectBandShifts`.
  `findShiftOrigins` walks baseline elements in document order,
  finds the first whose Δy points in the band's direction with
  magnitude comparable to the band's shift, and emits the
  responsible element (path, baseline / variant class, Δtop,
  suspect axis: `height` / `margin/padding-above` / `y-position`).
  Surfaced as a new "Shift-origin diagnostics" table in
  `vrt diff-for-agent`, populated automatically when
  `--dom-position-diff` is on. Verified on dogfood Pass B iter 1:
  42 origin rows across 10 viewports — e.g. mobile `[720-960]
  Δ-94px → card-header / luna-panel-head, suspect: height`,
  below-1024 `[480-720] Δ+112px → button-row / luna-actions,
  suspect: height`. The exact symptom Subagent D plateaued on
  (`+152px shift band with no DOM-position delta`) now has a named
  origin. 9 unit tests cover the algorithm.
- [x] **Drop ✗ heuristic candidates from `vrt diff-for-agent`.**
  `--show-unverified` (default off) controls the visibility.
  Default output now drops rows whose computed value matches
  baseline; replaced with `_N unverified candidate(s) hidden_`
  note so the agent knows what was suppressed. Dogfood Pass B
  iter 1: table shrunk from 5 rows (2 ✓ + 3 ✗) to just 2 ✓.
- [x] **Grid `fr`-ratio inference.** `src/grid-ratio.ts` walks per-
  viewport bboxes, finds containers whose direct children have a
  non-uniform width distribution differing between baseline and
  variant, then suggests both a decimal ratio and a low-integer
  `fr` form (denominators 1..12). Two filters keep output sharp:
  `minRatioSpread` (default 1.15) drops flexbox subpixel-rendering
  noise (3 ~equal buttons coming out 130/140/143); `maxSumOverParent`
  (default 1.3) drops column-stacked containers where children fill
  100% width and per-child widths are content-driven (not a grid
  ratio). Surfaced as a new "Grid `fr`-ratio suggestions" section
  in `vrt diff-for-agent`. Dogfood Pass B iter 1: the workspace at
  768px reports `393/299 → 1.316 : 1.000 → 13fr 10fr` — the exact
  case Subagent D guessed manually as "1.316fr 1fr".
- [ ] **`display` context note for flex items.** A pill with
  `display: inline-flex` computes as `flex` when its parent is a
  flex container. Annotate so agents don't chase a delta that
  isn't a rule change.
- [x] **Unit-normalized property reporting.** `DpEntry` now carries
  `baselineEm` / `variantEm` for `letter-spacing`, `word-spacing`,
  `line-height` — values divided by the element's own font-size.
  `vrt diff-for-agent` renders a dedicated "Em-relative properties"
  sub-section in the per-viewport DOM-position table that exposes
  cases like "5 elements show `line-height` 18/21/24/28.5/40px but
  all five normalize to `1.5em`" — one rule, not five different
  values. D's exact complaint addressed. 4 new unit tests cover
  letter-spacing in px, line-height in px, non-em-relative
  properties not annotated, and `normal`/`auto` fallback.
- [x] **De-dupe `property changes` in class-rename map by class.**
  Column renamed `Property changes` → `Unique properties differ`
  and counts the unique property set per `(baseline-class,
  variant-class)` pair rather than summing per-element
  occurrences. Dogfood Pass B iter 1 numbers stay reasonable
  (eyebrow→luna-pill: 22, card→luna-panel: 17) because the
  fixture has 1 instance per class; on fixtures with N repeats
  of each card/metric/button the value will no longer inflate
  by N.

- [x] **DOM-position-based selector alignment** in a new
  `src/dom-position-styles.ts`. `migration-compare --dom-position-diff`
  captures per-element `(path, tag, classes, styles)` for every
  element with a `class` attribute or semantic tag, then matches
  baseline ↔ variant by tree position (`main[0]>section[0]>span[0]`),
  which is invariant under class renames. Surfaced as a new
  "Verified deltas by DOM position (class-rename-aware)" section in
  `vrt diff-for-agent`. Verified on the dogfood Pass B iter 1
  fixture: produces 872 property tuples across 60 element
  positions, naming both class names per row (e.g. baseline
  `eyebrow` ↔ variant `luna-pill`, baseline `dialog-card` ↔
  variant `luna-modal`). The exact gap subagent A flagged is now
  closed.
- [x] **Per-viewport DOM-position capture.** `--dom-position-diff`
  now captures the DOM-position styles at *every* discovered
  viewport (not just the first) and surfaces a new "Verified
  deltas by DOM position × viewport (catches media-query gaps)"
  section in `vrt diff-for-agent`. Output splits into:
    - **Universal deltas** — `(path, property)` pairs that differ
      on every viewport (a base CSS rule).
    - **Breakpoint-gated deltas** — pairs that differ on only a
      subset (a `@media` rule is wrong or missing).
  Verified on the dogfood Pass B iter 1 fixture: 871 universal
  pairs + 7 breakpoint-gated pairs across 10 viewports. The gated
  set correctly fingers `.luna-action` `height` (differs everywhere
  except mobile → variant lacks the breakpoint button-height rule)
  and `.luna-page` `width / margin` (differs only at desktop/wide
  → max-width value mismatch). Sample de-dupe + 200-entry cap
  keeps `migration-report.json` at ~360 KB.
- [ ] **Vertical-accumulation breakdown for layout-shift bands.**
  After C's iter 4 the DOM-position diff was nearly clean but
  `[720-1047]:+99px` persisted. Today the band reports the *shift*,
  not the *cause*. Decompose: "the +99px shift in band Y is
  explained by upstream accumulated height delta: `.luna-metric`
  −9px × 4 + `.luna-panel-title` line-height −1.5px × 3 …".
- [x] **Class-rename map as a header summary table** lands at the
  top of each variant section in `vrt diff-for-agent`, before the
  diff-by-viewport table. Aggregated from `domPositionDiff[Per
  Viewport]` and de-duped per `(baseline-class, variant-class)`
  pair. On the dogfood Pass B iter 1 fixture: 12 pairs (e.g.
  `eyebrow → luna-pill` × 22 properties, `card → luna-panel` × 17,
  `card-header → luna-panel-head` × 17). C called this "the
  single most valuable artifact"; it's now first billing.
- [ ] **De-dupe / re-cap `domPositionDiff.entries`.** The 200-tuple
  cap currently spends most of its budget on 4 repeats of each
  card / metric / button shape. Group by class-pair before
  truncating so unique deltas dominate.
- [x] **Fix-candidate scorer "value actually differs" gate.**
  `diff-for-agent` now marks `Verified?` as ✓ only when the
  candidate's `(selector, property)` appears in a real
  computed-style / DOM-position delta — not just when the property
  name appears anywhere. Verified pairs come from a new pre-built
  `verifiedPairs: string[]` index serialized unconditionally in
  `domPositionDiffPerViewport` (so the cap on `entries` /
  `byPathProperty` no longer affects accuracy). Rows are sorted ✓
  first. Dogfood Pass B iter 1: `.luna-{actions,field} gap`
  candidates (real deltas) get ✓, while `display` /
  `flex-direction` candidates whose computed values already match
  baseline get ✗ — same fixture, opposite ranking from before.
- [ ] **"Missing CSS rule" output.** Specced-vs-computed: "Baseline
  `.eyebrow` declares `text-transform: uppercase`; your variant has
  no rule producing that on `.luna-pill`." Today the tool emits
  computed-vs-computed but doesn't tell the agent which baseline
  selector is missing on the variant side.

- [ ] **Per-element / per-section diffRatio**. Today granularity
  bottoms out at the viewport. "Hero 0.4%, Panel 1.2%, Modal 4.0%"
  would let the agent target the worst offender. Both subagents
  independently asked for this.
- [ ] **Element bounding-box diff** that names the responsible
  CSS axis. "Your `.luna-panel:nth-of-type(1)` is 50px taller
  than baseline; candidate properties affecting height:
  `padding`, `line-height`, `font-size`."
- [ ] **Color samples on color-change category**. Today "1
  color-change" is recorded without naming the colors. Surface
  hex pairs (e.g. `(80,1040) was #6b7280, baseline is #8c9099`).
- [ ] **Regression alarm + auto-revert offer.** When net Δ is
  positive across most viewports after a patch, surface loudly.
  Both subagents wasted an iteration on a regression that needed
  manual reverting.
- [ ] **Per-viewport computed-style capture + label.** CSD today
  is a single global sample with no viewport tag. Capture per
  viewport and surface which width produced each tuple — both
  subagents struggled to know which.
- [ ] **Widen computed-style selector coverage** to include class
  selectors declared in the variant's CSS. (Prerequisite for
  item #1 above.) Already on the wish-list from Pass C; the
  subagent eval reinforces its priority.

- [x] Heuristic fix-candidate ranking now reconciles with computed-style.
  `vrt diff-for-agent` renames the heuristic table to "Heuristic fix
  candidates" with a per-row `Verified?` column (✓ when the
  property appears in the computed-style diff, — when it doesn't),
  and exposes the new authoritative "Verified deltas (computed-style)"
  table listing `(selector, property, baseline, variant)` tuples.
  On the dogfood data, all 5 heuristic candidates (`.luna-actions`
  `{display | gap}`, `.luna-field {display | flex-direction | gap}`)
  are correctly marked unverified, while the verified table surfaces
  the real deltas — `border-radius 12px→4px`, `font-family
  Inter→Arial`, `font-size 16px→13.33px`, `padding 11px 13px→8px`,
  `color rgb(15,23,42)→rgb(0,0,0)` — that the agent actually needed
  to fix.

### Playwright Integration
- [ ] `nlAssert()` with Vision LLM
- [ ] `onlyOnFailure` pattern
- [ ] `toHaveScreenshot()` integration

### Spec coverage
- [ ] Heading hierarchy validation
- [ ] ARIA relationship validation
- [ ] Color contrast invariants
- [ ] Responsive layout invariants

### Dashboard (separate repo)
- [ ] Execution result list/search
- [ ] Visual diff display (heatmap, side-by-side, overlay)
- [ ] Interactive approval operations
- [ ] Detection rate time-series graph
- [ ] Component-level status matrix
