# vlmkit feature review

調査日: 2026-05-19

## 要約

vlmkit の中核は Visual Regression Testing で、そこに design audit、
markup assistance、agent loop、API/server、benchmark lab が重なっている。
現在の README は機能量をよく拾えている一方で、`vrt` 時代の名前、
実験機能、公開済みの安定機能が同じ粒度で並んでいるため、利用者には
「まず何を使えばよいか」が見えにくい。

整理方針は次の 5 レイヤに分けるのが自然。

1. Core VRT: `diff`, `snapshot`, `baseline`, `manifest`
2. Quality gates: `check`, `stress`, `inspect smoke`
3. Agent loop: `diff agent`, `watch`, `diff-pr`, `migration`
4. Markup assistance: `build component`, `scan`, `inspect`, component/style helpers
5. Lab / infrastructure: `bench`, `report`, Crater, Cloudflare backend, HTTP API

## 機能マップ

| レイヤ | 主な CLI/API | 現状 | 役割 |
|---|---|---:|---|
| Core VRT | `vlmkit diff html`, `diff png`, `diff elements`, `snapshot` | stable | HTML/URL/PNG を複数 viewport で比較し、pixel / style / a11y / shift の信号を出す |
| Snapshot workflow | `snapshot approve`, `snapshot report`, `snapshot stability`, `baseline`, `manifest` | stable | baseline 管理、承認、CI fail 条件、false positive 計測 |
| Quality gates | `check a11y`, `check tokens`, `check theme`, `check perf`, `check drift` | stable-beta | a11y、design token、theme parity、Web Vitals、component/page drift の検査 |
| Markup assistance | `build component`, `scan component`, `scan breakpoints`, `stress i18n`, `stress media` | beta | スクリーンショットからの component 再現、component 抽出、i18n/media stress |
| Interaction inspection | `inspect interact`, `inspect explore`, `inspect smoke` | beta | 操作列・探索・a11y driven smoke test で UI の壊れ方を見る |
| Agent loop | `diff agent`, `diff runs`, `watch`, `diff-pr`, `snapshot fix-prompt` | beta | coding agent が読むための Markdown/JSON パケット生成、ラウンド間比較 |
| Migration eval | `migration compare`, `migration blind`, `migration subagent` | experimental | UI library / CSS migration の before/after 評価と blind repair 評価 |
| AI reasoning | `/api/reason`, `packages/vlmkit-ai` | experimental | VLM/LLM による差分解釈、CSS fix suggestion |
| Benchmark lab | `bench`, `report`, CSS challenge | experimental | CSS 削除/復元ベンチ、検出率 DB、モデル比較 |
| Infrastructure | `api serve`, Worker entry, Crater, Cloudflare capture | beta-experimental | HTTP API、cross-renderer、remote browser capture、storage binding 検出 |

## Package boundaries

| Package | 責務 | コメント |
|---|---|---|
| `@mizchi/vlmkit` | CLI と HTTP API/client の公開面 | 利用者が最初に触る入口。安定 CLI と実験 CLI の区別を README で明示したい |
| `@mizchi/vlmkit-core` | browser 非依存寄りの diff / DOM / a11y / visual primitives | `png-diff`, `heatmap`, `computed-style-diff`, `a11y-semantic` など。最も安定 API にしやすい |
| `@mizchi/vlmkit-capture` | Playwright / Crater / viewport discovery / config | browser や backend 依存を隔離する場所として妥当 |
| `@mizchi/vlmkit-markup` | component / style / inspect / stress / heal | 機能範囲が広いので、README では use case 別に見せた方がよい |
| `@mizchi/vlmkit-ai` | LLM/VLM client と reasoning pipeline | 現状は OpenRouter VLM、Gemini/Anthropic LLM が中心。OpenAI image generation は未統合 |

## 主要なズレ

### 1. `vrt` と `vlmkit` の名前が混在

`README.md` は概ね `vlmkit` に寄っているが、`docs/architecture.md`,
`docs/api-design.md`, `docs/ja/README.md`, package README には `vrt`
時代の名前が残っている。CLI shim として旧名を残すのは妥当だが、公開
docs の主語は `vlmkit` に統一した方がよい。

### 2. 安定機能と実験機能が同列

`diff`, `snapshot`, `check`, `baseline` は導入用の安定導線にできる。
一方で `migration blind`, CSS challenge, AI fix-loop, Crater/Cloudflare
backend は強いが、依存環境や評価文脈が必要。README では stable / beta /
experimental のラベルを付けると導入判断が速くなる。

### 3. AI provider の説明が「VLM-driven」に対して曖昧

現状の環境変数は `VRT_VLM_MODEL` が OpenRouter、`VRT_LLM_PROVIDER` が
Gemini/Anthropic 中心。OpenAI の GPT Image 2 や GPT-5.5 の image
generation tool は vlmkit にはまだ直接つながっていない。OpenAI を使うなら
次のどちらかを明示的に設計する必要がある。

- `gpt-image-2` を画像生成・編集モデルとして直接呼ぶ
- `gpt-5.5` の Responses API tool として image generation を使う

### 4. HTTP API の branding/version が古い

`src/api/openapi.ts` の title は `vrt HTTP API`、`API_VERSION` は `0.4.0`。
package version は `0.6.0` なので、公開 OpenAPI と npm package の見え方が
ずれている。

### 5. `src/experiments` が公開 CLI に直結している

実験ディレクトリから CLI に直接出ている機能が多い。短期的には問題ないが、
README と OpenAPI では experimental label を付ける。長期的には
`experiments` から `labs` または正式 package に昇格させる基準を決める。

## 推奨する README 構成

1. What is vlmkit
   - Visual regression + semantic UI verification toolkit と定義する
   - VRT が中核、VLM/LLM は optional enhancement と書く
2. Quick start
   - `diff html`
   - `snapshot`
   - `snapshot approve`
   - `diff agent`
3. Stable CLI
   - `diff`
   - `snapshot`
   - `check`
   - `baseline`
   - `manifest`
4. Beta workflows
   - `watch`
   - `diff-pr`
   - `inspect`
   - `stress`
   - `build` / `scan`
5. Experimental labs
   - `migration`
   - `bench` / `report`
   - AI reason / CSS fix-loop
   - Crater / Cloudflare backend
6. Package APIs
   - `core`, `capture`, `markup`, `ai`
7. Migration from `vrt`
   - 旧コマンドは shim として残るが、新規 docs は `vlmkit` を使う

## OpenAI image generation note

Codex セッション自体は image generation tool が有効なら画像生成できる。
ただし vlmkit のコード上は、現時点で OpenAI GPT Image 2 へ直接つなぐ実装は
見当たらない。

OpenAI API で画像生成を機能化するなら、モデル ID は `gpt-image-2` を第一候補に
する。`gpt-5.5` は画像入力とテキスト出力の frontier model で、Responses API
では image generation tool を使える。つまり「GPT-5.5 が直接画像を返す」
というより、「GPT-5.5 に推論・指示整理をさせ、画像生成 tool / `gpt-image-2`
で生成する」と整理すると実装境界が明確になる。

## 次の作業候補

1. `docs/ja/README.md`, `docs/architecture.md`, `docs/api-design.md` の主語を
   `vlmkit` に更新する。
2. README の CLI 表に stability label を追加する。
3. `src/api/openapi.ts` の title/version を package version と合わせる。
4. `packages/vlmkit-ai` に OpenAI image generation adapter を追加するか、
   「画像生成は Codex/tool 側の責務」として明示的に非対応にする。
5. `src/experiments` から公開 CLI に出す機能の昇格基準を docs に置く。

## 関連 workflow

- [AI mock to markup flow for blog design](./blog-design-ai-flow.md)
