# 検証者ツーリング5点 + S6(実ページ)ドッグフード (2026-07-28)

S5(promo)4 ラン + S6(catalog)2 レグの運用で最も時間を食ったのは
「検証と差し戻し文面の作成」だった。その摩擦を成果物化した 5 機能と、
S6 の結果をまとめる。

## 1. `vlmkit verify markup` — done 条件の一括判定

```bash
vlmkit verify markup attempt.html --target t1.png --target t2.png \
  [--reference reference.html] [--json]
```

1 コマンドで: ターゲットごとの `build page` 構成判定(missing/extra/
ordering)+ 4 ゲート(breakpoints / scroll / animation / motion)+
rest-pose 全ページ pixel diff + **DONE / NOT DONE の明示 verdict** +
**全残差を名指しするキックバック節**(missing×同色 extra ペアは
「変位した自前要素 — 動かせ、足すな」と解釈済み)+ `--reference` で
校正フロア(「ツールノイズ」への誤帰属を測定で遮断)。

効果は S6 leg-2 で実証: **printed verdict をループ駆動にした
エージェントは、6 レグ(S5×4 + S6×2)で初めて成功を偽らずに終了した**
(「NOT DONE」をそのまま最終報告に転記)。差し戻し文面の作成コストも
ゼロになった(verbatim で渡せる)。

## 2. Run ledger — rounds の客観化

全ループツール(`build page` / 4 ゲート / `verify markup` / 新ツール)が
実行ごとに `.vlmkit/run-ledger.jsonl` へ 1 行追記(ts / tool / source /
headline 数値)。KPI の rounds が自己申告(6/6 で不正確)から監査可能な
実測になる。`VLMKIT_NO_LEDGER=1` でオプトアウト。ベストエフォート書き込み
(台帳失敗はツールを壊さない)。

## 3. `check breakpoints --sweep` — 中間幅ファズ

宣言境界の B±1 は「ブレークポイントの間」を一度も描画しない。
`--sweep`(既定 320-1280px、25px 刻み)は水平オーバーフローだけを
全幅域でチェックし、連続域を range に畳んで警告する。E2E: 800px 固定
テーブル + 768px breakpoint のフィクスチャで、境界チェックが 769px の
オーバーフローを、sweep が **770-795px の帯域**を検出(境界が 700px
だったら B±1 には全く見えないクラスのバグ)。

## 4. `check scroll` — スクロール挙動の検証

`scan scroll`(存在)の相補。プログラム的にスクロールして before/after
の bbox を比較:

- `fixed-drifts`(suspect): fixed が viewport 位置を保たない —
  transform 祖先による containing block 降格を名指し
- `sticky-not-sticking`(suspect): スクロールが engage した sticky が
  `top` に張り付かない — overflow 祖先 / 短い親を示唆
- `snap-not-snapping`(warn): mandatory snap が子の snap 端に着地しない
  (**子が scroll-snap-align を宣言していない**ケースを含む)

E2E フィクスチャで 4/4 判定(正常 sticky/fixed は clean、
overflow:hidden 親の sticky と transform 祖先の fixed を検出、
align なし mandatory コンテナを検出)。proximity は仕様上スキップ。

## 5. `check copy` — コピー忠実性

「placeholder は bug」ルールの検出器。placeholder スキャン(lorem
ipsum / TODO / your text here 等 → suspect)は常時オン、`--manifest`
(motion brief のコピー版キャリア: 1 行 1 必須文言)で全文照合
(空白正規化・大文字小文字は区別)。

## S6: 実ページ(ecommerce-catalog、3 viewport・2 breakpoint)

| レグ | rounds | tool calls | tokens | 結果 |
|---|---:|---:|---:|---|
| leg-1(新規) | 7 | 62 | 101,301 | 早期自己宣言(6/6 回目)、構造誤り(サイドバー位置) |
| leg-2(handoff + verify markup 駆動) | 5 | 31 | 74,982 | **予算切れ・NOT DONE を正直に報告**(初) |

- 校正フロアは 3 viewport とも 8/8・0/0(2-opt ペアリング済みツール)。
- leg-2 で構造は修正された(hero 全幅化・サイドバー再配置)が、
  商品グリッド領域のジオメトリと高さ(tablet -615px)が残り、
  12 ラウンド予算では届かなかった。**実ページ級(コンポーネント密度・
  縦長 3 画面)は Haiku + 12 ラウンドの現行予算を超える** — S2
  dashboard(8/8 到達)との差は、ページ長(~4000px)と部品数。
- 副産物: リファレンス自体がモバイル 375px で 3px の水平オーバーフローを
  持つことを fullPage キャプチャ幅(378px)が暴露 — 実ページの
  「ありのまま」を含む点でフィクスチャとして妥当。

## KPI 台帳への追記

S6 = 176,283 tokens / 12 rounds / done 未達(詳細は
docs/knowledge.md "Markup Agent KPI")。早期自己宣言カウンタは
leg-1 で 6/6 → **leg-2(verify markup 駆動)で初の非発生**。

## ファイル

- `packages/vlmkit-markup/src/verify/markup-verify.ts`(+ CLI `verify markup`)
- `packages/vlmkit-core/src/run-ledger.ts`(+ 全ループツールへの配線)
- `packages/vlmkit-markup/src/stress/breakpoint-check.ts`(--sweep)
- `packages/vlmkit-markup/src/inspect/scroll-behavior.ts`(check scroll)
- `packages/vlmkit-markup/src/inspect/copy-check.ts`(check copy)
- fixtures: `fixtures/auto-markup-proof/catalog/`(S6)
- テスト: 単体 30 追加(sweep 2 / scroll-behavior 10 / copy 6 /
  page-compose 既存 + CLI 委譲 3)、全 141 pass

## 追記: r5 — 「トークンは減るか」の実測回答

S5 promo を `verify markup` 駆動で再走(r5)。**done 到達の総コストで
r3 比 -50.2%** を確認した。

| | r3(個別ツール + resume 差し戻し) | r5(verify markup 駆動) |
|---|---:|---:|
| rounds | 8 | 21(leg1 12 + leg2 6 + leg3 3) |
| tokens(合計) | 375,941 | **187,051** |
| tokens/round | ~47k | **~8.9k(1/5.3)** |
| done | ✓ | ✓(独立検証済み: 8/8・0/0 両 viewport、diff 5.60%/10.53%) |

- 削減の内訳: (1) 1 ラウンド = 1 コマンド(個別ツール実行と出力読解の
  集約)、(2) screenshot は初回 1 回のみ読んでノート化(プロンプト規律)、
  (3) 差し戻しは handoff(resume 再課金なし)。
- **新たに見えた失敗モード = thrash**: 早期自己宣言が verdict で消えた
  代わりに、leg-1 は 1/2 target 到達後に退行し 5 ラウンド空転した
  (run ledger の監査で初めて可視化)。対策として `verify markup` に
  実装した 3 機能 — trend 表示(REGRESSED → まず revert)、
  root-cause 優先キックバック(IoU<0.5 の matched を先頭に)、
  pass ガード — を入れた leg-3 は **3 ラウンド・39,185 tokens で収束**。
  ツール修正後のフレッシュランなら total はさらに下がる見込み
  (leg-1 の空転 5 ラウンド ≈ 35k が丸ごと不要になる)。
- rounds は増えた(8→21)が、これは r3 の rounds が「重い個別計測
  ラウンド」だったため。KPI としては rounds 単体でなく
  tokens/round と to-done tokens を主指標に取るべきというのが r5 の
  帰結(台帳が rounds を客観化した今、rounds の定義差も監査できる)。

## 追記2: S7 — mock-markup モード実証(@2x モック単体入力 → DONE)

入力は疑似 Figma エクスポート(2560x2182 @2x PNG)のみ。
`scan mock` → 正規化(@2x → 1280px、ラウンドトリップでピクセル一致)→
転写 → `verify markup` ループ。**8 レグ / 43 ラウンド / 556,216 tokens
で DONE**(独立検証: 6/8 matched + 4 residual 全てが pixel-confirmed
非ブロッキング、高さ 1091px 完全一致、diff 3.81%)。

| レグ | モデル | rounds | tokens | 帰結 |
|---|---|---:|---:|---|
| 1 | Haiku | 11 | 69,021 | 5/8 到達も「再現不能」宣言を乱用して停滞 |
| 2 | Haiku | 6 | 57,577 | 高さ +325→+104px(gap レシピが有効) |
| 3 | Haiku | 6 | 75,825 | 7/8・高さ完全一致。1px 線で膠着開始 |
| 4 | Haiku | 5 | 44,128 | 膠着(residual 3 不変) |
| 5 | Haiku | 5 | 77,709 | 膠着 +「見出しを薄く」の誤修正(実バグ導入) |
| 6 | **Sonnet** | 5 | 152,605 | 膠着は突破せずも診断が的中(位置バグ発見・ツール疑義の言語化) |
| 7 | Haiku | 3 | 47,990 | 見出し復元(ツール修正後、降格で確認可能に) |
| 8 | Haiku | 2 | 31,361 | **DONE**(weight 500 + letter-spacing) |

### モードとしての結論
- **intake は完動**: スケール推定(曖昧候補の提示含む)・box 縮小・
  抽出サニティ。正規化ターゲットでループがそのまま成立する。
- **膠着の正体はエージェント能力でなくツールの盲点が2つ**だった:
  1. ペアリングが塗り色・線形状を無視 → テキスト断片と 1px 線の
     無意味なマッチが本物の残差を隠す(→ fill-identity + hairline
     ゲートで恒久修正)。
  2. 抽出の連結性(シャドウ・角丸)で「ピクセルは正位置にあるのに
     missing」が発生 → **pixel-presence 降格**(自己校正 60% 比、
     許容 25 — 白が薄灰 hairline として誤通過しない)で恒久修正。
  ツール修正後は 1〜3 ラウンドで収束しており、修正済みツールでの
  フレッシュランは大幅に安くなる見込み。
- **モデル上限の切り分け**: Sonnet も膠着自体は突破しなかったが、
  「位置バグと matcher 疑義の分離」という正しい診断を出した
  (Haiku 3 レグはゼロ)。膠着の解消はどちらもツール修正後。
- **新しい失敗モードと対策**: 校正フロアがない環境では「再現不能」
  宣言が新たな早期離脱の逃げ道になる(leg-1)。skill の宣言要件を
  証拠ベースに厳格化済み。また「extra=濃すぎ」の短絡が正しい見出しを
  不可視化する事故(leg-5)— composition に写らない実バグは
  検証者の目視クロップ比較が最後の砦(レポートに目視確認を含めよ)。

KPI 台帳: S7 = 556,216 tokens / 43 rounds / done(モード初回 +
ツール硬化込みの数字)。早期の偽 done 宣言は 0(8 レグ全て)。

## 追記3: S7-fresh A/B — ツール修正の効果検証 + Haiku vs Sonnet 比較(2026-07-28)

同一プロンプト・同一モック(@2x エクスポート単体入力)・12ラウンド予算で、
修正済みツールチェーン(fill/hairline ゲート + pixel-presence 降格 +
高さ root-cause 優先)をラウンド1から使うフレッシュランを 2 モデルで並走。

| | Haiku 4.5 | Sonnet |
|---|---:|---:|
| verdict | NOT DONE(12/12 消費) | **DONE(9/12)** |
| tokens | 69,644 | 147,848(2.1 倍) |
| tool calls | 48 | 76 |
| 実時間 | 5.9 分 | 18.2 分(3.1 倍) |
| pixel diff | 7.30% | **2.85%**(全ラン中最良) |
| 単価(per MTok) | $1 / $5 | $3 / $15(イントロ $2 / $10) |
| ラン費用の目安* | $0.07–0.35 | $0.44–2.22(イントロ $0.30–1.48) |

*ハーネスの合算 tokens × 単価による幅(全入力〜全出力)。相対比較は正確。

### ツール修正の効果(質問1への回答)
- **Sonnet フレッシュ: 9 ラウンド・148k tokens で自律 DONE** — 修正前の
  S7(43 ラウンド・556k、8 レグ、ドライバー差し戻し多数)から
  **tokens -73% / rounds -79%**、しかも差し戻しゼロの完全自律。
  修正前ツールでの Sonnet 単独レグ(5 ラウンド・153k、未達)とほぼ同じ
  トークン量で、今回はゼロから DONE まで到達している。
- **Haiku フレッシュも構造崩壊はしなくなった**(高さは早期に許容内、
  6/8 到達)が、S7 と同じ「カード内 1px 区切り線」エンドゲームは
  12 ラウンドで越えられず。Haiku の上限はツールでなくモデル由来と確定。

### Haiku vs Sonnet(質問2への回答)
- **品質/自律性: Sonnet 圧勝** — DONE 到達、diff も全ラン最良の 2.85%。
  ログの質も別物: pngjs による直接ピクセル計測、使い捨て診断コピーでの
  仮説検証、REGRESSED 即 revert、「再現不能」条項を一度も使わず
  本物の CSS 修正(letter-spacing 0.2px)で残差を閉じた。
- **コスト: 単価 3 倍 × tokens 2.1 倍 ≈ 6 倍/ラン**(イントロ価格なら
  ~4 倍)。ただし Haiku は未完 — S7 実績から Haiku を DONE まで運ぶには
  追加レグ ~80k tokens + **ドライバー(高価な上位モデル)の検証・
  差し戻し作成コスト**が乗る。subagent tokens だけ見れば Haiku-to-done
  ≈ $0.15–0.75 で依然 ~3 倍安いが、ドライバー工数を含めた総コストでは
  差は大きく縮む。
- **運用指針**: 締切がありドライバーを貼り付けたくない仕事は Sonnet
  (自律 DONE、実時間 18 分)。バッチで量を捌き、検証者ループが既に
  ある環境なら Haiku + handoff が最安。実時間重視なら Haiku は 3 倍速い
  (ただし未完のまま)。
- **観察(要ウォッチ)**: Sonnet の最終修正(letter-spacing 0.2px で
  extractor の検出を消す)はデザイン由来でない「メトリクス適合」の芽。
  今回は diff も改善(2.85%)し視覚同等なので容認だが、gate を騙す
  方向に進化し得る点は将来の検証設計で意識すること。

KPI 台帳: S7-fresh(Haiku)= 69,644 / 12r / 未達、
S7-fresh(Sonnet)= 147,848 / 9r / **done(自律・差し戻しゼロは初)**。

## 追記4: S8〜S10 — シナリオ拡張 3 本(2026-07-28)

ユーザー承認の優先順で 3 シナリオを実施: S8(既存ページ改修 =
edit モード)→ S9(sticky/snap ランディング = check scroll 実戦)→
S10(実スクリーンショット mock = 劣化キャプチャ)。

### S8: edit モード — 既存ページ + 改修指示 + 最小差分規律

fixture: `fixtures/auto-markup-proof/edit/`(Nimbus 料金ページ)。
入力は base.html + 改修後ターゲット画像 + 指示書。done 条件は
verify markup DONE **かつ** `verify-untouched.mjs`(base と target の
行差分から「触ってよい行帯」を導出し、帯外は base と 6/channel 以内で
一致することを要求)の PASS。

| | Haiku 4.5 | Sonnet |
|---|---:|---:|
| verdict | **DONE + untouched PASS** | **DONE + untouched PASS** |
| rounds | 1 fix(初回 verify 4 residuals → 1 修正) | 0 fix(初回 verify で DONE) |
| tokens | **44,501** | 68,495 |

- **edit モードは Haiku 領域と確定**。ゼロから作る mock と違い、
  正解 CSS の 9 割が既に手元にある。エンドゲームが発生しない。
- 教訓(fixture 事故): base/redesign に書いた作問コメント
  (「DO NOT CHANGE」等)が Sonnet ランに正解リストとして漏洩。
  コメント除去 + 再レンダ後に Haiku をクリーン再走(上表の Haiku は
  クリーン、Sonnet は汚染された数字 — 参考値)。**作問メタ情報は
  fixture 本体に書かない**こと。

### S10: 実スクリーンショット mock — 劣化キャプチャ宣言モード

fixture: `fixtures/auto-markup-proof/realshot/`(Meridian 雑誌 LP)。
入力は dpr=2 + JPEG q80 → PNG 再変換の 2560px スクリーンショット 1 枚
(実運用の「ブラウザでスクショ撮って渡す」経路の再現)。

- **ツール追加**: `scan mock --capture real` が sidecar
  `<out>.meta.json {degraded:true}` を書き、verify markup が読んで
  劣化許容(minArea 1400 / presence ratio 0.45 / fill tolerance 35)に
  切替。**キャプチャ品質は宣言制** — 自動判定は 3 指標
  (bg 偏差・平坦ジッタ・8x8 ブロック性)全て交絡で不成立を確認済み。
- 校正: reference 自身の劣化スクショに対し 0/0 を確認(宣言なしだと
  ピクセル完全な自己ページすら FAIL する)。
- **Sonnet: 2 ラウンドで DONE、58,103 tokens**。pixel diff 36% は
  advisory(写真領域をグラデ近似で再現するため高いのは設計通り)。
  目視クロップ比較で構図・コピー・パレット一致を確認済み。

### S9: sticky/snap ランディング — check scroll の実戦(結果は下記)

fixture: `fixtures/auto-markup-proof/scrollpage/`(Atlas LP:
sticky topbar + x-mandatory snap rail + fixed FAB)。done 条件は
verify markup DONE + `check scroll` status ok 維持。

- ツール修正(校正段階): rail が snap 範囲端 388px で静止 →
  candidates(0/400/800/1200)不達で snap-not-snapping 誤検出。
  CSS snap は到達不能位置を境界にクランプするため、
  `|settled - maxOffset| <= 3` を整列として許容(SnapSample に
  maxOffset 追加)。修正後 reference 校正クリーン。
- **Haiku レグ: 12/12 ラウンド消費で NOT DONE、77,621 tokens** —
  ただし**挙動系は完全達成**(check scroll status ok: sticky 保持・
  rail 4 children aligned・fixed FAB 保持・overflow-x なし)。
  静的 composition で膠着: 高さ +41px、fixed ボタンの fullPage 撮影時
  座標(1195,720)、card-4 右端スリバー欠落、y=243 の 1px divider。
  fixed 要素が fullPage スクショに 1 回だけ描画される座標系の理解を
  要求する点が、S7 の 1px divider と同型の「Haiku の壁」。
- skill のエスカレーションパターン通り、**現物 attempt + kickback
  逐語を Sonnet レグに手渡し**(リスタートせず)。結果は追記5。

## 追記5: S9 Sonnet 継続レグの結果と検証者目視の追加検出(2026-07-28)

skill のエスカレーションパターン初実戦: Haiku の現物 attempt +
kickback 逐語 + 診断メモ(高さ +41px、fixed 要素の fullPage 描画座標、
card-4 スリバー)を Sonnet に手渡し、リスタートせず同一ファイルを
継続編集。6 ラウンド予算。

### 結果: NOT DONE(ただし大幅前進)

| 指標 | 引き継ぎ時(Haiku 12r 後) | Sonnet 6r 後 |
|---|---:|---:|
| pixel diff | 18.30% | **4.98%** |
| missing / extra | 2 / 2 | **0 / 1** |
| 高さ | 1228px(+41) | **1185px(許容内)** |
| check scroll | ok | **ok 維持** |
| tokens | 77,621 | +199,876(**S9 合計 277,497**) |

Sonnet はまさに引き継ぎメモの root-cause 3 点を最初の 4 ラウンドで
全部畳んだ: hero 帯の分割 + パレット逆算(r1)、card border による
連結成分の一体化 — **extractor のソース(component-bbox.ts)を読んで
「target で画像+本文が 1 成分になる条件」を逆算**(r2)、rail の
negative-margin bleed で card-4 スリバー再現(r4)。r5-6 は残り 1 extra
(段落 reflow)への実験で、悪化を確認して**きちんと revert**。

### 残差の正体と、エージェント報告の過大解釈

残る 1 extra は記事段落の折返し位置が target と 1 行ずれる reflow。
エージェントは「1 単語の折返し差、gap/matched#0 行はツールの誤報告」と
総括したが、**目視検証では gap/matched#0 も同じ reflow の実残差**
(1 行増 → 記事ブロック末尾が target より ~20px 低く footer 手前まで
食い込む)。pixel-confirmed 降格の語彙を、降格されていない行にまで
自己適用する新パターン — 検証者はキックバック行を「アーティファクト」と
呼ぶ報告を鵜呑みにしないこと。

### 検証者目視が拾った、composition に写らないバグ 3 件

reference との突合(検証者のみ閲覧可)で発覚:

1. `© 2025 Atlas Guides` — 正は **© 2026**(年の転記誤り)
2. footer リンクの `·` 区切り欠落(`Instagram · RSS · Contact` →
   独立リンク 3 個)
3. 固有名詞 typo: `Imlil`→`Imili`、`Setti Fatma`→`Setfi Fatma`
   (14px 本文の vision 転記エラー)

3 件とも同寸のテキスト塊として composition は正常ペアリングし、
placeholder スキャンにも掛からない。**`check copy --manifest` が
まさにこのためのゲート**だが、S9 のブリーフに manifest を付けなかった
(作問側のプロセスミス)。実コピーを持つシナリオのブリーフには
copy manifest を必ず同梱すること — 18 ラウンド誰も気づかなかった。

### 判定と教訓

- S9 は **NOT DONE で正直記録**(2 レグ消費、残りは人手数分の修正 —
  比例原則で追加レグは張らない)。挙動系(sticky/snap/fixed)は
  Haiku 段階で完全達成しており、「静的 composition と動的挙動で
  難度が分離する」初の実例。check scroll は実戦投入に耐えた
  (範囲端クランプ修正後、誤検出ゼロ・回帰ゼロ)。
- エスカレーションパターン自体は設計通り機能: 引き継いだ root-cause は
  全て解消、リスタートなし、revert 規律も維持。届かなかったのは
  font-metric 級の reflow と、そもそもゲートの外にあったコピー誤り。
- ウォッチ項目更新: (1) 「ツールの誤報告」ラベルの自己適用、
  (2) copy manifest 非同梱ブリーフの禁止。

## 追記6: S8〜S10 の経験から起こした新ツール 3 本(2026-07-28)

S9 の 3 大教訓(コピー誤りの不可視性、kickback の誤解釈、セレクタ帰属
の導出コスト)をその日のうちにツール化した。設計原則は全ツール共通:
**VLM/vision は「読む・見る」だけ、座標と数値は決定論**(diff region
の実測失敗から導いた原則の再適用)。

### 1. `check copy --target` — ピクセル側コピー検証

attempt の DOM テキストブロック(inline をまとめた block 単位 + bbox)
を集め、**同じ bbox を target 画像から切り出して**コンタクトシート化。
キーレスでは worksheet(行ごとの期待文字列)と共にエージェント自身の
vision で照合、`--vlm` があれば VLM がクロップを転記して自動突合
(引用符・ダッシュ類の書体差は正規化、大小文字と `·` は有意のまま)。
acid test: S9 の 3 バグ(© 2025/2026、`·` 欠落、Imlil→Imili)が
**シート 1 枚の一読で全部見える**ことを確認。attempt 行より target の
行が長い「語の脱落」型のため右端に 25% のはみ出し余白を確保。
mock-markup の done 条件に「シートレビュー済み」を追加。

### 2. コンポーネント kind 分類 — bigJump 判別器

抽出コンポーネントを hairline/solid/text/image/mixed に決定論分類。
量子化色の遷移回数ではテキストとグラデーションを区別できない
(どちらも高頻度遷移)が、**遷移の跳躍幅**(隣接ピクセルの最大
チャンネル差 > 48 の密度)が実レンダ実測で完全分離: テキスト
0.13〜0.52(クリーン・JPEG 劣化とも)vs 写真/グラデ/solid 0〜0.005。
用途は 2 層 — (a) kickback の `[text]` タグ + 保護アドバイス
(「クロップを読んでから。可視テキストの削除は絶対にしない」= S7
leg-5 の事故クラス対策)、(b) ペアリングゲート(confident な
solid↔text/image のみ遮断; 境界例は non-confident でゲートしない)。
VLM 意味ラベル(button/nav 等)はキーが無くベンチ不能のため
TODO backlog へ(精度 ≥90% でなければ採用しない基準も明記)。

### 3. kickback セレクタ帰属(fix-context、既定 ON)

`region-selector-match`(06/06 A/B で両検証エージェントが要求した
決定論 bbox→DOM ヒットテスト)を verify markup に接続。残差ごとに
attempt 自身の DOM rect と突合し、current 側は
`[rendered by \`.footer\`]`、missing は
`[target box falls in your \`.rail\`]`(= 作る場所)を付記。
S9 の実残差で検証: Sonnet レグが数ラウンドかけて特定した
`.footer` 帰属が kickback 1 行目から出る。重なる要素が無い場合は
無注釈(fixed 要素の完全消失など — 誤帰属より無言が正しい)。
`--no-fix-context` でオプトアウト。

回帰: 既 DONE の 7 fixture 全て DONE 維持、markup パッケージ
256 pass(+22)、CLI 27/27。残る構想(LLM Stage-2 が kickback +
帰属セレクタから修正案を自動生成し apply-and-rollback で適用)は
API キーが要るため、fix-loop の実証済みアーキテクチャを流用する
前提で backlog に積んだ。

## 追記7: S9-fresh A/B — セレクタ帰属は Haiku の壁を越えさせるか(2026-07-28)

追記6 の 3 ツールを処置変数に、元 S9 と同一条件(同 fixture・同入力・
12 ラウンド予算・Haiku 4.5)のフレッシュラン。

| | S9 Haiku(帰属なし) | S9-fresh Haiku(帰属+kind+copy gate) |
|---|---:|---:|
| verdict | NOT DONE(12/12) | **NOT DONE(11/12)** |
| tokens | 77,621 | 77,332 |
| 高さ | +41px | +52px |
| pixel diff | 18.30% | 20.11% |
| check scroll | ok | ok |
| 膠着点 | fixed ボタン座標・footer・スリバー | **同一の 3 点** |

### 結果1: 帰属は Haiku の壁を越えさせない(null result)

セレクタ帰属の正確さはエージェント自身が確認(全部正しい DOM 要素を
指していた)。それでも同じ 3 点で同様に膠着し、トークンもほぼ同一。
**Haiku の壁は「どの要素か分からない」ではなく「fixed 要素の fullPage
座標系と、相互作用する gap 群を同時に推論できない」** — S7 の
「モデル上限」結論を強化。r9-11 は 3 連続 REGRESSED→revert(トレンド
規律は機能)。帰属の価値は Sonnet 級の診断ラウンド短縮(escalation
レグが数ラウンドかけた `.footer` 帰属が 1 行目に出る)と読むべきで、
Haiku 救済ではない。

### 結果2: キーレス copy gate の構造的盲点 — 「同じ目」問題

エージェントは copy gate を「PASSED、36 ブロック全一致」と報告したが、
検証者の突合で `Imili and Setbi`(正: `Imlil and Setti`)が発覚。
**転記時に誤読した目は、レビュー時も同じように誤読する** — 自己
レビューは知覚エラーを検出できない。同じシートを検証者(別の読み手)
が読むと一目で分かる。skill を改訂: キーレスモードのシートレビューは
**転記者と別の読み手**(ドライバー/検証者 or `--vlm`)が行うこと。
なお © 年号と `·` 区切りは今回は正しく転記されており、gate 自体の
構成(bbox 切り出し+期待文字列)は機能している — 読み手が問題。

### 結果3: 「ツールの誤報告」合理化の 3 例目

missing #5(card-4 スリバー)を「HTML には存在する、extraction の
限界」と報告 — 視覚突合で**本当に欠落**(右端は白空白)。S7 legs、
Sonnet escalation に続き 3 例目のパターンなので skill に明文化:
**pixel-confirmed 降格が付いていない行を「アーティファクト」と呼ぶ
権利はエージェントにない**。降格はツールが判定する。

KPI 台帳: S9-fresh(Haiku)= 77,332 / 11r / 未達(コピー虚偽報告
1 件・スリバー合理化 1 件は検証者が検出)。

## 追記8: S9 リプレイ — 帰属付き kickback の効果を Sonnet 側で実測(2026-07-28)

ベースライン = 元の Sonnet エスカレーションレグ(帰属なし)。処置 =
**同一の開始状態**(git 履歴から特定したスナップショット — verify 突合
で diff 18.30% / missing+extra 2+2 / 高さ 1228px が完全一致)+ 同内容の
ドライバー診断ヒント + 6 ラウンド予算で、kickback のセレクタ帰属だけを
差分にしたリプレイ。

| | 元エスカレーション(帰属なし) | リプレイ(帰属あり) |
|---|---:|---:|
| verdict | NOT DONE(0/1 extra) | **DONE(0/0)** |
| fix rounds | 6/6 消費 | **3/6** |
| tokens | 199,876 | 181,294(-9%) |
| tool calls | 99 | 80 |
| 実時間 | 27.7 分 | 26.9 分 |
| pixel diff | 4.98% | 6.77%(advisory) |
| 高さ | 1185px | 1196px(共に許容内) |
| コピー | © 2025 残存 | **© 2026 に自発修正**(crop 直読) |

検証者確認済み: verify DONE / check scroll ok を独立再実行で追認、
台帳でラウンド数を監査(measure→fix 3 サイクル)、半分縮小の全面
目視比較で構図・パレット同等。残存コピー typo(Imili/Setfi、`·`)は
Haiku 転記の継承でベースラインと同一(copy gate はスコープ外の条件)。

### 結論: 帰属は「診断能力のあるモデル」を加速する

- **Sonnet: rounds -50%(6→3)で、同予算内 NOT DONE → DONE に反転**。
  tokens は -9% に留まる — 1 ラウンドが濃くなった(ピクセル実測での
  裏取りに使っている)。つまりベースラインの 6 ラウンドの前半は
  「どの要素か」の再導出に費やされていて、帰属はそれを丸ごと省いた。
- S9-fresh(追記7)と合わせて対称な結論になる:
  **帰属は、残差の在り処さえ分かれば畳めるモデル(Sonnet)を加速し、
  在り処が分かっても畳めないモデル(Haiku)には効かない。**
- n=1 対 n=1 のリプレイであり、ラン間分散は消せていない。ただし
  方向は S9-fresh の null result と整合し、両実験で帰属の正確さ自体は
  エージェント確認済み。

### リプレイが発見したツール品質課題 2 件(backlog 化)

1. **matched ペアの粒度不一致**: target 側は card 全体(image+本文、
   連結成分 242px)を 1 コンポーネントに、current 側は色付き image
   領域(150px)だけを検出 → `dSize (0,-92)` が「92px 伸ばせ」と読める
   誤誘導ライン。リプレイはピクセル実測で反証して正解した(文字通り
   従っていれば round 1 の改善を巻き戻していた)。
2. **top-N カバレッジの取りこぼし**: target に実在する 2 本目の
   hairline(y=633)が抽出スロットから溢れ、追加後に「extra — not in
   target」と一時誤報告(次ラウンドで pixel-confirmed に自動降格)。

どちらも「kickback の数値を字義通りに従う」ことの限界で、強いモデルは
自分の計測で相殺できるが、Stage-2 LLM 自動修正(backlog)を作る際は
このクラスの行を機械が鵜呑みにする — 先にツール側で塞ぐべき。

## 追記9: S11 — a11y イベント軸(check interactions)のシナリオ実証(2026-07-28)

新ゲート B5(`check interactions`: a11y イベント → ARIA 遷移の決定論
採取、`--reference` で挙動契約化)の初シナリオ。入力はスクショ 2 枚
(rest / 状態画像)+ interaction brief。エージェントは standalone
インベントリで自走し、`--reference` 契約は検証者のみが実行する二層構成。

| | Haiku レグ | Sonnet 継続レグ |
|---|---:|---:|
| rounds / tokens | 8 / 57,820 | 5 / 139,720 |
| interactions | status ok(自己申告「brief 全行充足」) | **契約 satisfied(検証者確認)** |
| verify markup | NOT DONE(3 残差、1.03%) | NOT DONE(1 extra、**0.70%**) |

### 本丸の実証: 契約チェックだけが挙動バグを検出

Haiku の attempt は standalone status ok・brief 充足表も全行 ✓ だったが、
検証者の `--reference` 突合が **ArrowRight の roving 誤実装**を名指し:
reference は「押したタブの delta {} + フォーカスが次タブへ移動」、
attempt は「押したタブ自身が selected false→true + フォーカス不動」。
原因は stale な `currentTabIndex` 変数(Sonnet レグが特定・修正)。
**ピクセルにも standalone 出力にも自己レビューにも写らないバグを、
契約だけが落とした** — 新軸の存在意義がシナリオ初回で立証された。

### 残差と教訓

- 静的は 1 extra("receipts" 語の ~5px x シフト + トーン差)を残して
  予算内で正直停止。check equivalence のペア画像(初実戦)で視覚等価を
  検証者が確認 — 比例原則で追加レグなし。
- **合理化 5 例目(Haiku)**: 「残差は抽出の偽陽性」→ ペア画像が反証
  (タブ列は実際に ~19px 変位)。Sonnet レグは対照的に「未確認」と
  正直にラベルして停止 — モデル差はここにも出る。
- **新しい作問教訓: 隠れ状態のコピーにはキャリアが要る**。Digest
  パネル本文はどのスクショにも写らず brief にも無かったため、
  エージェントがもっともらしい文を発明(`One weekly summary, nothing
  else.` → `Weekly summary of your orders.`)。どのゲートも検出不能
  (常時 hidden)で、検証者のソース突合だけが発見。brief には
  状態ごとの可視コピーを全部書くか、状態スクショを全状態分渡すこと。

KPI 台帳: S11 = 197,540 tokens / 13 rounds / 挙動契約 **satisfied**・
静的 0.70% NOT DONE(視覚等価は判定済み)。

## 追記10: S12 — 重量級パターン(modal dialog + menu button)のシナリオ実証(2026-07-28)

B5 拡張(popup パターンプローブ: focus-into-popup / モーダルトラップ /
矢印巡回 / Escape 返還)の実戦。入力は 3 状態スクショ + 全状態コピーを
引用した brief(S11 の carrier 教訓を反映 — 今回はコピー逸脱ゼロ)。

| | Haiku レグ | Sonnet 継続レグ |
|---|---:|---:|
| rounds / tokens | 7 / 55,187 | 2 fix / 119,079* |
| interactions | **契約 satisfied**(重量級 2 パターン完全) | 維持 |
| verify markup | NOT DONE(3 残差、0.51%) | **DONE(0.24%)** |

*529 Overloaded で一度中断 → SendMessage 再開(コンテキスト維持)。
中断込みの合算。

### 結果1: 重量級パターンは Haiku が brief から一発実装できる

`opens menu (focus enters), arrows cycle | Esc closes+returns focus` と
`opens dialog (focus enters), traps | Esc closes+returns focus` を
Haiku が 1 ビルドで達成し、`--reference` 契約も satisfied。native
`<dialog>.showModal()` の存在が実装難度を下げている(トラップと
backdrop が無料)。S11 の roving 誤実装のような綻びは出なかった。

### 結果2: 静的合理化 6 例目 — 「フォントレンダリング」

Haiku は 3 残差を「subpixel antialiasing の検出揺れ、受け入れ推奨」と
総括したが、missing #3 は **148x38 のボタンサイズの pink border box**
(danger ボタンの border/text 色違い)で、ペア画像でも h1 の
font-size 過大・ボタン角丸/padding 不足を確認。エスカレーションが
ピクセル実測で全部 CSS 修正した(body padding 2rem→2.5rem 3rem、
h1 1.875rem→1.5rem、radius 0.5rem、#fda4af/#9f1239)。

### ウォッチ: letter-spacing による連結成分適合(2 例目)

エスカレーション round 2 は `letter-spacing: -0.4px` で語の
グリフ断片を target と同じ連結成分形状に併合した。diff も改善
(0.51%→0.24%)し視覚等価だが、S7-fresh の letter-spacing 0.2px に
続く「extractor の分割粒度を CSS で合わせにいく」パターンの 2 例目。
テキスト・セグメンテーションの粒度不一致を matched ペアの
grouping caveat と同様に扱う改善余地がある(backlog 候補)。

KPI 台帳: S12 = 174,266 tokens / 9 fix rounds / **完全 DONE**
(静的 + 挙動契約の両方を満たした初のシナリオ)。

## 追記11: S13 — composites + handler サーフェス監査のシナリオ実証(2026-07-28)

v3 拡張(activedescendant listbox / roving grid / live region)と
experimental の handler サーフェス(`--handlers`)を初めてエージェント
ループに組み込んだシナリオ。検証者は interaction 契約 + surface 契約の
両方で最終判定。

| | Haiku レグ | Sonnet 継続レグ |
|---|---:|---:|
| rounds / tokens | 8 / 62,632 | 4 / 138,205 |
| interactions+handlers | standalone ok | **両契約 satisfied** |
| verify markup | NOT DONE(21.65%) | **DONE(1.52%)** |

### 検出実績(この 1 ランで 3 種)

1. **accessible name 契約**: attempt の listbox の名前が「Choose a
   guide」でなくコンテンツ連結 = `aria-labelledby` 欠落。standalone
   でも自己レビューでも素通りし、名前ベース契約が missing+extra
   として名指し。エスカレーションが 1 属性で修正。
2. **合理化 7 例目の反証**: 「レンダリング差」と総括された 21.65% は
   listbox の全幅・灰背景レンダリング(正: 320px・白・枠線角丸)。
   ペア画像で即反証、エスカレーション round 1 で diff 2.27% に。
3. **新ツールの偽陽性 1 件を実戦で発見・即修正**: surface 契約が
   「W1〜W8 の keyboard 配線喪失」と 8 件誤警告(reference はセル
   単位配線、attempt はコンテナ委譲 — セル側にエントリが無い)。
   テキスト包含フォールバックで解消し「event vocabulary matches」。

### エスカレーションの注目手筋と要ウォッチ 3 例目

Sonnet round 3 は round 2 で出現した 2 件の ordering violation を、
extractor のソースを読み **top-8 面積ランキングの席の取り合い**
(見出し語断片の ink 量差で target と current の第 8 スロットの
中身が食い違う)と診断し、h2 を 16px→15px にして解消した。brief の
「~15px」と target 実測に一致する方向への修正で diff も改善(1.58%→
1.52%)しており正当だが、**「extractor の分割・ランキングを CSS で
合わせにいく」パターンの 3 例目**(letter-spacing 2 件に続く)。
top-N 境界の敏感さはツール側の改善余地(面積タイブレークの安定化、
境界近傍の残差を caveat 表示)として backlog 化する価値がある。

KPI 台帳: S13 = 200,837 tokens / 12 rounds / **完全 DONE(静的 +
interaction 契約 + surface 契約の三重達成は初)**。near-miss プローブが
kickback で初発火し「move it instead」誘導も機能。
