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
- [x] API type definitions (src/api/api-types.ts) — Compare, Smoke, Report, Status
- [x] Hono API server (/api/compare, /api/compare-renderers, /api/smoke-test, /api/status)
- [x] /api/compare computed style diff integration
- [x] VrtClient SDK (src/api/client.ts)
- [x] Unified CLI (src/cli/vrt.ts) — compare, bench, report, discover, smoke, serve, status
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
  - `vrt migration subagent prepare` (and the `migration-subagent-prepare` task) produces a subagent packet from `migration-report.json`; `vrt migration blind` provides reproducible blind scenarios.
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
  - `fixtures/migration/blind-scenarios.json` + `migration-blind.ts` (`prepare` / `solo` / `evaluate`) now reproduce + score the shadcn→luna scenario deterministically.
  - Loop run itself requires an LLM API key — see `docs/reports/2026-05-11-e3-shadcn-luna-blind-scaffold.md`.
- [x] Blind test with Reset CSS switch — see `docs/reports/2026-04-04-e3-reset-css-blind-test.md` (0.0% in 1 round)
- [ ] Success criteria: diff < 1% within 3 rounds

---

## Backlog (prioritize after evaluation)

### Infrastructure / Deploy
- [x] Cloudflare Browser Run CDP backend (`vrt snapshot --backend cloudflare`) — connects via `chromium.connectOverCDP` to `wss://api.cloudflare.com/.../browser-rendering/devtools/browser`. See `examples/vrt-snapshot-cloudflare.workflow.yml`.
- [x] Cloudflare Workers entry point (`worker/`) — `worker/index.ts` re-exports `createApiApp()` from `src/api/api-app.ts`. `env.BROWSER` wiring still pending.
- [ ] Cloudflare Quick Actions REST backend (`/screenshot`, `/crawl` for route discovery)
- [ ] crater WASM backend (layout only — paint is future)
- [x] Cloudflare R2 / KV / D1 storage — `worker/storage.ts` detects bindings; `/api/status` exposes `r2`/`kv`/`d1` availability via `StorageStatus`. Read/write wiring still pending.
- [x] npm package (`@mizchi/vrt`) — `pnpm add @mizchi/vrt`; exports both root and `/client`.
- [x] OpenAPI spec

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

- [x] **Component bbox extraction.** `packages/vrt-markup/src/component/component-bbox.ts` runs
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
  `packages/vrt-markup/src/component/component-geometry.ts` composes on top of `MatchedBbox[]`
  and flags `responsiveMismatch` when one side's per-axis spread
  exceeds the other's by ≥30px. Rendered as "Cross-viewport
  geometry profile" in `vrt diff-for-agent`. 5 unit tests +
  verified on shadcn→blank (8 responsive-mismatch flags
  surfaced).
- [x] **Heatmap region clustering** — group connected hot pixels
  in `*_heatmap.png` into named regions and report per-region
  shift instead of horizontal bands. Bands of bands lose
  resolution; region clusters preserve "this text run shifted up
  4px" granularity. `packages/vrt-core/src/heatmap-regions.ts` reuses the
  union-find CC labeller from `component-bbox.ts` against a
  hot-red mask (red − max(g,b) ≥ 60). 5 unit tests + verified on
  shadcn→blank (24 region clusters) and wireframe pricing-card
  (18 clusters — *still works when component bbox matching
  fails*, the F-overfit case).
- [x] **Text-row y-position extraction** from rendered PNGs via
  luminance-profile peak detection — exposes "the `$24` text row
  is 4px higher in the variant" without needing DOM correspondence.
  `packages/vrt-core/src/text-rows.ts` computes per-row mean luminance, treats rows
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

- [x] **Design token / palette compliance.** `packages/vrt-markup/src/style/palette-extract.ts`
  stride-samples the rendered PNG into a 5-bit-per-channel histogram
  and returns the top-K dominant colors. `packages/vrt-markup/src/style/palette-diff.ts`
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
  diff per state. `packages/vrt-markup/src/stress/multi-state.ts` marks all interactive
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
  subcommand. `packages/vrt-markup/src/component/component-from-image.ts` takes a target PNG +
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

### Scenario-matrix small misses — F3 + D4 (2026-05-13)

Two remaining single-item gaps from the scenario matrix:

- [x] **F3 — `vrt a11y-focus-order`**. Drives `Tab` through the
  page via `page.keyboard.press`, captures `document.activeElement`
  after each press, builds an ordered sequence of focus steps.
  Detects three classes of bug:
    - **reverse** — focus moved left within the same row (Δx <
      −40px, Δy ≤ 16px), or up the page (Δy < −24px). Tab order
      doesn't match T-to-B / L-to-R visual order.
    - **trap** — same element (path + bbox) focused twice in a row.
    - **skip-row** — focus jumped > 200px vertically; heuristic
      warning to verify nothing was skipped between.
  Cycle-detection by tracking the first focused element's path and
  stopping when it reappears. Path-collision sibling detection
  (same path but different bbox) avoids trap false-positives on
  identical-class sibling elements.

  Fixture `fixtures/a11y-focus-order/reversed/`: a flexbox toolbar
  using `order:` to visually reverse three buttons while keeping
  DOM order. Tool finds 2 reverse findings (Cut → Copy moves left,
  Copy → Paste moves left). The control case (a normally-ordered
  page) produces zero findings.

- [x] **D4 — `--device-scale-factor` (`--dpr`) flag on
  `component-from-image`**. Passes Playwright's
  `deviceScaleFactor` to `newPage`. CSS viewport is derived from
  the target image's pixel dimensions divided by dpr, so the page
  lays out at the *intended* CSS dimensions and renders at the
  higher DPR. Useful for retina simulation: capture target at 2×
  in Figma / Chrome devtools, then run with `--dpr 2` to verify
  the live render holds up.

Both registered in the unified `vrt` dispatcher. Smoke 15/15 PASS.

Scenario-matrix progress (HEAD → after this commit):
  ✅ 42 → 44 (+2: F3, D4)
  ❌ 12 → 10

In-scope full coverage now **44 / 85 = 52%**; full + partial =
**76 / 85 = 89%**.

### Scenario-matrix Clusters 2 & 3 — cross-browser + design-tokens (2026-05-13)

- [x] **Cluster 2: `vrt cross-browser`** — launches chromium /
  firefox / webkit in sequence, diffs each against the first
  successful engine (typically chromium = reference). Engines
  not installed in the local Playwright cache auto-skip with an
  actionable hint (`npx playwright install firefox webkit`) —
  the tool stays useful in a Chromium-only sandbox. Per-engine
  heatmap regions + UA strings + suggested-next-step that calls
  out the common per-engine quirks (form controls on WebKit,
  text subpixel shifts on Firefox). Closes scenario matrix
  items H1, H2, H3.

- [x] **Cluster 3: `vrt design-tokens`** — scale-conformance
  check. Renders the page, walks visible elements, samples
  computed-style `borderRadius`, `padding`, `margin`,
  `zIndex`, `boxShadow`. Per-property scale check (`isOnScale`
  with px tolerance) plus shadow-tier check (count distinct
  normalized shadow strings, flag when > N tiers).

  Defaults are conservative common scales:
    - radius: `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 48, 999`
    - spacing: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`
    - z-index: `0, 1, 10, 100, 1000, 9999`
    - shadow tiers: 5
    - tolerance: ±0.5px

  Override via CLI flags (`--radius-scale 0,4,8`) or a JSON
  config (`--config tokens.json`).

  Per-violation report: element, side (for box-sides), actual
  value, nearest in-scale value, delta. Closes scenario matrix
  items M4, M5, M6.

  Fixture: `fixtures/design-tokens/off-scale/page.html` with
  mixed conformant + off-scale values. Tool: **20 findings** —
  3 border-radius (7/5/9px), 3 margin (17/23px), 12 padding
  (4 sides × 3 elements all off-scale), 1 z-index (5), 8
  distinct shadows (allowed 5). Conformant elements (.ok-card,
  .btn-ok) pass cleanly.

Both registered in `vrt` dispatcher. Smoke script updated to
14/14 PASS.

Per scenario matrix, this drops missing-scenario count further:
  Before:  ✅ 35 / 🟡 32 / ❌ 19 / ⚪ 11
  After:   ✅ 42 / 🟡 32 / ❌ 12 / ⚪ 11

In-scope full coverage: **42 / 85 = 49.4%**. Combined with
partial (🟡), useful coverage is **74 / 85 = 87%**.

### Scenario-matrix Cluster 1 — media-variants (2026-05-13)

Single command covering 5 of the 24 missing scenarios from the
scenario-coverage matrix (`docs/reports/2026-05-13-scenario-matrix.
md`): forced-colors, reduced-motion, print, RTL, 200%-zoom.

- [x] **`vrt media-variants`** — renders an HTML / URL under each
  variant emulation and pixel-diffs against the default. Five
  emulations (Playwright primitives + small overrides):
    - `forced-colors` via `emulateMedia({ forcedColors: 'active' })`
    - `reduced-motion` via `emulateMedia({ reducedMotion: 'reduce' })`
    - `print` via `emulateMedia({ media: 'print' })`
    - `rtl` via `document.documentElement.dir = 'rtl'` injection
    - `zoom-200` via `html { zoom: 2 }` + halved viewport

  Per-variant heuristic verdict combines pixel delta + a static
  stylesheet-text check (more reliable on small pages where motion
  / forced-color responses are subtle):

    - `forced-colors`: `forced-color-adjust: none` declaration →
      explicit opt-out (suspect); else delta-based.
    - `reduced-motion`: `@media (prefers-reduced-motion: reduce)`
      rule present → ok; animation/@keyframes/transition present
      without that rule → suspect; neither present → ok.
    - `print`: `@media print` rule present → ok; absent → warn.
    - `rtl`: physical-property smell count (`margin-left`,
      `padding-right`, `text-align: left|right`); ≥2 → suspect,
      1 → warn, 0 → ok.
    - `zoom-200`: pixel-delta based.

  Verdict categories: `ok` / `warn` / `suspect` / `skip` (on error).

  Fixtures: `fixtures/media-variants/card/`
    - `friendly.html` (system colors, logical props, `@media`
      reduce/print rules, no opt-outs) → **5 ✓**
    - `hostile.html` (`forced-color-adjust: none`, no reduce rule
      despite animation, no print rule, physical props) → **3 ✗ +
      1 ⚠ + 1 ✓** (zoom-200 still reflows fine)

  Registered under `vrt` dispatcher; added to
  scripts/smoke-all-clis.sh (12/12 PASS).

### Survey Tier D — real-interaction sequences (2026-05-13)

- [x] **`vrt interact`** — declarative scripted-sequence VRT. The
  agent describes a sequence of Playwright actions in JSON; the
  tool drives the page through them and pixel-diffs each transition.
  Closes the "we can't see UI bugs hidden behind clicks / forms /
  scroll" gap from the capability survey.

  Action vocabulary: `snapshot`, `click`, `hover`, `type`, `fill`,
  `select`, `scroll`, `wait`, `waitForSelector`. Each `snapshot`
  saves a PNG; consecutive snapshots are pixel-diffed (threshold
  0.03) and the diff regions are CC-clustered with kind + fill
  annotations from the existing heatmap pipeline.

  Output: markdown report with:
    - Snapshot list (named PNGs)
    - Transition table (from → to, actions, diff %, region count)
    - Per-transition heatmap region tables (Top-Left, Size, Hot pixels, Fill, Kind)
    - Suggested next step that flags zero-delta transitions ("selector miss?")

  Fixture `fixtures/interact/dropdown-form/`:
  page.html has a dropdown trigger + email form + scrollable filler.
  sequence.json drives 5 snapshots through: default → dropdown-open
  → invalid-email → valid-email → scrolled. Results: 1.70% / 1.79%
  / 0.07% / 14.02% — each transition's induced change clearly
  surfaced, including the subtle 0.07% border-color shift on email
  validation.

  Registered under the unified `vrt` dispatcher.

### Survey Tier B / C / F follow-ups (2026-05-13)

Three of the ROI-ranked items from `docs/reports/2026-05-13-
capability-survey.md`, shipped together.

- [x] **B. Region content-type classifier.** `packages/vrt-core/src/region-classify.ts`:
  `classifyRegion(rgba, w, h, bbox)` returns one of `text` /
  `filled-rect` / `icon` / `image` / `unknown` with a confidence
  score. Features: quantized color count, luma std dev, horizontal
  stripe-row count, aspect, area. Rules:
    - tiny + square → icon
    - ≥ 2 dark stripes → text
    - colorCount ≤ 8 and lumaStd < 12 → uniform fill
    - colorCount ≤ 120 and lumaStd < 45 → button/badge (filled-rect)
    - single stripe → text
    - colorCount > 200 → image
  Wired into `findHeatmapRegionsFromFile` — each region now gets
  `kind` + `kindConfidence`. component-from-image renders the
  `Kind` column on the Heatmap region clusters table. Verified on
  pricing-card: CTA button → `filled-rect`, price digits → `icon`,
  small check icons → `text` (single-stripe). 4 unit tests.

- [x] **C. CSS suggestion synthesizer.** component-from-image now
  emits a `## Suggested CSS patch` section aggregating every
  actionable signal into a single paste-ready code block:
    - Backgrounds row → `body { background: <hex>; }` declaration
      when target/current outer hexes differ
    - Inner bg mismatch → `/* content container should use ... */`
    - Text-row count mismatch → `/* HTML: add N row(s) ... */`
    - Typography mismatches → `/* row #N: font-size: Xpx; font-weight: Y */`
    - Spacing gap deltas → `/* row #N: reduce margin-bottom by Xpx */`
    - Heatmap regions × kind → `background: <hex>` (filled-rect),
      `color: <hex>` (text), `fill: <hex>` (icon)
  Selectors are intentionally omitted (the tool can't see the DOM);
  the agent maps each comment back to whichever element matches the
  described region or row.

- [x] **F. Touch-target size check** (`vrt a11y-touch`). New CLI
  that scans visible interactive elements (`button`, `a[href]`,
  form controls, `[role=button]`, `[tabindex≥0]`, `summary`) and
  reports those whose bbox `min(w, h)` is below the WCAG threshold
  (44×44 AAA default, 24×24 AA via `--level AA`). Per-finding
  `cluster` flag fires when another interactive element is within
  24 px (forfeits AA's "with spacing" leniency). Fixture
  `fixtures/a11y-touch/small-targets`: 6 interactive elements, 5
  failing AAA (incl. inline-link 27×14, close-btn 16×16, cluster
  buttons 20×20), 3 failing AA. Registered in
  `vrt-command-router` + `vrt.ts`.

### Typography hints (2026-05-13)

The single largest gap from the capability survey (`docs/reports/
2026-05-13-capability-survey.md`) — subagent G v3 explicitly cited
typography as "the next blocker." Now closed for size + weight.

- [x] **Font-size estimation from band height.** `text-rows.ts`
  computes `estimatedFontSize` per band, derived from `bandHeight /
  0.92` snapped to a common UI bucket (12, 14, 16, 18, 20, 22, 24,
  28, 32, 36, 40, 48, 56, 64, 72). Calibrated against system-ui
  rendered at 12-48px. Absolute accuracy ≈ ±1 bucket; relative
  direction (target larger / smaller than current) is reliable.

- [x] **Font-weight bucketing from ink density.** New per-band
  `inkDensity` (dark pixels / inkBbox area, with adaptive threshold
  `meanLuma − 50` so muted-gray text is still detected) and
  `weightBucket` ∈ {light, regular, medium, bold}. Buckets
  empirically calibrated against system-ui at common weights.

- [x] **Per-row mismatch comparison** (`compareRowTypography`).
  Walks ordered baseline ↔ variant pairs, flags rows where snapped
  size differs OR weight bucket differs (with density-delta gate of
  0.04 to avoid noise). Returns `TypographyMismatch[]` with kind ∈
  {size, weight, both}. Surfaced as a sub-table inside the Text-row
  Δy section of component-from-image's report.

- [x] **Fixture + verification.** `fixtures/typography/wrong-size-
  weight/`: reference (`heading: 24px bold`, `price: 40px bold`,
  body 14px regular) vs buggy (`heading: 18px medium`, `price:
  24px medium`). Tool detection:
  - Row #0: target `28px bold` / current `20px regular` / kind=both
  - Row #1: target `40px bold` / current `24px bold` / kind=size
  Both real bugs caught; estimates off by ≤1 bucket but direction
  always correct.

- [x] **6 new unit tests** in `text-rows.test.ts`: font-size from
  band height, weight bucket ordering from density, and four
  compareRowTypography cases (size mismatch, weight mismatch, below-
  density-threshold no-op, kind=both classification).

Open future work for typography (deferred):
- Font-family bucket (serif vs sans, mono vs proportional) via
  character-shape histogram
- Range estimate ("24-28px") instead of single snapped value when
  the band height lands between buckets

### Remaining-issue close-out (2026-05-13)

Three concerns left open after the re-dogfood, all addressed:

- [x] **Sub-pixel vertical spacing hints.** Subagent G v3:
  "the remaining ~1.7% diff is text baseline Δy in the 2-19px
  range, and the report doesn't yet suggest which CSS knob to
  turn." `computeRowGapDeltas(baseline, variant)` derives the
  per-pair gap between consecutive text rows for both sides and
  reports the delta. component-from-image renders a new
  "Spacing fixes" sub-table inside the Text-row Δy section: for
  each (rowA, rowB) pair, shows target gap / current gap / Δ /
  the suggested action ("reduce preceding element's bottom
  space by Xpx" / "add Xpx").

- [x] **UA-default focus ring discrimination.** Subagent H:
  "`:focus-visible` registered 1.10% before I added any focus
  CSS — the browser's default outline cleared the suspect flag."
  `applyForcedPseudoState` now returns the per-element bboxes
  alongside fingerprints; component-from-image classifies each
  state-induced diff pixel as edge (within 4px of any bbox
  perimeter) or interior. New `Edge %` column + `ua-likely` note:
  fires when edge > 85% and interior pixels < 50 (= only the
  perimeter changed, no fill/text touched). Verified:
  missing-hover with no author `:focus-visible` rule → Edge 100%
  + `ua-likely` flag; author-styled `:focus-visible` with
  background change → Edge 34%, no flag.

- [x] **Wrong-direction hover detection.** Subagent H:
  "`:hover { background: #ffffff }` on a dark button would clear
  suspect with a huge raw %, but be semantically wrong." Added
  `meanInteriorLuma(path, bboxes)` to compute mean Rec.601
  luminance over the interior of forced bboxes. New `ΔLuma`
  column in the forced-state table + `direction?` note that
  fires when `:hover`/`:active` lightens the elements by > 15
  luma units. Verified: correct hover `#2563eb → #1d4ed8` shows
  ΔLuma ≈ −5 with no flag; wrong-direction `#2563eb → #93c5fd`
  shows ΔLuma +49.4 → "**direction?** `:hover` lightened by 49
  luma; verify this matches the intended hover direction."

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
  (src/cli/router.ts + src/cli/vrt.ts). Fixed a
  long-standing bug in the dispatcher: `process.argv[1]` was
  being set to a *relative* module path
  (`./migration-compare.ts`) which made each module's
  `isCliEntry` strict check
  (`resolve(argv[1]) === fileURLToPath(import.meta.url)`)
  silently fail in dev mode. Now resolved to absolute via
  `fileURLToPath(new URL(modulePath, import.meta.url))` —
  every command runs correctly from `node src/cli/vrt.ts <cmd>`
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
  `packages/vrt-markup/src/stress/multi-page-consistency.ts` renders N URLs (or HTML files)
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

- [x] **Vertical-shift origin diagnostic.** `packages/vrt-core/src/shift-origin.ts`
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
- [x] **Grid `fr`-ratio inference.** `packages/vrt-core/src/grid-ratio.ts` walks per-
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
- [x] **`display` context note for flex items.** A pill with
  `display: inline-flex` computes as `flex` when its parent is a
  flex container. DOM-position capture carries parent display context,
  and `diff-for-agent` annotates display rows with a flex/grid-item note
  so agents don't chase a delta that isn't a source rule change.
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
  `packages/vrt-core/src/dom-position-styles.ts`. `migration-compare --dom-position-diff`
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
- [x] **De-dupe / re-cap `domPositionDiff.entries`.**
  `migration-compare` now trims both single-viewport and
  per-viewport DOM-position entries by round-robin over
  `(baseline classes, variant classes, property)` groups, so the
  200-tuple cap keeps representative class-pair deltas instead of
  spending most of the budget on repeated card / metric / button
  shapes.
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

- [x] **Per-element / per-section diffRatio**. `diff-for-agent` now
  combines component bbox matches with heatmap regions and renders
  "Per-section diffRatio" rows, including worst-row marking and tests for
  section-ratio sorting.
- [ ] **Element bounding-box diff** that names the responsible
  CSS axis. "Your `.luna-panel:nth-of-type(1)` is 50px taller
  than baseline; candidate properties affecting height:
  `padding`, `line-height`, `font-size`."
- [x] **Color samples on color-change category**. Diff regions now carry
  sampled baseline/current color pairs, visual-semantic descriptions include
  hex pairs, migration results preserve color-change samples, and
  `diff-for-agent` renders a "Color-change samples" table.
- [ ] **Regression alarm + auto-revert offer.** When net Δ is
  positive across most viewports after a patch, surface loudly.
  Both subagents wasted an iteration on a regression that needed
  manual reverting.
- [x] **Per-viewport computed-style capture + label.** CSD now has
  `computedStyleDiffPerViewport`, `bySelectorProperty`, universal vs
  breakpoint-gated rows, and sample values tagged by viewport. It is
  captured in `migration-compare`, surfaced by `diff-for-agent`, and covered
  by `computed-style-diff` plus `diff-for-agent` tests.
- [x] **Widen computed-style selector coverage** to include class
  selectors declared in the variant's CSS. `captureComputedStyleSnapshotInDom`
  now reads same-origin CSSOM selectors and adds declared class-selector
  aliases (for example `.luna-pill`) while retaining the existing DOM
  class-combination key (for example `.luna-pill.is-active`). This gives
  downstream reports a stable variant-side selector to reference before
  the "missing CSS rule" diagnostic is added.

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

### Game Asset / Motion Dogfood (from 2026-05-20)

Goal: make the image -> asset contract -> model -> motion -> render gate useful
enough for game asset production, then decide which parts should become first
class vlmkit APIs.

Autonomy principle:

- Prefer deterministic probes, renderer metadata, and model/IR contracts over
  human visual checks.
- Human review should calibrate thresholds and label a small gold set, not sit
  in the main loop.
- Every quality concern should first become a machine-readable metric with
  `pass` / `warn` / `fail`, examples, and a regression fixture.
- If a check still needs a person, record the exact missing signal and add a
  task to automate it.

Current smoke status:

- [x] `gpt-image-2` game asset run scaffold:
  `design-runs/game-assets-20260520/`
- [x] Goblin one-shot / turnaround / voxel reference dogfood recorded
- [x] Procedural GLB/OBJ blockouts for low-poly and voxel goblin
- [x] Fixed-camera GLB/OBJ render and compare tools
- [x] Voxel robot with named joints and animation clips
- [x] Motion IR bridge:
  external-ish humanoid motion -> normalized IR -> retargeted GLB
- [x] Local VRMA-style fixture using
  `VRMC_vrm_animation.humanoid.humanBones`
- [x] Real `.vrma` smoke with `tk256ailab/vrm-viewer` `LookAround.vrma`
  downloaded into ignored `external/`
- [x] `extract-gltf-motion-ir --target-space humanoid` handles real VRMA,
  unnamed clips, and target-skeleton downgrade warnings
- [x] `verify-gltf-motion --motion-ir` uses IR clip/loop metadata so
  one-shot motions do not fail loop checks
- [x] Batch external VRMA smoke command for `LookAround`, `Goodbye`, and `Jump`
- [x] Initial automated motion quality report: frame bbox stability, screen
  coverage, ground-y, retained-channel ratio, and skipped-channel regions
- [x] Root translation normalization for external VRMA smoke:
  `keep|relative|horizontal-only|zero|scale-to-model`, with batch smoke
  defaulting to `relative`
- [x] Root translation normalization audit: `apply-motion-ir --audit-out`
  records source root height, target base height, delta ranges, normalized
  ranges, and applied scale for each root translation track
- [x] Root normalization audit recommendations: source/target root height
  scale, vertical/horizontal root motion ranges, and recommendation ids such
  as `relative-ok` or `consider-scale-to-model`
- [x] Target rig bind metrics in the normalization audit: measured retarget
  skeleton bounds, skeleton height, hand span, foot spread, and
  pelvis-to-foot height
- [x] Source rest metrics from VRMA humanoid nodes: Motion IR now records
  source skeleton bounds, skeleton height, hand span, foot spread, and
  source-to-target scale / pose warnings
- [x] Pose mismatch scoring expanded beyond foot spacing: shoulder width,
  upper-leg spread, and arm rest angle are measured and pinned in the external
  VRMA gold fixture
- [x] Smoke-report comparison for root normalization candidates:
  `compare-motion-quality-reports.mjs` classifies metric deltas as improved,
  regressed, stable, or tradeoff
- [x] Normalization candidate planner: smoke reports now expose runnable root
  candidates and pose candidates; `plan-motion-normalization-candidates`
  emits run/compare commands and comparison can fail on tradeoff
- [x] Experimental arm rest pose pre-normalization:
  `--pose-normalization arm-rest-offset` computes source-to-target upper/lower
  arm rest offsets and emits them in the audit
- [x] Motion-aware arm rest gate:
  arm-rest candidates now require at least 60deg of upper-arm rotation evidence;
  `Goodbye` remains runnable, while `LookAround` and `Jump` are blocked as
  `needs-motion-evidence`
- [x] Experimental stance width pose pre-normalization:
  `--pose-normalization stance-width-offset` computes lower-body rest-vector
  offsets for upper legs, lower legs, and feet. The adapter is runnable for
  `foot-spread-mismatch` / `leg-spread-mismatch`, records lateral-axis sign
  adjustment in the audit, and remains non-automatic until candidate
  comparisons justify changing defaults.
- [x] Candidate selection summary:
  `select-motion-normalization-candidates.mjs` groups runnable candidate
  comparisons and emits accepted/rejected/neutral/missing recommendations so
  the loop can reject mixed candidates without a manual read-through
- [x] Candidate promotion policy:
  non-automatic candidates become `promotable` only when repeated comparisons
  have at least 3 compared samples, at least 2 improvements, and no
  regressions, tradeoffs, or missing comparisons. This gives the autonomous
  loop a deterministic bridge between "runnable experiment" and "change the
  default".
- [x] MoonBit core slice:
  `motion-core` ports the arm-rest motion gate, root-translation
  recommendation/candidate selection, pose mismatch warning-id selection, and
  pose normalization candidate spec selection, plus candidate-group selection
  recommendation into tested MoonBit pure functions. `motion-core-cli` exposes
  the same decisions as a generated JS command surface. The JS orchestration
  tools now call `motion-core-runtime` for those decisions while still owning
  GLB/JSON I/O; audit-facing severity/reason text stays in explicit JS detail
  maps keyed by the MoonBit ids/specs. The runtime exposes categorized
  `motionCorePolicy.root`, `.pose`, `.selection`, `.retarget`, `.quality`, and
  `.kaguraRuntime` APIs so new orchestration code does not need to infer policy
  ownership from individual function names.
  `check-motion-core-parity` verifies the generated JS CLI decisions for the
  current policy fixtures
- [x] Named `robot-voxel` retarget profile for voxel robot smoke: skipped
  fingers, toes, chest, neck, and shoulders are tolerated with zero penalty,
  while skipped core bones fail the weighted profile
- [x] External VRMA smoke supports `--min-quality pass|warn|fail`, so CI-style
  loops can fail on `warn` while still preserving the quality summary in the
  report
- [x] Motion quality report tracks `left_foot` / `right_foot` bind-vs-animated
  deltas and emits a `foot-contact` check for sinking or always-floating motion
- [x] Motion quality report tracks pelvis, hand, and foot displacement from
  bind pose and emits a `limb-extent` check for outlier motion
- [x] External VRMA quality gold fixture captures realistic ranges for
  `LookAround`, `Goodbye`, and `Jump`; `verify-motion-quality-gold.mjs`
  checks smoke reports against it
- [x] Cheap multi-VLM review scaffold with dry-run contact sheet + strict JSON
  prompt for UI-TARS / Nova Lite
- [x] Kagura handoff pre-runtime smoke:
  `kaguraHandoff` records GLB path, world scale, origin, axes, fixed camera
  views, animation clip ids, and snapshot verification path. `pnpm run
  motion:kagura-handoff:game-assets` validates all local handoff contracts and
  writes structured `*.kagura-smoke.json` reports.
- [x] Published Kagura Moon package bridge:
  `design-runs/game-assets-20260520` depends on `mizchi/kagura@0.3.5`, and
  `motion-kagura-bridge` imports the root package facade without a sibling
  checkout. This caught and fixed a Kagura API gap where consumers needed
  root-level fixed-timestep constructors/accessors rather than direct
  `kagura_core` imports.
- [x] Experimental Kagura runtime smoke probe:
  `run-kagura-runtime-smoke.mjs` starts local `mizchi/kagura` `gltf_viewer`,
  serves a vlmkit GLB through a CORS asset server, opens it with Playwright, and
  reports runtime load/frame status. After the Kagura WebGPU readback fix, the
  robot handoff passes load, frame-signal, and frame-substance checks
  (`webgpu-readback`, `visiblePixelRatio` around 0.64). The probe still keeps
  frame-signal separate from frame-substance so submitted-but-empty frames stay
  diagnosable. `--calibration-contract` can run a known-good Kagura asset in the
  same report and marks `environmentLikelyBroken` when both sides fail. The
  report now includes `outcome.status`, and
  `--allow-environment-failure` lets CI/autonomous loops soft-pass a target +
  calibration double-fail as an environment block while still failing real
  asset-only failures. Clip playback remains pending viewer support.
- [x] Kagura runtime batch smoke:
  `pnpm run motion:kagura-runtime:game-assets` runs the runtime load/frame
  smoke against all local handoff contracts, writes local-only
  `*.kagura-runtime-smoke.json` reports, and summarizes pass /
  environment-failed / asset-failed / target-failed counts. Current local
  batch status is 3/3 pass. The batch also writes a local-only summary JSON with
  per-asset outcome, frame source, visible-pixel ratio, warning count, and
  failure count for autonomous follow-up decisions.
- [x] Game-asset motion dogfood smoke:
  `pnpm run motion:core-smoke:game-assets` exercises the single
  `design-runs` game-asset motion helper against real robot fixtures:
  FBX/Mixamo adapter decision, VRMA/GLB/Motion IR adapter decisions, Motion IR
  retarget verification, GLB clip-pose sampling, and clip/pose playback gates.
  Current local status is pass with `vrma_alert_wave`, 2 verified clips, 6
  sampled nodes, and `posePlayback=verified`.

Stepwise cleanup:

- [x] **G1. Batch external VRMA smoke.** Add a command that runs all or a
  selected list of `.vrma` samples through fetch -> extract -> verify IR ->
  apply -> verify GLB -> render -> verify renders. Report per sample:
  retained track count, skipped channel count, render status, duration,
  loop/one-shot, and failure reason.
- [x] **G2. Automated motion quality gate.** Replace ad hoc human visual
  review with metrics computed from the rendered frames, animation samples,
  and model bounds. Start with:
  - frame nonblank / finite bounds / foreground ratio
  - on-screen coverage and camera-fit margin
  - per-frame bbox jump and root drift
  - foot/ground penetration and floating distance
  - limb extent outliers compared with bind-pose bounds
  - retained-vs-skipped channel ratio by skeleton region
  - one-shot/loop metadata consistency
  Emit a compact report with `pass` / `warn` / `fail` and only require human
  review for threshold calibration. Initial implementation exists in
  `verify-motion-quality.mjs`; it now uses normalized `groundDeltaY` when
  render metadata provides bind bounds, checks tracked foot contact, and checks
  pelvis/hand/foot displacement from bind pose. Its threshold verdicts
  (foreground, coverage, bbox jump, ground, foot contact, limb extent, loop
  metadata, and summary verdict) now delegate to MoonBit
  `motionCorePolicy.quality`. First gold calibration set exists for
  `LookAround`, `Goodbye`, and `Jump`. The gold verifier now checks the exact
  calibrated sample set as well as per-sample metric ranges, so new or missing
  samples fail mechanically before threshold drift can hide behind visual
  review. Future work is adding more gold fixtures and target rigs under the
  same gate.
- [x] **G3. Cheap multi-VLM review gate.** Add optional model reviewers as a
  second opinion on top of deterministic metrics. Default candidates:
  `bytedance/ui-tars-1.5-7b` for fast UI/game-image review via OpenRouter and
  `amazon/nova-lite-v1` / `amazon.nova-lite-v1:0` as the stable cheap Nova
  path through OpenRouter or Bedrock. The reviewer receives a contact sheet,
  render metadata, Motion IR warnings, and asset contract excerpts, then emits
  strict JSON: `verdict`, `defects[]`, `confidence`, `model`, `costUsd`,
  `latencyMs`, and `evidenceFrameIds[]`. Consensus policy:
  - deterministic `fail` always fails
  - deterministic `pass` plus VLM `pass` passes
  - deterministic `pass` plus VLM `warn/fail` becomes `warn`, not hard fail
  - model disagreement triggers a second cheap reviewer before escalation
  Keep VLM review disabled when credentials are absent, and never require a
  human unless both deterministic metrics and reviewer consensus are
  inconclusive. Initial implementation exists as a dry-run-safe OpenRouter
  contact-sheet reviewer; Bedrock-native Nova can be added later if needed.
- [x] **G4. Retarget downgrade policy.** Formalize per-target skeleton
  profiles. For `robot-voxel`, define required bones, optional bones,
  ignored fine-grained bones, fallback mappings (`chest`/`neck`/shoulders),
  and whether skipped fingers/toes are acceptable. The policy must produce a
  deterministic score so agents can decide whether to continue, retry, or fail.
  First pass exists as `--retarget-profile robot-voxel`: fingers, toes,
  chest, neck, and shoulders are tolerated; skipped core channels such as
  hips/head/arms/legs fail. The profile schema is now machine-checkable via
  `motion:retarget-profiles:game-assets`, and the motion quality gate validates
  profile definitions before scoring. The `strict` retained-ratio verdict and
  `robot-voxel` rule id / score / verdict decisions are now MoonBit
  `motion-core` functions exposed through `motionCorePolicy.retarget`; JS still
  owns schema descriptions and report shaping. `simple-rig` remains an alias.
  `motions/retarget-profile-calibration.json` now pins synthetic downgrade
  cases for tolerated fine-detail skips, unexpected soft penalties, skipped core
  hard failures, and the `simple-rig` alias. Remaining promotion work belongs
  to G9 once more target skeletons exist.
- [x] **G5. Pose and scale normalization.** Measure source root height,
  root motion, and bind/rest orientation. Add options for root translation
  modes: keep, zero, horizontal-only, scale-to-model. Track T-pose/A-pose
  mismatch as a warning. Prefer automatic normalization with a written audit
  trail over asking for manual pose judgment. First pass exists in
  `apply-motion-ir.mjs`; external VRMA smoke defaults to relative root motion.
  `--audit-out` now records source root height, target base height, delta
  ranges, normalized ranges, scale, and a source/target height scaling
  recommendation. It also records target rig bind metrics from retargeted node
  world positions. `compare-motion-quality-reports.mjs` can compare a
  recommended candidate mode against the baseline smoke report. Source rest
  metrics and an initial `foot-spread-mismatch` pose warning now exist.
  Pose mismatch scoring now covers shoulder width, upper-leg spread, foot
  spread, and arm-down angle. Arm-rest and stance-width warnings now trigger
  runnable pre-normalization candidates, and repeated comparison results now
  produce deterministic `accepted` / `promotable` / `rejected` selection
  decisions. Per-metric comparison status and candidate sample decisions in
  `compare-motion-quality-reports.mjs` now delegate to MoonBit
  `motionCorePolicy.quality`, so the empirical loop has the same generated JS
  policy boundary as candidate-group promotion. Candidate selection now emits a
  default-change `readiness` layer: current data has no ready default changes,
  and candidates stay blocked on missing / insufficient clean comparisons
  instead of relying on manual judgment before changing defaults.
- [x] **G6. VRM + VRMA real playback check.** Use a real VRM model with a
  matching VRMA file to verify that our extractor agrees with an expected
  runtime playback path before retargeting onto simplified generated assets.
  Compare extracted transform coverage and render metadata automatically; keep
  manual playback viewing as a debugging fallback only. First implementation is the
  pre-runtime playback contract checker:
  `verify-vrm-vrma-playback-contract.mjs` validates VRM 1.0 `VRMC_vrm` and VRM
  0.x `VRM` humanoid mappings, VRMA humanoid mappings, extracted humanoid
  Motion IR metadata, required clips / required bone tracks, and optional render
  verification. It passes against the downloaded tk256ailab
  `VRM/sample.vrm` + `VRMA/LookAround.vrma` pair. Runtime clip exposure now
  belongs to G7/Kagura; sampled transform comparison is still a deeper runtime
  check.
- [x] **G7. Kagura integration smoke.** Define the `mizchi/kagura` handoff:
  GLB path, animation clip ids, scale/origin convention, fixed camera
  snapshots, and a minimal runtime load/play smoke test. The gate should be
  CLI-runnable in CI and return structured JSON. First pass exists as a
  pre-runtime contract smoke: it validates the GLB path, clip ids, axes,
  scale/origin convention, fixed camera snapshots, and checked render reports.
  The runtime probe now loads the robot GLB through Kagura `gltf_viewer` and
  passes load/frame-substance checks via WebGPU readback. Batch runtime smoke
  now covers all local handoff contracts. Target/calibration outcome
  classification and `--allow-environment-failure` process-fail policy now
  delegate to MoonBit `motionCorePolicy.kaguraRuntime`. Runtime reports now
  include structured `runtime.clipPlayback` status and batch summaries include
  requested/playable/missing clip counts. Local Kagura `gltf_viewer` now
  extracts non-skinned node animation clips, publishes
  `globalThis.__kaguraRuntimeClipPlayback`, and verifies the robot handoff as
  `playedClip=walk_cycle` with all requested clips playable. It also publishes
  node transform snapshots; vlmkit samples the same GLB clip at the reported
  time and verifies `runtime.posePlayback` against Kagura's transforms
  (`maxDelta` around 0.000004 locally). A roundtrip GLB handoff now acts as the
  known-good runtime calibration contract, and
  `motion:kagura-runtime-calibrated:game-assets` runs targets with that
  calibration so environment failures and asset failures stay separable.
- [x] **G8. Mixamo / FBX adapter decision.** FBX/Mixamo is now treated as
  `requires-conversion`: convert to GLB with an external tool such as Blender
  or FBX2glTF, then run the same GLB -> Motion IR extraction path. Direct FBX
  parsing stays out of reusable core because FBX is tool-version dependent; the
  dogfood helper records this through
  `decideMotionSourceAdapter(...).strategy === "convert-to-glb-first"`.
- [x] **G9. Avoid TypeScript double maintenance.** The temporary
  `@mizchi/vlmkit-core` TypeScript game-asset motion API was removed. Until
  this surface is worth a MoonBit package boundary, the single owner is
  `tools/game-asset-motion-core.mjs`: Motion IR schema/retarget verification,
  FBX/GLB/VRMA source adapter decisions, GLB clip-pose sampling, and Kagura
  runtime clip/pose gates. `verify-motion-ir.mjs`,
  `kagura-runtime-smoke-utils.mjs`, and the dogfood smoke delegate to that one
  module. MoonBit continues to own policy decisions; JS keeps renderer/browser
  orchestration and file I/O.

### Markup MoonBit migration

- [x] First markup policy slice:
  `packages/vlmkit-markup/markup-core` now owns the pure
  `component-goal` pass / review / fail policy and app-shell / landing /
  canvas / expressive-menu gates. TypeScript keeps the public
  `evaluateComponentGoal()` API, threshold profile metadata, and
  human-readable summaries, but delegates the status decision through
  `markup-core-cli`.
  `pnpm moon:test:markup` checks the MoonBit package and CLI surface, and the
  existing `component-goal` Node tests dogfood the bridge.
- [x] Component contract-plan policy slice:
  `component-contract-plan` now delegates probe-state validation, stable
  state merging, required-state extraction, and scroll-target source selection
  to `markup-core`. TypeScript still owns UI Contract JSON object traversal,
  validation loading, and carrying the original scrollport/canvas objects into
  the runner.
- [x] UI Contract pattern evidence validator slice:
  `contract/ui-contract.ts` now delegates pattern-specific evidence issue id
  selection for landing, app-shell, canvas, and expressive-menu contracts to
  `markup-core`. TypeScript still owns JSON traversal, issue paths, and
  human-readable messages.
- [x] UI Contract layout validator slice:
  `contract/ui-contract.ts` now delegates width / height / grid-display issue
  id selection to `markup-core`. TypeScript still owns schema types and maps
  the returned ids back to nested issue paths.
- [x] UI Contract state / scrollport validator slice:
  `contract/ui-contract.ts` now delegates state kind / target / minChangeRatio
  issue ids and expected-scrollport axis / target / minOverflow issue ids to
  `markup-core`. TypeScript still owns array traversal, duplicate tracking, and
  mapping the returned ids back to nested issue paths.
- [x] UI Contract marker validator slice:
  `contract/ui-contract.ts` now delegates marker kind and required marker target
  issue ids to `markup-core`. TypeScript still owns marker array traversal and
  maps ids back to nested issue paths and human-readable messages.
- [x] UI Contract optional range validator slice:
  repeat/content min/max range predicates now delegate to `markup-core`.
  TypeScript still owns the contextual path mapping, so the same range policy
  can be reused across repeat metadata and content metadata without leaking
  report wording into MoonBit.
- [x] UI Contract metadata presence validator slice:
  slot ids, asset ids, and canvas stateHook/input/HUD presence predicates now
  delegate to `markup-core`. TypeScript still owns nested array traversal and
  maps each returned id to the existing report path/message.
- [x] UI Contract composition validator slice:
  composition style/axis, layer role/z/id uniqueness, shape kind/id
  uniqueness, motion trigger/effect/duration/id uniqueness, and contrast
  mode/minRatio predicates now delegate to `markup-core`. TypeScript still owns
  array traversal, duplicate tracking inputs, and mapping
  issue ids to report paths/messages.
- [x] UI Contract decoration validator slice:
  decoration typography role/size/lineHeight, palette role/value hex, and media
  slot predicates now delegate to `markup-core`. TypeScript still owns
  decoration array traversal and report path/message mapping.
- [x] UI Contract remaining scalar validator slice:
  content exact/rowCount non-negative checks and composition contrast palette
  hex checks now delegate to `markup-core`. TypeScript keeps the schema shape
  and nested path/message mapping.
- [x] UI Contract boundary hardening:
  contract version, screen id/pattern/goal/source, viewport label/size/dpr,
  landmark id/role/name/parent, and responsive viewport predicates now delegate
  to `markup-core`. TypeScript still owns traversal, duplicate/parent/viewport
  lookup materialization, and path/message mapping.
- [x] Semantic drilldown selection policy slice:
  `component/semantic-drilldown.ts` now delegates layout-vs-decoration flow,
  priority scoring, reason id selection, and next-action ordering to
  `markup-core`. TypeScript still owns DOM/landmark capture, overlap scoring,
  heatmap kind extraction, and report text formatting.
- [x] Add markup-core parity fixtures:
  `fixtures/markup-core/parity.json` now pins representative app-shell,
  landing, canvas, expressive-menu, and responsive-stretch cases.
  `src/markup-core-parity.test.ts` checks the same matrix through both the TS
  bridge and the generated MoonBit CLI, leaving a direct JS/WASM binding target
  for the next migration step.
- [x] Avoid per-call process cost:
  `markup-core-api` now exports a direct generated JS dispatcher used by the TS
  bridge before falling back to the CLI. The process-local memoization remains
  for repeated pure calls, but normal component scoring and UI contract
  validation no longer spawn per call.

### Spec coverage
- [x] Heading hierarchy validation:
  introspection now emits a low-cost `heading-hierarchy` invariant when a page
  has headings, and `verifySpec` fails skipped levels such as `h1 -> h3`.
- [x] ARIA relationship validation:
  a11y snapshots can carry `id`, `attributes`, or camelCase ARIA reference
  fields, and `verifySpec` now fails unresolved `aria-labelledby`,
  `aria-describedby`, `aria-controls`, `aria-owns`, `aria-details`, and
  `aria-activedescendant` targets.
- [x] Color contrast invariants:
  `*.contrast.json` sidecars now generate a low-cost `color-contrast`
  invariant. `verifySpec` accepts either precomputed contrast failures or raw
  foreground/background samples and checks WCAG AA thresholds locally.
- [x] Responsive layout invariants:
  `*.responsive.json` sidecars now generate a low-cost `responsive-layout`
  invariant. `verifySpec` accepts responsive snapshots/findings and detects
  horizontal overflow, viewport-boundary escapes, and min/max width violations.

### Dashboard (separate repo)
- [ ] Execution result list/search
- [ ] Visual diff display (heatmap, side-by-side, overlay)
- [ ] Interactive approval operations
- [ ] Detection rate time-series graph
- [ ] Component-level status matrix
