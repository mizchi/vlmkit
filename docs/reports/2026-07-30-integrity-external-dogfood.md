# check integrity — S14c 外部ページ dogfood(2026-07-30)

設計: `docs/design/creative-markup-eval.md` / 前提: S14b 9/9・自作 S14c は
green の状態で、免除ルールの穴を実世界ページで探す(APG interactions
dogfood の教訓: 自作 fixture だけでは免除の穴は見つからない)。

## 方法

Chromium が proxy 越しに外部へ出られない環境のため、`wget -q -p -k -E` で
5 ページをローカルミラーし、file:// で gate を当てた。

| ページ | 選定理由 |
|---|---|
| example.com | 自明ベースライン |
| danluu.com | 意図的ミニマル CSS(数ルールで UA デフォルト維持) |
| csszengarden.com | 古典 CSS 技法の見本市(image replacement 等) |
| news.ycombinator.com | 非レスポンシブ table レイアウト |
| w3.org APG patterns index | 実務級サイト(JS/アイコンスプライト/複雑レイアウト) |

## 見つかった免除ルールの穴(→ 即修正 + 回帰テスト)

### 1. image replacement / visually-hidden(csszengarden で 6 fail 誤報)

Kellum 法(`height:0;padding-top;overflow:hidden` + `::before` グリフ)と
`text-indent:100%;nowrap` のリンクを `text-clipped` fail と誤判定。
`.sr-only`(1px box)も同型で誤爆するはずで、これは実務ページの大半が
踏む致命的な偽陽性クラスだった。

**修正(判別軸は「部分切れ vs 完全隠し」)**: clip 候補ごとに直下テキスト
ノードの rects と要素 box の交差面積(`textVisibleArea`)を実測。
- 部分的に見えている(≥4px²)→ 従来どおり fail(本物の切れ)
- 完全に隠れている + 置換シグナル(background-image / `::before`・
  `::after` content / 1px sr-only 形状)→ **exempt**(理由付き)
- 完全に隠れているが置換シグナル無し → **warn**(未完成の
  visually-hidden か事故の全クリップか、決定論では判別不能と明示)

### 2. scroll-scan 委譲の二重報告(同 fixture で発覚)

text 側で免除した要素(sr-only 等)が A7 委譲の `clipped-content` warn と
して再浮上していた。dedupe を findings だけでなく **exempted のセレクタ**
にも拡張。

### 3. third-party リソース失敗の重さ(danluu で 1 fail 誤報)

Cloudflare beacon(cross-origin analytics)のロード失敗を js-error fail
と判定していた。ページ自身のマークアップ健全性ゲートとしては過剰。
**修正**: script / stylesheet のロード失敗は **same-origin なら fail、
cross-origin なら warn**(サードパーティはページ自身の欠陥ではない)。

### 4. 意図的ミニマル CSS(danluu で unstyled-page warn 誤報)

danluu.com は 4 ルールだけ宣言して UA デフォルトを意図的に使う。
**修正**: 総 CSS ルール数 < 5 は「デザイン選択」として UA 指紋 warn を
出さない(全 stylesheet ロード失敗の fail 判定は従来どおり)。

## 修正後の結果

| ページ | verdict | 残る指摘 | 評価 |
|---|---|---|---|
| example.com | clean | — | ✓ |
| danluu.com | clean | warn 2(beacon — 本環境の proxy 遮断による環境アーティファクト) | ✓ 偽陽性 2 件解消 |
| csszengarden.com | clean | exempted 22(image replacement / アンカー) | ✓ 偽陽性 6 件解消、免除が可視 |
| news.ycombinator.com | **defects** | page-overflow-x 36px @768(#hnmain) | **真の陽性** — HN は実際に狭幅で横スクロールする |
| w3.org APG | defects | js-error ×2 + broken-image(query 付き main.js と上位パス画像を wget が取得できず) | **ミラー欠損アーティファクト** — 実サイトの欠陥ではない(APG interactions dogfood と同じミラー限界) |

## 結論

- 外部 dogfood は今回も自作 fixture が見せない穴を出した: **4 クラスの
  ルール修正**(うち image replacement / sr-only は実務ページの大半に存在
  する致命的偽陽性クラス)。全修正に回帰テストを常設(バッテリー 22 本)。
- 真の陽性 1 件(HN の非レスポンシブ横スクロール)は gate の意図どおり。
- ミラー限界は既知のとおり: query-string 付きアセットと上位パス参照は
  wget で欠け、その欠損が js-error / broken-image として出る。外部ページ
  評価は「ミラー起因 fail の手動トリアージ」が必須(gate の欠陥ではなく
  評価手順の制約)。
- 判別軸「部分切れ=欠陥 / 完全隠し=パターン(シグナル有無で exempt/warn)」
  は決定論のまま — VLM に頼らず csszengarden 全 22 候補を正しく仕分けた。
