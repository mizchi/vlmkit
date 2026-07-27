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

## 関連

- skill: `.claude/skills/auto-markup/SKILL.md`
- Haiku の VLM 単体評価(diff region): `docs/reports/2026-07-27-vlm-haiku-region-diff-agent-harness.md`
- 実装レビュー: `docs/reports/2026-07-27-auto-markup-feature-review.md`
