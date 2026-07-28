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
