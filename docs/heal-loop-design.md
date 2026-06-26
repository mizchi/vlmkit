# Heal Loop Design (`@mizchi/vlmkit-heal`)

Date: 2026-06-26
Status: Implemented on `feat/heal-loop`. 疎通 confirmed end-to-end against real
OpenRouter + real Playwright: (1) locator failure healed by a cheap coder
(`qwen3-coder-30b`), (2) token-based cost accounting makes the budget cap work
for OpenRouter, (3) VRT-diff routed to a reasoning-VLM observe tier
(`gemini-2.5-flash-lite`) which, given `expectedChange`, judged intentional and
updated the baseline. ui-tars was tried in observe and found unsuitable (it
judged an intentional change as a regression) — see "Default tiers".

## Goal

A cost-optimized, agentic self-healing loop for Playwright tests. Given a
failing test command, it observes the failure (error output + screenshot +
a11y/VRT diff), proposes a patch with a cheap model first and escalates to a
stronger model only on repeated failure, applies the patch, and re-verifies —
until the test passes (reproducibly) or a budget/attempt cap is hit.

This generalizes the planner/generator/healer pipeline experience into a
reusable library, and lives inside the vlmkit monorepo so it can reuse the
existing LLM/VLM abstraction, browser capture, and diff engine.

## Why a new package in vlmkit (not a standalone repo)

vlmkit already provides everything the loop needs except the loop itself:

- `@mizchi/vlmkit-ai`: `createUnifiedLLMClient` (Anthropic / Gemini /
  OpenRouter), `LLMResponse.costUsd` per-call cost accounting,
  `listModels({ maxCost })` cost-sorted OpenRouter models, `reasoning`
  (realized / not-realized / unexpected verdicts).
- `@mizchi/vlmkit-capture`: browser driving (Playwright + optional CDP).
- `@mizchi/vlmkit-core`: pixel diff (`heatmap`), `diffA11yTrees`, shared types.

A standalone repo would re-implement or re-depend on all of the above. The
new package adds only the two genuinely missing pieces: a **cost-escalation
router** and the **heal loop**.

## Package layout

```
vlmkit/packages/
├── vlmkit-core      (existing)
├── vlmkit-ai        (existing)
├── vlmkit-capture   (existing)
└── vlmkit-heal      ← new. depends on the three above via workspace:*
    └── src/
        ├── types.ts        # public contract types (defined first)
        ├── router.ts       # createModelRouter — pure logic
        ├── observe.ts      # failure observation (parse + VLM + reasoning)
        ├── patch.ts        # codegen patch proposal + apply/backup
        ├── heal.ts         # the loop state machine
        └── index.ts        # barrel: createModelRouter, heal
```

## Public contract (`src/types.ts`)

Types are fixed first; implementation stays regenerable behind them.

```ts
import type { LLMResponse } from "@mizchi/vlmkit-ai";

interface ModelTier {
  provider: "anthropic" | "gemini" | "openrouter";
  model: string;
  vision: boolean;
  baseURL?: string;                 // for self-hosted / non-OpenRouter endpoints (e.g. ui-tars)
  promptCostPerToken?: number;      // USD/token; used when the provider returns costUsd 0 (OpenRouter)
  completionCostPerToken?: number;
}

interface RouterOptions {
  tiers: ModelTier[];      // cheapest first, strongest last
  escalateAfter?: number;  // failures at a tier before moving up (default 1)
}

interface ModelRouter {
  current(): ModelTier;
  escalate(): void;            // advance a tier; stays put at the last tier
  record(r: LLMResponse): void;// accumulate costUsd into the shared budget
  spentUsd(): number;
  exhausted(): boolean;        // budget exceeded
}

interface HealOptions {
  testCommand: string;   // e.g. "pnpm exec playwright test tests/x.spec.ts"
  testFile: string;      // the only code file the loop may edit
  cwd: string;
  observe: RouterOptions;// vision REASONING VLM (NOT ui-tars). judges intentional vs regression
  codegen: RouterOptions;// tier0 = cheap text LLM (gemini-flash) -> last = sonnet
  budgetUsd: number;     // shared cap across BOTH routers; sum exceeding it stops the loop
  maxAttempts: number;
  autoApply?: boolean;   // default false: final apply is a human approval gate
  expectedChange?: string; // declared expected UI change; observe checks the diff against it
}

type Verdict = "fixed" | "regression" | "intentional-change" | "give-up";

interface HealAttempt {
  tier: ModelTier;
  phase: "observe" | "codegen";
  costUsd: number;
  errorKind: "locator" | "timeout" | "vrt-diff" | "other";
  patch?: string;
}

interface HealResult {
  verdict: Verdict;
  attempts: HealAttempt[];
  totalCostUsd: number;
  finalPatch?: string; // diff applied to testFile and/or baseline
}
```

Public functions: `createModelRouter(opts): ModelRouter` and
`heal(opts): Promise<HealResult>`.

## Cost-escalation router (pure logic)

```
state: { tierIndex, failuresAtTier, spentUsd }   // spentUsd shared across routers
current()  -> tiers[tierIndex]
escalate() -> failuresAtTier++; if (failuresAtTier >= escalateAfter) { tierIndex++; failuresAtTier = 0 }
record(r)  -> spentUsd += r.costUsd
exhausted()-> spentUsd >= budgetUsd
```

Two routers are created inside `heal()` (observe + codegen) but share one
budget accumulator: any call from either phase adds to `spentUsd`, and the
loop stops when the sum exceeds `budgetUsd`.

### Default tiers

Observe axis (vision — judges intentional-change vs regression):

- tier0: a cheap **reasoning** VLM, e.g. `google/gemini-2.5-flash-lite`
  ($0.0000001/tok in) or `mistralai/mistral-small-3.2-24b-instruct`.
- **Do NOT put ui-tars here.** ui-tars is a GUI-grounding/action model (it
  emits clicks/coordinates), not a judgment model; in real 疎通 runs it
  returned "regression" for a clearly intentional change. ui-tars belongs in a
  future re-explore phase (drive the UI to find a path), not in observe.

Codegen axis (text, patch generation):

- tier0: cheap coder, e.g. `qwen/qwen3-coder-30b-a3b-instruct` ($0.00000007/tok)
- tier1: reliable fallback, e.g. `openai/gpt-4o-mini`
- (or `anthropic claude-sonnet` as a strong last resort)

All tiers are caller-overridable. OpenRouter per-token pricing can be fetched
with `fetchOpenRouterPricing()` and applied with `withPricing(tiers, pricing)`.

### Cost accounting (so the budget cap actually works)

The OpenRouter client in `@mizchi/vlmkit-ai` returns `costUsd: 0` (it does not
price responses). With OpenRouter-only tiers the budget cap would therefore
never trip. The loop fixes this with `billedCost(tier, costUsd, usage)`: trust
a provider `costUsd > 0`, otherwise estimate `promptTokens * promptCostPerToken
+ completionTokens * completionCostPerToken`. Fill the per-token fields via
`withPricing()`.

### Judging intentional vs regression needs an expectation

intentional-change vs regression **cannot be decided from pixels alone** — even
a human can't tell whether a change was meant without knowing the intent. Pass
`HealOptions.expectedChange` (from the spec / PR description); the observe tier
checks the failing screenshot against it. With no `expectedChange`, the observe
tier conservatively returns `regression` (never bakes a possible regression into
the baseline) — a safe default, not a bug.

## Heal loop state machine

```
loop while (attempt < maxAttempts && !budget.exhausted()):
  1. run testCommand
       pass -> verify (run twice in a row) -> green => Verdict = "fixed", stop
  2. fail -> classify error output (locator / timeout / vrt-diff / other)
  3. if vrt-diff -> OBSERVE phase (model = observe.current()):
       - captureActual(): read newest test-results/*-actual.png
       - observe(screenshot, textReport + expectedChange) -> verdict
       - "regression"          -> Verdict = "regression", stop (NOT patched)
       - "intentional-change"  -> run updateSnapshotsCommand; finalPatch =
                                  "baseline-update"; loop top (NO codegen call)
       - "unknown"             -> fall through to CODEGEN
  4. CODEGEN phase (model = codegen.current()):
       - context: error kind + current test source + error output
       - newTestSource -> backup + applyPatch(testFile); loop top
       - updateBaseline -> run updateSnapshotsCommand; loop top
       - no usable patch -> escalate codegen
  on continued failure after a codegen patch: escalate the codegen router

terminate:
  - budget exhausted or attempts exhausted -> Verdict = "give-up" (best attempt)
```

`verify = two consecutive green runs` reuses the reproducibility definition
from the spec-to-playwright pipeline (flaky-test removal).

The observe phase (cheap reasoning VLM) decides intentional-vs-regression
*before* any codegen call, and an intentional change updates the baseline
without invoking codegen at all — so the expensive text tiers run only when a
test actually needs rewriting. That is the core cost lever.

## Safety boundary

- Back up `testFile` and any baseline PNG before each patch apply; roll back
  on failure or interruption.
- App code is never edited. The loop is only permitted to write `testFile`
  and baseline images; anything else is physically refused.
- `autoApply: false` (default): the final green patch is shown as a diff and
  requires human approval before it is committed. `autoApply: true` for CI.
- Baseline updates are proposed only when the realized verdict is
  `intentional-change`, so a regression is never baked into the baseline.

## Test strategy (TDD)

- `ModelRouter` is pure logic: unit-test tier advancement (inject failures),
  budget-exceeded `exhausted()`, and the `escalateAfter` boundary.
- `heal()` loop: inject mock LLM and mock browser to test state transitions
  across every Verdict path (fixed / give-up / regression / intentional-change).
- One integration test: deliberately break a locator in a
  playwright-playground-style sample test, run `heal`, assert it recovers and
  `verify` goes green twice. Mock LLM for determinism; real-API runs are
  opt-in behind an env flag.

## Open implementation questions (resolved at build time)

- Exact ui-tars availability / id on OpenRouter — checked via `listModels()`;
  fall back to `ModelTier.baseURL` for a self-hosted endpoint.
- Whether the codegen patch is produced as a unified diff or a full-file
  rewrite — decided during the patch.ts task based on apply reliability.
