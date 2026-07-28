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
