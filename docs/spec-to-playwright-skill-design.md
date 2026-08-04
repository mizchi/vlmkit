# spec-to-playwright Skill Design

Date: 2026-06-26
Status: Approved (design phase)

## Goal

Package the spec → Playwright-test pipeline (proven end-to-end this cycle in the
`playwright-playground` repo) as a reusable Claude Code skill, distributed from
the vlmkit repo via APM, so any Playwright project can install it and go from a
natural-language spec to a deterministic, reproducible, self-healing test suite.

## Why here (placement)

vlmkit already ships coding-agent skills under `.claude/skills/` (the `vrt-*`
family) and distributes them via APM (`apm install mizchi/vlmkit/.claude/skills/<name>`).
The pipeline's heal step uses `@mizchi/vlmkit-heal`, which lives in this repo, so
hosting the skill here keeps the heal integration first-class and the skill a
sibling of the existing `vrt-*` skills.

Distinct from `mizchi/skills/testing/playwright-test`, which is a Playwright
best-practices *reference* (config templates, CI sharding). This skill is a
*workflow*: spec → agent exploration → test generation → deterministic VRT →
heal. No real overlap.

## Distribution

```
apm install mizchi/vlmkit/.claude/skills/spec-to-playwright
```

Name: `spec-to-playwright` (describes the workflow; VRT is one part, so no
`vrt-` prefix).

## File layout

```
.claude/skills/spec-to-playwright/
├── SKILL.md                          # workflow body (frontmatter: name, description)
├── README.md                         # overview, matching the existing skills' style
└── assets/
    ├── _helpers.ts                   # gotoApp() determinism layer
    ├── seed.spec.template.ts         # environment bootstrap seed template
    ├── _generation-rules.md          # generator's mandatory rules
    ├── playwright.config.preset.ts   # deterministic config (fixed viewport/locale/tz, build→preview)
    ├── baseline-linux.sh             # linux baseline via the official Playwright container
    └── ci.yml                        # arm64-runner CI template (matches baseline arch)
```

**Assets are extracted from the `playwright-playground` reference implementation**
— the exact files that ran two-consecutive-green in a linux container this
cycle, not hand-written templates. `playwright-playground` is the skill's
reference/example project.

## SKILL.md sections

`description` (pushy auto-trigger for Playwright projects): from a natural-language
spec, generate Playwright tests and stabilize VRT for reproducibility; use when
authoring tests from a spec, making VRT deterministic, or getting generated
tests to reproduce in CI.

1. **When to use / not** — spec → tests, deterministic VRT, heal-follows-UI. Not
   for one-off test tweaks.
2. **Setup (once)**
   - `npx playwright init-agents --loop=codex` (planner/generator/healer + MCP config; use the matching loop for other runtimes)
   - copy assets: `_helpers.ts` / `seed.spec.template.ts` / `_generation-rules.md` →
     `tests/`+`specs/`; merge the deterministic `playwright.config` settings;
     wire `baseline-linux.sh` as an npm script; drop in `ci.yml`
   - `pnpm add -D @mizchi/vlmkit-heal`
   - append "READ `specs/_generation-rules.md` and obey it" to the generator
     agent definition
3. **Run (staged)**: `plan` (official planner or `vlmkit-plan` CLI →
   `specs/<topic>.md` plus optional `specs/<topic>.locators.json`, verifies real roles/labels) → `generate` (official
   generator or `vlmkit-generate` CLI → `tests/<topic>.spec.ts`, rule-compliant:
   gotoApp + 2 VRT screenshots + semantic assertions; diagnostics retry + AST
   validator gate + optional locator inventory check + rollback-safe
   `--gate-command`) → `baseline` (linux, matches CI arch) → `verify` (two
   consecutive green) → `heal` (on failure, vlmkit-heal).
4. **Determinism essentials** — fixed viewport/locale/tz, `prefers-reduced-motion`,
   font wait, `vite build && preview` (avoid HMR), cross-arch baseline caveat
   (arm64 baseline ↔ arm64 runner).
5. **Pitfalls (lived this cycle)** — port 4173 conflicts; the `baseline:linux`
   node_modules-leak bug (host darwin binaries → `@rollup/rollup-linux-*` missing,
   fixed with an anonymous `node_modules` volume + `--ipc=host`); emulated amd64
   chromium SIGKILL (use native arch); MCP not connected → reload Claude Code.

## vlmkit-heal integration (heal step)

```ts
import { heal } from "@mizchi/vlmkit-heal";
const r = await heal({
  testCommand: "pnpm exec playwright test tests/<topic>.spec.ts",
  updateSnapshotsCommand: "pnpm exec playwright test tests/<topic>.spec.ts --update-snapshots",
  testFile: "tests/<topic>.spec.ts",
  cwd: process.cwd(),
  observe: { tiers: [{ provider: "openrouter", model: "google/gemini-2.5-flash-lite", vision: true }] },
  codegen: { tiers: [
    { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false },
    { provider: "openrouter", model: "openai/gpt-4o-mini", vision: false },
  ]},
  budgetUsd: 1,
  maxAttempts: 4,
  // expectedChange: "..."  // declare for VRT intent; omit and a regression stays out of the baseline
});
```

Document the lesson: **ui-tars is NOT used for the observe judgment** (it is a
GUI-grounding model; it mislabeled an intentional change as a regression). Use a
cheap reasoning VLM for observe; keep ui-tars for a possible re-explore phase.

## Validation — empirical-prompt-tuning, blank-repo scoring

After implementation, measure skill quality with the empirical-prompt-tuning
meta-skill (operator-triggered):

1. **Bias-free executor**: a fresh subagent that does NOT know the skill is given
   a blank repo (empty dir, or a minimal Vite app only) plus the skill, and told
   to "follow it to take a spec → Playwright test → two consecutive green in a
   linux container".
2. **Two-sided scoring**: executor self-report (where it stalled / ambiguous
   instructions) + instruction-side metrics (which SKILL.md step caused a gap,
   ordering mistake, or missing precondition).
3. **Iterate**: fold stalls back into SKILL.md / assets; re-score until the
   executor completes with zero outside help.

Pass criterion: **the skill alone — no human/assistant intervention — gets a
blank repo from spec to two-consecutive-green linux runs.**

## Out of scope (YAGNI)

- A scaffolding CLI (`npx` installer). Asset copy is documented in SKILL.md; a
  CLI can come later if the manual copy proves painful.
- Multi-framework support beyond Vite. The deterministic layer assumes a
  `build → preview` static serve; other setups are a follow-up.
