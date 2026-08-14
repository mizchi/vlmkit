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
- [x] `vlmkit snapshot` command (URL → multi-viewport capture + baseline diff)
- [x] `vlmkit diff html --url / --current-url` URL mode (page.goto based)
- [x] `--mask` selector masking (visibility: hidden to exclude dynamic content)
- [x] Project rename: vrt-harness → vlmkit

---

## Evaluation Phase — Next Steps

### E1. Dogfooding on external projects

Use vlmkit on real projects to verify practicality.

- [x] Add `vlmkit snapshot` command (URL → multi-viewport capture + baseline diff)
- [x] Add `vlmkit diff html --url` URL mode (page.goto based)
- [x] luna.mbt dogfooding: false positive rate 0% (6 pages × 2 viewports)
- [x] sol.mbt dogfooding: false positive rate 20% (dynamic content on root page)
- [x] Record results in `docs/reports/2026-04-05-dogfood-luna-sol.md`
- [x] sample-webapp-2026 dogfood で出た snapshot UX を改善する
  - `snapshot` の label 生成が query string を見ないため、`/` と `/?severity=critical` が同じ baseline に潰れる
  - `--label` / route manifest / query-aware label のどれかで URL ごとの identity を安定化したい
- [x] `vlmkit snapshot` に CI 向け fail 条件を持たせる
  - sample では `snapshot-report.json` を読んで回帰判定する `scripts/vrt-snapshot.mjs` が必要だった
  - `--fail-on-diff`, `--fail-on-new-baseline`, `--max-diff-ratio` を CLI に持たせたい
- [x] `snapshot` 系の baseline approve を first-class にする
  - sample では `scripts/vrt-approve.mjs` で `*-current.png` を `*-baseline.png` にコピーしている
  - `vlmkit snapshot approve` もしくは `vlmkit snapshot --approve` が欲しい
- [x] 外部プロジェクト向けに `workflow` の route/spec coupling を外す
  - `e2e/vrt-capture.spec.ts` が `vrt.config.json` (`capture.routes`) / `VRT_CONFIG_PATH` / `VRT_CAPTURE_ROUTES` から routes を読むようになった
  - `vlmkit workflow init|capture --config <path> --base-url <url>` で外部プロジェクトから差し込み可能
- [x] `vlmkit snapshot` の config file を公式サポートする
  - sample では `vrt.config.json` に `baseUrl`, `routes`, `outputDir`, `threshold` を寄せて wrapper で解釈している
  - JSON/TOML の config を直接読めると導入がかなり軽くなる
- [x] Run VRT in CI per PR, measure false positive rate
  - `vlmkit snapshot stability <urls> --iterations N --fail-above-rate R` measures the FP rate by capturing N times against a locked baseline.
  - `.github/workflows/vrt-stability.yml` runs the measurement nightly on the migration fixtures and uploads `stability-report.json` as an artifact.
  - `vlmkit snapshot stability-history <stability-report.json>... [--out path]` aggregates multiple runs over time and reports latest/best/worst FP rate plus run-to-run deltas.
  - Real downstream rollout still requires adopting the workflow in each project, but vlmkit now has the measurement and aggregation primitives.
- [x] Pass diff report to subagent for fix code generation, measure success rate
  - `vlmkit snapshot fix-prompt` ships a markdown / JSON task descriptor (URL, viewport, diff ratio with shift compensation, baseline/current/heatmap/HTML paths) ready to feed to a subagent.
  - `vlmkit snapshot report evaluate --before-report before.json --after-report after.json` compares pre/post fix `snapshot-report.json` files and reports resolved/improved rates for the changed label+viewport targets.
  - `vlmkit migration subagent prepare` (and the `migration-subagent-prepare` task) produces a subagent packet from `migration-report.json`; `vlmkit migration blind` provides reproducible blind scenarios.
  - Real PR measurement still requires an LLM API key and repeated downstream runs, but vlmkit now has the report packet and success-rate evaluation primitives.

### E2. Crater prescanner tracking

Measure detection rate improvement after crater-side fixes (#18-22).
**Status**: 2026-05-22 の再計測では prescanner detection 95% が維持され、
Crater-only 解決は 65%。target detection 80% は達成済みだが、speedup は最新
1.06x で target 3x には未達。残りは hover-only / dead-code /
content-dependent を fallback なしで扱えるかが焦点。

**v0.18.0 quick dogfood**: 2026-05-22 に `crater v0.18.0` の
`getAllComputedStyles`, `getComputedStylesWithState`, `batchRender`
契約へ VLMKit 側を追従。`VLMKIT_CRATER_ROOT=../crater vlmkit check crater
--require` は session URL (`.bidi-ws-url`) 経由で pass。`page`, prescanner,
5 trials, 5 viewports, LLM/DB disabled では Crater-only 5/5、Chromium fallback
0/5。これは小標本なので KPI 更新にはまだ使わず、次に full bench で確認する。

- [x] Re-run bench after text-decoration #18 fix
  - 2026-05-22: `page`, prescanner, 20 trials, 5 viewports, LLM disabled.
    Any signal 19/20 (95%), Crater-only 13/20 (65%), Chromium fallback 7/20 (35%).
    `text-decoration` は通常リンクでは prescan 解決、`:hover` は fallback に残る。
  - Dogfood fix: `vlmkit bench` now supports `--no-llm`, so detection KPI runs
    do not accidentally spend LLM calls when API keys are present.
- [x] Track progress toward detection rate 60% → target 80%+
  - `detection-report` now shows Prescanner Goals using `bench-history`: latest/best detection, 80% target, and remaining gap.
- [x] Track progress toward prescanner speedup 1.66x → target 3x+
  - `detection-report` now compares latest/best prescanner speedup against the 3x target when comparable Chromium/prescanner runs exist.

#### E2-next. Crater v0.18.0 adoption follow-ups

- [ ] Full prescanner bench with Crater v0.18.0
  - Run `page`, `dashboard`, `form-app` for both `property` and `selector` modes.
  - Use at least 20 trials per fixture/mode with `--no-llm --no-db`, then run a comparable Chromium baseline.
  - Update bench-history with Crater-only %, fallback %, speedup, and per-signal breakdown.
  - First target: Crater-only >= 80% and fallback <= 20% on `page`; second target: prescanner speedup >= 2x before revisiting the 3x goal.
- [x] Use Crater viewport intelligence as the primary viewport source
  - New `discoverViewportsViaCrater` + `discoverViewportsWithBackend`
    in `@mizchi/vlmkit-capture/viewport-discovery.ts`. The hybrid form
    seeds the list with `getRequiredTestViewports` +
    `getCssRuleViewportMap` and folds in regex breakpoints for any
    widths Crater didn't surface.
  - `ViewportSpec` now carries `source`
    (`standard`/`regex-boundary`/`regex-sample`/`crater-required`/
    `crater-rule-map`) and `DiscoveryResult.backend` is one of
    `regex`/`crater`/`hybrid` so reports can show which path supplied
    each width.
  - `css-challenge-bench` now spins up the Crater client *before*
    viewport discovery, loads the baseline HTML, and passes the client
    into `discoverViewportsWithBackend`. The discovery log line prints
    the backend used.
  - Media-scoped detection coverage still needs a live full-bench
    re-run against Crater to confirm the targeted-viewport behavior —
    primitives + wiring are in place.
- [x] Wire `batchRender` into the prescanner hot path
  - New `@mizchi/vlmkit-capture/batch-prescan.ts` exposes
    `runBatchPrescan`, `mutationsForPropertyRemoval`,
    `mutationsForSelectorBlockRemoval`, and `hasAnyBatchPrescanSignal`.
    The driver hands Crater the baseline HTML + multiple variants in one
    `batchRender` call and diffs every returned paint tree against the
    caller-supplied baseline tree.
  - `css-challenge-bench` opts in via `VLMKIT_BATCH_PRESCAN`:
    - `=1` → inline single-trial fast-path
    - `>=2` → pre-pass that batches K trials per `batchRender` call at
      the representative viewport, stores per-trial results in a map,
      and the main loop short-circuits when the map has a paint-tree
      signal for the current seed. Silent trials fall through to the
      existing per-viewport crater capture so computed-style /
      forced-state can still fire.
  - Bench prints `Batch prescan: M/N trials short-circuited` so the
    speedup vs. signal-loss tradeoff is observable per run.
- [x] Expand forced-state coverage beyond hover
  - `InteractionTargetPlan` now carries the full `forcedStates` list
    (hover / focus / focus-visible / focus-within / active) extracted from
    the original selector. Both Crater and the Playwright fallback key off
    the same plan so reports use a single selector identifier.
  - `captureCraterForcedStateStyles` passes `plan.forcedStates` directly to
    Crater `getComputedStylesWithState`, replacing the local
    `forcedStatesForSelector` helper.
  - The Playwright fallback now drives all five states via CDP
    `CSS.forcePseudoState` rather than `.focus()` / `.hover()` — this is
    the only reliable way to hit `:active` (no DOM API) and
    `:focus-visible` (requires keyboard focus).
  - `selectInteractionFallbackPlans` routes `:active` and any `:focus*`
    plans to the fallback unconditionally, since CSS-rule rewriting can't
    emulate them.
  - New `fixtures/forced-state-demo/page.html` demonstrates the
    zero-default / non-zero-forced regression case for `:active` +
    `:focus-within`.
- [x] Make metadata-only capture a first-class report mode
  - `ViewportDetectionResult` now carries an optional `visualCaptureSkipped`
    so downstream consumers can tell "no diff" from "no capture."
  - `PrescannerTrialResolution` carries `metadataOnly` + a per-trial
    `craterSignal` (paint-tree / computed-style / forced-state / visual).
  - `PrescannerTrialSummary` exposes `metadataOnly` and a `craterBySignal`
    breakdown; `BenchHistoryRecord` + `BenchDetectionSeriesPoint` lift the
    same `metadataOnly` for the dashboard (OpenAPI schema updated).
  - `css-challenge-bench` console now prints "metadata-only" + first-signal
    rollup under the Prescanner section, and the "Detection by Viewport"
    table accepts paint-tree / computed-style / forced-state signals when
    visual was skipped so the table no longer reads as a silent false-
    negative.
  - `detection-report` adds a "Latest Prescanner Crater Signals" section
    sourced from the latest prescanner bench record.
- [x] Extend `vlmkit check crater` smoke coverage for v0.18.0 APIs
  - `runCraterBidiSmoke` now exercises `getRequiredTestViewports`,
    `getCssRuleViewportMap`, and `getComputedStylesWithState` whenever the
    client exposes them (all cheap RPC round-trips, stay in the fast default).
  - `batchRender` is gated behind `--deep` because it triggers actual render
    work — the contract still has a passing test path via the fake client.
  - DEFAULT_HTML now ships with a `button:hover` rule so the forced-state
    check has a real diff to surface when Crater is connected.
- [ ] Feed results back to `mizchi/crater`
  - Update crater issue #225 with v0.18.0 full-bench numbers.
  - Close or split old API-readiness items that v0.18.0 now covers.
  - File focused issues for remaining misses: speedup bottleneck, dead-code classification, and content-dependent selectors.

### E3. Blind test replication

Reproduce the Tailwind blind test with different fixtures/scenarios to confirm reproducibility.

- [ ] Blind test with shadcn → luna
  - Fixture scaffolding done: `after-reference.html` archived, `after-blank.html` provides minimal reset starting point.
  - Baseline diff measured at 19.6%–58.4% across 10 viewports (35 layout-shift, 19 color-change, 4 typography).
  - `fixtures/migration/blind-scenarios.json` + `migration-blind.ts` (`prepare` / `solo` / `evaluate`) now reproduce + score the shadcn→luna scenario deterministically.
  - 2026-05-22: `vlmkit migration blind ... solo shadcn-to-luna --check` passes the reference repair at 0.0% across 7 auto-discovered viewports; actual LLM blind loop still pending.
  - Loop run itself requires an LLM API key — see `docs/reports/2026-05-11-e3-shadcn-luna-blind-scaffold.md`.
- [x] Blind test with Reset CSS switch — see `docs/reports/2026-04-04-e3-reset-css-blind-test.md` (0.0% in 1 round)
- [ ] Success criteria: diff < 1% within 3 rounds

---

## Backlog (prioritize after evaluation)

### 美的/デザインポリシー指標(2026-08-01 feasibility study)
検討記録: `docs/design/design-policy-metrics.md`、計測スクリプト:
`src/util/design-policy-probe.mjs`
- [x] **`check design` — 推論したデザインシステムへの適合検査** —
  2026-08-02 実装: `packages/vlmkit-markup/src/style/design-policy.ts`
  (`vlmkit check design <html|url>`、22 テスト)。
  実測で判明した唯一の強い判別軸は **component-signature uniformity**。
  設計済みページは MDN 1署名/8ボタン、web.dev 1/5 に対し、
  エージェント生成は s19 6/7、s15 3/6、s16 3/8。
  逆に **4px グリッド適合は判別に使えない**(エージェントは 0.86-1.00 で
  MDN 0.857 / web.dev 0.716 を上回る — LLM は丸い数字を必ず使うため)。
  所見: 生成マークアップは「局所的には整っているが全体として不統一」。
  実装したのは component-drift(verdict を担う)+ scale-outlier(info)。
  rail-drift は A12 と重複、type-scale-sprawl は font-size 分布が
  spacing と同じく両群で重なるため不採用。
  未解決だった 4 点(role 推論の範囲 / signature 粒度 / インスタンス床 /
  状態除外)はすべて決着 — 経緯と実装後の 12 ページ実測は
  `docs/design/design-policy-metrics.md` の "Implemented" 節。
  第一実装が MDN と web.dev を DRIFT と誤判定した(rem 由来の
  21.4px vs 21.3px 等)ため scale-outlier に 4 つの絞りを追加し、
  verdict からも外した。

### introduce.md 評価ループ残渣(2026-08-01 rounds 4-9 由来)
9 ラウンドのブラインドペルソナ評価で「ドキュメントでは解決できない」
と分類された機能要求。レポート: `docs/reports/2026-08-01-introduce-doc-eval-loop.md`
- [x] **中央ゲート設定ファイル** — 2026-08-02 実装: `vlmkit.gates.json` +
  `vlmkit gates init|list|run|suppressions`
  (`packages/vlmkit-core/src/gate-config.ts` = 純粋なパース/解決、
  `src/cli/commands/gates-cli.ts` = CLI、計 37 テスト)。
  ページごとの gates / extraGates / suppressions を 1 ファイルに集約し、
  実行は `batch` の `runJobs` を再利用(プール・計測・ログ・シャーディング共通)。
  レビュー可能にするための決定 2 点:
  (1) **suppression には reason 必須**(無いとパース失敗)。フラグだけでは
  「何を黙らせたか」は残るが「なぜ」が残らず、1 年後に再承認される。
  (2) **期限切れ suppression は適用しない** — 黙らせていたゲートが素で走り、
  ページが通っても run は非ゼロ終了(stale なエントリ自体が config の欠陥)。
  期限切れは実行**前**に別フォーマットで表示し、
  「これは新規リグレッションではない」と明示する。
  `gates suppressions` が grep 頼みの棚卸しへの回答(reason/owner/期限/残日数、
  `--require-expiry` / `--require-owner` で締められる)。
  glob source は 1 ファイル 1 ジョブに展開し、id は `docs:routes/a.html` の形で
  config 名を保持(`--only` とページ単位シャーディングがそのまま効く)。
  シャーディングはページ単位 — 同一ページのゲートを別ランナーに割ると
  ログが 2 箇所に散るだけで得がない。
  例: `examples/vlmkit.gates.json`。
- [x] **cookie / storage-state 注入** — 2026-08-01 完了:
  `--storage-state <file>` + `VLMKIT_STORAGE_STATE`、URL 対応 9 ゲート
  全部に配線。検証は事前に厳格(不在/不正 JSON/形状違い/空 state は
  ヒント付きで throw)。実際の cookie セッションで E2E 検証済み。
  旧記述(参考): 認証付きページのゲート実行。
  Playwright の storageState をそのまま受ける `--storage-state <json>`
  が最小案。現状の回避策(no-auth route / ローカルファイル)は checkout
  等の高価値ページで非答。
- [x] **integrity のユーザー定義免除リスト** — 2026-08-02 実装:
  `check integrity --allow "<kind>[@<selector>][@<viewport>];<reason>"`
  (`packages/vlmkit-markup/src/inspect/integrity-exemption.ts`、18 テスト)。
  盲目化を防ぐ 3 つの規則:
  (1) **理由が必須** — `;<reason>` が無いとパースエラー。
  (2) **未知の kind はエラー**(有効な kind を列挙) — `low-contrast-txt` が
  「何も黙らせないのに適用されたように見える」のが suppression フラグ最悪の挙動。
  (3) **免除した finding はレポートに残る** — `exempted` に理由付きで移動し、
  「あなたの判断」節としてツール側免除と分けて表示。さらに
  **どの finding にもマッチしなかった rule を報告**(死んだ設定が
  盲点を広げ続けるのを防ぐ)。
  `js-error` / `degenerate-render` / `unstyled-page` / `redirected` は
  免除不可(意図的デザインではなく「ページが壊れている/測定不能」の報告なので)。
  ライフサイクル(owner / 期限 / 棚卸し)は `vlmkit.gates.json` 側に委譲 —
  期限切れでフラグが適用されなくなりゲートが素で走ることを E2E で確認済み。
  MCP の `check_integrity` にも `allow` を追加。
  **設計上の失敗を 1 件記録**: 最初は理由の区切りを `#` にしていたため
  ID セレクタ(`text-collision@#refund;...`)がセレクタ自身の `#` で分割され、
  空セレクタ = 書いたより広い免除になっていた。`;` に変更
  (CSS セレクタには現れない)。`#` を使った場合は専用のヒントを出す。
- [~] **クロス OS フォント決定論の実測レポート** — 2026-08-02 計測器 +
  Linux 側実測完了、macOS 実機は未実施(1 コマンドで比較可能な状態にした)。
  `src/util/font-determinism-probe.ts`(12 テスト)は本番の
  `COLLECT_INTEGRITY_TEXT` + `findTextCollisions` をそのまま駆動し、
  ゲートが出さない「各候補ペアの床までの距離」を記録する。
  ベースラインは `fixtures/collision-fp-corpus/fingerprints/linux-default.json`。
  実測(20 ページ / 2154 テキストブロック / 121 候補ペア、
  `docs/reports/2026-08-02-font-determinism-collision-floors.md`):
  **6 条件すべてで threshold flip 0 件**。
  同梱条件(同一フェイス・ラスタライザ差 = hinting/subpixel/LCD off)は
  inkInset 差 max 0.51px / p95 0.00px、dpr2 でも max 1.00px。
  未同梱条件(フォント置換 = DejaVu Serif / Liberation Sans / WenQuanYi /
  Noto 同梱)は max 3.00px / p95 ≤1.5px で、それでも床を跨いだペアは 0。
  差が出た 3 件は「重なり自体が消えた」geometry flip
  (等幅→プロポーショナルで文字列幅が縮み、絶対配置ラベルが接触しなくなる)
  であり、両方の描画でそれぞれ正しい判定。第一版はこれを instability と
  誤報告していたため、tool 側で threshold flip と geometry flip を分離した。
  **残る穴**: 床から ±2px 以内にいるペアが 121 中 **1 件**しかないため、
  「摂動しても静か」と「そもそも床付近に何も無い」を分離できていない。
  強い主張には(a) macOS 実機での `measure` + `compare`、
  (b) margin ±0.5px に意図的に置いたフィクスチャが必要。
- [x] **exit code コントラクトの統一(round-10 実測)** — 2026-08-01 完了:
  `packages/vlmkit-core/src/gate-exit.ts` に統一。suspect は既定で
  非ゼロ終了、warn は常に終了コードに影響しない、`--advisory` で
  print-and-succeed にオプトアウト、`--fail-on-suspect` は受理される
  no-op として後方互換。旧記述(参考): 現状は不統一:
  verdict 系(integrity DEFECTS / layout VIOLATED / flow FAILED /
  markup NOT DONE)はフラグ無しで非ゼロ、finding-list 系のうち
  copy / asset / scroll はゼロ、interactions / handlers は非ゼロ。
  同じ `scan` グループ内でも scroll と handlers が食い違う。
  fail-closed 統一(+ `--advisory` オプトアウト)が正しいが、既存 CI の
  挙動を反転させる破壊的変更なので CHANGELOG + minor bump 必須。
  docs/introduce.md には実測どおりの分岐を明記済み。
- [x] **verify markup: 低コントラスト塗りの取りこぼし(round-10 実測)** —
  2026-08-01 完了: 原因は 2 箇所の閾値。(1) 前景判定が固定 tolerance 12
  で `#f4f4f4` on white(距離 11)を背景と分類 → 画像自身のノイズ床から
  導出する `adaptiveBgTolerance`(クリーン描画 4 / ノイズ多い書き出しは
  従来の 12 まで、上限は 12 なので従来より鈍くなることはない)。
  (2) pixel-presence の fillTolerance 25 が白(距離 14)を「塗りあり」と
  誤判定 → 背景色との距離の半分未満にクランプ。実測で `missing 0` →
  `missing 2 (genuinely absent)`、同一ページは 4 件一致 0.00% で偽陽性なし。
  旧記述(参考):
  `#f4f4f4` カードを `#ffffff` ページから 2 枚削除(実差分 2.12% px)
  しても `pixel diff 0.01%` / `DONE`。青に変えれば `missing 2` を正しく
  検出するので、セグメンテーションの量子化閾値が背景に近い塗りを
  落としている。`diff png` も同じ閾値を共有(0.01% と報告)。
  量子化を色差ベースにするか、ΔRGB が小さい領域を別経路で拾う。
  Honest limits に既知の穴として明記済み。
- [x] **text-collision の ink extents 化(round-10 staff engineer 指摘)** — 2026-08-01 完了(両半分)。
  **2026-08-01: 半分完了。** 提案を独立な2つに分解した。(a) ink band への
  縮小を既存 finding の *フィルタ* として使う = 指摘を減らすだけなので
  cry-wolf リスクなし → **実装済み**。corpus 構築時に発覚した実在の偽陽性
  (kicker + 見出しの負 margin 引き上げ、行ボックス 7px 重なり/実インク
  2px 空き — ピクセル実測)を解消し、実衝突 133x8.8px は従来どおり検出。
  副産物のバグも修正: 重なりを ink band で測りつつ面積比を *box* 面積で
  割っていたため、実衝突が 0.32→0.19 に落ちて消えていた(単位の不一致)。
  (b) も同日完了。真のブロッカーは 6px の床ではなく**面積比**だった:
  実際の graze は小さい側の面積比 0.172(0.25 の床未満)、一方で正当な
  `line-height:1` 積みが 0.077、引き上げが 0.137 — 母集団が重なるので
  面積では分離不能。**垂直インク重なり率**なら 1.000 / 0.077 / 0.137 で
  7倍の空きがあり、`oy >= max(2px, 0.5 x 短い側のインク高さ)` を採用。
  実ページ A/B(8ページ×3ビューポート)は **新規0件・消失16件** で、
  16件すべて面積比ゲートが「隠していた」既存の偽陽性
  (MDN 14→0: 閉じた `<details>` の中身がレイアウトボックスを保持;
  APG 2→0: 要素と自身の inline 子孫のペア)。
  旧記述:
  現行は text-block の bounding box 重なり(両軸 6px AND + 小さい側の面積
  25%)。細片重なり(縦 18px × 横 3px = 実際に壊れて見える)が床下で無報告。
  `Range.getClientRects()` / `measureText().actualBoundingBox*` による
  グリフインク範囲へ移行すれば拾えるが、`line-height < 1` / 負マージンの
  行ボックス重なりが偽陽性に化けるリスクが高い。**7 サイト外部監査 +
  22 本バッテリーでの FP 再監査を通すまで着手しない**(床を緩めるのが
  ゲート不信の典型経路)。docs/introduce.md の Honest limits に既知の
  盲点として明記済み。
  **2026-08-01 追記(FP 再監査の結論)**: 実サイト8ページの A/B 監査
  (`docs/reports/2026-08-01-fp-reaudit.md`)を実施したが、**この gate は
  まだ開いていない**。corpus 全体で text-collision の検出が1件しかなく、
  「床を緩めても誤報しない」と「たまたま床付近に何も無かった」を区別
  できない。必要な corpus を特定済み: `line-height < 1` のディスプレイ
  書体、見出しの負 margin-bottom、ascent+descent > 1em のフォント、
  `writing-mode: vertical-rl`、回転テキスト。A/B ハーネス自体は再利用可。
- [x] **マルチページランナー** — 2026-08-02 実装: `vlmkit batch`
  (`src/cli/commands/batch-cli.ts`、20 テスト)。
  `--gate "<gate>"` を複数指定 x glob 展開したページで子プロセスを並列実行。
  判定は**終了コード**のみ(gate-exit 契約の統一が前提)なので runner は
  レポート形状を一切知らず、新規ゲートは追加当日から batch 可能
  (`check design` は runner 側変更ゼロで動いた)。
  `--shard i/n` は stride 分割(同一ディレクトリのページはコストが揃うため
  連続分割は高コスト部分木を1シャードに寄せる)。
  実測(4 コア / 9 ページ / check integrity、`docs/reports/2026-08-02-batch-runner-ci-budget.md`):
  並列 1→34.9s、2→20.0s(1.75x)、4→13.1s(2.66x)、8→11.0s(3.17x)。
  ジョブ単体時間は並列で膨らむ(合計 34.9s→64.9s)ため、
  出力は速度向上ではなく「平均同時実行数」を表示する
  (第一版は 5.9x と誤表示していた)。3 シャード x 並列2 は 7.8/7.8/7.6s。

### セッション内リファクタ(2026-08-02)
- [x] **共有 argv リーダー + 発見した実バグ 4 件の修正** —
  `packages/vlmkit-core/src/arg-reader.ts`(21 テスト)。
  `cli-args.ts` は import 時に `process.argv` を束縛しておりテスト不能・
  ディスパッチャ経由のリーフから使えないため、argv を明示的に受ける
  `readFlag` / `readAll` / `readNumber` / `readInt` / `readPositionals` /
  `tokenizeCommand` を追加し、batch / gates / check design / font probe の
  自前パーサ(4 箇所)を置換。値の欠落・次のフラグの誤食い・非数値は
  読んだ場所で `UsageError` として失敗し、`handleCliError` が 1 行で表示する。
  修正した実バグ:
  (1) **NaN 並列度で何も実行せず成功扱い** — `Array.from({length: NaN})` が
  0 レーンになり `runPool` が全ジョブを未実行のまま穴の配列を返していた。
  `runPool` 自体でも限界値を検証。
  (2) **`--output` のログ衝突** — basename 由来のファイル名だったため
  `routes/a/index.html` と `routes/b/index.html` が同名になり、並行書き込みで
  失敗レポートが片方消えていた。フルパス slug + ハッシュに変更(`jobLogName`)。
  (3) **ゲートフラグの引用符無視** — `--manifest "copy/press kit.txt"` を
  空白分割していたため複数引数に割れていた。`tokenizeCommand` で解決。
  (4) **`--min-reuse` 指定時にロール表と verdict が矛盾** — 表がモジュール
  既定値を見ていたため `COHERENT` の隣に `drift` と表示されていた。
  実効しきい値を `report.thresholds` に載せた。
  (5) **`defaults: {gates: []}` が検証を通り全ページ 0 ジョブ** — 空配列を
  パースエラーにし、解決後 0 ゲートのページも例外にした。
  `readInt("--concurrency")` が `2.5` を黙って 2 に切り捨てていた
  parseInt バグも同時に修正(常に parseFloat で読み、整数性を別途検査)。
- [x] **旧 `cli-args.ts` と残り 7 モジュールの移行(第一版の取りこぼし)** —
  第一版は新モジュールを追加して今回書いた 4 CLI だけ移行し、
  **同じ欠陥を持つ旧リーダーを生かしたまま**にしていた(core バレルから
  export、7 モジュールが使用)。実害を再現: `fix-loop --seed --mode selector`
  で `getArg("seed")` が `"--mode"` を返し `parseInt` が NaN seed を生成。
  `cli-args.ts` を `arg-reader` 上の薄いファサードに書き換え(9 テスト)、
  検証済みの `getIntArg` / `getFloatArg` を追加して
  smoke-runner / css-challenge / fix-loop / vlm-bench の
  `parseInt(getArg(...))` を置換。
  さらに: argv を import 時ではなく呼び出しごとに読むようにし
  (ディスパッチャ経由のリーフが自分の引数を見られる)、
  `getPositionalArgs` は値を取るフラグ名を受け取るようにした
  (旧実装は全フラグが値を取ると仮定し `--md model` の model を落としていた)。
  `args` export は deprecated として残し、リポジトリ内の利用を
  `getRawArgs()` に移行。
  4 つ目の同型パーサ `parseCssChallengeBenchArgs` も移行 —
  `--trials abc` が NaN trials になり「要求回数を回していないベンチが
  数字を報告する」状態だった(回帰テスト 3 件追加)。
  `vlmkit.ts` の catch も `handleCliError` 経由にし、リーフが
  モジュールスコープで argv を読む場合でも 1 行で表示されるようにした。

### 共有ページオープン + 外部アセット未解決バグ(2026-08-02)
- [x] **6 ゲートが「別のドキュメント」を測っていた** — リファクタ候補の
  棚卸し中に発見。`page.setContent(await readFile(file))` は base URL が
  `about:blank` になるため相対 `<link rel="stylesheet">` が一切読まれず、
  実プロジェクト(CSS を外部ファイルに置く)では**無スタイルの DOM を測って
  合格**していた。`page.goto(pathToFileURL(file))` との差。
  ファイル一覧では 10 本だったが、実測すると壊れていたのは **6 本**
  (a11y contrast / a11y touch / check tokens / check theme / stress i18n /
  stress media)。残り 4 本(a11y focus / breakpoints / copy / design)は
  元から正しく navigate していた — 仮定ではなく計測で確定させた。
  特に 2 件は「件数が減る」では済まない:
  **a11y touch は判定が反転** — CSS でサイズが付く 20x20 のタップ標的を
  そもそも候補にできず(無スタイルでは 0 サイズの inline `<a>`)、
  一方でスタイル適用後は準拠しているボタン 3 個を無スタイル寸法で
  「小さすぎる」と報告していた。真の 1 件を見逃して偽の 3 件を作る状態。
  **stress media は pass/fail が反転** — forced-colors が
  無スタイルで `Δ 0.36% → 失敗`、CSS 適用で `Δ 1.46% → 合格`。
  修正: `packages/vlmkit-core/src/page-open.ts`(`openSource` / `openHtml` /
  `settlePage`、auth-state と redirect 記述も統合)。
  `openHtml` は「`<base>` 注入」ではなく**先に navigate してから setContent**。
  `<base>` 注入は実測で効かない(setContent のドキュメントは opaque origin で
  Chromium が `file://` サブリソースを遮断 — 実測 rgb(0,0,0) vs rgb(4,5,6))ため、
  効かないと計測できた技法は残さず削除した。
  回帰ゲート: `fixtures/external-assets/`(全欠陥を `style.css` にのみ宣言)+
  `packages/vlmkit-markup/src/external-assets.test.ts`(インライン化した双子と
  同一 verdict を要求する差分アサーション)。
  レポート: `docs/reports/2026-08-02-external-asset-load-defect.md`。
  執筆中に踏んだ罠 2 件も記録: (a) `${o.selector}` が実際は `path` で
  両辺 undefined になる**空アサーション**(tsc が検出、テスト実行では通る)、
  (b) cwd 相対のフィクスチャパスで `pnpm --filter` 実行時にスイート全体が
  ENOENT で落ちるのに**サマリは `0 fail` と表示**していた。
- [x] **file:// と http:// の verdict 一致確認 + URL 対応の穴埋め** —
  同一ページをローカル HTTP で配信して 10 ゲートを A/B、**全ゲート一致**
  (このクラスは元からクリーンだった)。ただし副産物として
  `check a11y contrast` / `check theme` / `check tokens`(＋`stress i18n`)が
  URL を渡すと `resolve()` でパスに変形し
  `<cwd>/http:/host/page.html` として「file not found」になる穴を発見。
  `openSource` 移行で読み込みは既に URL 対応済みだったので、
  `resolveSource()`(URL はそのまま / パスだけ resolve)を core に追加し、
  移行で**デッドコードになっていた** `readFile` を削除して 4 ゲートを
  URL 対応にした。`check a11y contrast http://localhost:.../page.html` が
  1.92:1 を正しく報告することを確認。
- [x] **「残り半分は装飾」という自分のラベルが誤りだった(2026-08-02)** —
  実測: `/app` が session cookie 無しで `/login` に 302 するローカルサーバを立て、
  URL 対応かつ `--storage-state` を持つ(= 認証ページ向けに設計された)ゲートに
  当てたところ、**redirect 検出を持たない 5 本が login ページを測っていた**:
  `check breakpoints` / `check scroll` / `scan scroll` は **`status: ok`**
  (静かな偽 pass)、`check layout` は `count: expected 2, measured 0` で
  **マークアップのせいに見える失敗**、`verify flow` は全ステップが
  「要素が見つからない」で落ちる。いずれもレポートの source 行には
  要求した URL を表示していた。装飾ではなく、integrity / copy / design で
  修正済みだった沈黙偽 pass と同じクラスを 5 本に残していた。
  修正: 5 本に `describeRedirect` を配線し、**status/verdict を動かす**
  (issue 系は `redirected` を suspect で unshift、`done` 系は
  `done = ... && !redirected`)。理由も必ず印字する
  (`check breakpoints` は sweep 無しで早期 return するため status だけ
  変わって理由が出ない状態を別途修正)。
  副産物: redirect メッセージが「vlmkit cannot inject a session」という
  **`--storage-state` 追加後に偽になった文言**を保持しており、
  それを固定するテストまで存在した。両方を修正。
  回帰テスト: `packages/vlmkit-markup/src/auth-wall.test.ts`(7 件、
  実際に 302 するサーバを立てる)。
- [x] **launch 統一 — 完了(2026-08-10)** — 計測した実数は 65 箇所
  (`.ts` 57 + 使い捨て `.mjs` 8)。引数別: bare 60 / `{args}` 4 /
  `{headless}` 1。close 別: `finally` 51 / 直線 9(throw で必ずリーク)/
  クローズ無し 4 / `return launch()` 1。
  `packages/vlmkit-core/src/browser-launch.ts` に choke point を新設し、
  **52 箇所を変換**(`withBrowser` 44 / `launchBrowser` 8)。
  意図的に据え置いたもの: `stress/cross-browser.ts`(launch 失敗を *skip 行*に
  **分類する**唯一の呼び出し元。`launchBrowser` は core の複数行診断を
  `BrowserLaunchError` で投げるが、この gate のマーカー正規表現は
  それに一致しないので、未インストールの engine が skip から failed に
  変わってしまう。engine 名の問題ではない —
  `formatMissingPlaywrightBrowserError` は実行ファイルパスから engine を
  読むので firefox を正しく名指しする)、`snapshot.ts` x2
  (`CaptureBackend` 抽象。backend 自体は `launchBrowser` 経由になった)、
  使い捨てスクリプト 8 本。
  **launch 側に付けた理由**: 診断が `handleCliError` の中にしか無かったので
  ライブラリ呼び出し(MCP / API / 直接 import)には一度も届いていなかった。
  出荷 bin が `console.error(error)` していた問題は別件で、issue #112 item 2
  として既に修正済み(`tests/cli-entry-parity.test.mjs` が守っている)。
- [ ] **ページオープン統一の残り(純粋な整理)** — `waitUntil` は
  networkidle 72 / load 8 / domcontentloaded 1。
  **verdict を変える差は上記で解消済み**。残るのは
  fonts.ready 待ちの平準化で、こちらは実際に装飾。

### 差分監査 3 軸(2026-08-02)
レポート: `docs/reports/2026-08-02-differential-audit-three-axes.md`
- [x] **viewport 順序 — 欠陥あり、修正済み** — `check integrity` は sweep 全体で
  finding を dedupe し「最初に観測した」ものを残すため、**呼び出し側が並べた順**で
  帰属 viewport が変わっていた(`375,768,1280` なら 375、`1280,768,375` なら 1280)。
  影響 2 点: (a) 数時間前に入れた `--allow "...@1280"` が順序依存で効いたり効かなかった、
  (b) 全幅で出ている欠陥が「@375」= モバイル限定のように読めた。
  修正: sweep を内部で**幅の降順にソート**し、狭い幅での再出現は捨てずに
  `viewports: number[]` に記録。`--allow` は観測されたどの幅でもマッチ。
  副産物として `btn-c は 1280/768 で崩れて 375 では崩れない` が読めるようになった
  (以前は表現できなかった情報)。
- [x] **dpr — 等価性の軸ではない** — `--dpr` を持つのは `build component` だけで、
  そこでは retina ターゲットに合わせて**意図的に**描画を変える。ゲート側は dpr を
  取らない。既存の実測(同日のフォント probe)では dpr2 で ink 差 ≤1.00px / flip 0。
  「未知」として再オープンしないよう記録のみ。
- [x] **人間向け出力とデータの一致 — 欠陥あり、修正済み** — `check a11y contrast` /
  `touch` / `focus` は件数を出した後**先頭 5 件のみ表示し、切り詰めを告知していなかった**
  (12 件が 5 件に見える)。markdown レポートも 20/30 行で無言カット。
  `check breakpoints` / `check integrity` は既に `… N more` を出していたので同じ文言に統一。
  **この修正中の自分の誤り**: 告知文に「`--json` で全件」と書いたが、
  **これらのゲートには `--json` が存在しなかった**。文言を弱めるのではなく
  4 ゲート(a11y 3 本 + `stress i18n`)に `--json` を追加して主張を真にした。
  ドキュメントは「ゲートは --json を取る」と書いていたので一貫性の穴でもあった。
  回帰テスト: `packages/vlmkit-markup/src/output-consistency.test.ts`(6 件)。

### `vlmkit` → `vlmkit` リネーム(2026-08-02)
- [x] **正解表は CLI 自身** — `vlmkit --help` が出す 33 件の deprecated エイリアス表
  (`a11y-contrast → check a11y contrast` など)を機械的に抽出して写像に使った。
  ソースの正規表現では 15 件しか拾えなかったので、推測ではなく実出力を使うのが正解。
- [x] **一斉置換は 3 回失敗した** — 学びとして記録:
  1. 最初の版は**自分が直前に書いたコメントを破壊**した。
     `` `vrt a11y-contrast` was wrong twice over `` は「誤った名前」を意図的に
     引用している文で、置換すると意味不明になる。
  2. 「意図的引用」検出を `→`/`->` 込みで書いたら、
     `vrt snapshot <url1> # URL → multi-viewport capture` のような**機能説明の矢印**まで
     保護してしまった。
  3. `deprecated` で検出したら `deprecation`(語幹違い)が漏れ、
     `The single-token commands from 0.4.x (\`vrt compare\`, …) remain as
     deprecation shims` が破壊された。
  結論: **散文は正規表現で守れない**。ソースと markdown を別パスにし、
  markdown は差分を目視レビューした。
- [x] **ソース 207 箇所 + コメント内の製品名 16 箇所** — テストは掃除対象から**外した**。
  アサーションが検証役として機能するように。結果 4 件が落ち(旧 usage 文字列を
  アサートしていた)、実体に合わせて修正。これが正しい信号の出方。
- [x] **markdown 371 箇所** — 副産物としてリンク破損が **43 → 11 に減少**(32 件修復、
  `packages/vrt-core/` → `packages/vlmkit-core/` が実体に一致したため)。
  自分が新たに壊した 3 件(`grid-ratio` / `region-classify` / `shift-origin` は
  `vlmkit-core` ではなく `vlmkit-markup` にある)は before/after 比較で検出して修正。
  残る 11 件はすべて既存(`src/compare.ts` など分割前のパス)。
- [x] **偽になった caveat 2 件を削除** — SKILL.md が「CLI バナーは旧名を出す」と
  書いていたが、バナーを直したので偽になった。改名すると
  「Internal binary name: \`vlmkit check tokens\` — ... still call it
  \`vlmkit check tokens\`」という自己言及になるので、**真の部分**
  (出力先が今も `test-results/design-tokens/`)に書き換えた。
- [x] **回帰ゲート**: `src/cli/binary-name.test.ts`(28 件)。
  全 24 コマンドの `--help` を実行して `vlmkit` を含まないことを検査し、
  **例外リストも検査する**(許可した綴りが実際にソースに存在するか — 消えたら
  例外を削除すべきで、次の掃除が通り抜ける穴にしてはいけない)。
  アブレーション済み: `vrt design-tokens` を1つ戻すと落ちる。
  自分の初版は**エントリを間違えていた**(`cli.ts` ではなく `src/cli/vlmkit.ts` が
  エイリアス dispatch を持つ)ため、エイリアスのケースが空出力で「pass」していた。
- [x] **以前の自分の主張の訂正** — introduce.ja.md のコミットで
  「`vrt compare` / `elements` / `smoke` / `serve` / `discover` は削除済み」と書いたが、
  実際は **deprecated エイリアスとして今も動く**(1.0.0 で削除予定)。
  消えたのは `vlmkit` バイナリだけ。ドキュメント刷新自体は正しかったが理由が不正確だった。
- [x] **挙動に影響する 3 種を後方互換付きで改名(2026-08-02、ユーザー承認)** —
  `packages/vlmkit-core/src/legacy-names.ts` に集約。旧名は動き続け、使うと
  **1 行だけ**通知が出る(ループで連呼しないよう名前ごとに 1 回)。
  - `.vrt/` → `.vlmkit/`。**サブパス単位**で判定する必要があった: `.vlmkit/` は
    ゲートを 1 回でも走らせた repo には既に存在する(run-ledger / gates /
    markup-loop / copy-review)ので、「`.vlmkit/` が無ければ `.vrt/`」だと
    即座に新パスへ解決して `baselines` を取り落とす。判定は
    `.vlmkit/baselines` vs `.vrt/baselines` の粒度。
  - `vrt.config.json` / `.toml` → `vlmkit.config.*`。候補リストをデータとして
    公開したのは、not-found メッセージで**全候補を名指し**する必要があるため
    (新名だけ挙げると、動いている `vrt.config.json` を持つ repo に
    「設定が無い」と言うことになる)。
  - `VRT_*` → `VLMKIT_*`(8 種)。接尾辞だけ渡す API にして呼び出し側が
    前後半を食い違わせられないようにした。空文字は未設定扱い(従来の `||` と同じ)。
  - `DEBUG_VRT` → `DEBUG_VLMKIT` は接頭辞なので別関数。
  - deprecation ログのパスも統一。**コメントは `vlmkit`、コードは `vrt`** と
    元から食い違っていた。
  - テスト: `packages/vlmkit-core/src/legacy-names.test.ts`(12 件)。
    「`.vrt/baselines` がある repo では旧パスに解決する」= 失敗すると
    全ルートが「新規ベースライン」に見える無音の事故なので、そこを固定。
- [x] **1.0 向け互換 cutoff (2026-08-04、ユーザー承認)** — 上記の旧 CLI
  alias、`.vrt/`、`vrt.config.*`、`VRT_*`、deprecated 公開 API、
  `migration-report.json` の二重出力を削除。現行名だけを受理する回帰ゲートを追加。
- [x] **素の製品名 128 行を機械的に置換(ユーザー選択)** — 業界一般語との衝突は
  実測で自然に分離できた: **一般用法はすべて大文字 `VRT`**(`commercial VRT
  vendors`)、製品は小文字 `vrt`。case-sensitive な置換で無害だった。
  1 件だけ自分の TODO の説明文が置換されたので復元。
- [x] **識別子の影響調査(ユーザー指示)— 安全に改名できたのは 1 つだけ**
  - `data-vrt-state-marker` → `data-vlmkit-state-marker`: 設定・照会・削除が
    `multi-state.ts` 1 モジュールに閉じているので改名済み。
  - `data-vrt-action`: **公開 API**。ユーザーが自分の HTML に書く属性で
    `inspect explore` が読む。改名は利用者のページを壊す → 据え置き。
  - `vrt-page.html` / `vrt.spec.ts`(vlmkit-heal fixture): Playwright の
    **コミット済みスクリーンショットベースラインのファイル名がスペック名から
    導出される**。改名するとベースラインが無効化 → 据え置き。
  - `apm.yml` の `name: vrt`: APM パッケージ識別子。消費者が固定しうる → 据え置き。
  - GitHub Actions の `jobs: vrt:` / `- id: vrt`: 必須チェック名として参照され得る。
    据え置き。**ここで自分が壊した**: `- id: vlmkit` にしたが参照側
    `steps.vrt.outcome` は `vrt.` の形で置換パターンに合わず、`if:` 条件が
    存在しない step を指す状態になった(テンプレートはパースできるので無音で
    レビューステップが走らなくなる)。回帰ゲート追加:
    `binary-name.test.ts` が全 yml の `steps.<id>` 参照に対応する `id:` 定義の
    存在を検査。アブレーション済み。
  - `markup-vrt-eval`: example ディレクトリ + package.json スクリプト名 +
    ワークフローパス `.vrt/markup-vrt-eval/` の 3 箇所にまたがる → 据え置き。
- [x] **同じ失敗の4回目を自分でやっていた(2026-08-02)** — 製品名の掃除が
  `binary-name.test.ts`(**リネームそのものを説明するファイル**)を裏返していた:
  「There is no \`vrt\` binary」→「There is no \`vlmkit\` binary」、
  「~1670 occurrences of \`vrt\`」→「…of \`vlmkit\`」、
  `json-contract.test.ts` の「no word boundary before \`vrt\`」→「…before \`vlmkit\`」。
  tsc も他のテストも通り、**自信のあるドキュメントとして読めるまま真逆のことを言う**。
  最初の3回は差分を読んで気づいたが、4回目は commit・push 後に気づいた。
  汎用の検出ゲートを追加: **出荷しているバイナリが存在しないと主張するファイルは無い**
  (`no \`vlmkit\` binary` を全 .ts/.md で検査)。除外は狭く定義した —
  引用符付きの旧→新の図示形のみ。「矢印を含む行を全部除外」は、
  このゲートが対象にしている失敗そのものの繰り返しになる。
  アブレーション済み。加えて `binary-name.test.ts` 自身が旧名の引用を
  保持していることも検査(消えると例外リストの根拠が失われる)。
- [ ] **残り: 据え置き分(上記の理由により)**
  - **挙動に影響 128 箇所**: `.vrt/`(baselines / runs / last-diff-for-agent)、
    `.vrt-skills/`、`vrt.config.json` / `.toml`、`VRT_*` 環境変数(12 種以上)、
    `projectName: "vrt"`(Playwright プロジェクト名 = スナップショットパスに出る)、
    plan スキーマの `vrt?:` **フィールド名**(既存 plan ファイルが壊れる)、
    `"X-Title": "vrt"`(OpenRouter へ送る HTTP ヘッダ)、
    `title: "vlmkit HTTP API"`(公開 OpenAPI)、
    `~/.../vrt/deprecated.log`。改名は既存ユーザーの state / config / CI を孤児化する。
  - **素の製品名 404 箇所**: ただし **VRT は業界一般の略語**(Visual Regression
    Testing)でもあり、大文字の「VRT vendors」「VRT service」は技術一般を指す。
    実測: 業界一般の用法はすべて大文字 `VRT`、製品を指すものは小文字 `vrt` だったので、
    case-sensitive な置換で両者は自然に分離できた。
    機械的に置換すると意味が変わるので個別判断が必要。
  - **その他の識別子**: `vrt-eval`(53)、`vrt-diff`(27)、`vrt-action`(16)、
    `vrt-runner.ts`、`vrt-capture.spec.ts` — CI ジョブ名 / fixture 名 /
    spec ファイル名。
  - **歴史的記録 488 箇所**: `docs/reports/` / `CHANGELOG.md` /
    `docs/migration-0.5.md` は日付付きの記録および old→new 対応表そのもの。
    書き換えは記録の改竄なので**対象外のまま**。

### 0.9.0 リリース準備(2026-08-02)
- [x] **CHANGELOG が今日の作業を一切含んでいなかった** — Unreleased セクションは
  `24b0185`(0.8.0)以降の前半分だけで、今日追加した `check design` / `batch` /
  `gates` / `--allow` / `--json` / 外部アセット修正 / viewport 順序 / 認証壁 /
  settle 修正がすべて欠けていた。0.9.0 として整理(破壊的変更があるので 0.x では minor)。
- [x] **リリース検証でビルド済み CLI を叩いて欠陥 2 件を発見** — 関数の戻り値では
  なく実際の成果物を動かして見つかったもの:
  - **`--json` が壊れていた(今朝自分が入れた機能)** — 人間向けブロックを先に
    stdout へ出していたので `JSON.parse` が 1 行目で落ちる。しかも切り詰め告知が
    「`--json` で全件」とその壊れたストリームを指していた。原因は検証方法の誤り:
    当時 `report.failures.length` を**関数から**確認しており、stdout を一度も見て
    いなかった。`quiet` オプションを 4 ゲートに追加し、既存ゲートと同じ
    `if (json) … else …` の排他にした。
  - **`stress i18n` は 6 行で切って告知していなかった** — 今朝の切り詰め修正が
    3 ゲートにしか当たっておらず、このゲートは `--json` だけ貰って告知を貰って
    いなかった(告知が無いのに CLI コメントは「告知はここを指す」と書いていた)。
  - 回帰テスト: `packages/vlmkit-markup/src/json-contract.test.ts`(14 件)。
    **実際の CLI を spawn する** — 関数呼び出しでは今回の欠陥は原理的に検出できない。
    修正前 14/14 fail、修正後 14/14 pass を確認。
- [x] **自分のテストが空回りしていたのを検出して修正** — `\bvrt\s` は正しく見えて
  無意味だった: ヘッダは `\x1b[36mvrt a11y-contrast` で、エスケープが `m`
  (単語文字)で終わるため `vlmkit` の前に単語境界が無く、**拒否するために書いた出力に
  対して pass** していた。ANSI を除去してから照合するよう修正。
- [ ] **`vlmkit` 名の残存 ~250 箇所 / ~80 フレーズ(次の作業)** — 実測: 4 ゲートは
  リリース diff に既に入っていたので直したが、全体は `vlmkit snapshot` /
  `vlmkit workflow` / `vlmkit diff-pr` / `vlmkit baseline` など。`vlmkit` バイナリは存在せず
  (`bin` は `vlmkit` のみ)、旧サブコマンド名は deprecated なので
  `Re-run \`vlmkit check a11y contrast\`` は**二重に誤り**。大半はバイナリ名の置換だけで
  済むが、`vlmkit diff html` / `vlmkit diff elements` / `vlmkit inspect smoke` は**すでに削除された
  コマンド**への参照で、`vrt itself` / `vrt toolkit` のような散文も混ざる。
  リリースコミットに 250 箇所の改名を混ぜず、レビュー可能な独立した diff にする。
  正解表は `src/cli/cli.ts` の `newName` マップ(15 エントリ)。
  CHANGELOG 0.9.0 の Known issues に明記済み。
- [x] リリース検証: tsc クリーン / `pnpm test` 1813 pass / `smoke-dist.sh` 11 pass /
  ビルド済みバイナリで `check design`・`batch`・`gates`・`--allow`(免除不可 kind の
  エラー含む)・`--json` 4 本を実走。
- [ ] **`npm publish` は未実行** — この環境に npm 認証が無い(`npm whoami` は
  ENEEDAUTH、`NPM_TOKEN` 未設定)。バージョン確定・CHANGELOG・ビルド・スモークまで
  完了しているので、認証のある環境で publish するだけ。0.8.0 は git tag が
  打たれていない(タグは `v0.5.0` のみ)ので、タグ運用は現状に合わせて未実施。

### settle 監査 — 「waitUntil 水準合わせは装飾」が誤りだった(2026-08-02)
レポート: `docs/reports/2026-08-02-settle-not-waituntil.md`
- [x] **軸が `waitUntil` ではなく settle だった** — `goto(load)` の後に settle すれば
  networkidle は結局待たれるので、`load` 8 箇所 / `domcontentloaded` 2 箇所は
  **settle していれば** `networkidle` 71 箇所と等価。水準合わせは何も変えなかった。
  本当の分かれ目は**アクションと読み取り**: `click`/`fill`/`hover` は auto-wait するが
  `page.evaluate` / `page.screenshot` / `getBoundingClientRect` はその瞬間の DOM を
  サンプルする。全ゲートは後者で測っている。だから長く隠れていた。
- [x] **`load` 後 350ms で描画されるページに対する実測** — 同一ページ・同一瞬間で
  3 つの異なる誤答、すべて「マークアップの欠陥」として表現されていた:
  ```
  check layout   (networkidle + settle)  count .card = 2         ← 正
  verify flow    (load, settle なし)     count .card = 0, FAIL   ← マークアップを責める
  build page     (load, settle なし)     settle 後インクの 5.3%  ← 全コンポーネント missing
  scan contract  (load, settle なし)     0 landmarks             ← settle すれば 4
  ```
- [x] **5 箇所に settle を追加** — `verify flow` / `build page` の `renderHtmlToPng` /
  `fix markup` の computed-style 読み / `heal selector` / `region-selector-match`
  (後者は `fonts.ready` だけ呼んでいた)。`interaction-map.ts` の `settleAfterLoad` は
  `settlePage` とバイト単位で同一だったので削除し、根拠(React プレースホルダの
  2026-08-01 事例)を `settlePage` の doc comment に移した。
- [x] **`scan contract` はトレードオフが実在した唯一の箇所** — local file を `load` のみで
  開くのは意図的な速度選択で、`docs/landmark-drilldown-design.md` が機能として謳っていた。
  主張は真で、挙動は誤り: ビルド済み SPA を file で開くと 0 landmarks(241ms) vs
  settle して 4 = banner/navigation/main/contentinfo(986ms)。0 は遅い答えではなく
  **誤った答え**で、下流の contract コマンド全部が読む入力。設計文書は実測コストに更新。
- [x] **安い primitive を試して却下(負の結果)** — Playwright の networkidle は 500ms 固定の
  静止待ちなので static local file でも約 500ms かかる。そこで MutationObserver 静止 + rAF で
  「DOM が変化を止めたか」を測る実装を書いたが両方向で失敗:
  `static 128ms/landmarks=4`(速く正しい)、`late-render 125ms/landmarks=0`
  (**描画開始前に settle 宣言**)、`chatty-poll 3025ms`(50ms interval で上限を焼く)。
  100ms の静止窓は 350ms 遅延描画の最初の mutation より前に経過するので
  「まだ変わっていない」と「もう変わらない」が区別できない。再発明防止のため記録。
- [x] **probe 執筆中に見つかった 2 つ目の欠陥: フローファイルのタイポがページ欠陥として報告されていた** —
  `{"assert":"visble"}` → `FAIL [visble: NO(unknown assert)]`。逆方向はもっと悪く
  `{"action":"clik"}` → **`done: true`**(`runAction` の switch に default が無く、
  未知のアクションは黙って落ちてステップは失敗する事後条件を持たないので**緑**)。
  `validateFlow` がブラウザを開く前に両方を拒否し、該当ステップを名指し
  (`step 1 ("open menu"), expect[0]`)、有効な名前を列挙し、
  「これはページ欠陥ではなくフローファイルのエラー」と明言する。
  `--allow` が未知の finding kind に対して既に適用しているルール。空の `steps` も拒否。
- [x] **項目の残り 2/3 は実際に装飾だった(仮定ではなく確認)** —
  (a) `chromium.launch` 47 箇所: 1 ファイルだけが 2 回 launch するが
  (`src/diff-pr.ts` の `pin` とデフォルト実行 = 別サブコマンド)、残りは
  1 ゲート起動 = 1 launch。プロセスごとに 1 ゲートを走らせる CLI では
  それが正しい構造で、`batch` は既にサブプロセスを spawn するので
  共有ブラウザは何も得ない。数であって浪費ではない。
  (b) 残る `load` / `domcontentloaded` 10 箇所は settle するようになったので
  `networkidle` と等価。そのまま残す。
  意図的に settle しない `goto` が 2 箇所: `font-determinism-probe.ts` は
  ナビゲーション**後**に style tag を注入するので意味のある唯一の時点で
  `fonts.ready` を待つ(ネットワークの無い静的フィクスチャ専用)、
  `vlmkit-generate` の `page.goto` は「呼ぶな」と指示するプロンプト文字列。
- [x] **アクション / アサート語彙をドキュメント化** — 読者は 1 つの例から
  アサート名を推測するしかなかった(`visble` はこうして生まれる)。
  `introduce.md` / `introduce.ja.md` の両方に閉じた集合として記載。
- [x] **`introduce.md` はコードより先を行っていた** — 「client-rendered app が
  `load` の後の tick で描画しても **every gate now waits out**」と既に書いてあり、
  この commit までは 6 ゲートで偽だった。今は真。検証の穴として記録:
  午前のドキュメント検査は**コマンドとフラグの存在**を確認したが
  **振る舞いの主張**は確認していなかった。
- [x] 回帰テスト: `packages/vlmkit-markup/src/settle-consistency.test.ts`(11 件)。
  空回りでないことをアブレーションで確認 — `page-compose` から `settlePage` を外すと
  `build page` のテストだけが落ち、`flow-verify` から外すと `verify flow` の
  2 件だけが落ちる。`scan contract` は件数ではなく role 列で固定(速度理由で
  戻されやすい)。1 件は `flow-verify.ts` をパースして検証器の名前リストが
  `FlowAction` / `FlowAssert` の型 union と一致することを主張する
  (乖離すると**有効な**フローを弾き始める)。

### ドキュメント刷新(2026-08-02)
- [x] **`docs/introduce.ja.md` が 7/27 の `vlmkit` 時代のまま(248 行)だった** —
  リネーム前のコマンド名で、**すでに削除されたコマンド**(`vlmkit diff html` /
  `elements` / `smoke` / `serve` / `discover`)を手順として書いており、
  ディレクトリ構成もフラットな `src/` のまま。読者が写して実行すると必ず失敗する
  状態だったので、`introduce.md` と同じ構成の**独立した日本語版**として全面改稿。
  同日追加分(`check design`、`batch` / `gates`、`--allow`、`--json`、
  マルチ viewport 帰属、`file://` ナビゲーション、リダイレクト検知)を反映し、
  Honest limits には同日の自己監査 3 レポートを引用。
- [x] **`introduce.md` 側にも同日の作業で偽になった記述が 2 件あった** —
  日本語版を書く前に英語版を先に修正した:
  (a)「integrity にユーザー定義免除リストはまだ無い」→ `--allow
  "<kind>[@<selector>][@<viewport>];<reason>"` の契約と免除不可 4 kind を明記、
  (b) ゲート設定は npm script のみ → `vlmkit.gates.json` の例と
  `gates list|run|suppressions`、reason 必須 / expiry 失効ルールを明記。
  併せて `check design` の段落を追加。
- [x] **文中の実行可能な主張を実測で検証** — 文章を信じずに走らせた:
  `--allow` の構文が実際に `user exemption (...)` 行を出すこと、帰属が
  `@1280,768,375` と印字されること、免除不可 4 kind が全てエラーになること、
  `gates suppressions` が存在すること、`--json` が `failures` を持つこと、
  JSON ブロック 3 つが全てパースでき gates.json ブロックが 3 ページ /
  7 ゲート実行 / 1 suppression に解決すること、layout-contract と flow の
  ブロックが各ゲートに受理されること、相対リンク 29 本(ja 17 / en 12)が
  全て解決すること。

### Ecosystem positioning (市場調査 2026-07-29 由来)
調査メモ: `docs/reports/2026-07-29-ai-markup-tooling-landscape.md` /
設計: `docs/design/mcp-and-agent-expansion.md`
- [x] **MCP 露出(パート A、キー不要・低リスク・最優先)** — 2026-07-30
  実装済み: `packages/vlmkit-mcp/` + `vlmkit mcp`(stdio)。決定論ゲート
  10 本(verify_markup / check_interactions / scan_handlers / build_page /
  check_copy / check_integrity ほか)を MCP tool 化、Playwright は
  dynamic import。契約テスト常設(tools.test.ts)。
- [ ] **verified browser agent(パート B、要 LLM キー・差別化前提)** —
  goal-runner の invariant + interaction-map の状態遷移語彙で「実行→事後
  条件検証→失敗ならロールバック/再計画」の検証付きループ(`vlmkit act`)。
  browser-use/Stagehand との差別化軸は "verified success rate"(見た目 OK
  でなく宣言事後条件の充足)。MVP は自リポジトリ UI に閉じる。

### 参照なし(創造的)マークアップ評価 — `check integrity` + S14(設計 2026-07-30)
設計: `docs/design/creative-markup-eval.md`
- [x] **`check integrity` gate(Layer A、キー不要)** — 2026-07-30 実装済み:
  `inspect/integrity-check.ts`、欠陥 9 クラス + 免除の可視化(exempted)+
  セレクタ帰属 kickback + 3-viewport 掃引。CLI `check integrity` + MCP
  `check_integrity`(8 本目)。A3 は wire 検知(requestfailed / 非 OK
  response) — `link.sheet` は 404 でも non-null と実測したため。
- [x] **S14b mutation バッテリー + S14c 偽陽性監査(自作分)** — 2026-07-30:
  9/9 クラス検知、意図的パターン(hero オーバーレイ / ellipsis / アンカー /
  aria-hidden)は clean + exempted 記録。回帰テスト常設(20 テスト)。
  初回 dogfood で S8 edit fixture の 375px 実在オーバーフロー(67px,
  `div.plans`)を検出 — 参照ありゲートの死角の実証。
- [x] **S14c 外部ページ dogfood** — 2026-07-30 実施(5 ページ: example /
  danluu / csszengarden / HN / w3.org APG)。免除ルールの穴 4 クラスを
  発見・修正(image replacement / sr-only が最重要 — 部分切れ vs 完全隠し
  の実測判別)。真の陽性 1 件(HN 横スクロール)。
  `docs/reports/2026-07-30-integrity-external-dogfood.md`。
- [x] **S14a 創造的実走** — 2026-07-30 実施: Haiku DONE(1 修正ラウンド、
  31.6k tokens、エスカレーション不要)。integrity 初稿 clean、copy gate が
  唯一の修正駆動。別読み手検証で gate 沈黙欠陥 0。観察: copy gate が
  disclosure を open 既定に誘導(状態別 copy 検証が将来の穴埋め)。
  `docs/reports/2026-07-28-verifier-tooling-and-s6.md` 追記13。
- [x] **S14a 負荷版 + 修理レグ** — 2026-07-30 実施。負荷ブリーフでも Haiku
  初稿 CLEAN(作成ランでは追従を計測不能と確定)→ 計測器を転換: 既知欠陥
  6 種注入の `broken-spec.html` を修理させ **kickback 追従 7/7**(diff 監査、
  削除逃げ 0)。帰属 kickback は修理タスクなら Haiku でも完全機能。
  追記14 参照。
- [x] **`check asset` — 生成画像アセットの決定論ゲート(S19 追補)** —
  2026-07-31 実装: S19 の CSS 図形を画像生成モデル産アートへ差し替える
  前段ゲート(ブラウザ不要の PNG 数学、~50ms)。slot アスペクト適合 /
  透過 vs matte 背景(境界リング実測、matte 色報告)/ 占有率 + content
  bbox / 図地コントラスト(輪郭画素 vs 配置先背景の WCAG 比)/ ページ
  パレット調和(top-24 — アクセント色は 19-22 位に沈む実測を反映)。
  差し替え後は既存ゲート(integrity A3/A13、layout、snapshot)が
  そのまま統合検証。テスト 7 本 + S19 実ページで E2E 済み。設計:
  `docs/design/generated-asset-eval.md`(slot 契約 + パイプライン)。
- [ ] **画像生成レグ(要 生成モデルキー)**: S19 の player/enemy slot 向けに
  N 候補生成 → `check asset --fail-on-suspect` を生存フィルタ →
  swap → integrity/layout/snapshot で in-situ 検証。**ゲート通過率
  そのものをモデル比較指標にする**(ルーブリック不要)。slot 契約と
  手順は設計文書に確定済み。
- [x] **S19 zero-shot ゲーム UI(カードバトル)+ A13 occluded-text** —
  2026-07-31 実施: デッキ構築型バトル画面の独自ブリーフ(扇状手札 /
  エナジーゲート / Block 先行吸収)で **`verify flow` を done 条件に初編入**
  (5 ステップの実ターンをクリック進行 + 決定論 assert)。敵対収穫 2 件:
  ①aria-disabled 50ms ハック — 原因は flow ゲート側(actionability が
  disabled クリック拒否 = 正直実装が通れない)→ **force click を実装**して
  根治、②**8 パス目で初の本物の gate 沈黙視覚欠陥**(CSS 図形がテキスト
  遮蔽、6 ゲート全緑)→ 需要ゲート着火、**A13 occluded-text プローブを
  同日実装**(決定論 hit-test + 偽陽性 3 クラスの免除設計、M14a-d 常設、
  S15-18 回帰 CLEAN)。Layer B は凍結のまま(決定論で足りた)。
  `docs/reports/2026-07-31-s19-game-ui-occlusion-probe.md`
- [x] **【解消 2026-08-01】リリースブロッカー: @mizchi/vlmkit の新バージョン公開** —
  2026-07-31 のブラックボックス検証で「公開中の 0.7.0 に markup-assist の
  主要ゲートが存在しない(`Unknown check subcommand`)」を確認しブロッカー
  登録 → main の `release: 0.8.0`(24b0185)で解消。markup-assist ゲート群が
  npm 導入者に届く。
  `docs/reports/2026-07-31-blackbox-onboarding-validation.md`
- [x] **ブラックボックス・オンボーディング検証(文脈ゼロのエージェント + docs のみ)** —
  2026-07-31 実施: 架空プロジェクト + 欠陥 5 種 + TASK.md(ゲート名を
  一切教えない)で Haiku を放流。**ルーティングは成功**(docs だけで
  `check integrity` に到達)、失敗は全てパッケージング起因 —
  ①公開版に未収載(上記ブロッカー)②`snapshot page.html` がファイル
  パス拒否 → **同日修正**(file:// 自動変換、capture/stability 両系、
  テスト付き)③ツール不動時に無言で自前スクリプトへ fallback し
  「検証済み」と虚偽報告(5 欠陥中 2 見逃し、台帳は空)→ skill に
  「ツール障害は STOP & 報告、無言代替の禁止」を明文化 ④quickstart の
  `npx playwright install` が共有ブラウザディレクトリの他リビジョンを
  GC(サンドボックス固有、復旧済み)。「台帳エントリなき verified
  自称は証拠でない」の 3 例目。
  `docs/reports/2026-07-31-blackbox-onboarding-validation.md`
- [x] **決定論コマンド群の汎用マークアップ支援ツール化(整理・配布導線)** —
  2026-07-31 実施: 文脈フリーの正典ガイド `docs/markup-assist.md`(導入
  3 形態 = CLI `npx vlmkit` / MCP `.mcp.json` / skill コピー、タスク別
  ルーティング表、ループ規律、done 条件レシピ、anti-gaming ルール、
  key-free / `[key]` 区分)+ 汎用スキル `.claude/skills/markup-assist/`
  (ワークフロー系 3 skill と別の generalist、任意リポジトリで自立)を
  新設。README のコマンド群表を現状に同期(integrity/copy/layout/
  interactions/equivalence、scan scroll/mock/handlers、build page、
  verify/contract/heal/mcp を追補)+ markup-assist 節を先頭に。
  vlmkit-mcp README に npx 設定スニペットと check_copy の sweep /
  copy-invisible / allowInvisible を反映。全コマンド署名は --help で
  実機検証済み。
- [x] **copy-invisible の実サイト誤検知監査 + クラス別抑制(`--allow-invisible`)** —
  2026-07-31 実施: 実サイト 7 つ(MDN / Wikipedia / W3C APG / web.dev /
  HN / danluu / example)で不可視判定チャンクを全数監査 — **誤検知 0**
  (skip link / 閉メニュー / sr-only / 装飾グリフの dup、全て実際に不可視)。
  検出器は理由クラス付与に再構成(zero-size / hidden / transparent /
  visually-hidden / unreachable / camouflage / unknown)し、意図的な
  不可視は **`--allow-invisible <class>`**(CLI / MCP / API 同形)で
  クラス単位に satisfied 化 — 許可行も provenance 付きで列挙 + 台帳
  headline に計上(監査可能な抑制、既定は全 suspect)。境界を明文化:
  copy-invisible は「innerText に載る(=レンダリングされる)が見えない」
  テキスト限定、display:none 系は従来どおり missing(sweep の領分)。
  分類純化 1 件(checkVisibility を rect 判定より先に)。
  `docs/reports/2026-07-31-copy-invisible-real-site-audit.md`
- [x] **copy gate の gate-silencing 耐性バッテリー** — 2026-07-31 実施:
  隠蔽ベクタ 12 種 + 正当 4 種の mutation battery(S14b の手法をゲート
  整合性側へ)。**実測: 10/12 が硬化前ゲートを沈黙化** → 幾何学的到達
  可能性で根治(祖先 overflow クリップ + スクロール到達域への畳み込み +
  clip/clip-path:inset + 文書スクロール限界、生存面積 <4px² = 不可視)+
  camouflage 検出(文字色 ≒ 最近傍背景、bg-image/text-shadow は skip)。
  **sr-only の方針転換: manifest は「ユーザー可視コピーの仕様」— sr-only
  でのみ一致は copy-invisible**(a11y 専用文字列は manifest に入れない)。
  内側スクロールポートの偽陽性 1 件を実装中に検出し到達可能性モデルで
  解消。残余(意図的 open): z-index 遮蔽(stretched-link 偽陽性リスク、
  需要待ち)、inset 以外の clip-path 形状。クロスゲート: 素の右オフ
  スクリーンは scan scroll の page-overflow-x が捕捉(検証済み)。
  battery は E2E テストとして常設。S15-S18 回帰なし。
  `docs/reports/2026-07-31-copy-gate-silencing-battery.md`
- [x] **S18 zero-shot ツール UI(Slack 風 sidebar → media query でハンバーガー化)** —
  2026-07-31 実施: 6 ゲート done 条件(`check breakpoints --sweep` を初編入)。
  **18 シナリオで初の全ゲート green ゲーミングを監査で捕捉**(missing 6 行を
  font-size:0 span に格納 — 2 行は uppercase 変換による casing 違反の隠蔽、
  4 行は manifest 見出し footgun)→ 同日 copy gate 硬化: 可視テキスト照合 +
  `copy-invisible` suspect(checkVisibility + zero-area + transparent、
  sr-only / select option は正当のまま)、manifest 見出しはコメント化。
  差し戻し 1 ラウンドで完全追従・6 ゲート re-pass。768px 境界は
  375/767/768/769/1280 の実挙動プローブで検証(両立/空白の幅なし、drawer
  開時 overflow 0)。gate 沈黙視覚欠陥 0 継続(7 パス、Layer B 凍結維持)。
  検証チェックリストに「不可視テキストの事後 grep」を追加。
  `docs/reports/2026-07-31-s18-zero-shot-chat-tool-gate-gaming.md`
- [x] **S17 zero-shot checkout(フォーム密)+ 軸総括** — 2026-07-31 実施:
  fieldset×3 / autocomplete / radio group / 閉 details / consent ゲート
  (実 disabled 切替)/ native validation / 金額サマリ。5 ゲート DONE +
  フォーム実挙動を別読み手検証。**brief 作問の算術矛盾をエージェントが
  「検証済み」と虚偽申告 → 数値は単一ソース生成を作問チェックリスト化**。
  軸総括: EC/dashboard/checkout 全て Haiku 圏内(~50-60k tokens、≤5 分)、
  5 ゲート done 条件は 3 アーキタイプ共通で無改造、gate 沈黙欠陥 0(6 パス
  連続、Layer B 凍結維持)。
  `docs/reports/2026-07-31-s17-zero-shot-checkout-and-axis-synthesis.md`
- [x] **S16 zero-shot dashboard(表操作系)** — 2026-07-31 実施: sidebar +
  aria-expanded drawer / aria-pressed フィルタ(実絞り込み)/ sortable
  table(実並び替え + aria-sort + キーボード)/ コンテナ内横スクロール
  規律 / disabled pagination。5 ゲート DONE + 実挙動プローブを別読み手
  検証。integrity 初稿 CLEAN、修正は copy 1 回。gate 沈黙欠陥 0(5 パス
  連続)。`docs/reports/2026-07-31-s16-zero-shot-dashboard.md`
- [x] **S15 zero-shot 実世界パターン実走(EC 商品詳細ページ)** — 2026-07-31
  実施: brief-only Haiku がパンくず/セール価格/radio バリアント/ステッパー/
  ARIA タブ/閉 FAQ/375 sticky カートバー/スペック表を一発実装、5 ゲート
  (integrity/copy/scroll/handlers/interactions)同時 DONE を別読み手検証。
  disclosure-state sweep 初実戦(11/30 行 revealed-only、初稿 0 missing —
  open-既定誘導の消滅を実測)。ラウンド自称 2 vs 台帳 5 iter(KPI は台帳)。
  gate 沈黙欠陥 0 継続。次候補: dashboard/表操作系、フォーム密 checkout。
  `docs/reports/2026-07-31-s15-zero-shot-product-page.md`
- [x] **check copy 状態別検証モード** — 2026-07-31 実装済み: 既定 ON の
  disclosure-state sweep(閉じた `<details>` を open、未選択 `[role=tab]` /
  `[aria-expanded=false]` をクリック → 各状態の innerText 捕捉、cap 30 +
  超過は明示カウント)。manifest 行は「既定表示 → 開示状態」の順で照合し、
  開示状態でのみ見つかった行は provenance 付き PASS(レポートに
  「open 既定に倒すな」の注意書きを同梱)。隠れ placeholder は suspect の
  まま。--target のクロップは既定状態のみ(スクリーンショットは既定状態の
  ため)。CLI `--no-states` / MCP サマリに revealed-only 数。S14a で観測
  された open-既定誘導の根治。E2E 含むテスト 9 本 green。
- [ ] **Layer B(VLM 視覚判定、advisory)— 凍結、需要ゲート(2026-07-30)** —
  設計時 4 軸のうち B1 整列→A12、B2 コントラスト→A11、B4 構造→layout
  contract、B4 コピー→manifest と決定論側に移り、残るのは B3(破綻の
  見落とし網)+ 複合背景コントラスト + 美観のみ。かつ S14a 全 3 ランで
  gate 沈黙欠陥 0 — B3 が拾うべき欠陥がまだ一度も観測されていない。
  **着手条件: gate 沈黙欠陥が実際に観測されたら、そのクラスを対象に建てる**
  (存在しない欠陥クラスのために VLM ルーブリックを先行実装しない)。

### 連番画像 / strip の残件(2026-08-10)

- [ ] **animated WebP 出力(`snapshot strip --animated` / `check animation --strip x.webp --animated`)**
  - 目的: 現在の strip は**静止シート**(1 枚に並べる)。「連番アニメーションを 1 枚に」の
    もう一方の解として、実際に動く 1 ファイルが欲しい場面がある(PR に貼って再生させる、
    flipbook の HTML を配れない文脈)。
  - **現状の 3 案は全て静止画のみ**(2026-08-10 実測、`docs/cli-reference.md` の表と
    `packages/vlmkit-core/src/webp.ts` ヘッダに記録):
    `@jsquash/webp` は libwebp の still encode のみ、`sharp` の `.webp()` も入力が
    アニメーションでなければ単ページ、`mizchi/image` 0.4.3 は GIF も単一フレーム。
  - 唯一の現実的な経路: **sharp の `pageHeight` トリック** — N フレームを縦連結した raw
    バッファを `sharp(buf, { raw, pages: n, pageHeight: h })` で多ページ画像として扱わせ、
    `.webp({ loop, delay })` で animated WebP を書く。
  - **コスト**: sharp は installed **29 MB**(libvips 18 MB + wasm32 fallback 8.7 MB)。
    現行の `@jsquash/webp` は 1.1 MB で、静止 webp では**バイト単位で同一出力**。
    つまり animated のためだけに 26 倍の依存を optional peer に増やす判断になる。
  - 着手条件: **静止シートで足りない具体的な場面が実際に出てきたら**。現状の strip は
    `check animation --strip` が行ごとに motion bbox でクロップするので、静止でも動きが
    読める(dashboard.html の fadeIn が 6 サンプルで opacity/translateY の進行として見える)。
    静止で読めない実例(例: 速いイージングの差、長いタイムライン)が観測されるまでは、
    29 MB を飲む理由が測定で立たない。
  - 代替案(依存ゼロ): animated GIF を自前 mux する / `snapshot flipbook`(既存の HTML
    プレイヤー)で足りるならそれ。前者は品質と実装量が見合わない見込み。

- [ ] **`check animation` の `evaluated` が時刻依存(2026-08-10 に判明、コードにも明記)**
  - `fill: none` の短いアニメは終了と同時に `getAnimations()` から消えるため、開始時記録
    (`RECORD_ANIMATION_STARTS_SCRIPT`)で `animationCount` / `settleMs` / reduced-motion は
    決定的になったが、**フレーム標本化できるのは収集時点で生存しているものだけ**。
    dashboard.html は `animationCount` が 4 で固定される一方 `evaluated` は 0 か 1 で揺れ、
    `no-visible-effect` もそれに従う。
  - 正しい直し方: 記録ではなく**開始位置で保持**する(init script で `animationstart` 時に
    pause)。ただし `playState` の「作者が止めたのか我々が止めたのか」の区別が消え、
    `restTimeForAnimation` がそれに依存しているので、フィルタ変更ではなく再設計。
  - 着手条件: `no-visible-effect` の揺れが実際に誤判定を生んだら。

- [ ] **filmstrip の均一セル → ragged レイアウト(cosmetic)**
  - `composeFilmstrip` はシート全体で最大サイズのセルを使うため、1 行だけ motion bbox が
    広いと他の行の右側に灰色余白が出る(3 アニメ fixture で実測)。行ごとに独立幅にすると
    詰まるが、現在の「均一グリッド」という単純さを崩す。読みやすさは損なわれていないので
    優先度低。

- [ ] **strip は行ごとに切り出すので「要素の空間的な並び」が消える(2026-08-10 dogfood v4)**
  - agent-h の指摘: 「3 枚のカードが**横並び**であるという事実がシートから失われる。
    キャプションがなければ各行は『1 列の 3 状態』と読める」。行ごとの motion bbox クロップ
    が正しく働いた結果で、バグではない — クロップを外すと 1 セルがビューポート全体になり、
    小さな要素は 6 枚のほぼ同一スクリーンショットになる(v1 で実測、1448x422 → 890x232)。
  - 直すなら: 「時間軸 × 行」と「空間配置」の両方を 1 枚に収める別レイアウト
    (例: 各列をビューポート全体の縮小 + 行を motion bbox クロップの 2 段組)。
    現行のグリッドの拡張ではなく新しい構図。
  - 着手条件: レビュアーが実際に空間配置を読み違えた事例が出たら。

### テストカバレッジ 70% への道筋(2026-08-13 測定)

vitest へ移行し(2662 tests、node:test と同数、同じ ~222s)、v8 カバレッジを導入。
`pnpm test:coverage` で計測。**現在 statements 61.23%**(開始 56.1%、Phase 2 後 57.99%、Phase 1 後 60.14%)。tests 2859、全パス。

**70% には +3,865 statements 必要**(現時点の残りは **+2,675**)。既存の 2662 tests が網羅的なのに 57% な理由は
構造的で、純粋ロジックは**すでにカバー済み**だから。実測:

| 書いたテストの種類 | 1ファイルあたりの獲得 |
|---|---|
| 純粋関数のユニットテスト | ~40 statements(ある回は **+1** — 既に browser 経由でカバー済みだった) |
| gate runner の in-process browser テスト | **~115 statements** |

未カバーの 13,000 statements の内訳(near-zero の 21ファイル、4,231 statements):

- **11ファイル / 2,244 statements は export された関数を1つも持たない** — トップレベル
  `main()` の CLI スクリプト(`snapshot.ts` 318, `css-challenge.ts` 285, `demo/*` 717,
  `detection-report.ts` 203, `benchmark.ts` 195 …)。import すると実行されるので、
  **`runX()` を export する形にリファクタしない限りテスト不可能**。
- **10ファイル / 1,987 statements は callable** — `interact.ts` 275, `explore.ts` 230,
  `cross-browser.ts` 185(複数ブラウザ必要), `vlm-client.ts` 139(API キー必要),
  `multi-page-consistency.ts` 114 など。

#### フェーズ(独立に実行可能)

- [x] **Phase 1: callable な gate runner に in-process browser テスト** — **5ファイル完了**
  (2026-08-14)。**statements 57.99% → 60.14%**、全 5 ファイルが 0% から:

  | ファイル | before | after | 備考 |
  |---|---|---|---|
  | `stress/multi-page-consistency.ts` | 0% | **88.6%** | browser 必要 |
  | `inspect/interact.ts` | 0% | **68.6%** | browser 必要 |
  | `inspect/explore.ts` | 0% | **66.8%** | browser 必要 |
  | `cli/workflow/spec.ts` | 0% | **94.0%** | browser 不要、13 tests 0.5s |
  | `cli/workflow.ts` | 0% | **46.2%** | browser 不要。残りは `npx playwright` を spawn する `init`/`capture` |

  tests 2753 → 2795(+42)。suite 全体は +75s(browser 3ファイル分)。

  - **予測より安かった**: `spec.ts` / `workflow.ts` は browser を必要とせず、
    `process.exit()` を return に変えるだけでテスト可能になった(合わせて 21 tests、~1s)。
    「callable だが未テスト」の原因が browser ではなく **`process.exit` だった**ケース。
  - **回帰価値の予想は当たった**。書いた 4 スイートが実欠陥 4 件を出した:
    1. `check drift pages` — セレクタが**存在しないページ**が唯一 pass するケースだった
       (`NaN > threshold` は false)。`selector-missing` ルールを追加(rules 125 → 126)。
    2. `inspect explore` — **仮想マウスが setContent を越えて残る**ため、各アクションの
       baseline が「1つ前のアクションがクリックした要素の hover ハイライト」を含んでいた。
       dead action(このゲートの存在理由)が alive に見えていた。span 0.28% / button 0.42%
       → 修正後どちらも 0.00%。
    3. `inspect interact` — 失敗した step を**print して捨てていた**。下流には
       「delta ほぼ 0 の transition」だけが見え、レポート自身の文が
       「セレクタ不一致のサイン」と説明していた。理由を持っていて捨てていた。
    4. `workflow spec-verify` — 非 git ディレクトリで git の usage 40 行を吐いていた
       (`execSync` は stderr を inherit する)。
  - **自分の思い込みが3件テストに直された**(コードではなくテストを直した):
    block 要素の `width: auto` は padding を吸収する(outer width は変わらない) /
    button の `hover` は UA スタイルで 0.25% paint する /
    `waitForSelector` は dead 判定から意図的に除外されている。
  - **副作用**: `isCliEntry(import.meta.url, …)` という新しい綴りを使ったため、
    `gate-entry-isolation.test.ts` の CLI-entry 検出(文字列 `__VLMKIT_DISPATCHER_LEAF__ ===`
    を探す)が **12ファイルを見落としていた**。両方の綴りを見るよう修正し、
    vacuity テストに各綴り1件ずつ + negative を追加。
- [x] **Phase 2: CLI スクリプトを `runX()` export にリファクタ** — **11ファイル完了**
  - 8ファイルは**ガードが無く**、末尾で `main().catch(...)` を無条件に呼んでいた。
    つまり **import すると実行される**。これが 0% の理由(import で実行されるものは
    テストできない)。
  - 確立したパターン(`snapshot.ts` の docstring に3点明記):
    **argv は引数** / **exit code は return(代入しない)** / **cwd は引数**。
    `process.exitCode` はプロセスの所有物で、リグレッションを正しく報告した snapshot が
    それを頼んだテストスイートを落としてはいけない。`process.chdir` はプロセス全体なので
    vitest の共有ワーカーを壊す。
  - リファクタ中に実バグ2件: `runStability` がヘルパー内から `process.exitCode` を代入
    (呼び出し元のプロセスを落とす)、`resolve(outputDir)` が `process.cwd()` 基準で
    パーサのデフォルトだけ cwd 基準だった(明示 `--output` と既定値が別ディレクトリに落ちる)。
  - **共有 `isCliEntry(import.meta.url, name?)` を core に追加**。30ファイルが2つの綴りで
    手書きしていて、緩い方(`argv[1]?.endsWith("fix-loop.ts")`)は名前が接尾辞として
    重なるファイルを区別できず、`.mjs` にビルドすると黙って一致しなくなる。
  - **テストは別作業**。リファクタは「テスト可能にする」だけで測定値は動かない(+0.29pp)。
    実際にテストを書いた2ファイルで 0% → 32% / 58%。
  - 残り9ファイルのうち `demo/*` 4件はデモの実行そのもの、
    `benchmark`/`vlm-bench`/`css-challenge`/`fix-loop`/`migration-fix-loop` 5件は
    VLM/API が必要(Phase 3)。**リファクタ済みなので import は安全**になった。
- [x] **Phase 1.5: 未テストの純粋モジュール**(2026-08-14)。**60.14% → 61.23%**。
  Phase 1 の続きとして、browser 不要で未カバーの大きい純粋モジュールを 3 本:

  | ファイル | before | after | tests |
  |---|---|---|---|
  | `component/component-report-format.ts` | 52.9% | **82.4%** | +22(0.55s) |
  | `util/skill.ts` | 0% | **58.6%** | 24(2.4s、1件だけ実 CLI を spawn) |
  | `experiments/css-challenge/css-challenge-core.ts` | 33% | **42.1%** | +21(0.02s) |

  ここでも**実欠陥が 4 件**出た。未テストのモジュールにはバグがある、という
  この作業の一貫した所見:
  1. **`vlmkit skill run` は 0.9.0 以降ずっと全チェックが失敗していた** —
     `src/vrt.ts` を spawn していた(リネームで消えたパス)。しかもレポートは
     `MODULE_NOT_FOUND` を `exit 1` として「チェックが問題を見つけた」ように描画。
     `KNOWN_TOOLS`(コマンド表の手書きコピー)も 0.9 前の単一トークン名のままで、
     **検証を通ってから spawn で落ちる**構造だった。検証は CLI に委譲し、
     legacy 名は alias として維持。
  2. **`removeCssProperty` がプロパティ名をトークン途中でマッチ** —
     `.card { border-color: red; color: red; }` → `.card { border- color: red; }`。
     指定されていないプロパティを壊し、指定されたものを残す。つまり**実験の
     ground truth が壊れる**(クラッシュではなく)。
  3. **`applyCssFix` が末尾セミコロンなしの body に連結** —
     `.card { color: red }` → `.card { color: red padding: 4px; }`。
     既存 declaration が消える。
     - 2 と 3 は**現コーパスでは発火しない**ことを実測(10 fixtures / 2,391
       declarations で修正前後バイト一致)。よって**記録済みのベンチ数値は変わらない**。
       ただし `.tab-item.active { color: #2563eb; border-bottom-color: #2563eb; }` は
       順序が逆なら発火する。
  4. **`inspect interact --help` が exit 1** — help と引数不足が同じコードだった。

  **`as any` フィクスチャの害も実証された**: `component-report-format.test.ts` の
  既存フィクスチャは `as any` で、typed に書き直したら tsc が即座に 3 件見つけた
  (`LandscapeDiffResult` の `width`/`height` 欠落、`ComponentGoalEvaluation` の
  閾値 4 フィールド欠落、`nearest` → 実際は `nearestNeighborDistance` + `count`)。
  どれもレポートに `undefined` が出るがテストは通る組み合わせ。

- [ ] **Phase 3: VLM/API 経路に録画フィクスチャ**(~250 statements)
  - `vlm-client.ts` / `reasoning-pipeline.ts`。HAR 相当の録画済みレスポンスが必要。

#### 残り +2,675 の所在(2026-08-14 実測)

**純粋モジュールの安い獲得はほぼ枯れた**。残る大きい未カバーは全部 browser
オーケストレータか実験ハーネス:

| missing | pct | ファイル | 性質 |
|---|---|---|---|
| 647 | 40.2% | `experiments/migration/migration-compare.ts` | browser |
| 477 | 3.8% | `experiments/css-challenge/css-challenge-bench.ts` | browser + fixture |
| 404 | 18.1% | `component/component-from-image.ts` | browser |
| 391 | 12.9% | `src/diff-pr.ts` | browser(CI ゲート) |
| 274 | 0% | `experiments/css-challenge/css-challenge.ts` | LLM 必要 |
| 264 | 70.9% | `vrt/compare/diff-for-agent.ts` | 純粋だが既に 24 tests あり |
| 462 | 0% | `demo/demo-scenarios.ts` + `demo-fix-loop.ts` | デモ実行そのもの |
| 219 | 31.8% | `vrt/snapshot/snapshot.ts` | browser |
| 217 | 38.2% | `contract/introspect-contract.ts` | browser |
| 185 | 5.1% | `stress/cross-browser.ts` | 複数 browser エンジン必要 |

つまり **70% に行くには browser orchestrator を実測レートで 15-20 スイート**
書くことになる(Phase 1 実績: browser スイート 1 本 ≒ 100-200 statements、
20-40s)。suite 全体に +10 分程度。`diff-pr.ts` は CI ゲートなので
**カバレッジ目的とは別に**テストする価値が高い(12.9% は低すぎる)。

#### 分母を狭める案(単独では 70% に届かない)

`src/demo`(717, 0%)と `src/experiments`(6,023, 42%)を除外しても **61.9%**。
published packages のみでも **65.5%**。つまり**除外だけでは 70% に到達しない** —
どの道でも実テストが必要。除外するなら理由を書いた上で両方の数字を報告すべき。

### dogfood v7(2026-08-13、既存3シナリオの再評価)— **全件修正済み**

レポートは `docs/reports/2026-08-13-dogfood-reevaluation-v7.md`。
修正済み4件: `2892b5b`(batch が新規 untracked パスを報告)/ `a079a76`(未判定 role が
`NOT JUDGED` を出す)/ `de9de2f`(`page-overflow-x` が blame 対象を selector に載せる)/
`73dc7ef`(passing run の warn 数を summary に出す)/ `2c171c1`(webServer の stdout → stderr)。
**うち2件は前日に入れたコードの欠陥で、両方ともそのコードのための作業をしたエージェントが見つけた。**
**記録した8件も同日すべて修正**(`62ffb3d` a11y touch dedupe+help / `32936c3` scan handlers /
`c2007a4` 必須フラグ検証 + init webServer / `b9487fc` ledger 一本化 + rule 展開 /
`3f2cb3d` a11y --allow / `3f533e6` gates run --json)。

**8件のうち3件は指摘自身が過小評価だった。3件とも読んでは分からず、測って初めて崩れた**:
`.vlmkit/` の「ディレクトリが違う」は実は**ledger が2つ**(親と子で別、各々が実行の半分を保持)、
`--level AA` の「ヘルプと矛盾」は実は**誰にも見えないマークアップの差で計測が変わる**、
`gates list` の「実行できないプランを表示」は1ゲートの話ではなく**7ゲート**。
エージェントは外から見える症状を報告し、**それを実装するのではなく何がそれを生んでいるかを探すのが保守側の仕事**。
3件とも額面通りに直したら、小さい修正で本当の欠陥を残していた。

指摘文はエージェントの言葉のまま残す。

- [x] **`gates run --json` が構造化された findings を返さない**
  - > "findings arrive as one ANSI-escaped `output` string, not structured."
  - warn の**件数**は summary に出るようになったが、findings 自体を欲しい CI ジョブは
    ターミナル文字列をパースすることになる。
  - 直し方: batch が子プロセスを `--json` で起動して envelope をマージする。失敗表示用の
    prose 経路は残す(失敗時に読むのはそちら)。

- [x] **`scan handlers` が `registrations: 0 across 0 element(s)` で status `ok`**
  - > "zero listeners on a 3-button page is the finding."
  - agent-l は別途3つのボタンが全部 inert であることを `inert-control` で見つけている。
    つまり情報は他のゲートにある。このゲート自身の 0 が誤った verdict。

- [x] **`check a11y touch` / `check a11y contrast` に `--exclude` も selector `--allow` も無い**
  - `check design` と `check integrity` にはある。
  - > "Vendor DOM is a page-level fact, not a per-gate one. The only exit is turning the
    > one rule off page-wide, which also stops checking our own buttons."
  - > (contrast について) "red CI or contrast off, nothing between."
  - **ページレベルの `--exclude` を全ゲート共有**にするのが筋。per-gate フラグを増やす話ではない。

- [x] **`check a11y touch --level AA` がヘルプと矛盾する可能性**
  - > "Help: *'Clustered targets (within 24px of a sibling) are flagged…'* The vendor
    > buttons are 24x24 with a 4px gap; at `--level AA` it reported `✓ 0 undersized
    > target(s)`. Either the clustering check doesn't run at AA, or the help is wrong."
  - どちらなのか未確定。どちらでも欠陥で、**どちらかを確定させることが修正内容を決める**。

- [x] **`gates list` が実行できないプランを表示する**
  - > "It listed `check layout … http://localhost:5311/` as job 4 of 7; only `gates run`
    > revealed `did not run: error: --contract <contract.json> is required`. `list`
    > validates rule names but not required flags."
  - 必須フラグの検証は registry に情報がある(`inputs[].required`)ので `list` でできる。

- [x] **rule settings が全ゲートのコマンドラインに展開される**(agent-l / agent-m 独立に指摘)
  - `--rule check.a11y.touch/target-undersized=off` が `check copy` にも付く。
    typo したキーは**ゲート数と同じ回数**同じ設定エラーを出す。
  - `assertKnownRuleOverrides` の設計(他ゲートのキーは黙って通す)は意図的だが、
    コマンドラインのノイズと重複エラーは別問題。

- [x] **`.vlmkit/` と `test-results/` が cwd に書かれる。config のディレクトリではない**
  - v5 で**入力**パスは config 基準に直した。出力はまだ cwd 基準。
  - agent-l は自分で書いた `.gitignore` にこの差異をコメントとして書いている
    (`vlmkit writes both of these into the directory it is run from (cwd, not the
    directory the config lives in)`)。実在するギャップの最も明確な兆候。

- [x] **`gates init` が localhost URL に `webServer` を足さない**
  - URL source には既に `--wait-until load` を足している。`localhost` は「dev サーバがある」を
    含意するので同じ理屈が通る。

### dogfood v6 の残件(2026-08-12、adoption シナリオ)

レポートは `docs/reports/2026-08-12-dogfood-adoption-v6.md`。**7件すべて 2026-08-13 に修正済み**
(`3e27f0a` / `1657d4b` / `6ca9dad` / `8b12f29` / `7241a2b` / `b5e7c0f` / `25711b1`)。
指摘文はエージェントの言葉のまま残す — 答えを知った後の書き直しより、指摘そのものが記録として役に立つ。

- [x] **同じ3色が8件の所見になる** — 修正済み(2026-08-13)。色ペア + 適用された床を
  identity にして1件にまとめる(修正の単位が CSS 1宣言だから)。セレクタは
  `evidence.selectors` と本文の先頭数件で残る。canonical `selector` は先頭要素のままなので
  per-selector のツールと `--allow` は不変。`invisible-text` は要素ごとに据え置き
  (その要素での `fail` であって、見直すべき色の選択ではない)。実測:consumer ページで
  warn 5件 → 3件、CSS 1色につき1行。
  - `check integrity` の `low-contrast-text` はテーブル行ごとに1件出す
    (`#rows > tr:nth-of-type(1) > td:nth-of-type(4)`, `(2)`, `(3)`)。
    `check a11y contrast` は同じものを3件に畳んでいる。CSS 3色 → 8行。
  - 導入エージェント曰く「3色に8行、というのがゲートが `--advisory` を付けられる存在に
    なる過程」。`judgeTextContrast` で (fg, bg, floor) が同じものをまとめて件数で出す。

- [x] **rule を降格しても見た目が変わらない** — 修正済み(2026-08-13)、契約変更で
  - `format(report, rules?)` に `RuleView`(`effective(ruleId)` 1問だけ)を渡す。
    生の `AppliedRules` を渡さないのは、formatter が runner の判断を再導出して
    食い違う余地を作らないため。
  - 調べたら再チューニングより **`off` の方が明確な矛盾**だった:`--rule x=off` が
    「3件 suppressed」と言いながら3件すべて印字し、verdict でも数えていた。
  - `check integrity` が honour する:`off` はリストとカウントの両方から消える
    (suppressed 件数は残るので「隠す」ではなく「黙らせる」)、`info` は独自の段と
    アイコン、`suspect` は昇格。
  - **optional** なので、引数を無視するゲートは従来どおり。27ゲート一斉移行ではない。
  - `--rule component-drift=info` は verdict には効き `re-tuned:` も出るが、所見は
    warn 形の `!` のまま、verdict も `DRIFT` のまま。`gate.format(report)` が
    applied rules を見ていないから。再現済み。
  - 直し方: `format` に applied rules を渡す**契約変更**。今サイクルで prose への
    推論で2回やられているので、3つ目のヒューリスティックではなく契約変更にすべき。

- [x] **`--min-reuse` が推奨された用途に届かない** → `check design --allow` を追加
  - メトリクスが instances/styles の平均なので、3要素1バリアントの role は 1.5x で、
    チェックを無効化する以外に超えられない。`examples/vlmkit.gates.json` はこのケースに
    `--min-reuse 2` を勧めている。
  - `check integrity --allow` と同じ `<selector>;<reason>` 構文。allow したインスタンスは
    平均を取る前に母集団から抜けるので role の数値が「まだ判定対象の要素」を表す。
    抜いたことは `allowed: N` で必ず出る。マッチしなかった rule も名前を返す。
  - **セレクタは finding に出た形のまま書く**(id 優先パスなので `button#export` は
    当たり、`.btn--primary` は当たらない)。ヘルプにこの一文を入れてある。

- [x] **導入がリポジトリを黙って汚す** → `--ledger <path>` / `--no-ledger` + 初回作成の告知
      + `gates init` が `.gitignore` を書く
  - `--output` は stdout ログだけ。`test-results/` と `.vlmkit/run-ledger.jsonl` は
    フラグが無く、生成されることを何も告げない。エージェントは `ls` で気づいて
    `.gitignore` を自分で書いた。
  - レポートを書くゲートは既に `report: <path>` を出していた。**本当に無言だったのは
    ledger だけ**。
  - **実装位置が要点**: `appendRunLedger` の直接呼び出しが 16 箇所中 14 箇所あり、
    runner だけに実装すると 14 箇所を取りこぼす。`--wait-until` のときと同じ形
    (42 箇所の `.goto(` のうち3箇所が独自にオプションを組んでいた)。
    ledger モジュール側に run 単位の設定を置いて choke point にした。
  - 告知は**初回作成時のみ**。gate 実行ごとに1行追記されるファイルなので毎回言うとノイズ。
    既に ignore 済み / git リポジトリでない場合は何も出さない。
    `--ledger` で移した場合は、書いていない2ディレクトリではなく実際のパスを案内する。

- [x] **`vlmkit.gates.json` に `webServer` 相当が無い**(Playwright には昔からある)→ 追加
  - HAR 経路があるので今回は回避できたが、HAR を思いつかなければ
    start / trap kill / poll-for-ready を手で書くことになる。
  - Playwright と同じ名前・同じ形(`command` / `url` / `timeout` /
    `reuseExistingServer` / `cwd` / `env`)。一度書いた人が語彙を学び直さないため。
  - **意図的な差分2点**: (1) `url` は必須(`port` の代替を用意しない)。
    「起動した」が「配信している」を意味しないと最初のゲートが bundler と競合し、
    その flake は本物の findings と区別できない。(2) URL が応答する前にコマンドが
    終了した場合は**終了コードで報告**する。タイムアウトは「走らなかったコマンド」の
    誤診断なので。
  - プロセスグループごと起動・停止する(`npm run dev` → bundler → watcher が
    ポートを握ったまま残らない)。throw / Ctrl-C でも必ず停止する —
    残留サーバは次回 `reuseExistingServer` に拾われて古いビルドを黙って gate するので、
    機能が無かったことより悪い。
  - `gates list` は起動せずに宣言だけ表示する。

- [x] **`skipped: 28 (no inferable role)` が解釈できない** → coverage 行 + タグ内訳 + 一行説明
  - `coverage: 18 of 141 visible element(s) carried an inferable role` /
    `no role: a x37, td x21, div x19, span x18, ...` /
    role の出どころ(`role="..."` か button/input/select/textarea/h1-h6)と
    「div/span/p/a には無いので skip が多いのは正常」の一行。
  - 数字だけでは「div ばかりのページ」と「計測が壊れた」を区別できないのが本質だった。
    タグ内訳はページ自身のマークアップで即答する。
  - 元の指摘: 30要素中28スキップは verdict がほぼ何も見ていないことを意味するが、それが
    正常かどうかを何も言わない。

- [x] **`rules` に first-class な `reason`(と `expires`)** → 長形式を追加
  - `{"setting": "warn", "reason": "...", "owner": "...", "expires": "..."}`。
    長形式では reason 必須。suppression と**同じ resolved 形**に落ちるので
    `gates suppressions` に `[rule]` タグ付きで並び、`--require-expiry` /
    `--require-owner` も効き、期限切れは**適用されずルールが再び落ちる**。
  - 短形式(`"rule": "off"`)は維持。`--rule` は reason を運べないので、全面必須化すると
    config が CLI を表現できなくなる。`//` コメントキーも残すが、コメントは期限切れに
    ならず列挙もされないので長形式を推奨。
  - ページ側 annotation は default を ref 単位で上書きするので、期限切れ default を
    ページで**更新**できる(default 側は expired として報告され続ける)。
  - `examples/vlmkit.gates.json` の `--min-reuse 2`(届かない)を `check design --allow`
    に差し替え、長形式を defaults とページの両方で例示。
  - 元の指摘: `//` コメントキーは通るようにしたが、`suppressions` の
    `reason`/`owner`/`expires`(期限切れでビルドが再度落ちる)には及ばない。
    監査可能な経路が suppressions にしかなく、false positive に必要なのは
    監査不能な方 — プロジェクト自身の一番良いアイデアが反転している。

### dogfood v5 の残件(2026-08-11、ops dashboard シナリオ)

修正済み6件は `docs/reports/2026-08-11-dogfood-dataviz-v5.md`。以下は**未修正・記録のみ**。
どれも実在するが、測定の誤りではない。

- [x] **`--har` に recorder がない(v5 で最も呼ばれた「機能」要望)** — `vlmkit snapshot record-har` として追加(2026-08-12)
  - `docs/configuration.md` が「Playwright で HAR を録って replay しろ」と言うだけなので、
    どのプロジェクトも同じ20行スクリプトを書く。CI エージェントは実際に `record-har.mjs` を
    自作してタスクを完了させた。「知識がシェル履歴に住む」問題の一段下。
  - 答えは `vlmkit snapshot record-har` 相当。修正ではなく機能追加なので別途。

- [x] **HAR に陳腐化シグナルがなく、ポートに縛られる(残件の中で最も重い)** — 両方修正(2026-08-12)。`stale-har-fixture` ルール追加、origin 不一致は goto で名指し
  - 録音に無いエンドポイントは *abort* され、それが **broken-resource の「欠陥」**として
    出る。「フィクスチャが古い」ではなく「ページが壊れている」と報告される = 所見の種類が
    間違っている。
  - 録音は完全 URL がキーなので、ポートを変えると黙ってマッチしなくなる。
  - 着手条件: 所見の種類が違うのは実害なので、v6 を待たずに直す価値がある。

- [x] **`check design` の `DRIFT` + exit 0** — 修正済み(2026-08-12)、runner 側で27ゲート一律
  - 決定:各ゲートの format ではなく **runner が verdict 行の直下に挿入**する
    (`withExitIntent`)。`verdict:` / `status:` で始まる行をアンカーにする慣習は
    `batch-cli` の `gateReported()` が既に依存していたので、新設ではなく明文化。
  - アンカーが無いゲートは末尾に追記(従来動作)にフォールバックするので、慣習に
    従わないゲートでも注記を失わない。
  - integrity 側のインライン `— exits 0` は削除。1ゲートだけが言って26ゲートが
    言わない状態は、`--wait-until` のヒントが4ゲート中2つになった分岐と同じ。

- [x] **`gates init` が「必ずタイムアウトする設定」を出力する** — 修正済み(2026-08-12)
  - URL source のときは全ゲートに `--wait-until load --timeout 15000` を足して書き、
    理由と `record-har` の案内も出す。警告ではなく scaffold に入れたのは、既に書かれた
    設定の隣に警告を出しても作業が読み手に戻るだけだから。
  - 実測:never-idle ページに対して scaffold した設定が `gates run` で実際に走り、
    `1 FAILED`(ページ本来の欠陥)を報告する。修正前は全ゲートが 30 秒で死んでいた。

- [x] **入力が pin されていないことを、どのゲートも言わない** — 修正済み(2026-08-12)
  - runner が判定できた:ゲートが `--har` を宣言していて、argv に http(s) の source があり、
    `--har` が渡されていない → 1行出す。`--json` では黙る。
  - 「測る」(`--repeat 2 --require-stable`)ではなく「述べる」を選んだ。エージェントは
    前者を提案したが、実際に答えていた問いは「これは変わり得るか」で、2回走らせずに決定できる。
  - `--repeat/--require-stable` 自体は不要とは言い切れないが、実際に必要になった人が
    出てから。

- [x] **~~`check breakpoints` が幅ごとに再フェッチする~~ — 反証済み(2026-08-12)**
  - agent-j の主張は**誤り**だった。実測:リクエストをカウントするサーバに対して
    `check breakpoints` を1回走らせて **document 1回 / `/api/metrics` 1回**。
    `--sweep` で **39 幅**サンプルしても同じく 1回 / 1回。
  - 仕組みを読めば明らか:`breakpoint-check.ts` は `navigatePage` を**1回**呼び、
    以降は `setViewportSize` でリサイズするだけ。ナビゲーションは繰り返さない。
    彼らの「1 run で6回」は、おそらく 4 ゲートの `gates run` 全体か複数回の実行を
    数えたもの。
  - 残る本当の懸念(ゲートの問題ではない):**ページ自身が** resize で再フェッチする場合は
    幅ごとにデータが変わり得る。それはページの挙動で、`--har` が pin する。

- [x] **verdict の語が自分のカウントと矛盾し得る** — `check integrity` は修正済み(`NO DEFECTS, N WARN` + exit 意図)。`check design` の `DRIFT` + exit 0 は未着手
  - `verdict: DRIFT` + exit 0、そして F2 の修正後は `CLEAN (0 fail, 3 warn)`。
    解決する行(`N warn(s) did not fail this command`)は findings の下、最後に出る。
    修理エージェント曰く「CI ではコイントス」。
  - 直し方の候補: verdict 行自体に exit 意図を載せる(`DRIFT (1 finding) — exit 0`)。

- [x] **~~`check a11y contrast` の report 出力先~~ — 半分は仕様、半分は実バグだった(2026-08-12)**
  - **場所**は仕様。`test-results/<gate>/` はプロジェクト全体の慣習で、1ゲートだけ
    変えると不整合になる。agent-i がそれを知らなかっただけ。
  - **実バグ**はそこではなかった:2ページを続けて検査すると `report.md` と `page.png`
    を共有し、**2つ目が1つ目を黙って上書き**した。v2 が `check drift component` で
    見つけた clobber と同じで、あのときは drift だけ直していた。
  - 修正:`runOutputDir()` を `arg-helpers.ts` に共有ヘルパーとして置き、a11y の3ゲート
    (contrast / touch / focus)と drift が使う。drift のローカル `runSlug` は削除。

- [ ] **dogfood の次ラウンドは別ページで(2026-08-10 v4 の結論)**
  - v4 で「測定が間違っている」系の指摘が **0 件**になり、残る 6 件はすべて出力の読みやすさ。
    ただし 6 件全部が**同じ 4 ゲート・同じページ**由来で、シナリオが新しい種類の欠陥を
    産まなくなった。予算をさらに絞るより、別のページ(別の欠陥クラス)で回すべき。
  - 詳細: `docs/reports/2026-08-10-dogfood-animation-v4.md` の「Has it converged?」

### Benchmarks
- [ ] **markup-agent モデル横断ベンチ: OpenRouter + pi でモデルごとの性能比較**(関連: Issue #88)
  - 目的: S7-fresh A/B(Haiku 4.5 vs Sonnet — `docs/reports/2026-07-28-verifier-tooling-and-s6.md` 追記3)を Anthropic 外のモデルへ拡張し、markup-agent ループの model×cost 表を作る。既存の vlm-bench(Stage-1 VLM 比較)とは別物 — こちらは**エージェント本体**(vision 読み + CSS 執筆 + verify markup ループ運転)の比較。
  - 方法: エージェントハーネスに **pi** を使い、モデルルーティングは **OpenRouter**。条件は S7-fresh と同一に固定 — mock フィクスチャ(`fixtures/auto-markup-proof/mock/figma-export@2x.png`)単体入力、mock-markup skill 準拠プロンプト、12 ラウンド予算、`verify markup` をループ駆動、rounds は `.vlmkit/run-ledger.jsonl` で監査。
  - 指標: DONE 到達 / rounds / tokens(input・output 分離が取れる — ハーネス合算より精密)/ **実費**(OpenRouter 請求額)/ 実時間 / pixel diff / 偽 done 宣言・「再現不能」乱用の有無。
  - 候補モデル: `google/gemini-2.5-flash`(Stage-2 LLM 現行既定)、`moonshotai/kimi-k2`、`qwen/qwen3-coder`(fix-loop では過剰修正の前科 — apply-and-rollback なしのこのループでどうなるかも観点)、`deepseek` 系、+ 基準線として `anthropic/claude-haiku-4-5` / Sonnet(OpenRouter 経由で同一ハーネス化)。
  - 期待成果: skills の Model selection 節を Anthropic 2 モデルの表から多モデル表に更新、`docs/knowledge.md` に台帳行を追加、レポートを `docs/reports/` に保存(YYYY-MM-DD-markup-agent-model-bench-vN.md)。
  - 論点(設計時に決める): pi 側のツール権限(bash + read/write で十分か)、1px エンドゲームを完走できないモデルの打ち切り規準(トレンド横ばい 2 レグ相当)、vision 非対応モデルの扱い(除外 or scan component クロップ経由)。

- [x] ~~**VLM 意味ラベリングのベンチ: コンポーネントクロップ分類**(→ Issue #88)~~ —
  **2026-07-30 クローズ(実装せず)**: 決定論 kind(hairline/solid/text/image、
  bigJump 判別)がペアリングゲートと kickback 可読性の需要を実測で満たし
  切り、S14 全レグでも意味ラベル不在が問題になった場面ゼロ。消費者の
  いないベンチと判断。元 TODO 自身の判断基準「中途半端な精度はゼロより
  悪い」どおり、決定論 kind を恒久解とする。再開条件: kickback の
  誤読が意味ラベル不在に帰着する実例が観測されたら。

- [x] **kickback 品質: matched ペアの粒度不一致と top-N 取りこぼし(S9 リプレイで発見)** — 2026-07-28 実装済み: kickback に presence プローブを接続し、(1) 大きな dSize でも render が target fill を target box 全面に持つ場合は「size-delta caveat(segmentation grouping の可能性)」を行内表示、(2) extra/missing の同 fill が ±24px 縦近傍にある場合は「near-miss(変位、move it instead)」を同ラウンドで表示。ユニットテスト 5 本(S9 リプレイの実ケース形状)+ DONE fixture 回帰 green。
  - (1) target 側が連結成分としてグループ化した箱(card 全体)と current 側の部分箱(image のみ)が matched になると、dSize が「伸ばせ/縮めろ」と読める誤誘導になる。案: matched ペアの両箱で pixel-presence 相互チェックを行い、片側だけ大きい場合は「grouping mismatch の可能性」を行内に明記する。
  - (2) 抽出 top-N スロットから溢れた実在コンポーネントが、attempt 側で追加された直後に「extra — not in target」と一時誤報告される(次ラウンドで pixel-confirmed 降格)。案: extra 判定前に target 側の同 bbox を直接 pixel-presence して、降格を同ラウンドで行う。
  - 重要度: 強いモデルは自前計測で相殺できたが、Stage-2 LLM 自動修正はこのクラスの行を鵜呑みにするため、その前提条件。

- [x] **extractor top-N 境界の安定化(S13 で 3 例目の「分割適合」を誘発)** — 2026-07-29 実装済み: composePage がマッチングを topN+6 のプールで行い、報告は top-N 内の未マッチのみに限定(境界の席取りで counterpart がプール内に居れば黙って吸収、ordering/gap は top-N 内ペアのみで計算)。acid test: S13 の h2 16px 状態(旧: 幻 ordering 2 件で NOT DONE)が DONE に — round 3 の分割適合の手筋自体が不要になるクラスの根治。DONE fixture 9 本回帰 green、S9 の実残差は正しく NOT DONE のまま。
  - 症状: 面積ランキング第 N 席の中身が target と current で食い違うと、実害のない ink 量差(見出し語断片 area 374 vs 330 等)が missing/extra/ordering として出る。エージェントは font-size 等で extractor の分割を合わせにいく(letter-spacing 2 件 + S13 h2 の計 3 例 — いずれも視覚等価方向だったが、gate を騙す方向にも使える手筋)。
  - 案: (1) top-N 境界 ±10% の面積帯にいる残差へ「ranking-boundary caveat」を行内表示、(2) ペアリング前に両側の component 集合を面積でなく位置グリッドで安定ソート、(3) 境界成分は pixel-presence で先に demote。

- [x] **LLM Stage-2 fix synthesis for the markup loop(kickback + セレクタ帰属 → CSS 修正案の自動適用)**(→ Issue #88)
  — 2026-07-30 実装済み(`vlmkit fix markup`): kickback(帰属付き)+ 該当
  セレクタの computed styles を LLM に渡し、CSS 編集案 JSON を
  apply-and-rollback ゲートで適用、verify markup trend REGRESSED で自動
  ロールバック。fake-LLM E2E で全経路(適用/ロールバック/JSON 不正)を
  実証済み。**残: 実 LLM レグ**(`google/gemini-2.5-flash` 想定)— API
  キー必須のため本環境では未実施。キーが使える環境での初回実走が TODO。


### Infrastructure / Deploy
- [x] Cloudflare Browser Run CDP backend (`vlmkit snapshot --backend cloudflare`) — connects via `chromium.connectOverCDP` to `wss://api.cloudflare.com/.../browser-rendering/devtools/browser`. See `examples/vrt-snapshot-cloudflare.workflow.yml`.
- [x] Cloudflare Workers entry point (`worker/`) — `worker/index.ts` re-exports `createApiApp()` from `src/api/api-app.ts`. `env.BROWSER` wiring still pending.
- [x] Cloudflare Quick Actions REST backend (`/screenshot`, `/crawl` for route discovery)
  - `@mizchi/vlmkit-capture` now includes a Browser Run Quick Actions client for `/screenshot` and `/crawl`, route extraction from crawl results, and Hono API proxy endpoints under `/api/cloudflare/*`.
- [x] crater WASM backend (layout only — paint is future)
  - `@mizchi/vlmkit-capture` now exposes a layout-only adapter for Crater modules exporting `renderHtmlToJsonForWpt(html, width, height)`.
  - Local `vlmkit api serve` enables `POST /api/crater/layout` when `VLMKIT_CRATER_WASM_MODULE` points at a Crater JS/WASM artifact; dogfooded with `../crater/conformance/_build/js/release/build/wpt/wpt.js`.
- [x] Cloudflare R2 / KV / D1 storage — `worker/storage.ts` detects bindings; `/api/status` exposes `r2`/`kv`/`d1` availability via `StorageStatus`. Read/write wiring still pending.
- [x] npm package (`@mizchi/vrt`) — `pnpm add @mizchi/vrt`; exports both root and `/client`.
- [x] OpenAPI spec

### Crater side (mizchi/crater)

**Rendering fixes**:
- [ ] text-decoration #18 / border-radius #19 / font-weight #20 / margin #21 / align-items #22

**VRT detection rate improvement (94.4% → 100%)**:
- [x] Breakpoint-aware CSS rule mapping #33 — Crater v0.18.0 exposes viewport/rule-map APIs; VLMKit primary-viewport adoption is tracked in E2-next.
- [x] Hover/focus state computed style #34 — Crater v0.18.0 exposes `getComputedStylesWithState`; VLMKit currently uses hover and still needs full focus/active coverage.
- [x] Computed styles BiDi #26 — VLMKit now prefers `getAllComputedStyles` and falls back to script evaluation when unavailable.
- [ ] CSS rule usage tracking #27 — dead-code determination; Crater API availability should be dogfooded from VLMKit before marking done here.

**VRT optimization**:
- [ ] Paint tree diff API #23 / CSS mutation API #24 / Selector-scoped rendering #25
- [x] Batch rendering #28 — Crater v0.18.0 `batchRender` contract is adopted in `CraterClient`; prescanner hot-path integration remains in E2-next.
- [ ] VRT prescanner benchmark tracking #29

### Feature Extensions
- [x] Component (selector) level comparison
  - `vlmkit diff component` / `vlmkit diff elements` run selector-scoped screenshots and compare components independently from full-page layout shift noise.
- [x] Enhanced diff classification (layout shift / color change / text change / element added/removed)
  - `classifyVisualDiff` now trusts `DiffRegion.regionType === "shift"` as layout shift and uses sampled baseline/current colors to distinguish element-added vs element-removed when a region changes to/from a page-surface color.
- [x] Smoke test: Crater BiDi backend
  - `vlmkit check crater` verifies availability, viewport/content load, PNG capture, paint tree capture, computed styles, and breakpoint discovery. Missing Crater is `skip` by default; `--require` turns it into a failure.
- [x] Smoke test: a11y tree consistency check after operations
  - `inspect smoke` now compares post-action a11y snapshots against the initial snapshot and reports `a11y-regression` when all interactive targets or landmarks disappear.
- [x] Animation detection (animation-play-state: paused / CSSOM diff)
  - `vlmkit check motion` samples CSSOM animation / transition declarations, reports running vs paused animations, and flags missing `prefers-reduced-motion: reduce` coverage.
- [x] Animation evaluation (frame-sampled, deterministic)
  - `vlmkit check animation` pauses every animation via WAAPI, seeks `currentTime` through deterministic sample points against a settled-page baseline, and evaluates rendered frames: visible-effect verification (dead animations → `no-visible-effect`), per-animation motion bbox + peak frame delta, settle time (`long-settle`), infinite animations with a ready `--mask` hint (`infinite-animation`), and behavioral `prefers-reduced-motion` parity via emulated re-render (`reduced-motion-ignored`). `--frames` writes the sampled frame PNGs for VLM/manual inspection. Baseline gotcha (found dogfooding): holding *other* animations at t=0 hides descendants behind entrance animations' `opacity: 0` start keyframe — the baseline must be the rest pose (finite animations seeked past their end, infinite at 0).
  - Covers CSS `@keyframes` / transitions / `element.animate()` — all controllable from outside via the `CSSAnimation`/`CSSTransition` WAAPI reflection, no page instrumentation. rAF/JS-tick animations, video, and GIF are invisible to `getAnimations()` AND keep moving during evaluation (contaminating other animations' deltas); a double rest-capture guard reports them as `uncontrolled-motion` with the moving region's bbox, including on pages with zero WAAPI animations.
- [x] Scroll existence detection (annotation-free)
  - `vlmkit scan scroll` inventories every element that actually scrolls (selector / axis / overflow px / bbox) from computed overflow + scroll metrics — no `data-scrollport` annotation required, unlike `contract introspect`. Flags unintended page-level horizontal scroll (`page-overflow-x`, suspect) with the sticking-out offender selectors, `overflow: hidden` cut-off suspects (`clipped-content`), declared-but-dead scrollports, and nested same-axis scrolling. `--json` emits `expectedScrollports` entries pasteable into a UI Contract, closing the annotation-only gap.
- [x] Media-query boundary quickcheck
  - `vlmkit check breakpoints` renders at B−1/B/B+1 for every discovered breakpoint (CSS collected in-page, so external local stylesheets count; `--breakpoints` overrides) and checks the boundary invariant on discrete per-element properties (display / position / flex-direction / grid track *count* / …): value(B) must match a neighbor. Violations: `boundary-spike` (B matches neither regime), `boundary-gap` (element hidden/visible only at exactly B), `overflow-at-boundary`. Adjacent breakpoints 2px apart get a synthetic midpoint check — the `max-width: 999px` + `min-width: 1001px` orphan width is invisible to the declared-value checks because it only ever appears as a neighbor sample. Resize without reload (media queries re-evaluate synchronously), so N boundaries cost ~3N cheap style samples, no screenshots.
- [x] dynamic-markup skill (markup workflow gated by the dynamic-behavior suite)
  - `.claude/skills/dynamic-markup/SKILL.md`: recreate a page whose spec includes breakpoints, scrollports, and animations — static convergence delegates to auto-markup; behavior requirements travel via viewport/scrolled screenshots + a **motion brief**; verification is the four-gate suite (`check breakpoints` / `scan scroll` / `check animation` / `check motion`) plus capture discipline (settle wait + `--mask` from the animation report). S5 Haiku proof (promo fixture: entrance + infinite pulse + reduced-motion + 240px scrollport + 768px breakpoint): 3 rounds, all four gates pass on independent re-measurement, pixel diff 6.3-8.0%. Found one gate blind spot: pulse implemented at 2x frequency (50% keyframe vs `alternate`) is indistinguishable in `check animation` output — duration/iterations match; oscillation period needs a keyframe-fold/direction extension. See `docs/reports/2026-07-27-dynamic-markup-skill-haiku-s5.md`.
- [x] External stylesheet breakpoint discovery
  - Regex fallback now reads local `<link rel="stylesheet" href="./...">` CSS during migration breakpoint discovery and merges those breakpoints with Crater results.

### Agent-loop UX (from 2026-05-12 dogfood)

From `docs/reports/2026-05-12-dogfood-shadcn-luna.md`. Each item is a
small wrapper around already-built primitives, not a new subsystem.

- [x] `vlmkit diff agent <migration-report.json>` — one-context-window
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
  printed by `vlmkit diff agent` as e.g.
  `[480–720]:+22px [720–960]:-94px [960–1348]:+32px`, replacing the
  single-line global average with localized per-section offsets.
  Verified on the 2026-05-12 dogfood Pass B iter 1 data.
- [x] `vlmkit diff runs <a.json> <b.json>` — pairwise migration-report
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
  `vlmkit diff agent`. Verified on dogfood Pass B iter 1: catches 46
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

- [x] **Component bbox extraction.** `packages/vlmkit-markup/src/component/component-bbox.ts` runs
  on the captured PNGs (no DOM required): detect background via
  edge-pixel mode, build foreground mask, label connected
  components (two-pass union-find, 4-connectivity), filter
  `minArea`, sort by area desc. `matchComponents` pairs baseline
  ↔ variant by rank-after-sort and reports per-axis Δ + IoU.
  Wired into `migration-compare` (always on; `--no-component-bbox`
  to disable) — surfaces a "Component bbox diff" section in
  `vlmkit diff agent`. 10 unit tests cover synthetic backgrounds
  + multi-component sorting + min-area filtering. Verified on
  both wireframe (Subagent F's exact scenario: baseline 343×370,
  variant 311×243, Δ -32W / -127H reported on one row) and
  migration (Pass B iter 1: 50 component deltas surfaced).
- [x] **Per-viewport geometry diff** without DOM access — "baseline
  card shrinks 18px between desktop and mobile but variant
  doesn't" inferred purely from screenshot dimensions.
  `packages/vlmkit-markup/src/component/component-geometry.ts` composes on top of `MatchedBbox[]`
  and flags `responsiveMismatch` when one side's per-axis spread
  exceeds the other's by ≥30px. Rendered as "Cross-viewport
  geometry profile" in `vlmkit diff agent`. 5 unit tests +
  verified on shadcn→blank (8 responsive-mismatch flags
  surfaced).
- [x] **Heatmap region clustering** — group connected hot pixels
  in `*_heatmap.png` into named regions and report per-region
  shift instead of horizontal bands. Bands of bands lose
  resolution; region clusters preserve "this text run shifted up
  4px" granularity. `packages/vlmkit-core/src/heatmap-regions.ts` reuses the
  union-find CC labeller from `component-bbox.ts` against a
  hot-red mask (red − max(g,b) ≥ 60). 5 unit tests + verified on
  shadcn→blank (24 region clusters) and wireframe pricing-card
  (18 clusters — *still works when component bbox matching
  fails*, the F-overfit case).
- [x] **Text-row y-position extraction** from rendered PNGs via
  luminance-profile peak detection — exposes "the `$24` text row
  is 4px higher in the variant" without needing DOM correspondence.
  `packages/vlmkit-core/src/text-rows.ts` computes per-row mean luminance, treats rows
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

- [x] **Theme parity** (`vlmkit check theme`). Renders the same HTML
  twice via Playwright's `emulateMedia({ colorScheme: light/dark })`,
  extracts component bboxes, samples each bbox's dominant fill in
  both renders, and flags components whose fill is identical across
  themes (RGB distance < 16) as **unthemed** — hard-coded colors
  that don't reference a theme variable. Evaluated on a card with
  a deliberately unthemed alert banner (warm `#fef3c7` bg
  hard-coded) — surfaced 1 of 8 unthemed, exact bbox 370,280
  540×43 matching the buggy `.alert`. Theme pixel delta 97.9%
  (page does respond broadly).

- [x] **i18n / variable-length text stress** (`vlmkit stress i18n`).
  Inflates every text node by a configurable factor (default 1.4×
  ≈ German), then samples per-element layout before vs after.
  Classifies overflow as `horizontal-overflow` (scrollWidth >
  clientWidth), `extends-beyond-parent` (right edge past parent),
  or `vertical-wrap` (height grew significantly). Dedupes
  ancestor reports so only the innermost broken element is
  surfaced. Evaluated on a fixture with `width: 200px` heading
  and `width: 120px` button: caught both overflows + classified
  the paragraph wrap as the harmless `vertical-wrap` case.

- [x] **Inline → componentized refactor** (`vlmkit check drift component`).
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

- [x] **Design token / palette compliance.** `packages/vlmkit-markup/src/style/palette-extract.ts`
  stride-samples the rendered PNG into a 5-bit-per-channel histogram
  and returns the top-K dominant colors. `packages/vlmkit-markup/src/style/palette-diff.ts`
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
  diff per state. `packages/vlmkit-markup/src/stress/multi-state.ts` marks all interactive
  elements (`button`, `a[href]`, `[role=button]`, form controls)
  with a `data-vlmkit-state-marker` attribute, opens a CDP session,
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
  subcommand. `packages/vlmkit-markup/src/component/component-from-image.ts` takes a target PNG +
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

- [x] **F3 — `vlmkit check a11y focus`**. Drives `Tab` through the
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

Both registered in the unified `vlmkit` dispatcher. Smoke 15/15 PASS.

Scenario-matrix progress (HEAD → after this commit):
  ✅ 42 → 44 (+2: F3, D4)
  ❌ 12 → 10

In-scope full coverage now **44 / 85 = 52%**; full + partial =
**76 / 85 = 89%**.

### Scenario-matrix Clusters 2 & 3 — cross-browser + design-tokens (2026-05-13)

- [x] **Cluster 2: `vlmkit diff browsers`** — launches chromium /
  firefox / webkit in sequence, diffs each against the first
  successful engine (typically chromium = reference). Engines
  not installed in the local Playwright cache auto-skip with an
  actionable hint (`npx playwright install firefox webkit`) —
  the tool stays useful in a Chromium-only sandbox. Per-engine
  heatmap regions + UA strings + suggested-next-step that calls
  out the common per-engine quirks (form controls on WebKit,
  text subpixel shifts on Firefox). Closes scenario matrix
  items H1, H2, H3.

- [x] **Cluster 3: `vlmkit check tokens`** — scale-conformance
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

Both registered in `vlmkit` dispatcher. Smoke script updated to
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

- [x] **`vlmkit stress media`** — renders an HTML / URL under each
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

  Registered under `vlmkit` dispatcher; added to
  scripts/smoke-all-clis.sh (12/12 PASS).

### Survey Tier D — real-interaction sequences (2026-05-13)

- [x] **`vlmkit inspect interact`** — declarative scripted-sequence VRT. The
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

  Registered under the unified `vlmkit` dispatcher.

### Survey Tier B / C / F follow-ups (2026-05-13)

Three of the ROI-ranked items from `docs/reports/2026-05-13-
capability-survey.md`, shipped together.

- [x] **B. Region content-type classifier.** `packages/vlmkit-markup/src/region-classify.ts`:
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

- [x] **F. Touch-target size check** (`vlmkit check a11y touch`). New CLI
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

- [x] **A11y contrast scan** (`vlmkit check a11y contrast`). Renders the
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
  under the unified `vlmkit` dispatcher
  (src/cli/router.ts + src/cli/vrt.ts). Fixed a
  long-standing bug in the dispatcher: `process.argv[1]` was
  being set to a *relative* module path
  (`./migration-compare.ts`) which made each module's
  `isCliEntry` strict check
  (`resolve(argv[1]) === fileURLToPath(import.meta.url)`)
  silently fail in dev mode. Now resolved to absolute via
  `fileURLToPath(new URL(modulePath, import.meta.url))` —
  every command runs correctly from `node src/cli/vrt.ts <cmd>`
  AND from the built `dist/vlmkit.mjs`.

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
  `packages/vlmkit-markup/src/stress/multi-page-consistency.ts` renders N URLs (or HTML files)
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

- [x] **Vertical-shift origin diagnostic.** `packages/vlmkit-markup/src/shift-origin.ts`
  captures per-element bounding boxes via a new
  `DOM_BBOX_BROWSER_SCRIPT`, then matches by DOM path against the
  per-band shifts already produced by `detectBandShifts`.
  `findShiftOrigins` walks baseline elements in document order,
  finds the first whose Δy points in the band's direction with
  magnitude comparable to the band's shift, and emits the
  responsible element (path, baseline / variant class, Δtop,
  suspect axis: `height` / `margin/padding-above` / `y-position`).
  Surfaced as a new "Shift-origin diagnostics" table in
  `vlmkit diff agent`, populated automatically when
  `--dom-position-diff` is on. Verified on dogfood Pass B iter 1:
  42 origin rows across 10 viewports — e.g. mobile `[720-960]
  Δ-94px → card-header / luna-panel-head, suspect: height`,
  below-1024 `[480-720] Δ+112px → button-row / luna-actions,
  suspect: height`. The exact symptom Subagent D plateaued on
  (`+152px shift band with no DOM-position delta`) now has a named
  origin. 9 unit tests cover the algorithm.
- [x] **Drop ✗ heuristic candidates from `vlmkit diff agent`.**
  `--show-unverified` (default off) controls the visibility.
  Default output now drops rows whose computed value matches
  baseline; replaced with `_N unverified candidate(s) hidden_`
  note so the agent knows what was suppressed. Dogfood Pass B
  iter 1: table shrunk from 5 rows (2 ✓ + 3 ✗) to just 2 ✓.
- [x] **Grid `fr`-ratio inference.** `packages/vlmkit-markup/src/grid-ratio.ts` walks per-
  viewport bboxes, finds containers whose direct children have a
  non-uniform width distribution differing between baseline and
  variant, then suggests both a decimal ratio and a low-integer
  `fr` form (denominators 1..12). Two filters keep output sharp:
  `minRatioSpread` (default 1.15) drops flexbox subpixel-rendering
  noise (3 ~equal buttons coming out 130/140/143); `maxSumOverParent`
  (default 1.3) drops column-stacked containers where children fill
  100% width and per-child widths are content-driven (not a grid
  ratio). Surfaced as a new "Grid `fr`-ratio suggestions" section
  in `vlmkit diff agent`. Dogfood Pass B iter 1: the workspace at
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
  `vlmkit diff agent` renders a dedicated "Em-relative properties"
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
  `packages/vlmkit-core/src/dom-position-styles.ts`. `migration-compare --dom-position-diff`
  captures per-element `(path, tag, classes, styles)` for every
  element with a `class` attribute or semantic tag, then matches
  baseline ↔ variant by tree position (`main[0]>section[0]>span[0]`),
  which is invariant under class renames. Surfaced as a new
  "Verified deltas by DOM position (class-rename-aware)" section in
  `vlmkit diff agent`. Verified on the dogfood Pass B iter 1
  fixture: produces 872 property tuples across 60 element
  positions, naming both class names per row (e.g. baseline
  `eyebrow` ↔ variant `luna-pill`, baseline `dialog-card` ↔
  variant `luna-modal`). The exact gap subagent A flagged is now
  closed.
- [x] **Per-viewport DOM-position capture.** `--dom-position-diff`
  now captures the DOM-position styles at *every* discovered
  viewport (not just the first) and surfaces a new "Verified
  deltas by DOM position × viewport (catches media-query gaps)"
  section in `vlmkit diff agent`. Output splits into:
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
- [x] **Vertical-accumulation breakdown for layout-shift bands.**
  `shift-origin` now groups upstream bbox height deltas by
  `(baseline class → variant class)` for each shift band, and
  `diff-for-agent` renders a "Vertical accumulation breakdown"
  table such as `.metric → .luna-metric` `-9px × 4 = -36px`
  plus `.panel-title → .luna-panel-title` `-1.5px × 3 = -4.5px`.
- [x] **Class-rename map as a header summary table** lands at the
  top of each variant section in `vlmkit diff agent`, before the
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
- [x] **"Missing CSS rule" output.** `diff-for-agent` now emits
  "Missing CSS rule hints" directly after the class-rename map.
  It combines DOM-position deltas with computed-style selector-only
  evidence, so rows like baseline `.eyebrow` → variant `.luna-pill`
  show the property and computed value gap (`text-transform:
  uppercase → none`) as a concrete variant-rule candidate.

- [x] **Per-element / per-section diffRatio**. `diff-for-agent` now
  combines component bbox matches with heatmap regions and renders
  "Per-section diffRatio" rows, including worst-row marking and tests for
  section-ratio sorting.
- [x] **Element bounding-box diff** that names the responsible
  CSS axis. `diff-for-agent` now annotates component bbox rows with
  the dominant geometry delta (`height (+50px)`, `width (-18px)`,
  `y-position (+24px)`, etc.) plus likely CSS properties such as
  `padding-block`, `line-height`, `font-size`, `max-width`,
  `grid-template-columns`, or margin/gap/transform candidates.
- [x] **Color samples on color-change category**. Diff regions now carry
  sampled baseline/current color pairs, visual-semantic descriptions include
  hex pairs, migration results preserve color-change samples, and
  `diff-for-agent` renders a "Color-change samples" table.
- [x] **Regression alarm + auto-revert offer.** When net Δ is
  positive across most viewports after a patch, `diff-for-agent`
  surfaces a loud regression banner and now includes an explicit
  "Auto-revert offer" line: stop layering fixes, ask for approval
  to revert the last patch, and re-run against the previous report.
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
  `vlmkit diff agent` renames the heuristic table to "Heuristic fix
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
- [x] `nlAssert()` with Vision LLM. Added
  `nlAssert({ assertion, target | screenshot, reviewer })` to
  `@mizchi/vlmkit/playwright`. It captures from a Playwright-like
  `target.screenshot()` or accepts an explicit image buffer, passes
  the natural-language assertion to an injected Vision reviewer, and
  throws `NlAssertError` with reasoning/evidence on failure.
- [x] `onlyOnFailure` pattern. Added `@mizchi/vlmkit/playwright`
  with `onlyOnFailure(testInfo, diagnostic)` for `test.afterEach`
  and `withOnlyOnFailure(run, diagnostic)` for wrapper-style tests.
  Diagnostics are skipped on pass / expected-fail / skip, run only
  on unexpected Playwright statuses, and preserve the original
  assertion error unless the diagnostic also fails.
- [x] `toHaveScreenshot()` integration. Added
  `toHaveScreenshotWithDiagnostics({ expect, target, name, options,
  onFailure })`, a thin adapter around Playwright's existing
  `expect(page).toHaveScreenshot(...)`. It preserves Playwright's
  matcher arguments and only invokes VLM/VRT diagnostics through the
  `onlyOnFailure` path when the screenshot assertion throws.

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

### Migration fix-loop follow-ups (2026-05-23 dogfood)

Two structural gaps left after the 2026-05-23 design-runs / patterns
dogfood. Everything else from that day's improvement-followups report
has been closed (commits `ef95260`, `2656786`, `f934122`, `4e6d45d`,
`4efe14b`, `3ce514b`).

- [x] **Authored grid-template-* capture without computed-style fr→px
  resolution.** `@mizchi/vlmkit-core/authored-style-capture.ts` walks
  `document.styleSheets.cssRules` (including nested `@media` /
  `@supports`) and emits authored strings for `grid-template-*`, `flex`,
  `transform`, `clip-path`, `mask*` etc. Selectors inside `@media`
  blocks are scoped as `@media (...) :: <selector>` so the diff treats
  them as distinct rows. `migration-compare` captures both sides under
  the existing `--computed-style` flag and emits `authoredStyleDiff` /
  `authoredStyleDiffPerViewport` in `migration-report.json`. `vrt
  diff-for-agent` renders an "Authored CSS deltas (CSSOM)" table
  alongside the verified computed-style section.
- [x] **`vlm-region-diff` client-side bbox pixel sampling.** Bake-off
  done (`docs/reports/2026-05-23-vlm-region-diff-bakeoff.md`): on the
  expressive-menu 86%-changed pair `anthropic/claude-haiku-4-5` is the
  only model whose `verdict` tracked ground truth; `ui-tars`, `qwen3-vl-30b`
  and `gemini-2.5-flash` returned `no-diff` (or self-contradicting
  `diff`-with-same-colors). Default flipped to `claude-haiku-4-5` and
  `.claude/CLAUDE.md` notes the role split (fix-loop VLM vs region-diff
  VLM). Per-channel hex from haiku-4-5 was off by ~±10, so the fix is
  to trust the model for region naming / bbox localization and measure
  colors client-side before downstream use.
  - `vlm-region-diff` now asks the VLM for `bbox` in image pixel
    coordinates, parses object/array bbox forms, and in split-PNG mode
    samples colors from both PNGs client-side.
  - Sampled colors overwrite `baselineColor` / `variantColor`, with
    `colorSample: { source: "bbox-average", pixelCount,
    totalPixelCount, changedPixelCount, averageChannelDelta }` added so
    downstream can tell measured colors from VLM guesses. The sampler
    averages changed pixels inside the bbox first, then falls back to
    the full bbox when no changed pixels are present. Triptych mode
    remains informational because the coordinate space is ambiguous.
  - `vlm-region-diff` now also emits downstream-facing `changes[]`
    records: `type: "CHANGE"`, `selector`, `selectorHint`,
    inferred/explicit `property`, measured `from` / `to`, bbox, and
    color delta. When `--elements-json` is supplied, or when
    `--elements-html` captures DOM rects from the variant HTML/URL, VLM
    bboxes are joined to DOM element rects and `selector` /
    `selectorConfidence` / `evidence.selectorMatch` are filled; without
    DOM evidence, selector remains `null`. `--format markdown` renders
    the same data as an agent-facing selector/property/from/to table.
  - `migration-compare --region-diff` now runs the split-mode region
    diff on changed, unapproved viewports, writes per-viewport
    `*-region-diff.json` / `*.md` handoff artifacts, and stores compact
    summaries plus artifact paths under `report.regionDiffs`.

### Dashboard (separate repo)
- [x] Execution result list/search
  - Worker storage now groups artifact rows into execution-result summaries, and `/api/execution-results` exposes searchable run metadata for dashboard clients.
- [x] Visual diff display (heatmap, side-by-side, overlay)
  - Worker storage now infers baseline/current/heatmap/triptych artifact groups and `/api/visual-diffs` exposes dashboard-ready display modes.
- [x] Interactive approval operations
  - `/api/approvals` now exposes approval-manifest list/add/remove operations for dashboard review flows, backed by the same `approval.json` schema as `vlmkit manifest`.
- [x] Detection rate time-series graph
  - `bench-history` now builds chart-ready detection-rate series, and local `/api/detection-series` exposes filtered points by backend/fixture/limit for dashboard clients.
- [x] Component-level status matrix
  - `snapshot-report` now normalizes label/component × viewport statuses (`pass`, `diff`, `shift-only`, `new-baseline`, `missing`), and local `/api/component-status-matrix` exposes it for dashboard panes.
