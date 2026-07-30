# 設計: MCP 露出 と browser-use 領域への進出

日付: 2026-07-29 / 背景: `docs/reports/2026-07-29-ai-markup-tooling-landscape.md`

ポジショニング: vlmkit は「決定論的な検証器」。生成器(v0/Lovable…)や
タスク自動化エージェント(browser-use/Stagehand…)と正面競合しない。
両領域に**検証レイヤとして**接続するのが本設計の狙い。

---

## パート A: MCP 露出(近い / 低リスク)

### 目的
Playwright もコーディングエージェントも MCP に収束した今、vlmkit の
決定論ゲートを **MCP tool** として出し、他人のエージェントループの
「検証ステップ」に組み込ませる。生成は相手、判定は vlmkit。

### 現状資産(再利用できるもの)
- `src/api/api-app.ts` … Hono アプリ + `/api/openapi.json` + 既存ルート
  (smoke-test, cloudflare screenshot/crawl, crater layout)。ツール
  ハンドラの受け皿が既にある。
- 各ゲートは既に「純関数 + CLI 薄皮」構造:
  `runMarkupVerify` / `runInteractionMap`(compare 含む)/
  `buildHandlerSurface` + `deriveHandlerIssues` / `runRegionJudge` /
  `runCopyCheck` / `composePageDiff` / `runMarkupAutofix`。
  → MCP は**この純関数を JSON-in/JSON-out で薄く包むだけ**。

### 露出するツール(第一弾、決定論のみ・キー不要)
| MCP tool | 委譲先 | 入力 | 出力(構造化) |
|---|---|---|---|
| `verify_markup` | runMarkupVerify | attempt, targets[], reference? | verdict, targets[], gates[], kickback[] |
| `check_interactions` | runInteractionMap + compare | source, reference?, handlers? | inventory, issues[], contract, surface |
| `scan_handlers` | buildHandlerSurface | source | surface, pointer-only issues[] |
| `build_page` | composePageDiff | target, current | matched/missing/extra/ordering/gap |
| `check_copy` | runCopyCheck | source, target?/manifest? | mismatches, sheet paths |
| (opt) `heal_markup` | runMarkupAutofix | attempt, targets[] | rounds[], done — ※要 LLM キー |

### 設計原則(このリポジトリの学習を MCP に持ち込む)
1. **VLM に数値を言わせない**は MCP でも不変。座標/寸法/色は決定論、
   vision は「読む・判断する」だけ。
2. **キックバックはそのまま「次アクションの指示」になる形**で返す
   (帰属セレクタ・kind タグ・near-miss・grouping caveat 込み)。
   S9 リプレイで実証済みの「帰属付き kickback が rounds を半減」を
   MCP 消費者にそのまま提供する。
3. **降格はツールの判定**(pixel-confirmed 等)を JSON フラグで明示 —
   消費エージェントが「アーティファクト」と誤解する余地を与えない
   (合理化 7 例の再発防止をプロトコルに焼く)。
4. `--handlers`/`--reference` 等のモードは MCP の boolean/optional 引数に
   一対一対応。CLI と MCP で挙動を分岐させない(単一の純関数)。

### 実装状況(2026-07-30)
**Part A は出荷済み**(`packages/vlmkit-mcp/`)。露出ツール 6 本:
verify_markup / check_interactions(+reference 契約 +handlers)/
scan_handlers / check_copy / **build_page** / **check_equivalence**(keyless
advisory)。`vlmkit mcp`(stdio)で起動、JSON-RPC initialize/tools/list/
tools-call を実サーバでスモーク済み、8 パッケージテストが MCP 出力=純関数
出力を保証。
- **意図的スキップ**: 単体の behavior ゲート(check_breakpoints /
  scan_scroll / check_scroll / check_animation / check_motion)は
  verify_markup が内部実行し gate 結果を返すため、MCP 標準ツールとしては
  重複。ターゲット画像を持たず「挙動だけ」を見たい à-la-carte 需要が
  実証されたら追加する(完成度の穴ではなく、需要待ちの判断)。

### 実装ステップ
1. `@modelcontextprotocol/sdk`(stdio + streamable-http)を
   `packages/vlmkit-mcp/`(新規)に追加。Playwright 依存は tool 実行時
   dynamic import(barrel を汚さない現行規約に従う)。
2. 各 tool の入力 zod schema を `api-types.ts` の型から導出、出力は既存
   の Report 型をそのまま JSON 化。
3. `vlmkit mcp` CLI サブコマンド(stdio サーバ起動)。Hono 側にも
   `/mcp` streamable-http エンドポイントを追加(`createApiApp` 拡張)。
4. スモーク: MCP Inspector で各 tool を叩き、CLI 出力と JSON 等価を
   突合するテスト(既存の cli.test.ts と同じ純関数を共有するので薄い)。

### リスク / 判断保留
- 大きな target 画像の base64 往復コスト → tool は**パス受け取り**を
  基本、リモート実行時のみ artifact ストレージ経由。
- 認証付き MCP(claude.ai コネクタ)はヘッドレス/cron で不在になりうる
  → ローカル stdio を第一級に。

---

## パート B: browser-use 領域(遠い / 差別化前提)

### 実装状況(2026-07-30, キー不要部分)
**verified-execution エンジンは出荷済み**: `vlmkit verify flow`
(`inspect/flow-verify.ts`)+ MCP `verify_flow`。スクリプト化フロー
(action → 事後条件アサート: attr/visible/hidden/focused/text/count)を
決定論検証し、最初の未達で FAIL する。「何かした」でなく「宣言した状態が
成立した」をゲートする Part B の核が、LLM 無しで動く。残るのは
**ゴール→フロー プランナ(要 LLM キー)**のみ — flow-verify がその
出力の実行・検証層になる。足りないもの #2(事後条件言語)は完了。

### 何をもって「進出」とするか
browser-use / Stagehand / Skyvern は **ゴール駆動のタスク自動化**
(「ログインしてカートに入れる」)。ここに素で参入しても後発で勝てない。
vlmkit が持ち込める唯一の差別化は **"verified agent"**:
> 毎ステップ後に決定論アサーションを挟み、"それらしく動いた" ではなく
> "宣言した事後条件を満たした" ことをゲートするブラウザエージェント。
競合の弱点(毎ステップ LLM・"見た目 OK" 止まり・検証欠如)への直撃。

### 現状資産(既に半分ある)
- `inspect/explore.ts` … a11y ツリーからのアクション自律探索
  (`runExplore` / `DiscoveredAction`)。
- `inspect/interact.ts` … 宣言的アクション列の駆動 + ステップ間
  スナップショット + ピクセル diff(`runInteract`)。
- `util/goal-runner.ts` … **ゴール + 事後不変条件(invariant)チェック**
  (`runGoal`、`goalRealized`)。← これが差別化の核。
- `inspect/interaction-map.ts` … イベント→ARIA 状態遷移の決定論採取。
  ステップ後の「状態が意図通り変わったか」判定にそのまま使える。

### 足りないもの(進出の要件)
1. **ゴール→アクション プランナ**(LLM)。ただし競合と違い、プランナの
   出力を「実行 → interaction-map/goal-runner で事後条件検証 →
   失敗ならロールバック/再計画」の**決定論ゲートで挟む**。
   fix-loop の apply-and-rollback をブラウザ操作に移植する形。
2. **ステップ事後条件の言語**。goal-runner の invariant を
   「aria-selected が変わる」「live region が announce する」「focus が
   dialog に入る」等、interaction-map の語彙で書けるように拡張。
3. **アクションキャッシュ**(Stagehand v3 が示した勝ち筋)。成功アクション
   列を run-ledger 派生でキャッシュし、再実行時に LLM を飛ばす。
   vlmkit は既に `.vlmkit/run-ledger.jsonl` を持つので素地あり。
4. **セレクタ耐性**。既存 `heal/selector-heal.ts` を実行時 healing に
   接続(DOM が動いても事後条件で照合)。
5. **副作用の隔離**。submit/遷移/削除を含むため、fresh-load 分離 +
   navigation ブロック(interaction-map のプローブで実証済みの型)。

### 最小実証(MVP)の切り方
- `vlmkit act <url> --goal "..." --assert <invariant-file>`:
  プランナが 1-3 アクションを出す → 実行 → interaction-map で invariant
  検証 → done/rollback。**検証付きの最小ループ**を 1 本通すのが第一目標。
- ベンチ: browser-use の公開タスクを「検証付き成功率(事後条件まで
  満たした割合)」で測る。競合の "clicked something" 成功と、vlmkit の
  "state actually changed as asserted" 成功の差を数値化するのが売り。

### 判断保留 / リスク
- プランナ品質はモデル依存(S9-fresh の null result と同型: 検証が
  あっても弱いモデルは越えられない)。→ 検証は「弱いモデルの底上げ」で
  なく「強いモデルの高速化 + 誤りの遮断」と位置づける(実測済みの結論)。
- 汎用 web への一般化はスコープ特大 → まず**自リポジトリの UI 検証**
  (dogfood 対象サイト)に閉じた verified-agent から。
- API キー必須 → パート A(キー不要の検証 MCP)を先に出荷し、B は
  その上物として段階投入。

### 順序の推奨
A(MCP 露出、キー不要、低リスク、即価値)→ B の MVP(`act` 1 ループ)→
ベンチで "verified success rate" を数値化 → 判断。
