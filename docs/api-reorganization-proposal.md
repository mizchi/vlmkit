# API Reorganization Proposal — v5 (0.5.0)

Status: **APPROVED for implementation** (after four review passes).
Scope: library + CLI API consistency. No package extraction.

## 1. Motivation

The `0.4.0` publish exposes the public API for the first time. Before
users harden against it, fix the inconsistencies accumulated during the
package-split refactor:

- Verb-prefix collisions (`compare*` vs `diff*`).
- Factory functions silently return `null`; caller can't tell *why*.
- 30+ flat CLI commands.
- Per-command argv parsing diverged on defaults.

## 2. Naming taxonomy

| Prefix | Intent | Returns | Examples |
|---|---|---|---|
| `compare*(a, b)` | Pixel / similarity (ecosystem term) | `Diff` or `Match` | **`compareScreenshots`** (keep), `compareRowTypography` |
| `diff*(a, b)` | Structural diff of typed data | `Diff` struct | `diffA11yTrees`, `diffComputedStyles`, `diffDomPositionStyles`, `diffPalettes`, `diffPaintTrees` |
| `find*(input)` | Heuristic search | Array | `findHeatmapRegions*`, `findShiftOrigins`, `findGridSuggestions`, `findDominantBackgrounds*`, `findAffectedComponents` |
| `detect*(input)` | Binary quality check | `boolean` / `Issues[]` | `detectBandShifts`, `detectWhiteout`, `detectEmptyContent` |
| `extract*(input)` | Pure derivation / parse | Data | `extractTextRows*`, `extractBreakpoints*`, `extractPalette*`, `extractComponents*`, `extractSnapshotFixTasks`, `extractDiffSemantics` |
| `classify*(input)` | Categorization | Enum | `classifyRegion`, `classifyVisualDiff` |
| `analyze*(input)` | Multi-step → report | `Report` | `analyzeReport` |
| `verify*(input, spec?)` | Assertion | `VerifyResult` | `verifySpec`, **`verifyA11yTree`** (rename), **`verifyDomEquivalence`** (rename) |
| `run*(options)` | End-to-end orchestration | `Result` | `runPngDiff`, `runQualityChecks` |
| `create*(config?)` | Factory | Instance (throws by default) | `createVlmClient`, `createUnifiedLLMClient`, `createLLMProvider`, `createReasoningPipeline`, `createScopedVrtDiff` |

### Renames

| Current | Proposed |
|---|---|
| `compareScreenshots` | keep |
| `evaluateDomEquivalence` | `verifyDomEquivalence` |
| `checkA11yTree(tree)` | `verifyA11yTree(tree, spec)` *(spec required; see §7)* |
| `compareRowTypography` | keep |

## 3. Error contract

### Factories: `VrtConfigError` (throw by default; opt-out for legacy)

```ts
export class VrtConfigError extends Error {
  code:
    | "MISSING_KEY"            // vlm-client.ts:230
    | "INVALID_MODEL"          // vlm-client.ts:90
    | "MULTIPLE_MATCHES"       // vlm-client.ts:107
    | "INVALID_PROVIDER"       // llm-client.ts:302
    | "NO_PROVIDER_AVAILABLE"  // llm-client.ts:344
    | "MISSING_DEPENDENCY"     // vlm-client.ts:139
  ;
}

export interface CreateOptions {
  /** When false, returns null instead of throwing. Default: true. */
  throwIfMissing?: boolean;
}
```

Network/HTTP errors are *runtime* not *config* — stay as `Error`. Out
of scope for 0.5.0.

### Diff functions: NO behavior change

Keep `compareScreenshots` and `generateDiffReport` returning `T | null`.
The v4 plan ("always return T, set snapshot.status = 'missing'")
collided with caller code at `verify.ts:109` and `fix-loop.ts:109`
that uses `if (diff && diff.diffPixels > 0)` to discriminate "no
change" vs "no baseline" — collapsing them silently treats missing
baselines as passing.

The factory-side `VrtConfigError` work delivers the bulk of the
"discriminate failure modes" goal. Leave diff functions alone.

## 4. CLI subcommand grouping

Audit-driven against every entry in `src/cli/router.ts:50-77,229-238,313`.

```
vrt diff                              compare two things → diff
  vrt diff html <a> <b>               compare → diff html
  vrt diff png <a> <b>                png-diff
  vrt diff elements <html>            elements
  vrt diff browsers <html>            cross-browser
  vrt diff agent <run-dir>            diff-for-agent
  vrt diff runs <run...>              compare-runs

vrt check                             assert pass/fail
  vrt check a11y contrast <html>      a11y-contrast
  vrt check a11y touch <html>         a11y-touch
  vrt check a11y focus <html>         a11y-focus-order
  vrt check tokens <html>             design-tokens
  vrt check theme <html>              theme-parity
  vrt check perf <html>               perf
  vrt check drift component <html>    component-consistency
  vrt check drift pages --urls...     multi-page-consistency

vrt inspect                           record reproducible artifacts
  vrt inspect interact <html>         interact
  vrt inspect explore <html>          explore
  vrt inspect smoke <html>            smoke
```

(Rationale for `inspect` over `record`: `record` conflicts with
Playwright codegen — `playwright codegen` is colloquially "record
mode." `inspect` also matches the existing
`packages/vrt-markup/src/inspect/` directory where `interact.ts` and
`explore.ts` already live.)

```
vrt stress
  vrt stress i18n <html>              i18n-stress
  vrt stress media <html>             media-variants

vrt scan
  vrt scan component <png>            component-extract
  vrt scan breakpoints <file>         discover

vrt build
  vrt build component <png> <html>    component-from-image

vrt snapshot                          unchanged (cohesive)
  vrt snapshot <url...>
  vrt snapshot approve
  vrt snapshot flipbook               flipbook moves here (post-proc)

vrt workflow                          unchanged
  vrt workflow init / capture / verify / approve / report /
  graph / affected / introspect / spec-verify / expect

vrt bench / api / skill / report      unchanged
```

### Retired top-level aliases

`vrt init / capture / verify / approve / graph / affected / introspect /
spec-verify / expect` (the 9 shortcuts at `router.ts:170-179`) become
deprecation shims pointing at `vrt workflow <cmd>`. Eliminates the
name collision with anything new at the top level.

### Deprecation infrastructure

- Shims live at `src/cli/_shim/<oldname>.ts`. Each prints
  `[vrt deprecated] use 'vrt <new> ...' — removed in 1.0.0` to stderr
  and delegates to the new path.
- Log path:
  - Linux/macOS: `${XDG_STATE_HOME ?? ~/.local/state}/vrt/deprecated.log`
  - Windows: `${LOCALAPPDATA}\vrt\deprecated.log`
- Failure mode: read-only FS / CI sandbox → stderr-only, never crash.
  Wrap log write in try/catch.

## 5. CLI parser — ship with renames in 0.5.0

cac adoption ships **with** the renames. Reason: the nested subcommands
(`check a11y contrast`, `diff browsers`, …) can't be expressed cleanly
with `getArg`-based parsing. Doing renames first would force a rewrite
at 0.5.1 for the ~12 commands gaining a subcommand layer.

### Migration scope (corrected count)

`grep -rln "getArg\\|process\\.argv\\.slice" packages/ src/` → **38
files** (proposal v4 said 28; updated):

- `src/cli/commands/*.ts` (4)
- `src/cli/workflow*.ts` + `workflow/*.ts` (5)
- `src/experiments/{benchmark,css-challenge,migration}/*.ts` (7)
- `packages/vrt-markup/src/{component,inspect,stress,style}/*.ts` (12)
- `packages/vrt-core/src/{a11y-*,png-diff}.ts` (4)
- Misc / util (~6)

Per-file cost ≈ 30 min (typical `parseArgs` block is 20 lines →
3-5 cac flag defs + extract module-top `getArg` reads into `cliMain`).
38 × 30 min = **19 h pure mechanical**.

Test gate: every old name → new name pair runs the same fixture and
produces identical exit code + stdout. ~30 fixtures × 10 min = **5 h**.

Subcommand-nesting design + integration debugging = **~1 day**.

**Total: 3-4 days realistic**, not "2-3 day thin wrapper."

### Standard flags after cac

```
--output-dir <path>   default: test-results/<top>/<sub>
--json                machine-readable stdout
--quiet               suppress progress
--debug               verbose
--config <path>       default: vrt.config.json if present
```

Target arg: positional `<html|url>` first; `--url` / `--file` as override.

## 6. Type envelopes — audit-driven

```ts
// vrt-core/types.ts
export interface Findings<T> {
  items: T[];
  total: number;
  truncated: boolean;
}
```

Apply only to `findHeatmapRegions*` (internally caps region count).
Defer `Report<T>` / `VerifyResult<T>` until ≥2 callers share shape.

## 7. `verifyA11yTree` — explicit spec required

Default-spec design is a separate task. For 0.5.0 ship explicit stock
specs:

```ts
// packages/vrt-core/src/a11y-defaults.ts
export const A11Y_STRICT: UiSpec = { ... };       // landmark + labels + contrast + focus
export const A11Y_RECOMMENDED: UiSpec = { ... };  // landmark + labels + contrast
export const A11Y_MINIMAL: UiSpec = { ... };      // landmark only
```

Each is a frozen const typed as the existing `UiSpec` — no schema
change. Surveying which `SpecCheckType` values
(`types.ts:223-230`: `landmark-exists`, `label-present`,
`no-whiteout`, ...) compose into each tier is a design step inside
the 0.5.0 PR, not a separate phase.

`verifyA11yTree(tree, spec)` makes `spec` **required**. The codemod
injects `A11Y_RECOMMENDED` and the matching import.

## 8. Codemod scope (`vrt migrate`)

| Pattern | Rewrite | Import to inject |
|---|---|---|
| `checkA11yTree(tree)` | `verifyA11yTree(tree, A11Y_RECOMMENDED)` | `import { verifyA11yTree, A11Y_RECOMMENDED } from "@mizchi/vrt-core"` |
| `evaluateDomEquivalence(a, b)` | `verifyDomEquivalence(a, b)` | `import { verifyDomEquivalence } from "@mizchi/vrt-core"` (replace old name) |
| `createVlmClient()` | `createVlmClient({ throwIfMissing: false })` | (unchanged — preserves nullable contract) |
| `createUnifiedLLMClient()` | `createUnifiedLLMClient({ throwIfMissing: false })` | (unchanged) |
| `createLLMProvider()` | `createLLMProvider({ throwIfMissing: false })` | (unchanged) |
| `createReasoningPipeline()` | `createReasoningPipeline({ throwIfMissing: false })` | (unchanged) |

Codemod implementation: `ts-morph` (more reliable than jscodeshift for
TS-specific import management). Lives at
`scripts/migrate-0.5.ts`; invoked via `pnpm vrt migrate` or
`npx @mizchi/vrt migrate`.

Doc-only (`docs/migration-0.5.md`):
- The 30+ CLI subcommand renames (shell / CI).

## 9. CI grep gate

`scripts/check-deprecated.sh` (new file) invoked from a new
`lint-deprecated` workflow:

```bash
#!/usr/bin/env bash
grep -rEn '\b(checkA11yTree|evaluateDomEquivalence)\b' \
  packages/ src/ \
  --include='*.ts' \
  --exclude='*/cli/_shim/*' \
  --exclude='*/test/*' \
  | grep -v '\.test\.ts:'
test $(grep ... | wc -l) -eq 0
```

`packages/*/src/_shim/` and `src/cli/_shim/` directories are created
by the 0.5.0 PR. Tests retain old names to verify shim behavior.

## 10. Versioning + rollout

- **0.4.x**: as published.
- **0.5.0**: type/error/CLI-tree renames + cac CLI + deprecation shims
  + `VrtConfigError` + `vrt migrate` codemod + grep gate.
  - **Ship gate**: maintainer's own CI shows zero entries in
    `deprecated.log` after one full bench-suite run against the new
    names.
- **0.6.x — 0.9.x**: iterate on deprecation-log data.
- **1.0.0**: remove shims. Cutover criterion: no log entries from CI
  for ≥1 calendar month.

## 11. Out of scope

- API package extraction.
- Crater as default backend.
- `.d.ts` generation.
- VS Code extension.
- Diff-function null-return change (kept as-is — see §3).
- Default a11y spec (ship explicit stocks; design proper default later).

## 12. Sign-off

Four review passes resolved every blocker (`hasBaseline` semantics,
`DiffReport.snapshot`, `DEFAULT_A11Y_SPEC`/`UiSpec` mismatch, missing
CLI commands, `record`/codegen collision, cac timing). v5 is the
implementation contract. Open work items in order:

1. Implement `VrtConfigError` + opts-pattern in vrt-ai factories.
2. Add `A11Y_STRICT` / `A11Y_RECOMMENDED` / `A11Y_MINIMAL` constants
   (design + implement in same step).
3. Rename `checkA11yTree` → `verifyA11yTree`, `evaluateDomEquivalence`
   → `verifyDomEquivalence`. Keep old names as deprecation re-exports.
4. Add `scripts/migrate-0.5.ts` (ts-morph codemod).
5. Migrate 38 files to cac. New CLI tree:
   `diff/check/inspect/stress/scan/build/snapshot/workflow/...`.
6. Wire shim directory + deprecation log path with Windows + read-only
   FS handling.
7. Add `scripts/check-deprecated.sh` + `.github/workflows/lint-deprecated.yml`.
8. `docs/migration-0.5.md` for CLI renames + codemod walkthrough.
9. Ship gate: green bench-suite with zero deprecation-log entries.
