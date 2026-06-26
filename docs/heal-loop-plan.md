# Heal Loop Implementation Plan (`@mizchi/vlmkit-heal`)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build `@mizchi/vlmkit-heal` and confirm it interoperates end-to-end with a real Playwright run — a broken test is healed and `verify` goes green.

**Architecture:** New workspace package depending on `@mizchi/vlmkit-{core,ai,capture}`. Pure-logic cost-escalation router + an injectable heal loop. Determinism via injected mock LLM; real Playwright execution against a self-contained file:// fixture proves the "playwright loop 疎通".

**Tech Stack:** TypeScript (Node 24 native TS), `node:test` + `node:assert/strict`, tsdown, Playwright.

**Conventions (from existing packages):**
- exports: `{ ".": "./src/index.ts", "./*.ts": "./src/*.ts" }`
- test script: `node --test 'src/**/*.test.ts'`
- tests: `import { describe, it } from "node:test"; import assert from "node:assert/strict";`

---

## File Structure

- `packages/vlmkit-heal/package.json` — name, exports, deps, test script
- `packages/vlmkit-heal/tsconfig.json` — extends root
- `src/types.ts` — public contract (no logic)
- `src/router.ts` + `router.test.ts` — cost-escalation router (pure)
- `src/runner.ts` + `runner.test.ts` — run testCommand, classify pass/fail/errorKind
- `src/patch.ts` + `patch.test.ts` — backup / apply / rollback to testFile + baseline
- `src/clients.ts` — `ObserveClient` / `CodegenClient` interfaces (injectable; real impls wrap vlmkit-ai)
- `src/heal.ts` + `heal.test.ts` — loop state machine (all deps injected)
- `src/index.ts` — barrel: `createModelRouter`, `heal`, types
- `fixtures/` — self-contained 疎通 fixture (static html + broken playwright test + config)
- `smoke/heal-smoke.ts` — wires real Playwright + mock-or-real LLM against the fixture

---

## Task 1: Scaffold package

**Files:** Create `packages/vlmkit-heal/{package.json,tsconfig.json}`, `src/index.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@mizchi/vlmkit-heal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./*.ts": "./src/*.ts" },
  "scripts": { "test": "node --test 'src/**/*.test.ts'" },
  "dependencies": {
    "@mizchi/vlmkit-core": "workspace:*",
    "@mizchi/vlmkit-ai": "workspace:*",
    "@mizchi/vlmkit-capture": "workspace:*"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.json", "include": ["src"] }
```

(Verify root tsconfig path/shape first; match what vlmkit-core does.)

- [ ] **Step 3: src/index.ts placeholder** → `export {};`

- [ ] **Step 4: install & verify workspace wiring**

Run: `pnpm install`
Expected: `@mizchi/vlmkit-heal` linked, no errors.

- [ ] **Step 5: commit** → `feat(heal): scaffold vlmkit-heal package`

---

## Task 2: Contract types

**Files:** Create `src/types.ts`

- [ ] **Step 1: write types.ts** — exactly the contract from `docs/heal-loop-design.md`
  (`ModelTier`, `RouterOptions`, `ModelRouter`, `HealOptions`, `Verdict`,
  `HealAttempt`, `HealResult`). Import `LLMResponse` from `@mizchi/vlmkit-ai`.

- [ ] **Step 2: re-export from index** → `export * from "./types.ts";`

- [ ] **Step 3: typecheck** → `pnpm -w build` or `tsc --noEmit` on the package. Expected: clean.

- [ ] **Step 4: commit** → `feat(heal): public contract types`

---

## Task 3: Cost-escalation router (TDD)

**Files:** Create `src/router.test.ts`, then `src/router.ts`

- [ ] **Step 1: failing test (router.test.ts)**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModelRouter } from "./router.ts";
import type { ModelTier } from "./types.ts";

const tiers: ModelTier[] = [
  { provider: "gemini", model: "flash-lite", vision: false },
  { provider: "gemini", model: "flash", vision: false },
  { provider: "anthropic", model: "sonnet", vision: false },
];
const spent = { usd: 0 };

describe("ModelRouter", () => {
  it("starts at the cheapest tier", () => {
    const r = createModelRouter({ tiers }, { budgetUsd: 1, add: (n) => (spent.usd += n), total: () => spent.usd });
    assert.equal(r.current().model, "flash-lite");
  });
  it("escalates after escalateAfter failures", () => {
    const r = createModelRouter({ tiers, escalateAfter: 2 }, { budgetUsd: 1, add: () => {}, total: () => 0 });
    r.escalate(); assert.equal(r.current().model, "flash-lite");
    r.escalate(); assert.equal(r.current().model, "flash");
  });
  it("stays at the last tier", () => {
    const r = createModelRouter({ tiers }, { budgetUsd: 1, add: () => {}, total: () => 0 });
    r.escalate(); r.escalate(); r.escalate(); r.escalate();
    assert.equal(r.current().model, "sonnet");
  });
  it("exhausted when shared budget exceeded", () => {
    let t = 0;
    const r = createModelRouter({ tiers }, { budgetUsd: 0.5, add: (n) => (t += n), total: () => t });
    r.record({ costUsd: 0.6 } as any);
    assert.equal(r.exhausted(), true);
  });
});
```

- [ ] **Step 2: run, expect FAIL** → `cd packages/vlmkit-heal && node --test 'src/router.test.ts'` → module not found.

- [ ] **Step 3: implement router.ts**

```ts
import type { LLMResponse } from "@mizchi/vlmkit-ai";
import type { ModelRouter, ModelTier, RouterOptions } from "./types.ts";

// Shared budget accumulator so observe + codegen routers sum into one cap.
export interface Budget { budgetUsd: number; add(n: number): void; total(): number; }

export function createModelRouter(opts: RouterOptions, budget: Budget): ModelRouter {
  const escalateAfter = opts.escalateAfter ?? 1;
  let tierIndex = 0;
  let failuresAtTier = 0;
  return {
    current: () => opts.tiers[tierIndex],
    escalate() {
      failuresAtTier++;
      if (failuresAtTier >= escalateAfter) { failuresAtTier = 0; tierIndex = Math.min(tierIndex + 1, opts.tiers.length - 1); }
    },
    record(r: LLMResponse) { budget.add(r.costUsd); },
    spentUsd: () => budget.total(),
    exhausted: () => budget.total() >= budget.budgetUsd,
  };
}
```

- [ ] **Step 4: run, expect PASS**. Export `createModelRouter`, `Budget` from index.

- [ ] **Step 5: commit** → `feat(heal): cost-escalation router`

---

## Task 4: Test runner + error classifier (TDD)

**Files:** Create `src/runner.test.ts`, then `src/runner.ts`

`runTest(cmd, cwd)` runs the command, returns `{ ok, stdout, stderr }`.
`classify(output)` → `"locator" | "timeout" | "vrt-diff" | "other"`.

- [ ] **Step 1: failing test** — feed canned Playwright failure strings to `classify`:
  - `"locator resolved to 0 elements"` → `"locator"`
  - `"Timeout 5000ms exceeded"` → `"timeout"`
  - `"Screenshot comparison failed"` → `"vrt-diff"`
  - `"some other error"` → `"other"`
  Plus `runTest("node -e \"process.exit(1)\"", cwd)` → `ok:false`.

- [ ] **Step 2: run, expect FAIL.**

- [ ] **Step 3: implement runner.ts** using `node:child_process` `execFile`/`spawn` (promisified), capturing stdout+stderr; `classify` via regex table.

- [ ] **Step 4: run, expect PASS. commit** → `feat(heal): test runner + error classifier`

---

## Task 5: Patch apply with backup/rollback (TDD)

**Files:** Create `src/patch.test.ts`, then `src/patch.ts`

`applyPatch({ file, content })` backs up the original, writes new content, returns a `rollback()` thunk.

- [ ] **Step 1: failing test** — in a tmp dir: write a file, `applyPatch` new content, assert file changed; call `rollback()`, assert original restored.

- [ ] **Step 2: run, expect FAIL.**

- [ ] **Step 3: implement patch.ts** using `node:fs`. Backup to `<file>.heal-bak`; rollback restores and removes backup. Refuse to write any path outside the allowed set (testFile + baseline dir) — pass an `allow: string[]` and assert membership.

- [ ] **Step 4: run, expect PASS. commit** → `feat(heal): patch apply with backup/rollback + path allowlist`

---

## Task 6: Injectable clients

**Files:** Create `src/clients.ts`

Define minimal injectable interfaces so `heal` is testable without network:

```ts
import type { ModelTier } from "./types.ts";
export interface ObserveClient {
  // returns realized verdict material for a vrt-diff failure
  observe(input: { tier: ModelTier; screenshotPng?: Buffer; textReport: string }):
    Promise<{ verdict: "intentional-change" | "regression" | "unknown"; costUsd: number }>;
}
export interface CodegenClient {
  // returns a full-file replacement for testFile (or baseline note)
  propose(input: { tier: ModelTier; errorKind: string; testSource: string; context: string }):
    Promise<{ newTestSource?: string; updateBaseline?: boolean; costUsd: number }>;
}
```

- [ ] **Step 1: write clients.ts** (interfaces only).
- [ ] **Step 2: write `createRealCodegenClient` / `createRealObserveClient`** thin wrappers over `createUnifiedLLMClient` (codegen) and the VLM client (observe), mapping `LLMResponse.costUsd` through. Keep prompt minimal.
- [ ] **Step 3: typecheck. commit** → `feat(heal): observe/codegen client interfaces + real impls`

---

## Task 7: Heal loop state machine (TDD with mocks)

**Files:** Create `src/heal.test.ts`, then `src/heal.ts`

`heal()` takes `HealOptions` plus injected `{ runTest, observe, codegen }` (default to real impls; tests inject mocks).

- [ ] **Step 1: failing test** — mock runner returns fail on attempt 1, pass on attempt 2 (after patch); mock codegen returns a fixed `newTestSource`. Assert:
  - `verdict === "fixed"`, `attempts.length >= 1`, `finalPatch` present.
  - A second test: runner always fails + tiny budget → `verdict === "give-up"`.
  - A third: errorKind `vrt-diff` + observe returns `intentional-change` → codegen called with baseline-update path → `verdict` `"fixed"` with `updateBaseline`.

- [ ] **Step 2: run, expect FAIL.**

- [ ] **Step 3: implement heal.ts** per the design state machine:
  run → pass→verify(run twice)→fixed; fail→classify→(vrt-diff?observe)→codegen.propose→applyPatch→loop; escalate on continued failure; stop on budget.exhausted/maxAttempts.

- [ ] **Step 4: run, expect PASS. commit** → `feat(heal): heal loop state machine`

---

## Task 8: Playwright 疎通 (self-contained fixture)

**Files:** Create `packages/vlmkit-heal/fixtures/{page.html,broken.spec.ts,playwright.config.ts}`, `smoke/heal-smoke.ts`

Proves the loop drives a REAL Playwright run and heals a real file. LLM is
mocked (returns the known-correct locator) so the proof is deterministic and
needs no API key; a real-API path is opt-in via env.

- [ ] **Step 1: fixtures/page.html** — a trivial static page with a button
  `<button id="go" aria-label="Start">Start</button>` and a result node.

- [ ] **Step 2: fixtures/playwright.config.ts** — `testDir: "."`, no webServer;
  tests navigate to the file:// URL of page.html (deterministic, no server).

- [ ] **Step 3: fixtures/broken.spec.ts** — a test that uses a WRONG locator
  (`getByRole("button", { name: "Begin" })` while the real label is "Start"),
  so it fails with a locator error.

- [ ] **Step 4: smoke/heal-smoke.ts** — call `heal()` with:
  - `testCommand: "pnpm exec playwright test broken.spec.ts"`, `cwd: fixtures/`
  - mock codegen client returning `newTestSource` with the corrected label "Start"
    (unless `HEAL_REAL_LLM=1`, then use the real client + real tiers incl. ui-tars)
  - assert result `verdict === "fixed"`.

- [ ] **Step 5: run the 疎通 smoke**

Run: `node packages/vlmkit-heal/smoke/heal-smoke.ts`
Expected: broken.spec.ts fails first, heal applies corrected locator, re-run +
verify(twice) green, prints `verdict: fixed`. ← **this is the 疎通 confirmation.**

- [ ] **Step 6: commit** → `test(heal): playwright 疎通 smoke (broken locator healed)`

---

## Self-Review

- Design coverage: package(T1), contract(T2), router+budget(T3), runner/classify(T4),
  patch/allowlist(T5), clients(T6), loop+verdicts(T7), playwright 疎通(T8). Covered.
- The contract's `budgetUsd` "shared across both routers" is realized via the
  `Budget` accumulator (T3) injected into both routers (T7).
- Real ui-tars/OpenRouter resolution is exercised only on the opt-in
  `HEAL_REAL_LLM=1` path (T8); the committed smoke is mock-LLM + real Playwright,
  so 疎通 is provable without API keys.
- Placeholder check: tsconfig shape (T1) and baseline-update prompt details
  (T6) are the only "verify against existing code" points, flagged inline.
