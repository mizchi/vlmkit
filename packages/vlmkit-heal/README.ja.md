# @mizchi/vlmkit-heal

Playwright テスト向けの自己修復 (self-healing) ループです。Playwright コマンドを実行し、失敗を観測し、テストファイルの書き換え、または承認された VRT ベースライン更新を行います。モデル呼び出しは安価な tier から強い tier へ段階的に上げ、共有の予算上限で止めます。

言語: [English](./README.md) | 日本語

## 何をするか

`@mizchi/vlmkit-heal` は CLI ではなく TypeScript API パッケージです。

意図した UI 変更で Playwright テストが落ちたときに使います。

- locator の文言が変わった。例: `Begin` が `Start` になった
- アクセシブル名が変わり、Playwright が `error-context.md` を出力した
- `toHaveScreenshot` のベースラインが古く、見た目の差分が宣言済みの意図と一致する
- 失敗した複数 spec を、予算上限つきで順番に修復したい

アプリケーションコードは編集しません。ループが書き換えるソースファイルは `testFile` だけです。VRT 差分が承認された場合だけ、指定したスナップショット更新コマンドを実行できます。`fixed` 以外で終わった場合、元のテストファイルに戻します。

## インストール

Node.js 24+ と Playwright が必要です。

```bash
pnpm add -D @mizchi/vlmkit-heal @playwright/test tsx
pnpm exec playwright install chromium
```

以下の例は `tsx` で実行します。このパッケージは現在 TypeScript source file を export しているためです。

このリポジトリの workspace package として使う場合:

```bash
pnpm install
```

## モデル設定

2 種類のモデル tier を渡します。

- `observe`: VRT レビュー用の vision reasoning。スクリーンショットから accept / reject / unsure を判断できるモデルを使います。
- `codegen`: Playwright テストファイルを書き換える text/code モデルです。

対応プロバイダは `openrouter` / `anthropic` / `gemini` です。

| プロバイダ | 環境変数 |
|---|---|
| OpenRouter | `OPENROUTER_API_KEY` |
| Anthropic direct | `ANTHROPIC_API_KEY` |
| Gemini direct | `GEMINI_API_KEY` |
| OpenAI-compatible `baseURL` | 認証が必要なら `VLMKIT_HEAL_BASEURL_KEY` |

OpenRouter tier では `fetchOpenRouterPricing()` と `withPricing()` で token 単価を埋めてください。内部の OpenRouter client は `costUsd: 0` を返すため、価格メタデータがないと `budgetUsd` が実質効きません。

## Playwright Test Agents と使う

`vlmkit-heal` は公式 Playwright Test Agents 全体を置き換えるものではなく、その後段で使う想定です。Playwright agents は対話的にテストを生成・修復します。`vlmkit-heal` はその後に、CI、VRT ベースライン、モデル費用の上限、2 回連続 green の検証を扱うための境界つきステップを追加します。

推奨フロー:

```bash
npx playwright init-agents --loop=codex
# 他の agent runtime では --loop=claude / --loop=vscode / --loop=opencode を使う
```

段階は次のように分けます。

| Stage | 担当 | 出力 |
|---|---|---|
| Plan | Playwright `planner` | user story、seed test、任意の PRD から `specs/<topic>.md` |
| Generate | Playwright `generator` | 実際の locator/assertion を使った `tests/<topic>.spec.ts` |
| First repair | Playwright `healer` | 生成中の対話的な修正 |
| Verify + VRT gate | test command / CI | committed baseline と 2 回連続 green |
| Bounded heal | `@mizchi/vlmkit-heal` | `budgetUsd` 内での 1 ファイル test rewrite、または承認済み VRT baseline 更新 |

公式 planner/generator agents を呼び出せない、または特定の agent runtime に依存したくない場合は、`@mizchi/vlmkit-plan` と `@mizchi/vlmkit-generate` が同じ artifact 用の runtime-neutral な prompt/API contract を提供します。ただし、これらはブラウザを自分では操作しません。seed test や UI observation は利用側の agent から渡してください。

Playwright を更新したら `npx playwright init-agents --loop=...` を再実行してください。生成される agent 定義には、その時点の Playwright MCP tools と instruction が含まれます。

探索・作成中の修復には Playwright 公式 healer を使います。生成後、特に次の guardrail が必要な場合は `vlmkit-heal` を使います。

- 安価な model tier から強い tier へ上げつつ、費用を `budgetUsd` で止める
- VRT baseline 更新前に accept / reject / needs-review を判定する
- アプリケーションコードを編集しない
- `give-up` / `regression` / `flaky` / `needs-review` ではロールバックする
- 追加の 2 回 green で再現性を確認する

Playwright Test Agents で生成された spec を後段で heal する雛形は
[`examples/test-agents/heal-after-generator.ts`](../../examples/test-agents/heal-after-generator.ts) を参照してください。

## クイックスタート

`scripts/heal-login.ts` のような小さいスクリプトを用意します。

```ts
import { resolve } from "node:path";
import {
  fetchOpenRouterPricing,
  heal,
  withPricing,
  type ModelTier,
} from "@mizchi/vlmkit-heal";

const openRouterKey = process.env.OPENROUTER_API_KEY;
if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is required");

const pricing = await fetchOpenRouterPricing(openRouterKey);

const observeTiers: ModelTier[] = withPricing([
  { provider: "openrouter", model: "openai/gpt-5-mini", vision: true },
  { provider: "openrouter", model: "anthropic/claude-sonnet-4.6", vision: true },
], pricing);

const codegenTiers: ModelTier[] = withPricing([
  { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false },
  { provider: "openrouter", model: "openai/gpt-5-codex", vision: false },
], pricing);

const testFile = resolve("tests/login.spec.ts");

const result = await heal({
  testCommand: "pnpm exec playwright test tests/login.spec.ts",
  testFile,
  cwd: process.cwd(),
  observe: { tiers: observeTiers },
  codegen: { tiers: codegenTiers },
  budgetUsd: 1.0,
  maxAttempts: 4,
  outputDir: "test-results",
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.verdict === "fixed" ? 0 : 1;
```

実行:

```bash
OPENROUTER_API_KEY=... npx tsx scripts/heal-login.ts
```

locator の失敗では、ループは Playwright の出力と最新の `error-context.md` を読み、`codegen` tier にテストファイル全体の書き換えを依頼します。その後 `testFile` に適用し、同じコマンドを再実行します。`fixed` は、通過した実行のあとに検証実行が 2 回連続で通った場合だけ返ります。

## VRT ベースライン更新

`toHaveScreenshot` の失敗では、`codegen` を呼ぶ前に baseline / actual / diff 画像をレビューします。

差分が意図したものなら `expectedChange` を渡してください。pixel だけでは意図を判定できません。

```ts
import { resolve } from "node:path";
import { collectGitContext, heal } from "@mizchi/vlmkit-heal";

const result = await heal({
  testCommand: "pnpm exec playwright test tests/badge.spec.ts",
  updateSnapshotsCommand: "pnpm exec playwright test tests/badge.spec.ts --update-snapshots",
  testFile: resolve("tests/badge.spec.ts"),
  cwd: process.cwd(),
  observe: { tiers: observeTiers },
  codegen: { tiers: codegenTiers },
  expectedChange: "The status badge changes from blue Active to red Archived.",
  gitContext: collectGitContext(process.cwd(), { base: "origin/main" }),
  acceptThreshold: 0.8,
  confirmAccept: true,
  budgetUsd: 1.0,
  maxAttempts: 3,
});
```

VRT レビューの結果:

- `accept` かつ `acceptThreshold` 以上: `updateSnapshotsCommand` を実行
- `reject`: `regression` を返す
- `unsure` または低 confidence の accept: `needs-review` を返す

`confirmAccept` のデフォルトは `true` です。最初の `observe` tier が accept し、より強い `observe` tier がある場合、ベースライン更新前に最強 tier でも accept する必要があります。

reviewer だけを直接呼ぶこともできます。

```ts
import { findVrtArtifacts, reviewVrtDiff } from "@mizchi/vlmkit-heal";

const { baseline, actual, diff } = findVrtArtifacts(process.cwd());
if (!baseline || !actual) throw new Error("no Playwright VRT artifacts found");

const review = await reviewVrtDiff({
  baselinePng: baseline,
  actualPng: actual,
  diffPng: diff,
  expectedChange: "The status badge changes from blue Active to red Archived.",
  tier: { provider: "openrouter", model: "openai/gpt-5-mini", vision: true },
});
```

## 複数ファイル

失敗した spec を順番に処理し、suite 全体の外側予算を置く場合は `healAll()` を使います。

```ts
import { resolve } from "node:path";
import { healAll } from "@mizchi/vlmkit-heal";

const { entries, fixed, totalCostUsd } = await healAll(
  failedFiles.map((file) => ({
    testCommand: `pnpm exec playwright test ${file}`,
    testFile: resolve(file),
    cwd: process.cwd(),
    observe: { tiers: observeTiers },
    codegen: { tiers: codegenTiers },
    budgetUsd: 0.75,
    maxAttempts: 4,
  })),
  { totalBudgetUsd: 3.0 },
);
```

各ファイルには個別の `budgetUsd` があり、`totalBudgetUsd` は batch 全体の合計消費が上限に達した時点で残りを skip します。

## 自己ホスト / OpenAI-compatible モデル

tier に `baseURL` を設定します。`/chat/completions` はパッケージ側で付与します。

```ts
const observeTiers = [
  {
    provider: "openrouter",
    model: "local-vlm",
    vision: true,
    baseURL: "http://localhost:8000/v1",
    promptCostPerToken: 0,
    completionCostPerToken: 0,
  },
] satisfies ModelTier[];
```

エンドポイントが Bearer 認証を要求する場合は `VLMKIT_HEAL_BASEURL_KEY` を設定してください。

## Options Reference

| Option | 意味 |
|---|---|
| `testCommand` | pass/fail を exit code で判定する shell command。 |
| `testFile` | ループが書き換えてよい唯一のソースファイル。絶対パス推奨。 |
| `cwd` | `testCommand` を実行する working directory。 |
| `observe.tiers` | VRT レビュー用の vision reasoning tier。安い順。 |
| `codegen.tiers` | テスト書き換え用の codegen tier。安い順。 |
| `budgetUsd` | そのファイル内で observe/codegen が共有する予算上限。 |
| `maxAttempts` | `give-up` までの最大試行回数。 |
| `outputDir` | Playwright output directory 名。未指定なら一般的な名前を探索。 |
| `updateSnapshotsCommand` | VRT baseline を更新するコマンド。未指定なら `${testCommand} --update-snapshots`。 |
| `expectedChange` | VRT レビュー用の宣言済み visual intent。強く推奨。 |
| `gitContext` | `collectGitContext()` などから渡す commit/diff context。 |
| `acceptThreshold` | VRT accept を自動採用する最小 confidence。default `0.8`。 |
| `confirmAccept` | VRT accept を最強 `observe` tier で再確認する。default `true`。 |
| `flakyThreshold` | gate は green だが verify が red になる状態が何回続いたら `flaky` にするか。default `2`。 |

特殊な snapshot 更新コマンドが必要な場合は、`testCommand` と同じ options に `updateSnapshotsCommand` を設定します。

```ts
await heal({
  ...options,
  updateSnapshotsCommand: "pnpm exec playwright test tests/badge.spec.ts --update-snapshots",
});
```

## Verdict

| Verdict | 意味 |
|---|---|
| `fixed` | テストが通り、検証実行も 2 回通った。書き換え済みの test file は残る。 |
| `regression` | VRT レビューが差分を reject した。元の test file に戻す。 |
| `needs-review` | VRT レビューが unsure、低 confidence、または強 tier 確認で不一致。 |
| `flaky` | テストは通ることがあるが検証が繰り返し落ちる。patch は残さない。 |
| `give-up` | 試行回数または予算が尽きた。元の test file に戻す。 |
| `intentional-change` | public type の互換性のために残している verdict。現在の `heal()` は VRT accept 後に verification を実行し、通常は `fixed` を返す。 |

## Safety Model

- `heal()` はアプリケーション source を編集しません。
- テストの書き換えは `testFile` に限定されます。
- `fixed` 以外の終了では元の test file に戻します。
- VRT ベースラインは、レビューが accept したあとに指定したスナップショット更新コマンド経由でのみ更新します。
- 間違った VRT accept は regression をベースラインに焼き込むため危険です。`expectedChange` を渡し、`confirmAccept: true` を維持し、`observe` には reasoning に強い VLM を使ってください。

## Smoke Check

このリポジトリ内で:

```bash
node packages/vlmkit-heal/smoke/heal-smoke.ts
HEAL_REAL_LLM=1 OPENROUTER_API_KEY=... node packages/vlmkit-heal/smoke/heal-smoke.ts
```

通常の smoke は LLM をモックし、Playwright は実際に動かします。`HEAL_REAL_LLM=1` では実モデル tier を使うためプロバイダの API key が必要です。

## Troubleshooting

- `no API key for provider`: provider の API key を設定するか、全 tier を OpenRouter に寄せてください。
- OpenRouter で予算が尽きない: `withPricing(await fetchOpenRouterPricing(key))` で OpenRouter tier に token 単価を入れてください。
- VRT が `needs-review` になる: `expectedChange` を渡す、`confirmAccept: true` を維持する、または baseline/actual/diff を手動確認してください。
- locator 修復の精度が低い: Playwright が `error-context.md` を出しているか確認し、custom output directory を使っているなら `outputDir` を指定してください。
- モデルが大きく書き換えすぎる: `healAll()` の前に、`testCommand` と `testFile` を 1 spec に絞ってください。

## 設計メモ

[docs/heal-loop-design.md](../../docs/heal-loop-design.md) と
[docs/vrt-review-design.md](../../docs/vrt-review-design.md) を参照してください。
