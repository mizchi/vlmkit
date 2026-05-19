# vlmkit project structure diagram

作成日: 2026-05-19

## 生成済み画像

- [全体構成 PNG](./assets/vlmkit-project-structure-1-overview.png)
- [Package / source boundary PNG](./assets/vlmkit-project-structure-2-package-boundary.png)
- [visual diff flow PNG](./assets/vlmkit-project-structure-3-visual-diff-flow.png)

## 全体構成

```mermaid
flowchart TB
  user["User / Coding Agent"]

  subgraph cli["CLI: @mizchi/vlmkit"]
    vlmkit["vlmkit"]
    diff["diff\nhtml / png / elements / browsers / agent / runs"]
    snapshot["snapshot\ncapture / approve / stability / report / flipbook / fix-prompt"]
    check["check\na11y / tokens / theme / perf / drift"]
    inspect["inspect\ninteract / explore / smoke"]
    markup_cli["build / scan / stress\ncomponent / breakpoints / i18n / media"]
    migration["migration\ncompare / blind / subagent"]
    labs["bench / report\nCSS challenge lab"]
    api_cli["api\nserve / status"]
    workflow["workflow\ninit / capture / verify / approve"]
  end

  subgraph api["HTTP API / Worker"]
    hono["Hono API app"]
    openapi["OpenAPI"]
    compare_api["/api/compare"]
    renderers_api["/api/compare-renderers"]
    reason_api["/api/reason"]
    smoke_api["/api/smoke-test"]
    worker["Cloudflare Worker entry"]
  end

  subgraph packages["Workspace packages"]
    core["@mizchi/vlmkit-core\nPNG diff / heatmap / DOM / style / a11y / quality"]
    capture["@mizchi/vlmkit-capture\nPlaywright / Crater / viewport discovery / config"]
    markup["@mizchi/vlmkit-markup\ncomponent / design tokens / theme / inspect / stress / heal"]
    ai["@mizchi/vlmkit-ai\nVLM / LLM clients / reasoning / intent"]
  end

  subgraph backends["External backends"]
    playwright["Playwright Chromium"]
    crater["Crater BiDi"]
    cloudflare["Cloudflare Browser Rendering"]
    llm["OpenRouter / Gemini / Anthropic"]
    storage["R2 / KV / D1 bindings"]
  end

  subgraph outputs["Artifacts"]
    pngs["baseline / current / heatmap PNG"]
    json["diff-report.json\nsnapshot-report.json\nstability-report.json"]
    md["agent Markdown\nfix prompt\nsummary report"]
    html["flipbook HTML"]
    baselines["baselines / snapshots / approval manifests"]
  end

  user --> vlmkit
  vlmkit --> diff
  vlmkit --> snapshot
  vlmkit --> check
  vlmkit --> inspect
  vlmkit --> markup_cli
  vlmkit --> migration
  vlmkit --> labs
  vlmkit --> api_cli
  vlmkit --> workflow

  api_cli --> hono
  hono --> openapi
  hono --> compare_api
  hono --> renderers_api
  hono --> reason_api
  hono --> smoke_api
  worker --> hono

  diff --> core
  snapshot --> core
  check --> core
  workflow --> core
  migration --> core
  labs --> core
  compare_api --> core

  diff --> capture
  snapshot --> capture
  workflow --> capture
  renderers_api --> capture
  smoke_api --> capture

  check --> markup
  inspect --> markup
  markup_cli --> markup
  migration --> markup
  smoke_api --> markup

  reason_api --> ai
  migration --> ai
  labs --> ai

  capture --> playwright
  capture --> crater
  capture --> cloudflare
  ai --> llm
  worker --> storage

  core --> pngs
  core --> json
  markup --> md
  snapshot --> html
  workflow --> baselines
```

## Package / source boundary

```mermaid
flowchart LR
  subgraph entry["Entry points"]
    bin["src/cli/vlmkit.ts"]
    router["src/cli/cli.ts\ncommand router"]
    api_server["src/api/api-server.ts"]
    api_app["src/api/api-app.ts"]
    worker_entry["worker/index.ts"]
  end

  subgraph app_src["Root src"]
    snapshot_src["src/vrt/snapshot/*"]
    compare_src["src/vrt/compare/*"]
    api_src["src/api/*"]
    workflow_src["src/cli/workflow/*"]
    experiment_src["src/experiments/*\nmigration / css-challenge / detection / flaker / benchmark"]
    util_src["src/util/*"]
  end

  subgraph core_pkg["packages/vlmkit-core"]
    image_core["image diff\npng-diff / heatmap / regions / shift"]
    dom_core["DOM and style\ndom-equivalence / computed-style"]
    semantic_core["semantic\na11y / visual / quality"]
    cli_core["deep CLI helpers\na11y / element / mask"]
  end

  subgraph capture_pkg["packages/vlmkit-capture"]
    config_capture["capture config"]
    viewport_capture["viewport discovery"]
    browser_capture["capturer / Playwright analyzer"]
    crater_capture["Crater client / prescanner"]
  end

  subgraph markup_pkg["packages/vlmkit-markup"]
    component_markup["component\nbbox / geometry / extract / from-image"]
    style_markup["style\npalette / tokens / theme"]
    inspect_markup["inspect\ninteract / explore / smoke / dep-graph"]
    stress_markup["stress\ni18n / media / cross-browser / multi-page"]
    heal_markup["heal\nfix-prompt / selector-heal"]
  end

  subgraph ai_pkg["packages/vlmkit-ai"]
    vlm_ai["vlm-client"]
    llm_ai["llm-client"]
    reason_ai["reasoning / reasoning-pipeline"]
    intent_ai["intent / nlp"]
  end

  bin --> router
  router --> snapshot_src
  router --> compare_src
  router --> workflow_src
  router --> experiment_src
  router --> util_src
  router --> api_server

  api_server --> api_app
  worker_entry --> api_app
  api_app --> api_src

  snapshot_src --> image_core
  compare_src --> image_core
  compare_src --> dom_core
  workflow_src --> semantic_core
  api_src --> semantic_core
  experiment_src --> image_core
  experiment_src --> dom_core

  snapshot_src --> browser_capture
  compare_src --> browser_capture
  workflow_src --> config_capture
  experiment_src --> viewport_capture
  experiment_src --> crater_capture

  router --> component_markup
  router --> style_markup
  router --> inspect_markup
  router --> stress_markup
  snapshot_src --> heal_markup
  experiment_src --> component_markup

  api_src --> reason_ai
  experiment_src --> reason_ai
  reason_ai --> vlm_ai
  reason_ai --> llm_ai
  reason_ai --> intent_ai
```

## 代表フロー: visual diff から agent 用レポートまで

```mermaid
sequenceDiagram
  participant U as User / Agent
  participant CLI as vlmkit diff html
  participant Cap as vlmkit-capture
  participant Core as vlmkit-core
  participant Markup as vlmkit-markup
  participant Out as Artifacts

  U->>CLI: baseline.html + current.html / URL
  CLI->>Cap: viewport discovery + page capture
  Cap->>Out: baseline/current screenshots
  CLI->>Core: pixel diff + heatmap + region detection
  CLI->>Core: computed style / DOM / a11y diff
  CLI->>Markup: component geometry and palette helpers
  Core->>Out: diff-report.json + heatmap PNG
  U->>CLI: vlmkit diff agent diff-report.json
  CLI->>Out: agent-friendly Markdown
```

## 読み方

- `@mizchi/vlmkit-core` は比較の最小単位を持つ層。
- `@mizchi/vlmkit-capture` は browser / renderer 依存を隔離する層。
- `@mizchi/vlmkit-markup` は UI を理解・検査・再構成する補助層。
- `@mizchi/vlmkit-ai` は VLM/LLM reasoning の任意拡張層。
- `src/experiments/*` 由来の CLI は価値が高いが、安定 API というより labs として扱う。
