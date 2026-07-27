# 2026-07-27 自動マークアップ観点での機能レビュー(有用な機能 / 不足機能)

リポジトリ全体(packages/*, src/cli, docs/, docs/issues-drafts/, docs/reports/,
シナリオマトリクス v2)を「エージェントがスクリーンショット・デザイン・仕様から
HTML/CSS を自動で書き、収束させる」という自動マークアップの観点で棚卸しした。

前提となる設計上の強み: **`@mizchi/vlmkit-markup` は VLM/LLM 呼び出しゼロ**
(全 57 モジュールが pixel/DOM/Playwright/MoonBit の決定論シグナル)。
マークアップの推論はエージェント側が担い、ツールはシグナルを返す構造に
なっている。VLM/LLM は `vlmkit-ai` / `vlmkit-plan` / `vlmkit-generate` /
`vlmkit-heal` / experiments に隔離されている。

---

## 1. 自動マークアップに有用な既存機能

### 1.1 画像 → マークアップ収束ループ(中核)

| 機能 | 場所 | 要点 |
|---|---|---|
| `build component` | `packages/vlmkit-markup/src/component/component-from-image.ts` | target.png + current.html → pixel diff + bbox Δ + heatmap 領域(kind/fill 付き)+ typography 推定 + spacing 修正表 + palette diff + Suggested CSS patch。ドッグフードで 87% → 1.3–1.7% / 3–5 ラウンド収束の実績 |
| 収束ゴールプロファイル | `component/component-goal.ts` | `app / layout / pixel / landing / app-shell / canvas / expressive-menu` 等 8 種。パターン別の pass/review/fail 閾値と evidence |
| `scan component` | `component/component-extract.ts` | ページ/モックアップ PNG → 主要コンポーネント検出 + 個別 PNG 切り出し(`build component` への入力生成) |
| セマンティックドリルダウン | `component/semantic-drilldown.ts` | landmark 単位のレイアウト契約と「次に直す領域」の選択。layout レーンと decoration レーンを分離 |

### 1.2 UI Contract IR(仕様駆動マークアップの土台)

- `contract/ui-contract.ts`(1428 行): landmark / layout / responsive / slot /
  state / marker / composition / canvas / content の宣言的 IR + 約 30 個の
  バリデータ。
- `contract introspect`: **既存 HTML/URL → IR 推定**(仕様抽出方向)。
- `contract validate`: IR の検証。
- ポリシー核は MoonBit(`markup-core-runtime.ts` + markup-core/*.mbt)。

### 1.3 決定論的診断シグナル(DOM 共有不要のものが多い)

- `diff png --elements-html` + `region-selector-match.ts` — diff 領域 bbox を
  DOM rect にヒットテストして**セレクタ候補を決定論で提示**。A/B 実験で
  VLM 帰属より一貫して有効("I never opened a screenshot before knowing
  where to look")。
- `presence-matrix` — ビューポート横断の領域出現マトリクス(「1280 のみ ⇒
  ≥1200px のメディアクエリを疑え」)。
- `shift-origin` / per-band shift / heatmap region clustering — 「下全部が
  80px ずれた」ではなく発生源を局所化。
- `text-rows` — 行検出 + フォントサイズ/ウェイト推定 + 行間ギャップ Δ
  (「row #3 の前の margin-bottom を 4px 減らせ」)。
- `component-bbox` / `component-geometry` — DOM 非依存の bbox マッチと
  レスポンシブ挙動差の検出。
- `palette-extract` / `palette-diff` — 不足色・余計なハードコード色を hex で提示。
- `grid-ratio` — bbox から CSS `fr` 比率を逆算。
- `region-classify` — 領域を text / filled-rect / icon / image に分類。
- `quality.ts` — whiteout / エラー画面 / 空コンテンツのガード。

### 1.4 スタイル・設計システム監査

`check tokens`(スケール逸脱 + 最近傍提案)、`check theme`(light/dark
両レンダで未テーマ化色検出)、`check motion`、palette 準拠。
M ティア(デザイントークン)はシナリオマトリクスで**全項目 ✅**。

### 1.5 状態・堅牢性・a11y ゲート

- multi-state(CDP `forcePseudoState` で :hover/:focus/:active/:focus-visible、
  transition 無効化、UA デフォルトフォーカスリング判別、hover 方向チェック付き)
- `stress i18n`(×1.4 テキスト膨張 → overflow 分類)、`stress media`
  (forced-colors / reduced-motion / print / RTL / 200% zoom)
- `diff browsers`(chromium/firefox/webkit)
- `check a11y contrast|touch|focus`(WCAG コントラスト、タッチターゲット、
  Tab 順序 vs 視覚順序)
- `inspect interact`(宣言的操作シーケンス + 遷移ごとの diff)、
  `inspect explore`、smoke-runner

### 1.6 エージェント連携・自動生成パイプライン

- `markup-loop init|observe|doctor|run`(`src/util/markup-loop.ts`)—
  ドロップイン型ループ。request/observations/rules/plan/locator-inventory/
  guardrail をファイル契約で受け渡し。`--dry-run` でオフライン検証可。
- `vlmkit-plan`(仕様+UI 観測 → 構造化テスト計画)→ `vlmkit-generate`
  (計画 → Playwright spec、diagnostics 駆動リトライ)→ `vlmkit-heal`
  (安→強モデルエスカレーション + 予算上限 + VRT accept 閾値)。
- `snapshot fix-prompt` — 回帰をサブエージェントに渡す構造化パケット
  (URL / viewport / shift 補正 diff / PNG・HTML パス)。
- `diff agent`(diff-for-agent)— 1 コンテキストに収まる Markdown 集約、
  wireframe モード検出時は画像専用プレイブックに切替。
- 2 段 VLM/LLM パイプライン(`reasoning-pipeline.ts` + fix-loop)—
  CSS 破壊 → VLM CHANGE list → LLM 修正 → apply-and-rollback 検証。

---

## 2. 不足機能(優先度順)

### P0 — 構造的ギャップ

1. **UI Contract → HTML/CSS スキャフォールド生成(IR→markup 方向)が存在しない。**
   `contract introspect`(markup→IR)と validate はあるが、逆方向のコンパイラが
   ない。`docs/markup-implementation-flow.md` の「まだ足りないところ」にも
   UI Contract compiler として明記。「自動マークアップ」に最も直結する欠落。
2. **マルチコンポーネント合成がない**(シナリオ A5 🟡)。`build component` は
   単一コンポーネントでは収束するが、複数コンポーネントをページに構成する
   レイヤー(配置・ギャップ・ランドマーク骨格の合成)が未実装。
   `scan component` で分解 → 個別収束 → **再合成** の最後の一手が欠けている。
3. **色シグナルの統計が細部で壊れている**(issues-drafts 10/11、v3 実験で
   工数の約 40%)。`sampleRegionColor` が領域中央値を取るためテキスト色変化
   (`#212529 → #090353`)が `#ffffff → #ffffff` と報告される。diff ピクセル
   限定サンプリング + テキスト領域用の明暗ペア抽出が必要。

### P1 — 実装済みだが未公開 / 半配線

4. **CLI 未公開の内部機能**: `selector-heal`(パッケージ説明に載っているのに
   コマンドなし)、palette diff 単体、`grid-ratio` / `landscape-diff` /
   `shift-origin` / `region-classify` / `semantic-drilldown` の個別呼び出し。
   エージェントが「fr 比率だけ教えて」とピンポイントに聞けない。
5. **`vlmkit-heal` に bin がなく、ルート CLI にも `heal` コマンドがない。**
   修復はライブラリ/smoke スクリプト経由のみ。healer は advisory-only で
   修正を永続化しない(シナリオ O6 🟡)。
6. **参照画像生成(`image-gen-client.ts`)が孤立。** docblock は
   vlmkit-markup/workflow から使われると主張するが実際の呼び出しは
   design-runs のスクリプト 1 本のみ。CLI 表面なし。テキスト仕様 →
   参照画像 → `build component` という A6(テキストからの生成)経路を
   開通させる鍵なのに未配線。
7. **region bbox の非 JSON 出力欠落 + crop ヘルパーなし**(draft 05)、
   **`layout-shift` ラベルに測定済み `shift {dx,dy}` が付かない**(draft 12)。

### P2 — ロードマップ明記済みの未実装

8. `vlmkit design analyze-brief` / `vlmkit design prompt`
   (markup-implementation-flow の step 0 支援)— 未実装。
9. **レポート JSON の機械可読化**(landmark drilldown / goal evidence /
   scrollport / canvas evidence)— エージェントが Markdown をスクレイプ
   している。
10. UI Contract シミュレータ(Chromium / Crater / layout backend 間の
    契約レイアウト比較)、既存実装イントロスペクション(DOM+CSS から
    state/content/decoration 意図を推定)、MoonBit ブラウザレス高速
    レンダラ(align-items 未対応あり)。

### P3 — 実験結果が示す品質課題

11. **VLM `diff region` は修復用途で正味マイナスのまま**(セレクタ誤帰属、
    捏造 hex デルタ、Delta-0 行)。refutation gate(PIXEL_REFUTE_FLOOR)で
    最悪ケースは緩和済みだが、推奨は依然 deterministic 経路。VLM 帰属を
    region-selector-match の決定論結果で常時クロスチェックする統合が未了。
12. **「pixel-perfect ≠ 修復完了」の静的キャプチャ盲点**: JS トグルの状態
    クラス(navbar-shrink 等)、エンジン固有ルール(:-moz-placeholder)、
    閾値未満のデルタ。状態網羅キャプチャ + cross-engine の第一級化が必要
    (A/B シリーズ最大の知見)。
13. **DOM 変更と CSS 変更の区別がない。** コピーを変えたエージェントが
    47.5% diff を食らった件。DOM/a11y 等価性プリフライトは migration-compare
    にはあるが、build component / wireframe 経路には未統合。
14. **親レイアウト修正と子スタイルの衝突**(V9a/V9b): parent gap 修正時に
    child margin を掃除せず +5pp 回帰、原因(カード padding 不足)ではなく
    症状(+42px)を提案。警告文のみで構造的対策なし。
15. エージェントの**初期構造選択が新しい上限**: ツール起因の失敗は減り、
    「最初に選ぶ構造・寸法が悪い」失敗に移行(mobile 16.4% vs クリーン
    スタート 0.2%)。→ P0-1(IR→スキャフォールド)と P2-8(brief 分析)が
    効く領域。

### P4 — シナリオマトリクス残課題・エルゴノミクス

16. **O ティア(エージェント・エルゴノミクス)が最大の未実装クラスタ**:
    O7 スキルレジストリ(`.vrt-skills/` は例 1 件のみ)、O9 エージェント
    編集可能ヘルパー層、O10 セッション記録、O11 バグ再現フィクスチャ
    自動生成、O12 レンダ結果への LLM 判定 CLI。
17. C7 ロケール別フォント(font-family 検出未実装、typography の
    serif/sans 判別も deferred)、A3 手描きワイヤーフレーム(text-row
    検出が活字前提)、I6 複数形処理。
18. アニメーション中間フレーム(E9/E12/N3)、CWV(bundle size / lazy-load)
    — 自動マークアップとの関連は薄いが認知済みの ❌。
19. **ドキュメント腐敗がエージェントを直撃**: ルート `SKILL.md` の File
    Structure は全パスが実在せず、markup 系コマンドに一切触れない。
    vrt/vlmkit 命名の分裂が architecture.md / api-design.md / ja README /
    TODO.md に残存。スキル記述ドリフト(Gap K/L/M)も再発中。

---

## 3. 推奨(次の一手)

1. **IR→HTML スキャフォールドコンパイラ**(P0-1)+ **マルチコンポーネント
   合成**(P0-2)。エージェント失敗の主因が「初期構造の選択ミス」に移った今、
   投資対効果が最も高い。introspect が既にあるので round-trip
   (introspect → contract → scaffold)でテスト可能。
2. **色サンプリングの修正**(P0-3、drafts 10/11)。小さい変更で v3 実験の
   最大時間損失を消せる。
3. **公開の負債返済**: `heal` コマンド、`selector-heal`、palette、
   region crop、shift {dx,dy} の CLI/JSON 露出(P1)。実装済み機能を
   エージェントから呼べるようにするだけで済む。
4. **SKILL.md / 命名の全面更新**(P4-19)。エージェントが最初に読む
   ファイルが 2 世代前の構成を教えている。

---

## 調査ソース

- `packages/vlmkit-{markup,core,capture,ai,plan,generate,heal}/src`
- `src/cli/cli.ts`(コマンドルータ)、`src/util/markup-loop.ts`
- `docs/markup-implementation-flow.md`(「まだ足りないところ」節)
- `docs/issues-drafts/01–12`
- `docs/reports/2026-05-13-scenario-matrix-v2.md`(56 ✅ / 33 🟡 / 13 ❌ / 11 ⚪)
- `docs/reports/2026-06-06-ab-external-synthesis.md`、`-v2` / `-v3`
- `docs/reports/2026-05-15-design-md-scenario-v9.md`、
  `2026-05-19-agent-skills-validation-v5.md`
- `docs/knowledge.md`、`docs/feature-review.md`、`TODO.md`
