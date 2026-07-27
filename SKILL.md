---
name: vrt
description: 'Reference for the `vrt` CLI — Visual Regression Testing combined with accessibility (a11y) semantic verification. Use when running `vrt-test` / `vrt` (Playwright VRT) / `vrt-update` / `vrt compare` / `vrt snapshot`, configuring the fix-loop CSS challenge benchmark, or picking a VLM model for diff analysis.'
---

# VRT + Semantic Verification — Agent Skill Guide

## Overview

A quality assurance tool for coding agents that combines Visual Regression Testing (VRT)
with accessibility semantics verification.

Automatically verifies that changes are visually and semantically (a11y) as intended,
running a loop to detect and repair regressions.

## CLI Commands

All commands run from the **project root**. See `docs/api-design.md` for API design details.

### Basic

```bash
pnpm test                      # Unit tests (all workspace packages)
vlmkit snapshot <url>...       # URL → baseline + diff
vlmkit diff html a.html b.html # Compare two HTML files / URLs
vlmkit diff agent <report>     # Agent-friendly Markdown diff report
```

### Markup assistance (automatic markup)

All deterministic — no VLM / API key required.

```bash
vlmkit build component <target.png> <current.html>  # Converge HTML toward a target screenshot
vlmkit scan component <screenshot.png>              # Detect + crop components
vlmkit contract introspect <html|url>               # Existing markup → UI Contract IR
vlmkit contract scaffold <ui.contract.json>         # UI Contract IR → HTML/CSS scaffold
vlmkit contract validate <ui.contract.json>         # Validate the IR
vlmkit check palette <target.png> [current.png]     # Dominant colors / palette diff
vlmkit check tokens|theme|motion <html>             # Design-system audits
vlmkit check a11y contrast|touch|focus <html>       # A11y gates
vlmkit stress i18n|media <html>                     # Overflow / media-variant stress
vlmkit heal selector <html|url> ".broken"           # Selector replacement candidates
```

### CSS Challenge (detection rate benchmark)

```bash
pkf run fix-loop -- --fixture page --seed 42         # Single CSS deletion challenge (VLM/LLM recovery)
pkf run css-bench -- --trials 30                     # Benchmark (detection rate measurement)
pkf run css-bench-crater -- --fixture page           # Crater prescanner backend
pkf run css-bench-all                                # All fixtures at once
pkf run css-report                                   # Analysis report of accumulated data
```

### Migration VRT (CSS migration verification)

```bash
pkf run migration-compare -- before.html after.html  # 2-file comparison
pkf run migration-reset        # Reset CSS comparison (normalize vs others)
pkf run migration-tailwind     # Tailwind → vanilla CSS
```

Breakpoints are auto-discovered from CSS, generating boundary ±1px + random sample viewports.

### Demo

```bash
pkf run vrt-demo               # Basic VRT demo (kitty graphics)
pkf run vrt-demo-fix           # Fix loop demo
pkf run vrt-demo-multi         # Multi-scenario
pkf run vrt-demo-multistep     # Multi-step
```

## Agent Workflow

### Basic Loop

```
┌─────────────────────────────────────────────┐
│ 1. Create baseline                          │
│    pkf run vrt-update                       │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 2. Make code changes                        │
│    - State intent clearly in commit message │
│      (feat: / fix: / style: / refactor: /   │
│       a11y: / deps:)                        │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ 3. pkf run vrt                              │
└─────────┬───────────────────────────────────┘
          │
     ┌────┴────────────────┐
     │                     │
   PASS               FAIL/ESCALATE
     │                     │
     ▼                     ▼
┌──────────┐    ┌─────────────────────┐
│ 4a.      │    │ 4b. Identify issue  │
│ Done     │    │     → Fix code      │
│          │    │     → Return to 3   │
└──────────┘    └─────────────────────┘
```

### Verification Pipeline (runs automatically)

```
Change ─→ 3 tracks run in parallel:

Track 1: Diff Intent    — git diff + commit message → infer change intent
Track 2: Visual Diff    — pixel comparison → heatmap → region classification
Track 3: A11y Diff      — a11y tree diff → semantic change detection

→ Cross-Validation (cross-reference all 3):

| Visual | A11y  | Intent  | → Verdict             |
|--------|-------|---------|----------------------|
| None   | None  | any     | APPROVE (no change)   |
| Yes    | Yes   | match   | APPROVE (as expected) |
| Yes    | Yes   | none    | ESCALATE (unclear intent) |
| Yes    | None  | style   | APPROVE (visual only) |
| Yes    | None  | refac   | ESCALATE (unintended) |
| None   | Yes   | a11y    | APPROVE (a11y improvement) |
| None   | Yes   | other   | REJECT (semantics broken) |
| any    | regr  | any     | REJECT (a11y regression) |

→ Quality Gate:
  - Whiteout detection (blank white screen)
  - Error state detection (red warning display)
  - Empty content detection
  - A11y regression (lost label, removed landmark)
```

## exit code

| code | Meaning |
|------|---------|
| 0    | PASS — no change, or all approved |
| 1    | FAIL — rejected changes, or quality error |

escalate returns exit 0 but emits warnings.

## How to Write Commit Messages

The verification pipeline infers change intent from the commit message.
When intent is correctly inferred, expected visual changes are auto-approved.

```
feat: add dark mode toggle          → visual + a11y additions expected
fix: fix mobile layout breakage     → only fix target should change
refactor: extract utility functions → no visual/a11y changes expected
style: change button color blue→green → visual change, no a11y change expected
a11y: add labels to form            → a11y change, minimal visual change expected
deps: update to React 19            → no visual/a11y changes expected
```

## A11y Check Usage

VRT verify also inspects the A11y tree simultaneously. The following are detected:

- Button/link without label (`label-missing`)
- Image without alt text (`img-alt-missing`)
- Landmark element removed (`landmark-changed`)
- Interactive element removed (`node-removed`)
- Inappropriate role change (`role-changed`)

If any of these are detected during refactoring,
semantics are likely broken.

## File Structure

This repository is a pnpm workspace. See `.claude/CLAUDE.md` § Package Layout for the authoritative table.

```
├── SKILL.md                   ← This file
├── Taskfile.pkl               # Task runner (pkfire: `pkf run <task>`)
├── Spec.pkl / Test.pkl        # Specs + smoke gate (pkspec)
├── playwright.config.ts       # Playwright config for VRT
├── e2e/                       # Screenshot + a11y collection specs
├── fixtures/                  # Test fixtures (a11y, migration, wireframe, ...)
├── packages/
│   ├── vlmkit-core/           # Pixel/CSS/DOM/a11y diff engine + shared types
│   ├── vlmkit-capture/        # Playwright / Crater capture, viewport discovery
│   ├── vlmkit-ai/             # VLM/LLM clients, 2-stage reasoning pipeline
│   ├── vlmkit-markup/         # Markup tooling: build/scan component, contract
│   │                          #   introspect/validate/scaffold, checks, stress,
│   │                          #   selector-heal (all deterministic, no VLM)
│   ├── vlmkit-plan/           # Spec + UI observations → structured test plan
│   ├── vlmkit-generate/       # Plan → Playwright spec (diagnostics-driven retries)
│   └── vlmkit-heal/           # Failing-test heal loop (model escalation + budget)
├── src/
│   ├── cli/                   # `vlmkit` CLI entry + router + commands
│   ├── api/                   # Hono HTTP API server
│   ├── vrt/                   # snapshot / compare workflows
│   ├── util/                  # markup-loop, skill, agent helpers
│   └── experiments/           # migration, css-challenge, detection, benchmarks
└── docs/                      # knowledge.md, markup-implementation-flow.md, reports/
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Font rendering diffs | Adjust pixelmatch threshold (packages/vlmkit-core/src/heatmap.ts) |
| A11y tree is null | Wait for page render completion (adjust waitFor) |
| Everything becomes ESCALATE | Add prefix to commit message (feat:/fix:/style: etc.) |
