# 2026-07-27 auto-markup skill + Haiku 単独での自動マークアップ証明

## 主張

**Haiku(claude-haiku-4-5)だけを推論エージェントとして、ターゲット
スクリーンショットのピクセルのみから HTML/CSS を自動再構築できる。**
Stage-2 LLM なし、VLM API なし — 決定論シグナルツール
(`check palette` / `build page` / `build component`)と Haiku 自身の
視覚で完結する。

## 提供形態

`.claude/skills/auto-markup/SKILL.md` として skill 化(本コミット)。
パイプライン: ターゲット観察(palette/scan)→ 骨格(contract scaffold
または直書き)→ 構成収束(build page: 欠落/余剰/順序/gap)→
部品収束(build component + report.json)→ 装飾監査(palette/tokens/
theme)→ 任意の VLM 補助(diff region、色命名のみ)。

MCP ではなく skill を選んだ理由: リポジトリの既存慣習(`.claude/skills/`
に 7 skill)に一致し、追加の常駐プロセス・依存ゼロで、任意の Claude Code
セッションに自動配布されるため。CLI 自体が安定 I/F なので、MCP 化が
必要になれば skill の各ステップを tool にマップするだけでよい。

## 証明ランの設定

- **エージェント**: Haiku サブエージェント(claude-haiku-4-5)単独。
  プロンプトは skill ファイルへの参照 + タスク + 「compose/ 等の正解
  HTML があり得るディレクトリを開くこと禁止」のルールのみ。
- **入力**: `fixtures/auto-markup-proof/target.png`(1024x768、
  hero / カード3枚 grid / CTA バンド / footer の合成ページ)だけ。
- **予算**: 最大 5 計測ラウンド。

## 結果(親エージェントによる独立検証値)

Haiku は **4 ラウンド・23 tool call・112 秒**で完走。自己申告値ではなく
検証者が `attempt.html` を再計測した値:

| 指標 | 値 |
|---|---|
| `build page` matched | **6/6**(missing 0 / extra 0) |
| IoU | **0.97–0.99**(全コンポーネント) |
| 位置ズレ | ≤2px、gap デルタ 0 |
| `diff png` ピクセル diff | **1.40%**(11,012 / 786,432 px) |
| 残差の内訳 | glyph AA + 微小 typography(1 layout-shift, 3 element-added, 2 text-change いずれも数px級) |
| コピー | 全文一致("Compose the page" / "Hero copy goes here." / Card A-C alpha/beta/gamma / "Ready to start?" / "Footer content") |
| パレット | 5 色一致(hero #1f2937 系 / カード #eef2ff 系 / CTA #2563eb 系 / footer #e5e7eb 系 / 背景) |
| 構造 | `<header>` / `<footer>` landmark + div.cards/div.card(127 行、自己完結)。`<main>` 欠落は今後の skill 文言改善点 |

成果物: `fixtures/auto-markup-proof/attempt-haiku.html`(Haiku の生成物、
無編集)。再現: 同フィクスチャに対して skill の手順を任意のエージェントで
実行。

## 解釈

- 2026-05-13 dogfood(Sonnet 級エージェントで 87%→1.3-1.7% / 3-5
  ラウンド)と同水準の収束を、**Haiku で 4 ラウンド 1.40%** で達成。
  シグナルツールが十分に具体的な修正指示(bbox / fill hex / "reduce
  72px")を返すため、エージェント側の推論負荷が小さく、小型モデルでも
  ループが回ることを示す。
- 「エージェントの初期構造選択が上限」(2026-06 時点の結論)に対し、
  `build page` の欠落/順序/gap シグナルが初期構造の誤りを 1 ラウンド目で
  名指しするため、上限が実質的に引き上がった。
- 注意: 本フィクスチャは太い構造のページ(コンポーネント 6 個)。
  細粒度 UI(フォーム密集、アイコン多数)での Haiku 上限は未計測 —
  次の検証課題。

## シナリオ 2: スクロール + media query 分岐(同日追記)

### 設定

`fixtures/auto-markup-proof/dashboard/` — Ops ダッシュボード。
シナリオ 1 より難しい要素:

- **@media 分岐**: モバイル(≤768px)でサイドバーと top nav が消え、
  統計カードが縦積みになる(presence 変化を含む)
- **スクロールポート**: Activity フィードは固定高 + `overflow-y: auto`、
  10 行中 6 行のみ可視
- **入力は 3 枚の PNG**: desktop 1280 / mobile 375 / desktop のフィードを
  最下部までスクロールした状態(不可視行の伝達手段)
- skill に 3.5(multi-viewport)/ 3.6(scrollport)節を追加して対応

### 経過 — ツールバグの発見と修正

初回ラン(6 ラウンド)で desktop の `build page` が
matched=3 / missing=5 / extra=4 という崩壊した数値を返した。独立検証で
**ツール側のバグ**と判明: 周縁 8 点サンプリングの背景検出が全幅ダーク
ヘッダーに汚染され、target と current で背景判定が非対称になり
(片側は淡色 body、片側はダークヘッダー)、コンポーネント集合が比較
不能になっていた。`composePageDiff` を「target の全画像ストライド
最頻色を両側の共通背景として使う」方式に修正(コミット
"Fix build page background asymmetry on dark-header pages")。
修正後、同じ attempt の再計測は matched=8 / missing=0 / extra=0 +
実行可能なデルタに正常化。**複雑シナリオのドッグフードが実バグを
1 件発見・修正した。**

### 結果(修正済みツール + 検証者の独立再計測)

Haiku は合計 10 ラウンド(初回 6 + フィードバック後 4)で収束:

| 指標 | desktop (1280) | mobile (375) |
|---|---|---|
| `build page` | **8/8 matched、missing 0、extra 0** | **8/8 matched、missing 0、extra 0** |
| 統計カード | 位置 Δ≤1px、サイズ完全一致(318-319x99)、IoU 0.91-0.92 | 幅/高さ一致、Δy 8px、IoU 0.85 |
| Activity パネル | IoU 0.94 | IoU 0.85(高さ -43px) |
| ピクセル diff | **6.20%** | **6.23%** |
| スクロール実測 | **450 > 298 ✓** | **440 > 258 ✓** |

- breakpoint: `@media (max-width: 768px)` を `scan breakpoints` が検出 ✓
- フィード 10 行すべて再現(2 枚の screenshot から結合、重複 2 行を排除)✓
- サイドバー/nav のモバイル非表示 ✓、Activity 見出しのパネル内配置・
  ゼブラ行・6 行可視 + 7 行目切れも一致 ✓
- 残差 6.2% の内訳: topbar 高さ(mobile +8px)、フィードパネル高、
  glyph AA — 構成レベルは完全一致で、数 px の padding 差が主

### シナリオ 1 との比較

| | シナリオ 1(landing) | シナリオ 2(dashboard) |
|---|---|---|
| ターゲット | 1 枚 | 3 枚(2 viewport + scrolled) |
| 特殊要素 | なし | @media 分岐、scrollport、presence 変化 |
| ラウンド | 4 | 10(うちツールバグで 6 消費) |
| 構成 | 6/6 | 8/8 + 8/8(両 viewport) |
| ピクセル diff | 1.40% | 6.2%(両 viewport) |

小型モデルでも「viewport ごとに build page → media query 内だけ修正」
という手順が回ること、スクロール要件は screenshot 2 枚(通常+scrolled)
で伝達できることを確認。ピクセル収束はシナリオ 1 より緩い —
多 viewport では 1 つの修正が他 viewport に波及するため、ラウンド予算を
多めに取るべき(skill の budget 節に反映済みの 3-5 ラウンドでは不足、
複雑ページは 8-12 ラウンド見当)。

## シナリオ 3: フォーム密集 UI + :hover / :focus 状態(同日追記)

### 設定

`fixtures/auto-markup-proof/authform/` — 中央寄せ認証カード。
シナリオ 1-2 で未計測だった 2 軸を検証:

- **細粒度コンポーネント**: 見出し / サブタイトル / ラベル付き入力 ×2
  (placeholder 付き)/ チェックボックス行 + リンク / primary ボタン /
  divider / secondary ボタン / フッターリンク
- **インタラクティブ状態**: primary ボタンの `:hover`(暗転)、
  email 入力の `:focus`(青枠 + リング)。デフォルト screenshot には
  写らないため、**hover 中 / focus 中の screenshot を追加ターゲット**
  として供給(scrolled-feed と同じ手法)
- skill に 3.7(interactive states)節を追加して対応

### 結果(検証者の独立再計測 — 実際に hover / focus 操作して撮影)

Haiku は 6 ラウンド・27 tool call・133 秒で完走:

| 状態 | 検証方法 | ピクセル diff |
|---|---|---|
| default | そのまま撮影 | **2.64%** |
| button hover | Playwright `hover()` 実操作 | **2.64%**(状態デルタは完全一致 — 残差はベースと同一) |
| email focus | Playwright `focus()` 実操作 | **3.32%**(リング再現、微小差) |

- multi-state 検証(CDP forcePseudoState): `:hover` 誘発 2.45% で
  **ΔLuma 負(正しく暗転)**、`:focus-visible` 誘発 1.87%。
  suspect / direction? フラグなし。
- hover 色の読み取り: Haiku は `#2464ec → #1c4cdc` と報告
  (実際 `#2563eb → #1d4ed8`、palette 量子化バケット由来の Δ≤9)。
- 全コピー・placeholder・チェック状態まで一致。

### 3 シナリオまとめ

| | S1 landing | S2 dashboard | S3 auth form |
|---|---|---|---|
| 難度要素 | なし | @media 分岐、scrollport、presence 変化 | 細粒度 ×10 部品、:hover/:focus |
| ターゲット枚数 | 1 | 3(2 viewport + scrolled) | 3(default + hover + focus) |
| ラウンド | 4 | 10(うち 6 はツールバグ下) | 6 |
| 構成収束 | 6/6 | 8/8 × 2 viewport | カード 1/1(IoU 0.98) |
| ピクセル diff | 1.40% | 6.2% | 2.6-3.3%(3 状態) |
| 副産物 | — | build page 背景検出バグ修正 | — |

「状態 screenshot を追加ターゲットとして渡す」パターンは scrollport
(S2)と states(S3)の両方で機能した — **静的画像では伝達できない
振る舞い要件は、その状態の画像を 1 枚足せば小型モデルにも伝わる**。

## 関連

- skill: `.claude/skills/auto-markup/SKILL.md`
- Haiku の VLM 単体評価(diff region): `docs/reports/2026-07-27-vlm-haiku-region-diff-agent-harness.md`
- 実装レビュー: `docs/reports/2026-07-27-auto-markup-feature-review.md`
