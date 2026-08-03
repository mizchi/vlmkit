---
name: spec-to-playwright
description: Turn a natural-language spec into Playwright tests with deterministic, reproducible VRT and a self-healing loop. Uses the official init-agents planner/generator to explore the app and generate tests, a determinism layer to keep screenshots byte-stable, and @mizchi/vlmkit-heal to auto-fix failures. Use when authoring Playwright tests from a spec, making visual regression tests deterministic, getting generated tests to reproduce in CI, or healing tests that drift from the UI.
metadata:
  internal: true
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

**No official agents available?** Prefer the runtime-neutral package path before
hand-writing. `vlmkit-plan` and `vlmkit-generate` produce the same planner- and
generator-shaped artifacts with diagnostics-driven retries:
```sh
vlmkit-plan --title "<topic>" --request-file specs/<topic>.request.md \
  --observations specs/<topic>.observations.json --out specs/<topic>.md \
  --locator-inventory-out specs/<topic>.locators.json \
  --provider anthropic --max-attempts 2
vlmkit-generate --plan specs/<topic>.md --rules specs/_generation-rules.md \
  --locator-inventory specs/<topic>.locators.json \
  --helper-import ../support/goto-app --out tests/<topic>.spec.ts \
  --provider anthropic --max-attempts 2 --overwrite \
  --gate-command "pnpm exec playwright test --list {testFile}"
```
If you can't use either the official agents or these CLIs, do their job by hand
with the SAME steps, in order:
  1. explore the app to confirm real roles/labels/testids
  2. write `specs/<topic>.md` (reference `**Seed:** tests/seed.spec.ts`)
  3. adjust `tests/seed.spec.ts` to your app's actual initial state
  4. hand-write `tests/<topic>.spec.ts` strictly following `specs/_generation-rules.md`
The determinism layer and rules are what matter; the agents/CLIs are just automated authors.

## Setup (once per repo)

Always needed: `_helpers.ts`, `seed.spec.ts`, `_generation-rules.md`, the
deterministic `playwright.config` merge. Conditional: `init-agents` (only if you
drive the official agents — skip when hand-writing), `@mizchi/vlmkit-heal` (only
for the heal step), `ci.yml` + `update-baselines.yml` (only when you keep VRT
baselines, i.e. use `toHaveScreenshot`).

**No Docker.** Pixel baselines can't match across OSes, so instead of rendering
them locally in a container, **CI is the source of truth**: baselines are always
rendered in the `ci.yml` environment, and `update-baselines.yml` regenerates them
there on demand. Developers never run Docker.

1. Generate the official agents + MCP server. Use the loop for the agent runtime
   in this repo:
   ```sh
   npx playwright init-agents --loop=codex
   ```
   Use `--loop=claude` for Claude Code, `--loop=vscode` for VS Code, and
   `--loop=opencode` for OpenCode. Regenerate these definitions whenever
   Playwright is updated so the MCP tools and instructions stay current.
   For Codex this creates the Codex agent definitions and MCP config for the
   `playwright-test` server. **If the MCP tools aren't available in your
   session, reload the agent runtime** so it connects.

2. Copy the determinism assets into the repo:
   - `assets/_helpers.ts` → `tests/_helpers.ts`
   - `assets/seed.spec.ts` → `tests/seed.spec.ts` (adjust the initial-state assertion)
   - `assets/_generation-rules.md` → `specs/_generation-rules.md`
   - merge `assets/playwright.config.preset.ts` into your `playwright.config.ts`
   - `assets/ci.yml` → `.github/workflows/ci.yml` (verifies against committed baselines)
   - `assets/update-baselines.yml` → `.github/workflows/update-baselines.yml` (CI renders + commits baselines)

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
"verify":      "playwright test && playwright test"
```

## Agent roles

The official Playwright Test Agents are still the authors of the test. Use
`@mizchi/vlmkit-heal` only after generation, where its budget, VRT review, and
rollback guardrails matter.

| Stage | Owner | Input | Output |
|---|---|---|---|
| Plan | Playwright `planner` or `vlmkit-plan` | user story/spec request, `tests/seed.spec.ts`, optional PRD | `specs/<topic>.md` with real flows and expected results |
| Generate | Playwright `generator` or `vlmkit-generate` | `specs/<topic>.md`, `specs/_generation-rules.md`, seed test | `tests/<topic>.spec.ts` |
| First repair | Playwright `healer` | failing generated test name | interactive patch or skipped test if functionality is broken |
| Bounded heal | `@mizchi/vlmkit-heal` | generated spec path, test command, optional `expectedChange` | verified test rewrite or accepted VRT baseline update |

## Run (staged)

```
plan      → invoke the playwright-test-planner agent with:
              - a clear user story / scenario request
              - tests/seed.spec.ts so fixtures, auth, and initial state are known
              - optional PRD / product notes for domain context
            It explores the live app (verifying real roles/labels) and writes
            specs/<topic>.md. The plan must reference **Seed:** tests/seed.spec.ts.

generate  → invoke the playwright-test-generator agent with specs/<topic>.md.
            It replays the steps and writes tests/<topic>.spec.ts following
            specs/_generation-rules.md: gotoApp() + a screenshot at the start and
            at the goal + role/testid/label assertions.

baseline  → a test with toHaveScreenshot fails until its baseline exists. CI is the
            source of truth: push the branch and run the `update-baselines` workflow
            (it renders baselines in the CI env and commits them back). Locally you
            MAY run `pnpm exec playwright test --update-snapshots` to preview, but do
            NOT commit local (e.g. -darwin) snapshots — they won't match CI.

verify    → pnpm run verify           (two consecutive green = reproducible). Locally
            this is green only against local baselines; the authoritative verify is CI.

heal      → after generator/healer output exists, run `vlmkit-heal` for bounded
            repair:
              npx tsx examples/test-agents/heal-after-generator.ts tests/<topic>.spec.ts
```

A test is "done" only when CI's `verify` is green twice in a row AND its VRT diff is
within threshold (the `ci.yml` workflow runs the suite twice).

## Determinism essentials

What keeps screenshots byte-stable (all in the assets):
- fixed `viewport` / `deviceScaleFactor` / `colorScheme` / `locale` / `timezoneId`
- `gotoApp()` disables animations/transitions, hides the caret, waits for fonts
- `webServer` runs `vite build && vite preview` — never the dev server (HMR
  injects scripts that perturb the DOM)
- **baselines live in one environment only**: a pixel baseline is tied to the OS/arch
  that rendered it, so committed baselines are always the ones CI rendered (via
  `update-baselines.yml`). Never commit locally-rendered snapshots.

## Heal (failure → fix)

```ts
import { heal } from "@mizchi/vlmkit-heal";

const r = await heal({
  testCommand: "pnpm exec playwright test tests/<topic>.spec.ts",
  updateSnapshotsCommand: "pnpm exec playwright test tests/<topic>.spec.ts --update-snapshots",
  testFile: "tests/<topic>.spec.ts",
  cwd: process.cwd(),
  // observe = a cheap REASONING VLM that judges intentional-change vs regression
  observe: { tiers: [{ provider: "openrouter", model: "openai/gpt-5-mini", vision: true }] },
  // codegen = cheap coder first, escalate to a stronger model on repeated failure
  codegen: { tiers: [
    { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false },
    { provider: "openrouter", model: "openai/gpt-5-codex", vision: false },
  ]},
  budgetUsd: 1,            // shared cap; estimated from tokens × price for OpenRouter
  maxAttempts: 4,
  // expectedChange: "the badge turns red"  // declare for a VRT change; omit and a
  //                                          regression is reported, NOT baked into the baseline
});
// r.verdict: "fixed" | "regression" | "needs-review" | "flaky" | "give-up"
```

Needs `OPENROUTER_API_KEY`. Heal only edits the test file + baselines (never app
code), and only commits a patch that verified green twice.

**Do NOT use ui-tars for the observe judgment** — it is a GUI-grounding model and
mislabels intentional changes as regressions. Use a cheap reasoning VLM.

**Any provider/model drives a tier** — `provider` is `"openrouter" | "anthropic" |
"gemini"`. Via OpenRouter you can name any model: `openai/gpt-5-codex`,
`openai/gpt-5-mini`, `anthropic/claude-sonnet-4.6` (Claude as the driver),
`qwen/qwen3-coder-30b-a3b-instruct`, etc. — all on one `OPENROUTER_API_KEY`.
`provider: "anthropic"` / `"gemini"` hit those APIs directly (need their own key).
`baseURL` on a tier points at any OpenAI-compatible endpoint (e.g. self-hosted).

## VRT review in CI (accept / reject / needs-review)

When a `toHaveScreenshot()` VRT fails in CI, a model can decide whether the change
is **intended** (accept → refresh the baseline) or a **regression** (reject). Two
assets wire this up:

- `assets/vrt-review.mjs` → repo root. Reads the failing VRT artifacts
  (`findVrtArtifacts`), infers intent from the commit + diff (`collectGitContext`)
  or `EXPECTED_CHANGE`, and calls `reviewVrtDiff`. accept (≥0.8) → runs
  `--update-snapshots` and exits 0; reject / unsure → exits 1.
- `assets/vrt-review-ci.yml` → `.github/workflows/vrt-review.yml`. Runs the VRT
  with `continue-on-error`, runs the review on failure, then commits the refreshed
  baselines back to the PR branch on accept (`permissions: contents: write`).
  Needs an `OPENROUTER_API_KEY` secret and `tsx` as a devDep.

The workflow's structure is load-bearing — each line below was added after it
failed on real CI, so keep them when adapting:
- **Runner arch must match the baseline arch.** A pixel baseline is tied to the
  OS/arch that rendered it; on a mismatched runner every screenshot diffs on font
  rendering alone. `ubuntu-latest` for amd64 baselines, `ubuntu-24.04-arm` for arm64.
- **Run the review via `npx tsx`, not `node`.** `@mizchi/vlmkit-heal` ships `.ts`
  sources, and Node won't type-strip files under `node_modules`
  (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). Add `tsx` to devDependencies.
- **`checkout` with `ref: github.head_ref` + `fetch-depth: 0`.** `pull_request`
  checks out a detached merge commit, so the baseline commit can't be pushed back
  without the head ref; and a shallow checkout leaves `origin/<base>` absent, which
  starves `collectGitContext` and forces needs-review on an intended change.
- **`safe.directory` before any git op.** The container runs as root while the
  checkout is owned by another uid; git refuses otherwise and commit-back fails.
- **Drop the pnpm `version:` pin** when `package.json` has `packageManager`, or
  `pnpm/action-setup@v4` errors with "Multiple versions specified".
- Push with `git push origin "HEAD:${{ github.head_ref }}"` (detached HEAD has no
  upstream).

```js
import { findVrtArtifacts, reviewVrtDiff, collectGitContext } from "@mizchi/vlmkit-heal";
const { baseline, actual, diff } = findVrtArtifacts(process.cwd());
const review = await reviewVrtDiff({
  baselinePng: baseline, actualPng: actual, diffPng: diff,
  gitContext: collectGitContext(process.cwd(), { base: "origin/main" }),
  tier: { provider: "openrouter", model: "openai/gpt-5-mini", vision: true },
});
// review.verdict: "accept" | "reject" | "unsure"
```

**Use a CAPABLE reasoning VLM for the review tier** (e.g. `gpt-5-mini`, not a tiny
VLM). Cheap VLMs accept a diff with high confidence while missing *collateral*
breakage elsewhere on the page. Inside the heal loop the same risk is guarded by
`confirmAccept` (default `true`): an accept is re-checked by the **strongest**
`observe` tier before the baseline is touched; if it disagrees the verdict becomes
`needs-review` instead of silently updating. Set `confirmAccept: false` to skip the
second opinion (single-tier ladders skip it automatically).

## Pitfalls (lived in the reference repo)

- **Port 4173 in use** → `lsof -ti tcp:4173 | xargs kill -9` before running.
- **VRT fails locally but the test is fine** → you're diffing against CI-rendered
  baselines on a different OS. That's expected; the authoritative check is CI. Don't
  "fix" it by committing local snapshots — run the `update-baselines` workflow if the
  change was intentional.
- **MCP tools missing / planner can't drive the browser** → `.mcp.json` was just
  created; reload Claude Code so the `playwright-test` server connects.
- **`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` when running a heal/review
  script** → `@mizchi/vlmkit-heal` ships `.ts` sources and Node won't type-strip
  under `node_modules`. Run your script with `npx tsx script.mjs` (add `tsx` as a
  devDep), not bare `node`.
