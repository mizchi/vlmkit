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
  observe: { tiers: [{ provider: "openrouter", model: "bytedance/ui-tars-72b", vision: true }] },
  codegen: { tiers: [
    { provider: "gemini",    model: "gemini-2.0-flash-lite",   vision: false }, // cheap first
    { provider: "anthropic", model: "claude-sonnet-4-20250514", vision: false }, // strong last
  ]},
  budgetUsd: 1.0,        // shared cap across both tiers; loop stops when summed cost exceeds it
  maxAttempts: 4,
});
// result.verdict: "fixed" | "regression" | "intentional-change" | "give-up"
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
