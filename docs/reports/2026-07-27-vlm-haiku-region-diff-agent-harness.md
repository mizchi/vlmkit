# 2026-07-27 Haiku を VLM 単体(Stage-2 LLM なし)で region-diff 評価

## 目的

`claude-haiku-4-5` を **VLM としてのみ**使い(Stage-2 LLM 修正合成なし)、
`vlmkit diff region` の実プロンプト(`src/experiments/migration/vlm-region-diff.ts`
の `SYSTEM_PROMPT`)に対する構造化出力の品質を、決定論パスのグラウンド
トゥルースと照合して測る。

## 方法(重要な注記)

実行環境に API キーが一切ないため(`ANTHROPIC_API_KEY` /
`OPENROUTER_API_KEY` / `GEMINI_API_KEY` すべて未設定、Anthropic 直叩きは
401)、リポジトリの `vlm-client` ではなく **Claude Code の Agent ハーネス
経由の Haiku サブエージェント**(model=haiku → claude-haiku-4-5)を VLM と
して使用した。プロンプトは `diff region` の SYSTEM_PROMPT + split/triptych
のユーザ文言を逐語コピー。画像は Read ツール経由(API の base64 添付とは
配送経路が異なる)。**方向性の評価としては有効だが、`pkf run vlm-bench` の
数値と直接比較はできない。** キーのある環境での追試コマンド:

```bash
vlmkit diff region --baseline target.png --variant current-broken.png \
  --model anthropic/claude-haiku-4-5
```

## フィクスチャ(グラウンドトゥルース既知)

`build page` 評価で使った合成ページ(hero / カード3枚 / CTA バンド / footer、
1024x768)。

| ケース | variant | 正解 |
|---|---|---|
| A: 構造差分(split) | カード1枚欠落 + CTA/footer が 72px 下にシフト | verdict=diff。カード領域 `#eef2ff`→`#ffffff`、CTA 旧位置 青→白 / 新位置 白→青 |
| A2: 同上(triptych) | 同上 + heatmap パネル | 同上 |
| A3: 同上(split + ルール明確化1文) | 同上 | 同上 |
| B: 同一(split) | target と同一レンダ | verdict=no-diff、0 regions |
| C: 色のみ(split) | CTA `#2563eb`→`#16a34a` | verdict=diff、bbox(40,368,944x92)、色ペア一致 |

決定論側の測定(照合基準): `diff png` = **16.85%** diff、5 regions、
`shift(+0,+64)`、カード領域 content 変化。ピクセルプローブ:
cardMid(500,270) target `#eef2ff` / broken `#ffffff`、
CTA 旧位置(500,410) target 青系 / broken `#ffffff`。

## 結果

| ケース | verdict | regions | 品質 | 所要 |
|---|---|---|---|---|
| A 構造(split) | **no-diff ✗** | 0 | **ミス**。ただし summary に「Card C が隠れ 2 カラム化」と変化自体は言語化 — 「色差分ではない」と規約解釈して抑制 | 17s |
| A2 構造(triptych) | diff ✓ | 4(全て捏造) | **最悪**。heatmap パネルのオレンジが変化色として漏出(「文字色が `#ff6600` に変化」×3、実画像にオレンジは存在しない)。bbox も実カード領域(y≈204-344)と不一致(y≈120) | 40s |
| A3 構造(split+1文) | 下記追記参照 | — | — | — |
| B 同一(split) | **no-diff ✓** | 0 | **完璧**(偽陽性なし) | 6s |
| C 色のみ(split) | **diff ✓** | 1 | **良**。bbox (40,368,944x96) ≈ 実測 (40,368,944x92)。variantColor **`#16a34a` 完全一致**。baselineColor `#1d4ed8`(実 `#2563eb`、Δ≈21 — blue-700/600 の混同)。propertyHint=background-color ✓ | 13s |

トークン: 1 コール ≈ 29-34k(画像込み、ハーネス計測)。

## 解釈

1. **既存 knowledge と整合**: 2026-05-23 bakeoff の「haiku は diff の*方向*を
   正しく返す唯一のモデル / hex は ±10 のブレ」を再確認(C)。同一ページで
   no-diff を返す堅牢性も確認(B)— qwen/gemini-flash の「~6% palette shift
   で no-diff」問題とは別物。
2. **新しい知見: 構造差分に対して split モードは無反応**(A)。「色・fill の
   差分のみ列挙せよ」というプロンプト規約を Haiku は文字通りに守り、欠落
   カード(fill→背景の変化そのもの)を「レイアウト変更であって色差分では
   ない」と自己分類して verdict=no-diff まで下げてしまう。CHANGE の存在自体
   は summary に言語化されるため、**verdict だけを読む消費側は回帰を取り
   こぼす**。
3. **triptych モードは Haiku でも drafts 06/09 の捏造モードに入る**(A2)。
   ヒートマップの hot color が変化色として色クレームに混入する。
   `PIXEL_REFUTE_FLOOR` の refutation gate が存在する理由そのもの。
   **Haiku を使う場合も triptych ではなく split を推奨**。
4. 結論は既存ガイダンスを補強する: **構造・シフトは決定論パス
   (`diff png` / `build page`)が正しく測り(16.85%、shift+64px を正確に
   検出)、VLM は色の命名(C のケース)に限って有効**。

## 追記: A3(ルール明確化の 1 文を足した split 再試行)

プロンプトに「一方で塗りがあり他方でページ背景になっている領域は色差分
である(fill vs background)」と 1 文加えて A を再試行した結果:

- verdict **diff ✓** に反転。
- region 1: **欠落カードを bbox ほぼ正確に特定** — (683,205,301x140)、
  実測第3カードは (685,204,299x140)。色は `#e8eef7`→`#f5f5f5`
  (実 `#eef2ff`→`#ffffff`、各 Δ≦10 — 許容内)。
- region 2 はスキーマ違反(baselineColor に "contains three cards" と
  いう文章)— 構造変化を色フィールドに押し込む癖は残る。
- **72px の CTA/footer シフトは依然として未報告**。VLM は「動いた帯」を
  色差分として認識しない。シフト検出は決定論パス(`diff png` の
  per-band cross-correlation)の独壇場のまま。

**アクション**: この 1 文を `vlm-region-diff.ts` の SYSTEM_PROMPT に反映
済み(本レポートと同コミット)。missing-element 系の取りこぼしを 1 文で
救える一方、シフト盲・スキーマ逸脱は残るため、refutation gate と
決定論パス優先の運用は変えない。

### A3 生 JSON(抜粋)
```json
{"verdict": "diff", "regions": [
  {"region": "Card C container", "propertyHint": "background-color",
   "bbox": {"left": 683, "top": 205, "width": 301, "height": 140},
   "baselineColor": "#e8eef7", "variantColor": "#f5f5f5",
   "description": "Card C is missing from the three-column layout; its light blue background is replaced with page background color."}
], "summary": "Card C is missing from the layout; the three-column card grid has been reduced to two columns in the variant."}
```

## 生 JSON

### A(split)
```json
{"verdict": "no-diff", "regions": [], "summary": "The baseline and variant have identical colors across all visible elements; the structural difference (Card C is hidden and cards display in 2-column instead of 3-column layout) is a layout change, not a color difference."}
```

### A2(triptych、抜粋)
```json
{"verdict": "diff", "regions": [
  {"region": "Card B label text", "propertyHint": "color", "bbox": {"left": 195, "top": 120, "width": 85, "height": 20}, "baselineColor": "#2c3e50", "variantColor": "#ff6600", "description": "Card B label text changed from dark to orange."}
], "summary": "Card backgrounds lightened and card label text colors changed from dark to orange across all three cards."}
```
(4 region 全てが heatmap 色 `#ff6600` 系への変化を主張 — 実画像に存在しない)

### B(split)
```json
{"verdict": "no-diff", "regions": [], "summary": "Baseline and variant are visually identical with no color or fill differences detected."}
```

### C(split)
```json
{"verdict": "diff", "regions": [{"region": "Primary action button", "selectorHint": "button, [class*='cta'], [class*='start']", "propertyHint": "background-color", "bbox": {"left": 40, "top": 368, "width": 944, "height": 96}, "baselineColor": "#1d4ed8", "variantColor": "#16a34a", "description": "Button background changed from blue to green."}], "summary": "The primary action button background recolored from blue to green."}
```
