# Heal Loop Design (`@mizchi/vlmkit-heal`)

Date: 2026-06-26
Status: Approved (design phase)

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
  baseURL?: string; // for self-hosted / non-OpenRouter endpoints (e.g. ui-tars)
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
  observe: RouterOptions;// tier0 = ui-tars (vision). screenshot analysis / realized verdict
  codegen: RouterOptions;// tier0 = cheap text LLM (gemini-flash) -> last = sonnet
  budgetUsd: number;     // shared cap across BOTH routers; sum exceeding it stops the loop
  maxAttempts: number;
  autoApply?: boolean;   // default false: final apply is a human approval gate
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

Observe axis (vision, GUI grounding):

- tier0: `ui-tars` (cheapest; screenshot -> structured failure state, material
  for the realized verdict). Resolved via `listModels()` if present on
  OpenRouter as `bytedance/ui-tars*`; otherwise via `ModelTier.baseURL`.

Codegen axis (text, patch generation — ui-tars is NOT used here, it is a GUI
action model, not a code generator):

- tier0: `gemini-2.0-flash-lite` (cheap)
- tier1: `gemini-2.5-flash`
- tier2: `anthropic claude-sonnet` (high accuracy, last resort)

All tiers are caller-overridable. OpenRouter tiers can be built dynamically
from `listModels({ maxCost })` (cost-ascending).

## Heal loop state machine

```
loop while (attempt < maxAttempts && !budget.exhausted()):
  1. run testCommand
       pass -> verify (run twice in a row) -> green => Verdict = "fixed", stop
  2. fail -> OBSERVE phase:
       - parse error output (classify: locator-not-found / timeout / vrt-diff)
       - if vrt-diff: capturer screenshot -> vlmkit reasoning realized verdict
         (intentional change vs regression). model = observe.current()
  3. CODEGEN phase: model = codegen.current()
       - context: error kind + current test code + (if any) screenshot / heatmap / a11y diff
       - verdict "intentional-change" -> baseline-update patch
       - otherwise -> test locator/wait/assert patch
       - budget.record(response)
  4. backup target file(s), then apply patch to testFile / baseline
  5. -> loop top (re-run)
  on continued failure: escalate the router for the phase that produced the bad patch

terminate:
  - budget.exhausted() or attempts exhausted -> Verdict = "give-up" (report best attempt)
  - confirmed regression (realized = regression, not a test-following issue)
    -> Verdict = "regression" (reported as an app-side problem, not patched)
```

`verify = two consecutive green runs` reuses the reproducibility definition
from the spec-to-playwright pipeline (flaky-test removal).

The observe phase lets a cheap vision model (ui-tars) supply the
intentional-vs-regression signal, so the loop calls the expensive codegen
tiers fewer times — this is the core cost lever.

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
