# @mizchi/vlmkit-heal

Self-healing loop for Playwright tests. It runs a Playwright command, observes a
failure, and either rewrites the test file or updates an accepted VRT baseline.
Model calls are routed cheap-to-strong under a shared budget cap.

Language: English | [Japanese](./README.ja.md)

## What It Does

`@mizchi/vlmkit-heal` is a TypeScript API package, not a CLI.

It is useful when a generated or maintained Playwright test fails because the UI
changed intentionally:

- locator text changed, for example `Begin` became `Start`
- accessible names changed and Playwright wrote `error-context.md`
- a `toHaveScreenshot` baseline is stale and the visual change matches declared
  intent
- a failing suite needs a bounded, file-by-file repair pass

It deliberately does not edit application code. The loop may rewrite only
`testFile`; for accepted VRT diffs it may run your snapshot update command.
Non-fixed outcomes restore the original test file.

## Install

Requires Node.js 24+ and Playwright.

```bash
pnpm add -D @mizchi/vlmkit-heal @playwright/test tsx
pnpm exec playwright install chromium
```

The examples below use `tsx` because this package currently exports TypeScript
source files.

If you are using this repository as a workspace package:

```bash
pnpm install
```

## Model Access

You provide model tiers for two phases:

- `observe`: vision reasoning for VRT review. Use a model that can judge
  accept/reject/unsure from screenshots.
- `codegen`: text/code model that rewrites the Playwright test file.

Supported providers are `openrouter`, `anthropic`, and `gemini`.

| Provider | Environment variable |
|---|---|
| OpenRouter | `OPENROUTER_API_KEY` |
| Anthropic direct | `ANTHROPIC_API_KEY` |
| Gemini direct | `GEMINI_API_KEY` |
| OpenAI-compatible `baseURL` | `VLMKIT_HEAL_BASEURL_KEY` when auth is needed |

For OpenRouter tiers, fill per-token pricing with `fetchOpenRouterPricing()` and
`withPricing()`. The unified OpenRouter client reports `costUsd: 0`, so pricing
metadata is what makes the budget cap effective.

## With Playwright Test Agents

`vlmkit-heal` is designed to run after the official Playwright Test Agents, not
to replace the whole agent loop. The Playwright agents create and repair tests
interactively; `vlmkit-heal` adds a bounded, auditable post-generation step for
CI, VRT baselines, model-cost control, and two-green verification.

Recommended flow:

```bash
npx playwright init-agents --loop=codex
# use --loop=claude / --loop=vscode / --loop=opencode for other agent runtimes
```

Then run the stages:

| Stage | Owner | Output |
|---|---|---|
| Plan | Playwright `planner` | `specs/<topic>.md` from a user story, seed test, and optional PRD |
| Generate | Playwright `generator` | `tests/<topic>.spec.ts` with real locators/assertions |
| First repair | Playwright `healer` | Interactive fixes while the generated test is still being authored |
| Verify + VRT gate | your test command / CI | committed baselines and two consecutive green runs |
| Bounded heal | `@mizchi/vlmkit-heal` | one-file test rewrite or accepted VRT baseline update under `budgetUsd` |

If you cannot or do not want to invoke the official planner/generator agents,
`@mizchi/vlmkit-plan` and `@mizchi/vlmkit-generate` provide runtime-neutral
prompt/API contracts for the same artifacts. They do not drive the browser by
themselves; pass in seed tests and UI observations collected by your agent.

Run `npx playwright init-agents --loop=...` again whenever Playwright is updated;
the generated agent definitions contain Playwright's current MCP tools and
instructions.

Use Playwright's built-in healer when you are still in the exploratory authoring
loop. Use `vlmkit-heal` after generation, especially when you need one or more of
these guardrails:

- spend cap across cheap-to-strong model tiers
- VRT accept/reject/needs-review before updating baselines
- no application-code edits
- rollback on `give-up`, `regression`, `flaky`, or `needs-review`
- reproducibility check with two additional green runs

For a ready-to-adapt post-generator script, see
[`examples/test-agents/heal-after-generator.ts`](../../examples/test-agents/heal-after-generator.ts).

## Quick Start

Create a small script such as `scripts/heal-login.ts`:

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

Run it:

```bash
OPENROUTER_API_KEY=... npx tsx scripts/heal-login.ts
```

On a locator failure, the loop reads Playwright output and the newest
`error-context.md`, asks the codegen tier for a full-file rewrite, applies it to
`testFile`, then reruns the command. A fixed result is returned only after a
passing run is followed by two passing verification runs.

## VRT Baseline Updates

For `toHaveScreenshot` failures, the loop first reviews baseline/actual/diff
images before calling codegen.

Pass `expectedChange` whenever the diff is supposed to be intentional. Pixels
alone cannot prove intent.

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

VRT review results:

- `accept` at or above `acceptThreshold`: run `updateSnapshotsCommand`
- `reject`: return `regression`
- `unsure` or low-confidence accept: return `needs-review`

`confirmAccept` defaults to `true`. When the first observe tier accepts and a
stronger observe tier exists, the strongest tier must also accept before the
baseline update runs.

You can also call the reviewer directly:

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

## Multiple Files

Use `healAll()` to process several failing specs sequentially with an outer
suite budget:

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

Each file keeps its own `budgetUsd`. `totalBudgetUsd` stops the batch once the
combined spend reaches the outer cap.

## Self-hosted or OpenAI-compatible Models

Set `baseURL` on a tier. The package appends `/chat/completions`.

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

Use `VLMKIT_HEAL_BASEURL_KEY` if the endpoint requires bearer auth.

## Options Reference

| Option | Meaning |
|---|---|
| `testCommand` | Shell command whose exit code defines pass/fail. |
| `testFile` | The only source file the loop may rewrite. Prefer an absolute path. |
| `cwd` | Working directory used to run `testCommand`. |
| `observe.tiers` | Vision reasoning tiers for VRT review, cheapest first. |
| `codegen.tiers` | Code generation tiers for test rewrites, cheapest first. |
| `budgetUsd` | Shared cap across observe and codegen calls for this file. |
| `maxAttempts` | Maximum loop attempts before `give-up`. |
| `outputDir` | Playwright output directory name. Defaults to searching common names. |
| `updateSnapshotsCommand` | Command used to refresh VRT baselines. Defaults to `${testCommand} --update-snapshots`. |
| `expectedChange` | Declared visual intent for VRT review. Strongly recommended. |
| `gitContext` | Optional commit/diff context, often from `collectGitContext()`. |
| `acceptThreshold` | Minimum confidence for automatic VRT accept. Default `0.8`. |
| `confirmAccept` | Confirm accepted VRT diffs with the strongest observe tier. Default `true`. |
| `flakyThreshold` | Gate-green/verify-red streak before returning `flaky`. Default `2`. |

For tests with special snapshot commands, set `updateSnapshotsCommand` next to
`testCommand`:

```ts
await heal({
  ...options,
  updateSnapshotsCommand: "pnpm exec playwright test tests/badge.spec.ts --update-snapshots",
});
```

## Verdicts

| Verdict | Meaning |
|---|---|
| `fixed` | The test passed and verification passed twice. The rewritten test file remains in place. |
| `regression` | VRT review rejected the change. The original test file is restored. |
| `needs-review` | VRT review was unsure, low confidence, or strong-tier confirmation disagreed. |
| `flaky` | The test can pass, but verification failed repeatedly. No patch is kept. |
| `give-up` | Attempts or budget ran out. The original test file is restored. |
| `intentional-change` | Kept in the public union for compatibility. Current `heal()` runs verification after VRT accepts and normally returns `fixed`. |

## Safety Model

- Application source is never edited by `heal()`.
- Test rewrites are constrained to `testFile`.
- Non-fixed outcomes restore the original test file.
- VRT baselines are updated only through your snapshot update command after an
  accepted review.
- A wrong VRT accept is dangerous because it bakes a regression into the
  baseline. Use `expectedChange`, keep `confirmAccept: true`, and prefer a
  capable reasoning VLM for `observe`.

## Smoke Checks

From this repository:

```bash
node packages/vlmkit-heal/smoke/heal-smoke.ts
HEAL_REAL_LLM=1 OPENROUTER_API_KEY=... node packages/vlmkit-heal/smoke/heal-smoke.ts
```

The default smoke uses a mocked LLM and real Playwright. `HEAL_REAL_LLM=1`
drives real model tiers and needs provider keys.

## Troubleshooting

- `no API key for provider`: set the provider key or use OpenRouter for all tiers.
- Budget never exhausts with OpenRouter: wrap OpenRouter tiers with
  `withPricing(await fetchOpenRouterPricing(key))`.
- VRT returns `needs-review`: provide `expectedChange`, lower risk by keeping
  `confirmAccept: true`, or inspect the baseline/actual/diff manually.
- Locator repairs are weak: ensure Playwright writes `error-context.md` and set
  `outputDir` if your config uses a custom output directory.
- The model rewrites too much: narrow `testCommand` and `testFile` to one spec
  before using `healAll()`.

## Design Notes

See [docs/heal-loop-design.md](../../docs/heal-loop-design.md) and
[docs/vrt-review-design.md](../../docs/vrt-review-design.md).
