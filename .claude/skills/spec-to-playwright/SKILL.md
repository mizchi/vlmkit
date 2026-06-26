---
name: spec-to-playwright
description: Turn a natural-language spec into Playwright tests with deterministic, reproducible VRT and a self-healing loop. Uses the official init-agents planner/generator to explore the app and generate tests, a determinism layer to keep screenshots byte-stable, and @mizchi/vlmkit-heal to auto-fix failures. Use when authoring Playwright tests from a spec, making visual regression tests deterministic, getting generated tests to reproduce in CI, or healing tests that drift from the UI.
---

# spec-to-playwright

A pipeline: **natural-language spec → explore the app → generate a Playwright
test → deterministic VRT baseline → verify reproducibility → heal on failure.**
It builds on the official Playwright test-agents (`init-agents`) and adds the two
things they lack: a determinism layer that makes VRT stable, and a cost-optimized
heal loop (`@mizchi/vlmkit-heal`).

Reference implementation: `mizchi/playwright-playground` — every asset here is
extracted from that repo, where the pipeline runs two-consecutive-green in a
linux container.

## When to use

- You have a spec / user story and want a real Playwright test for it.
- Your `toHaveScreenshot()` VRT is flaky and you want byte-stable baselines.
- You want generated tests to reproduce in CI, not just locally.
- A test broke because the UI changed and you want it healed (or the baseline
  updated when the change was intentional).

Not for: one-off edits to a single existing test (just edit it).

**Assumes a Vite app** served by `vite build` + `vite preview` (the determinism
preset uses `pnpm app:build && pnpm app:preview`). For other build tools, adapt
the `webServer` command + the two npm scripts; the rest of the pipeline is the same.

**No official agents available?** The `plan`/`generate` steps below invoke the
`init-agents` planner/generator (they need the `playwright-test` MCP server in a
main Claude Code session). If you can't dispatch them — e.g. you are a subagent,
or `init-agents` isn't set up — do their job by hand with the SAME steps, in order:
  1. explore the app to confirm real roles/labels/testids
  2. write `specs/<topic>.md` (reference `**Seed:** tests/seed.spec.ts`)
  3. adjust `tests/seed.spec.ts` to your app's actual initial state
  4. hand-write `tests/<topic>.spec.ts` strictly following `specs/_generation-rules.md`
The determinism layer and rules are what matter; the agents are just an automated author.

## Setup (once per repo)

Always needed: `_helpers.ts`, `seed.spec.ts`, `_generation-rules.md`, the
deterministic `playwright.config` merge. Conditional: `init-agents` (only if you
drive the official agents — skip when hand-writing), `@mizchi/vlmkit-heal` (only
for the heal step), `baseline-linux.sh` + `ci.yml` (only when CI parity is needed).

1. Generate the official agents + MCP server:
   ```sh
   npx playwright init-agents --loop=claude
   ```
   This writes `.claude/agents/playwright-test-{planner,generator,healer}.md` and
   `.mcp.json` (the `playwright-test` MCP server). **If the MCP tools aren't
   available in your session, reload Claude Code** so it connects.

2. Copy the determinism assets into the repo:
   - `assets/_helpers.ts` → `tests/_helpers.ts`
   - `assets/seed.spec.ts` → `tests/seed.spec.ts` (adjust the initial-state assertion)
   - `assets/_generation-rules.md` → `specs/_generation-rules.md`
   - merge `assets/playwright.config.preset.ts` into your `playwright.config.ts`
   - `assets/baseline-linux.sh` → a repo script, wired as `"baseline:linux"` in package.json
   - `assets/ci.yml` → `.github/workflows/ci.yml`

3. Add the heal engine:
   ```sh
   pnpm add -D @mizchi/vlmkit-heal
   ```

4. Make the generator obey the rules: append to
   `.claude/agents/playwright-test-generator.md`:
   > Before writing any test, READ `specs/_generation-rules.md` and obey it.

Add these npm scripts (the determinism preset and rules assume them):
```json
"app:build":   "vite build",
"app:preview": "vite preview --port 4173 --strictPort",
"verify":      "playwright test && playwright test",
"baseline:linux": "sh baseline-linux.sh"
```

## Run (staged)

```
plan      → invoke the playwright-test-planner agent with the spec.
            It explores the live app (verifying real roles/labels) and writes
            specs/<topic>.md. Reference **Seed:** tests/seed.spec.ts in the plan.

generate  → invoke the playwright-test-generator agent with specs/<topic>.md.
            It replays the steps and writes tests/<topic>.spec.ts following
            specs/_generation-rules.md: gotoApp() + a screenshot at the start and
            at the goal + role/testid/label assertions.

baseline  → generate baselines BEFORE the first verify (a test with toHaveScreenshot
            fails until its baseline exists). Two paths:
              • CI parity needed → pnpm run baseline:linux  (linux container, matches CI arch)
              • local only / CI parity out of scope → pnpm exec playwright test --update-snapshots
            Either is an acceptable terminal state; pick by whether CI must match.

verify    → pnpm run verify           (two consecutive green = reproducible)

heal      → on failure, run the heal loop (below)
```

A test is "done" only when `verify` is green twice in a row AND its VRT diff is
within threshold.

## Determinism essentials

What keeps screenshots byte-stable (all in the assets):
- fixed `viewport` / `deviceScaleFactor` / `colorScheme` / `locale` / `timezoneId`
- `gotoApp()` disables animations/transitions, hides the caret, waits for fonts
- `webServer` runs `vite build && vite preview` — never the dev server (HMR
  injects scripts that perturb the DOM)
- **cross-arch caveat**: a baseline is tied to the arch that rendered it. The
  asset `baseline-linux.sh` renders on the host arch (arm64 on Apple Silicon), so
  `ci.yml` uses `ubuntu-24.04-arm`. To run CI on amd64, regenerate baselines on amd64.

## Heal (failure → fix)

```ts
import { heal } from "@mizchi/vlmkit-heal";

const r = await heal({
  testCommand: "pnpm exec playwright test tests/<topic>.spec.ts",
  testFile: "tests/<topic>.spec.ts",
  cwd: process.cwd(),
  // observe = a cheap REASONING VLM that judges intentional-change vs regression
  observe: { tiers: [{ provider: "openrouter", model: "google/gemini-2.5-flash-lite", vision: true }] },
  // codegen = cheap coder first, escalate to a stronger model on repeated failure
  codegen: { tiers: [
    { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false },
    { provider: "openrouter", model: "openai/gpt-4o-mini", vision: false },
  ]},
  budgetUsd: 1,            // shared cap; estimated from tokens × price for OpenRouter
  maxAttempts: 4,
  // expectedChange: "the badge turns red"  // declare for a VRT change; omit and a
  //                                          regression is reported, NOT baked into the baseline
});
// r.verdict: "fixed" | "regression" | "intentional-change" | "flaky" | "give-up"
```

Needs `OPENROUTER_API_KEY`. Heal only edits the test file + baselines (never app
code), and only commits a patch that verified green twice.

**Do NOT use ui-tars for the observe judgment** — it is a GUI-grounding model and
mislabels intentional changes as regressions. Use a cheap reasoning VLM.

## Pitfalls (lived in the reference repo)

- **Port 4173 in use** → `lsof -ti tcp:4173 | xargs kill -9` before running.
- **`baseline:linux` fails with `@rollup/rollup-linux-* not found`** → the host's
  `node_modules` (e.g. darwin binaries) leaked into the linux container. The asset
  script already fixes this with an anonymous `-v /work/node_modules` volume.
- **Emulated amd64 chromium gets SIGKILLed** → never `--platform=linux/amd64` on
  Apple Silicon. Render baselines natively; match the CI runner arch instead.
- **MCP tools missing / planner can't drive the browser** → `.mcp.json` was just
  created; reload Claude Code so the `playwright-test` server connects.
