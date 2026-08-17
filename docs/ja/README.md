# vlmkit

Visual Regression Testing ツールキット — ピクセル差分、computed style 差分、a11y ツリー差分、AI による CSS 自動修正。

## 機能

- **ピクセル差分** — pixelmatch v7 + ヒートマップ生成
- **Computed style 差分** — `getComputedStyle` キャプチャ (hover/focus 含む)
- **A11y ツリー差分** — アクセシビリティスナップショット比較
- **CSS チャレンジベンチ** — CSS 削除/復元の自動化 (検出率 96.7%)
- **2段階 AI パイプライン** — VLM (画像→構造化差分) + LLM (差分→CSS 修正)
- **Migration VRT** — レスポンシブ viewport での HTML before/after 比較
- **スナップショット** — URL ベースの複数 viewport キャプチャ + baseline 差分
- **マスク** — セレクタベースのマスキング (アニメーション、カウンタ等の動的コンテンツ除外)
- **Crater 統合** — BiDi による軽量プリスキャナー (1.66x 高速化、偽陽性 0%)

## クイックスタート

```bash
pnpm install

# テスト実行 (341 テスト)
pnpm test

# 2つの HTML ファイルを比較
vlmkit diff html before.html after.html

# 2つの URL を比較
vlmkit diff html --url http://localhost:3000/ --current-url http://localhost:8080/

# URL のスナップショット (初回は baseline 作成、以降は差分計測)
vlmkit snapshot http://localhost:3000/ http://localhost:3000/about/ --output snapshots/

# 動的コンテンツをマスク
vlmkit snapshot http://localhost:3000/ --mask ".marquee-container,.hero-badge"

# CSS チャレンジベンチマーク
pkf run css-bench -- --fixture page --trials 30

# Fix ループ (CSS 破壊 → VLM 分析 → LLM 修正 → 検証)
pkf run fix-loop -- --fixture page --seed 42

# 実際のマークアップ作業用のエージェントループ
vlmkit markup-loop init --topic checkout --title "Guest Checkout Smoke" \
  --base-url http://localhost:3000 --provider anthropic
vlmkit markup-loop observe
vlmkit markup-loop doctor
vlmkit markup-loop run --dry-run
vlmkit markup-loop run

# examples/ 配下の再現プロジェクト
node examples/markup-loop-project/run.mjs
```

## CLI

```bash
vlmkit diff html <before.html> <after.html>     # Migration VRT (ファイルまたは URL)
vlmkit snapshot <url1> [url2] ...             # 複数 viewport スナップショット + 差分
vlmkit bench [options]                         # CSS チャレンジベンチマーク
vlmkit report                                 # 検出パターンレポート
vlmkit inspect smoke <file-or-url>                    # A11y 駆動ランダム操作テスト
vlmkit markup-loop <init|observe|doctor|run> # plan/generate/VRT gate の導入用ループ
vlmkit api serve [--port 3456]                    # API サーバー
vlmkit api status [--url http://localhost:3456]   # サーバーヘルスチェック
```

## 環境変数

| 変数 | 用途 | デフォルト |
|------|------|----------|
| `VLMKIT_LLM_PROVIDER` | LLM プロバイダ — `gemini` \| `anthropic` \| `openrouter` | gemini |
| `VLMKIT_LLM_MODEL` | LLM モデル | プロバイダのデフォルト (`openrouter` は qwen/qwen3-vl-8b-instruct) |
| `VLMKIT_VLM_MODEL` | VLM モデル (OpenRouter の id、直接呼ぶなら `gemini:` / `claude:`) | bytedance/ui-tars-1.5-7b |
| `OPENROUTER_API_KEY` | OpenRouter API キー | — |
| `GEMINI_API_KEY` | Google AI API キー | — |
| `ANTHROPIC_API_KEY` | Anthropic API キー | — |

`openai` というプロバイダは存在せず、`OPENAI_API_KEY` も使いません。OpenAI のモデルは
OpenRouter 経由で、id の `openai/` はその接頭辞です。`VLMKIT_LLM_PROVIDER=openai` は
`INVALID_PROVIDER` になります（エラーメッセージが下の経路を案内します）。

```sh
export VLMKIT_LLM_PROVIDER=openrouter
export VLMKIT_LLM_MODEL=openai/gpt-5.6-luna
export VLMKIT_VLM_MODEL=openai/gpt-5.6-luna
```

## ライセンス

MIT
