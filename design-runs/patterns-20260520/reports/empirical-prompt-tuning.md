# Empirical prompt tuning: design pattern feasibility

Date: 2026-05-20

Target prompt: `docs/design-pattern-feasibility.md`

Purpose: use the dogfood learnings to tune the pattern-classification prompt so
another agent can choose the correct vlmkit goal, markers, and validation loop
without relying on hidden context.

## Iteration 0: static check

Description/body consistency: acceptable.

Observed gap before execution:

- The doc named the right pattern goals, but did not centralize the canonical
  implementation marker vocabulary.
- The doc described canvas state checks, but did not give a minimum
  `window.__gameState` hook shape.
- Mixed landing/app-preview pages were covered by the classifier, but the
  landing section did not explicitly say that a sidebar-like hero preview is
  still a media slot unless it is interactive.

## Baseline scenarios

| Scenario | Kind | Critical items |
|---|---|---|
| Landing | SaaS landing mock with CTA, media slot, next-section hint | classify as landing, use `--goal landing`, require CTA/next/media markers |
| App shell | Discord-like sidebar UI | classify as app-shell, use `--goal app-shell`, require independent scrollports |
| Canvas | Runner game canvas mock | classify as canvas, use `--goal canvas`, treat mock as art direction |

All scenarios used 6 fixed requirements, with at least 2 critical requirements.

## Iteration 1 results

| Scenario | Success | Accuracy | Retries | Weak phase | Notes |
|---|---:|---:|---:|---|---|
| Landing | yes | 100% | 0 | none | Correctly chose `--goal landing` and required CTA/next/media evidence. |
| App shell | yes | 100% | 0 | none | Correctly chose `--goal app-shell` and `data-scrollport` evidence. |
| Canvas | yes | 100% | 0 | none | Correctly chose `--goal canvas` and separated art direction from DOM. |

Tool step count and duration were not available from the agent wrapper output,
so this run treats qualitative self-report and requirement achievement as the
primary measurements.

### Structured reflection

No executor reported unclear points.

### Discretionary fill-ins

- Landing executor invented `data-vlm-role="primary-cta"` style markers instead
  of the currently implemented `data-primary-cta`, `data-next-section`, and
  `data-media-slot`.
- App-shell executor chose `data-scrollport` names correctly, but added
  `channel-list`, `message-list`, and `member-list` by judgment.
- Canvas executor chose `window.__gameState` fields by judgment.

### Fix applied

Fix theme: canonical evidence vocabulary.

Requirement wording satisfied:

- landing item 2: explicit CTA / next-section / media-slot markers
- app-shell item 2: explicit independent scrollport marker names
- canvas item 3: canvas nonblank / frame delta / input response evidence

Changes:

- Added a `Canonical implementation markers` section to
  `docs/design-pattern-feasibility.md`.
- Added landing marker names to the landing contract and prompt constraints.
- Added app-shell `data-scrollport` names to the app-shell contract and prompt.
- Added minimum `window.__gameState` fields to the canvas contract and prompt.

## Hold-out result

Hold-out scenario: SaaS landing page with a static Discord-like app preview in
the hero.

| Scenario | Success | Accuracy | Retries | Weak phase | Notes |
|---|---:|---:|---:|---|---|
| Mixed landing/app preview | yes | 100% | 0 | none | Correctly kept top-level `--goal landing` and treated the preview as `data-media-slot`. |

### Hold-out discretionary fill-ins

- Executor added a policy that app-preview internals should only get
  app-shell validation if the preview is implemented as an interactive surface.

### Second fix applied

Fix theme: mixed landing/app-preview boundary.

Requirement wording satisfied:

- hold-out item 3: embedded app preview can be inspected as media slot, while
  inner app-shell scrollports are not acceptance gates for the landing page.

Changes:

- Added this boundary rule to the landing contract, prompt constraints, and
  signals section.

## Iteration 2 results

Same three baseline scenarios, fresh executors, after the marker and mixed
preview boundary fixes.

| Scenario | Success | Accuracy | Retries | Weak phase | Notes |
|---|---:|---:|---:|---|---|
| Landing | yes | 100% | 0 | none | Used canonical `data-primary-cta`, `data-next-section`, and `data-media-slot`; kept dashboard preview as a static media slot. |
| App shell | yes | 100% | 0 | none | Used `data-scrollport="channel-list"`, `message-list`, and `member-list`; selected/unread/focus states were explicit. |
| Canvas | yes | 100% | 0 | none | Used `--goal canvas`; required nonblank/frame/input evidence and minimum `window.__gameState` fields. |

### Structured reflection

No executor reported unclear points.

### Discretionary fill-ins

- Landing executor filled in product name, target/current paths, viewport/DPR,
  and treated the dashboard preview as static by default.
- App-shell executor chose `member-list` rather than `detail-panel` because the
  scenario explicitly had a member panel.
- Canvas executor filled in example paths and `1280x720`.

### New issue found outside the checklist

The canvas executor satisfied the scenario, but invented command flags:
`--mock`, `--out`, and `--viewport`. This was not a classification failure; it
showed that the prompt fixed machine-checkable evidence but did not fix the CLI
contract strongly enough.

### Third fix applied

Fix theme: canonical validation command shape.

Requirement wording satisfied:

- command-shape hold-out item 1: use positional
  `vlmkit build component <target.png> <current.html> --goal <goal> --output-dir <dir>`
- command-shape hold-out item 3: do not invent unsupported `--mock`, `--out`,
  or `--viewport` flags

Changes:

- Added `Canonical validation command shape` to
  `docs/design-pattern-feasibility.md`.
- Clarified that viewport is inferred from the target PNG and that DPR must
  match when using `--dpr` / `--device-scale-factor`.
- Updated implementation implication examples to include positional target and
  current HTML arguments.

## Command-shape hold-out result

Hold-out scenario: produce validation commands for landing, app-shell, and
canvas runs using provided target/current paths.

| Scenario | Success | Accuracy | Retries | Weak phase | Notes |
|---|---:|---:|---:|---|---|
| Command shape | yes | 100% | 0 | none | Used positional target/current arguments, correct goals, and no unsupported flags. |

### Command-shape discretionary fill-ins

- Executor added `--states hover focus-visible` only for app-shell.
- Executor left DPR out of fixed commands and documented it as a conditional
  addition when the target PNG is retina.

## Ledger

- **Canonical marker vocabulary drift**
  - Example: executor invented `data-vlm-role="primary-cta"` despite the tool
    reading `data-primary-cta`.
  - General Fix Rule: prompt docs that require machine-checkable evidence must
    name the exact marker attributes consumed by the implementation.
  - Seen in: iter 1 landing, iter 1 canvas.
- **Nested preview goal bleed**
  - Example: a sidebar-like hero preview could tempt an executor to apply
    app-shell gates inside a landing page.
  - General Fix Rule: mixed-pattern prompts must state which surface owns the
    acceptance goal and which nested surfaces are decorative/media slots.
  - Seen in: hold-out.
- **Invented CLI flags when command contract is implicit**
  - Example: executor generated `vlmkit build component ./src/GameRunner.tsx
    --mock ./design/mocks/runner-game.png --out ./design-runs/runner-canvas`
    even though the current CLI expects `<target.png> <current.html>`.
  - General Fix Rule: prompt docs that ask executors to run or recommend tools
    must include the exact command skeleton, positional arguments, and allowed
    option set near the relevant workflow.
  - Seen in: iter 2 canvas.

## Convergence

Current status: 2 baseline clears plus 2 hold-out clears after fixes.

The target prompt is good enough to ship for the current dogfood loop. Remaining
limits:

- Step count and duration are unavailable from the agent wrapper output, so
  convergence uses qualitative self-report and requirement achievement.
- The command-shape fix should be rechecked after any CLI surface change.
- The next empirical loop should use a real non-blog implementation run rather
  than another synthetic prompt-only scenario.
