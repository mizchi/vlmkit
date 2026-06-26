# @mizchi/vlmkit-heal

Cost-optimized self-healing loop for Playwright tests. Runs a test command;
on failure it observes (a vision tier — ui-tars — judges VRT diffs) and
proposes a patch (a text tier), escalating from a cheap model to a strong one
only when needed, under a shared budget cap. Success requires two consecutive
green runs.

Built on `@mizchi/vlmkit-{ai,capture,core}` (LLM/VLM abstraction with
per-call `costUsd`, browser capture, diff engine).

## API

```ts
import { heal, createModelRouter } from "@mizchi/vlmkit-heal";

const result = await heal({
  testCommand: "pnpm exec playwright test login.spec.ts",
  testFile: "tests/login.spec.ts",     // the only source file the loop may edit
  cwd: process.cwd(),
  // observe = a cheap REASONING VLM (NOT ui-tars, which is GUI-grounding only)
  observe: { tiers: [{ provider: "openrouter", model: "google/gemini-2.5-flash-lite", vision: true }] },
  codegen: { tiers: [
    { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false }, // cheap first
    { provider: "openrouter", model: "openai/gpt-5-codex", vision: false },                // strong last
  ]},
  budgetUsd: 1.0,        // shared cap across both tiers; loop stops when summed cost exceeds it
  maxAttempts: 4,
});
// result.verdict: "fixed" | "regression" | "intentional-change" | "flaky" | "give-up"
```

Any provider/model drives a tier. Via OpenRouter (one `OPENROUTER_API_KEY`) you
can name any model — `openai/gpt-5-codex`, `openai/gpt-5-mini`,
`anthropic/claude-sonnet-4.6` (Claude as the driver), `qwen/qwen3-coder-30b-a3b-instruct`.
`provider: "anthropic"` / `"gemini"` hit those APIs directly (own key); a tier's
`baseURL` points at any OpenAI-compatible endpoint.

Heal a whole failing suite with one cross-file budget:

```ts
import { healAll } from "@mizchi/vlmkit-heal";

const { entries, fixed, totalCostUsd } = await healAll(
  [optsA, optsB, optsC],          // one HealOptions per file
  { totalBudgetUsd: 2.0 },        // outer cap; remaining files skip once reached
);
```

Self-hosted observe model (e.g. ui-tars) via an OpenAI-compatible endpoint —
set `baseURL` on the tier (auth via `VLMKIT_HEAL_BASEURL_KEY` if needed):

```ts
observe: { tiers: [{ provider: "openrouter", model: "ui-tars", vision: true, baseURL: "http://localhost:8000/v1" }] }
```

Inject mocks for deterministic tests:

```ts
await heal(opts, {
  runTest: async () => ({ ok: false, stdout: "", stderr: "locator resolved to 0 elements" }),
  observe: { observe: async () => ({ verdict: "unknown", costUsd: 0 }) },
  codegen: { propose: async () => ({ newTestSource: "...", costUsd: 0 }) },
});
```

## Design

- Edits only the test file and VRT baselines; app code is never touched
  (enforced by a path allowlist in `applyPatch`).
- Baseline updates happen only when the vision tier judges a VRT diff to be an
  intentional change, never a regression.
- The observe tier (cheap vision) supplies the intentional-vs-regression
  signal so the expensive codegen tiers are called fewer times.

See `docs/heal-loop-design.md` for the full design.

## 疎通 smoke

```sh
node packages/vlmkit-heal/smoke/heal-smoke.ts          # mock LLM + real Playwright
HEAL_REAL_LLM=1 node packages/vlmkit-heal/smoke/heal-smoke.ts  # real tiers (needs API keys)
```

Breaks a locator in a self-contained fixture and confirms the loop heals it
through real Playwright runs.
