# 設計: 参照なし(創造的)マークアップの評価シナリオ

日付: 2026-07-30 / ステータス: Layer A 実装済み(同日)、Layer B / S14a は未着手

## 実装状況(2026-07-30)

実装順序 1〜4 を出荷:
- `packages/vlmkit-markup/src/inspect/integrity-check.ts` — Layer A 全プローブ
  (A1-A9)。A3 の stylesheet/script/font は **wire 検知**(requestfailed +
  非 OK response)に変更 — Chromium は 404 の `<link>` にも空の
  CSSStyleSheet を付けるため `link.sheet != null` では死んだ stylesheet を
  見分けられない(実装中に実測)。A2 は DOM 側 textBlocks を判定に含める
  (テキストのみのページはグリフが minArea 未満で components 0 になるため、
  pixel 単独では偽 degenerate になる)。
- CLI `check integrity` + MCP `check_integrity`(8 本目)。
- S14b mutation バッテリー: **9/9 クラス検知**(回帰テストとして常設)。
- S14c 偽陽性監査(自作分): hero オーバーレイ / ellipsis / 位置決め
  アンカー / aria-hidden 装飾 → verdict clean、全候補が `exempted` に記録。
- 初回 dogfood: S8 edit fixture(1280 で DONE 検証済み)が 375 で 67px の
  実在オーバーフローを持つことを検出(`div.plans` 帰属) — 参照ありゲートの
  死角(target が無い幅)をそのまま裏付ける結果。
- S14c 外部 dogfood 実施済み(同日): 5 実ページで免除ルール 4 クラスを
  修正(image replacement / sr-only が最重要)。
  `docs/reports/2026-07-30-integrity-external-dogfood.md`。
- S14a 実走済み(同日): Haiku DONE(1 修正ラウンド)、検証フェーズで
  gate 沈黙欠陥 0。`docs/reports/2026-07-28-verifier-tooling-and-s6.md`
  追記13。派生課題: 高密度ブリーフの負荷版、check copy の状態別検証。
- Layer B ワークシート: **凍結(需要ゲート、2026-07-30)** — 決定論降格で
  残余 2 軸まで縮小し、gate 沈黙欠陥の実観測が着手条件(下記 Layer B 節)。

### Layer A 拡張(2026-07-30 第 2 陣) — B 軸からの決定論降格

S14 の判別語彙(部分切れ vs 完全隠し / positioned+z-index は意図 /
近接=事故)を使い、Layer B に残していた判断 4 つを決定論化:

- **A10 `container-protrusion`** — overflow visible のまま painted parent
  (枠線・背景を持つ box)から in-flow の子がはみ出す(どのゲートも
  沈黙していた最頻クラス)。positioned な子(badge)と負の水平マージン
  (full-bleed breakout)はツール側 exempt。
- **A11 `invisible-text` / `low-contrast-text`** — 単色背景のみ対象に
  αブレンド + 累積 opacity 込みで WCAG 比を実測(<1.15 fail、<3 warn)。
  背景画像/グラデーションはページ単位の集約 exempt 行で明示スキップ
  (Layer B 領域のまま)。disabled / text-shadow は exempt。
  **image-replacement 等で視覚的に隠れたテキスト(自要素または祖先の
  クリップ外)はスキップ** — zen garden dogfood で発見した偽陽性クラス
  (閉じたドロップダウン内の白文字を invisible と誤報)への対処。
- **A12 `near-misalignment`(warn)** — 同型兄弟 3+ が left/center/right/top
  のいずれかで正確に揃っているとき、2-8px だけ外れた要素を警告。
  「0px も 9px 以上も正常、帯域内だけ事故」という near-miss 原理の整列版。
  他軸で正確に揃う要素(左揃えリスト内の中央揃え)は意図としてスキップ。
- **`check layout --contract`(別ゲート、`inspect/layout-contract.ts`)** —
  ブリーフの構造要求(幅±許容、1 行あたりセル数、full-width 折りたたみ、
  積み順、可視性、個数)を宣言 JSON で照合。S14a-stress の検証者が手書き
  していた DOM 計測の正式化。MCP `check_layout`(9 本目)。

dogfood(zen garden / danluu / HN / 自作 fixture 全て)で偽陽性 0 に調整
済み。attempt-stress の #changelog が low-contrast warn(2.56:1)として
検出されたのは真の陽性(Haiku が書いた実際に薄すぎる文字)。

## 背景と目的

これまでの評価軸(S1-S13)はすべて **お手本あり** — target 画像・reference
HTML・copy manifest のいずれかが正解として存在し、gate は「一致したか」を
判定してきた。しかし実運用では「ブリーフだけ渡してゼロからマークアップさせる」
創造的タスクが頻出する。このとき正解画像は存在しないが、**それでも明確に
評価できる項目がある**:

- レイアウト崩れ(テキスト衝突、はみ出し、潰れたコンテナ、水平スクロール)
- JS エラーによる UI 構築の失敗(白画面、部品欠落)
- リソース切れ(壊れた画像、読めなかった CSS)
- スタイル未適用(UA デフォルトのままの「素 HTML」)

これらは「デザインの良し悪し」ではなく **欠陥(defect)** であり、
(a) 決定論のレイアウト検査と (b) VLM の視覚判断の 2 層で検知できる。
本設計はその 2 層の分担・新ゲート `check integrity`・検証シナリオ S14 を定める。

## 設計原則(このリポジトリの実測から持ち込むもの)

1. **VLM に数値を言わせない**。座標・寸法・重なり量・比率はすべて
   決定論(pixel + DOM 計測)。VLM は「読む・判断する」だけ
   (diff-region A/B の net-negative 実測より)。
2. **降格・免除はツールの判定**。意図的オーバーレイ(hero テキスト等)の
   免除はツール側ルールとして JSON に明示し、エージェントの合理化余地を
   残さない(合理化 7 例の再発防止)。
3. **ピクセル作者の自己レビューは無効**(same-eyes)。Layer B の VLM 判定は
   マークアップしたエージェントと別の読み手であることを必須とする。
4. **VLM の主張は決定論で反証(refutation)する**。vlm-region-diff の
   refutation gate(2026-06-08)と同じ形: VLM が「崩れている」と言った領域を
   Layer A の計測でクロスチェックし、裏が取れない行は低信頼に降格する。

## 欠陥タクソノミー(参照なしで判定可能なもの)

### Layer A — 決定論(hard、単体で FAIL 判定可)

| # | 欠陥クラス | 検知法 | 再利用資産 |
|---|---|---|---|
| A1 | JS エラー / UI 構築失敗 | `page.on("pageerror")` + `console.error` + `requestfailed` を load〜idle まで収集。first-paint 前の fatal(構築を止めた)か後(装飾的)かを分類 | `inspect/smoke-runner.ts:295` の pageerror 監視 |
| A2 | 空・退化レンダー | スクリーンショットに component 抽出をかけ、成分数 0 / 背景率 >98% / ink が viewport 上部 10% のみ、を退化と判定 | `component-bbox.ts` `extractComponentsFromRgba`(target なし・current 単体に適用) |
| A3 | 壊れたリソース | `img.naturalWidth === 0`(src あり・非 lazy)、`link[rel=stylesheet]` の sheet 未ロード、`@font-face` 失敗 | 新規(1 つの in-page スクリプト) |
| A4 | テキスト衝突(重なり) | `COLLECT_TEXT_BLOCKS` の矩形をペアワイズ交差判定。**免除**: 祖先が `position:absolute/fixed` + z-index 差のある意図的オーバーレイ、`opacity:0`/装飾 (`aria-hidden`) | `inspect/copy-target.ts` `COLLECT_TEXT_BLOCKS` |
| A5 | テキストのはみ出し / 切れ | 要素 `scrollWidth > clientWidth`(overflow visible でない)+ ink が親の painted box 外に出る pixel 検査 | scroll-scan の `clipped-content` プローブと同型 |
| A6 | 潰れたコンテナ | 子の合計高さ ≫ 自身の height(float/absolute の巻き込み失敗、height:0 崩れ) | 新規(DOM 計測のみ) |
| A7 | 水平オーバーフロー / スクロール異常 | 既存 `scan scroll` の `page-overflow-x` / `nested-scroll` / `clipped-content` をそのまま統合実行 | `inspect/scroll-scan.ts`(丸ごと再利用) |
| A8 | スタイル未適用(FOUC / 素 HTML) | stylesheet が宣言されているのに computed style が UA デフォルト比率で高い(font-family serif・margin 8px body・青リンク等の指紋) | 新規 |
| A9 | ビューポート横断 | A2-A8 を 1280 / 768 / 375 の 3 viewport で実行(創造的マークアップは狭幅で崩れるのが定番) | breakpoint sweep の運転形 |

各検知は `severity: fail | warn` と **セレクタ帰属**(どの要素・どの矩形か)を
持つ。S9 リプレイで実証済みの「帰属付き kickback が rounds を半減」を
この gate でも最初から適用する。

### Layer B — VLM 視覚判定(soft、advisory / 反証付き)

> **状態 2026-07-30: 凍結(需要ゲート)。** 下表のうち B1 → A12、
> B2 の主要部(コントラスト)→ A11、B4 構造 → `check layout --contract`、
> B4 コピー → manifest と決定論側に移った。残るのは B3 + 複合背景
> コントラスト + 美観のみで、S14a 全 3 ランの検証フェーズで gate 沈黙
> 欠陥は 0 — B3 が拾うべき欠陥がまだ観測されていない。着手条件は
> 「gate 沈黙欠陥の実観測」。以下は当初設計の記録として残す。

決定論で書けない「見た目としておかしい」層。固定ルーブリックの
**強制択一 + 根拠領域の指名**で答えさせる(自由記述の印象批評はさせない):

| 軸 | 質問(強制択一) | 反証チェック |
|---|---|---|
| B1 整列 | 「明らかに揃っていない要素群があるか — あるなら領域名を指せ」 | 指された領域の bbox 左端/中心線の分散を実測。分散が閾値未満なら refuted |
| B2 視覚階層 | 「見出し・本文・CTA の区別がつくか(yes/no)」 | 指された領域の font-size / weight / 色差を実測 |
| B3 破綻の見落とし網 | 「壊れて見える箇所があるか — 領域名 + 一語の理由」 | Layer A の全検知と突合。**双方向**: VLM が指したのに A が沈黙 → A の穴候補として記録 / A が検知したのに VLM が沈黙 → VLM の盲点として記録 |
| B4 ブリーフ充足 | 「ブリーフの必須要素 X は視認できるか」(要素ごと) | copy sheet(A4 の矩形)に該当テキストが存在するかで反証 |

- 出力形式は `check equivalence` と同じ **keyless advisory**: API キーが
  ない環境ではペア画像 + 質問ワークシートを生成して「別の読み手」
  (人間 or 別エージェント)に渡す。キーがあれば VLM を直接呼ぶ。
- Layer B 単独で FAIL にしない。**Layer A の裏が取れた行だけ** kickback に
  昇格する(refutation gate と同じ demotion 規約: `verification.refuted`
  フラグはツールが付け、消費側に解釈させない)。

### 対象外(このゲートで判定しないもの)

- 美的な良し悪し・ブランド適合(正解が定義できない)
- コントラスト比の厳密な WCAG 判定 — 決定論で可能だが背景合成
  (グラデーション・画像上テキスト)の実装が重い。A8 とは別枠の
  将来プローブとして backlog に置く。
- copy の正誤 — ブリーフが全文を引用している場合は既存
  `check copy --target`(manifest 経路)がそのまま使える。本 gate の
  仕事ではない(S14a の運転で組み合わせる)。

## 新ゲート: `check integrity`

```
vlmkit check integrity <html-or-url> [--viewports 1280,768,375] [--brief brief.md]
                       [--json] [--out-dir .vlmkit/integrity]
```

- **入力はページ単体**(target 画像なし)。`--brief` は B4 の必須要素
  リスト抽出にのみ使う(なければ B4 スキップ)。
- 実行順: 1 回のロードで A1/A3/A8 を収集 → viewport ごとに
  screenshot + A2/A4/A5/A6/A7 → Layer B ワークシート生成。
- 出力: `IntegrityReport { verdict: "clean" | "defects", findings: [...],
  advisory: [...], sheets: [...] }`。findings は
  `{ kind, severity, selector?, rect?, viewport, evidence, exempted?: reason }`
  — 免除した候補も `exempted` として残す(ツールの判定を可視化)。
- kickback 形式は verify markup と同一規約(`[kind]` タグ + セレクタ帰属 +
  「次アクションの指示になる形」)。
- **verify markup との関係**: 参照ありのフローでは verify markup が主 gate の
  まま。`check integrity` は (a) 参照なしタスクの主 gate、(b) 参照ありでも
  behavior gate 群と同様に verify markup へ内部統合できる構造(純関数 +
  CLI 薄皮)にしておく。
- **MCP**: `check_integrity` として第一弾に追加(パス受け取り、
  isError = findings に fail がある)。キー不要なので既存 7 本と同列。

## 検証シナリオ: S14 バッテリー

gate 自体の妥当性を、これまでと同じ手法(mutation testing + 外部 dogfood +
偽陽性監査)で証明してから運用に入れる。

### S14b — mutation バッテリー(最優先: 検知率の証明)

clean なページ(既存 fixture の DONE 到達 attempt を流用)に、
タクソノミー各クラスの欠陥を 1 つずつ注入し、gate が**そのクラスとして**
検知することを確認する。CSS-challenge と同じ検知率表の方法論。

| 注入 | 期待検知 |
|---|---|
| `<script>throw new Error(...)</script>` を head に(構築前 fatal) | A1 fatal |
| 初期化 JS の関数名を 1 字壊す(部品が出ない) | A1 + A2 or A6 |
| `img src` を 404 に | A3 |
| 2 つの absolute テキストを同座標に | A4 |
| コンテナ width を 40px に(テキスト切れ) | A5 |
| flex 親の height:0 + overflow:hidden | A6 |
| 固定 width 1500px の要素を挿入 | A7 (page-overflow-x) |
| stylesheet の href を 404 に | A8 (+A3) |
| 375px でだけ潰れる min-width 指定 | A9 経由で該当クラス |

**合格基準: 9/9 クラス検知**(検知率 100% が目標 — 注入は自明ケースなので、
落ちるならプローブの設計不良)。誤クラス検知(A6 を A2 と報告等)は
帰属の質の問題として別カウント。

### S14c — 偽陽性監査(免除ルールの証明)

意図的パターンだけで構成した clean ページ群に gate を当て、
**findings 0 / exempted に正しく載る**ことを確認:

- hero 画像上のテキストオーバーレイ(A4 免除)
- ドロップダウン / バッジの重なり(A4 免除)
- 横スクロールカルーセル(A7 の nested-scroll 免除条件)
- `text-overflow: ellipsis` の意図的切り詰め(A5 免除)
- 装飾用 `aria-hidden` の重ね文字(A4 免除)

さらに外部ページ(APG dogfood と同様、curl ミラー経由)1-2 本で
実世界の偽陽性を拾う。**APG の教訓**: 自作 fixture だけでは
免除ルールの穴は見つからない — 外部 dogfood を S14c の必須手順にする。

### S14a — 創造的マークアップ実走(gate の実効性)

1. ブリーフのみ(target 画像なし)を書く。**ブリーフに全 copy を引用**し、
   ブリーフ自体が copy manifest を兼ねる形式(hidden-state copy carrier の
   既存規約を流用)。
2. Haiku にゼロからマークアップさせ、`check integrity` をループ駆動
   (DONE 条件 = verdict clean × 3 viewports + `check copy` manifest 一致)。
3. 行き詰まったら Sonnet へ kickback 逐語ハンドオフ(S9 と同じ運転)。
4. 検証フェーズ: 別の読み手が Layer B ワークシート + copy diff で監査
   (same-eyes 排除)。
5. 計測: rounds / 検知が修正を正しく誘導したか(帰属セレクタと実修正の
   対応)/ gate が沈黙したのに検証フェーズで見つかった欠陥(= gate の穴)。

### 指標(knowledge.md 台帳へ)

- クラス別検知率(S14b、9 クラス)
- 偽陽性率(S14c、意図的パターン n 個 + 外部ページ)
- S14a: rounds-to-clean、kickback 追従率、gate 沈黙欠陥数
- Layer B 反証率(VLM 主張のうち決定論で裏が取れた割合 — 低すぎるなら
  B は納品物から外し、A 単独運用に切り替える判断材料)

## 実装順序

1. `inspect/integrity-check.ts` — Layer A プローブ(A1-A8)+ viewport 運転
   (A9)。scroll-scan / copy-target / component-bbox / smoke-runner の
   既存資産を import で束ねる。ユニットテストは mutation 注入形。
2. CLI leaf `check integrity` + MCP `check_integrity`。
3. S14b mutation バッテリー(fixture + テスト化 — 回帰として常設)。
4. S14c 偽陽性 fixture + 外部 dogfood → 免除ルール調整。
5. Layer B ワークシート生成(check equivalence のペア画像 + 質問シートの
   流用)。キーがある環境での VLM 直結は Issue #88 のベンチ枠に相乗り。
6. S14a 実走 + 追記レポート + knowledge.md 台帳行。

## リスク / 判断保留

- **A4 の免除ルールが本丸**。重なり検知自体は自明だが、意図的オーバーレイの
  免除を狭くすると偽陽性の山、広くすると本物の衝突を握り潰す。S14c を
  先に厚くして閾値を実測で決める(z-index 差 + 祖先 positioning +
  背景 ink 密度の 3 条件から開始)。
- **A8 の UA デフォルト指紋**はリセット CSS 使用ページで誤爆しうる
  (destyle 等は意図的に素へ戻す)。stylesheet ロード成否(A3)と
  組み合わせ、「宣言があるのに効いていない」場合のみ fail にする。
- **A2 の退化判定**は全面画像ページ(ポスター的 LP)で背景率が計れない
  → component 抽出 0 個 かつ ink 分布退化の AND 条件にする。
- Layer B はキーなし環境では人間/別エージェント依存 — S14 の証明は
  Layer A 中心で成立させ、B は advisory として段階投入(check equivalence
  と同じ轍)。
