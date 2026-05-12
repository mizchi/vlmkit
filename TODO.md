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
- [ ] DOM / a11y-tree equivalence pre-flight in `migration-compare`.
  Catch "you accidentally changed the HTML" failures (which currently
  show up as opaque layout-shift) before screenshots are taken.
- [ ] Per-region shift detection — extend the existing `globalShift`
  (single pixel offset for the whole frame) to per-element bounding
  boxes so heatmap red-smears can be localized as
  "`.luna-panel-head padding too small, shifts following 4 elements
  down by 12px"`.
- [ ] `vrt compare-runs <a.json> <b.json>` — pairwise migration-report
  diff. "Viewport X went from 41% → 0%, dominant category
  layout-shift → none" validates that the patch did what the agent
  expected.
- [ ] Computed-style channel in `migration-compare`. Already exists in
  `css-challenge-bench`; lifting it surfaces semantically-different
  CSS that pixel-matches (e.g. `> * + * { margin-top }` vs `flex
  column + gap`).
- [ ] Stricter fix-candidate ranking. Today
  `10× .luna-actions { display }` is emitted even when the agent's
  CSS already has the right `display:` and the actual delta is
  `gap`/`flex-wrap`. Collapse the candidate label to the *changed*
  property, not the most-mentioned selector.

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
