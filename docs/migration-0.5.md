# Migration: 0.4.x → 0.5.0

> Historical document. The compatibility aliases and deprecation logging
> described below have been removed from the current development branch.

Internal migration notes for the API reorganization landed in
`feat/0.5.0` (proposal: `docs/api-reorganization-proposal.md`).

There are no external `@mizchi/vrt-*` consumers yet, so this doc is
maintainer-facing: it explains what changed, what still works
(deprecation shims), and what to update in this repo before 1.0.0.

## TL;DR

Everything from 0.4.0 still works in 0.5.0. New names are preferred;
old names print a one-line deprecation warning to stderr and a TSV
entry to `~/.local/state/vrt/deprecated.log` (or `%LOCALAPPDATA%\vrt\`
on Windows). All deprecation shims are removed at 1.0.0.

## Library renames

### `checkA11yTree` → `verifyA11yTree`

Pure rename. Same signature `(tree: A11yNode) => A11yIssue[]`.

```ts
// before
import { checkA11yTree } from "@mizchi/vrt-core";
const issues = checkA11yTree(tree);

// after
import { verifyA11yTree } from "@mizchi/vrt-core";
const issues = verifyA11yTree(tree);
```

`checkA11yTree` is still re-exported as an `@deprecated` alias from
both `packages/vrt-core/src/a11y-semantic.ts` and the package barrel.
It's defined as `export const checkA11yTree = verifyA11yTree;` so the
two names refer to the same function — no behaviour drift.

### `evaluateDomEquivalence` → `verifyDomEquivalence`

Pure rename. Same signature
`(baseline: DomFingerprint, variant: DomFingerprint) => DomEquivalenceResult`.

```ts
// before
import { evaluateDomEquivalence } from "@mizchi/vrt-core";

// after
import { verifyDomEquivalence } from "@mizchi/vrt-core";
```

## Factory error contract

Factories in `@mizchi/vrt-ai` used to return `null` silently when
configuration was missing. They now throw a tagged `VrtConfigError`
by default, with a discriminant `code` so callers can react to
specific failure modes.

```ts
export class VrtConfigError extends Error {
  code:
    | "MISSING_KEY"
    | "INVALID_MODEL"
    | "MULTIPLE_MATCHES"
    | "INVALID_PROVIDER"
    | "NO_PROVIDER_AVAILABLE"
    | "MISSING_DEPENDENCY";
}
```

Affected factories:

- `createVlmClient(model, opts?)` (`opts: { apiKey?, throwIfMissing? }`)
- `createUnifiedLLMClient(opts?)` (`opts: LLMClientOptions & { throwIfMissing? }`)
- `createLLMProvider(opts?)` (`opts: { throwIfMissing? }`)
- `createReasoningPipeline(config?)` (`config: PipelineConfig & { throwIfMissing? }`)

Two migration patterns:

**A. Throw + handle.** New code should prefer this — the discriminant
`code` lets you act on the failure shape:

```ts
import { VrtConfigError, createLLMProvider } from "@mizchi/vrt-ai";

try {
  const llm = createLLMProvider();
  // ...
} catch (e) {
  if (e instanceof VrtConfigError && e.code === "NO_PROVIDER_AVAILABLE") {
    console.warn("No LLM configured — skipping reasoning stage.");
  } else {
    throw e;
  }
}
```

**B. Keep the null contract.** Pass `{ throwIfMissing: false }`:

```ts
const llm = createLLMProvider({ throwIfMissing: false });
if (!llm) {
  // ... fall back
}
```

Internal callers in this repo (`api-server`, `fix-loop`,
`css-challenge`, `smoke-runner`, `vlm-bench`, `reasoning-pipeline`)
were updated to pattern **B** — they all had `if (!x)` branches that
relied on the null. New code should default to pattern A.

## CLI command tree

The 30+ flat top-level commands are now grouped under cohesive verbs:

| New | Old | Status |
|---|---|---|
| `vrt diff html <a> <b>` | `vrt compare <a> <b>` | shim |
| `vrt diff png <a> <b>` | `vrt png-diff <a> <b>` | shim |
| `vrt diff elements <html>` | `vrt elements <html>` | shim |
| `vrt diff browsers <html>` | `vrt cross-browser <html>` | shim |
| `vrt diff agent <run-dir>` | `vrt diff-for-agent <run-dir>` | shim |
| `vrt diff runs <run...>` | `vrt compare-runs <run...>` | shim |
| `vrt check a11y contrast <html>` | `vrt a11y-contrast <html>` | shim |
| `vrt check a11y touch <html>` | `vrt a11y-touch <html>` | shim |
| `vrt check a11y focus <html>` | `vrt a11y-focus-order <html>` | shim |
| `vrt check tokens <html>` | `vrt design-tokens <html>` | shim |
| `vrt check theme <html>` | `vrt theme-parity <html>` | shim |
| `vrt check perf <html>` | `vrt perf <html>` | shim |
| `vrt check drift component <html>` | `vrt component-consistency <html>` | shim |
| `vrt check drift pages --urls...` | `vrt multi-page-consistency --urls...` | shim |
| `vrt inspect interact <html>` | `vrt interact <html>` | shim |
| `vrt inspect explore <html>` | `vrt explore <html>` | shim |
| `vrt inspect smoke <html>` | `vrt smoke <html>` | shim |
| `vrt stress i18n <html>` | `vrt i18n-stress <html>` | shim |
| `vrt stress media <html>` | `vrt media-variants <html>` | shim |
| `vrt scan component <png>` | `vrt component-extract <png>` | shim |
| `vrt scan breakpoints <file>` | `vrt discover <file>` | shim |
| `vrt build component <png> <html>` | `vrt component-from-image <png> <html>` | shim |
| `vrt workflow init` | `vrt init` | shim |
| `vrt workflow capture` | `vrt capture` | shim |
| `vrt workflow verify` | `vrt verify` | shim |
| `vrt workflow approve` | `vrt approve` | shim |
| `vrt workflow graph` | `vrt graph` | shim |
| `vrt workflow affected` | `vrt affected` | shim |
| `vrt workflow introspect` | `vrt introspect` | shim |
| `vrt workflow spec-verify` | `vrt spec-verify` | shim |
| `vrt workflow expect` | `vrt expect` | shim |
| `vrt api serve` | `vrt serve` | shim |
| `vrt api status` | `vrt status` | shim |
| `vrt snapshot ...` | (unchanged) | — |
| `vrt bench ...` | (unchanged) | — |
| `vrt report` | (unchanged) | — |
| `vrt skill ...` | (unchanged) | — |

### Updating callers

Any script that still uses the old name keeps working — it just emits
a stderr warning. To clean up:

```bash
# In package.json scripts, CI YAML, dotfiles:
sed -i 's/vrt png-diff/vrt diff png/g' .github/workflows/*.yml
sed -i 's/vrt compare /vrt diff html /g' .github/workflows/*.yml
# ... etc per table above.
```

This repo's own `Taskfile.pkl` invokes scripts directly (e.g.
`node src/cli/commands/snapshot.ts`), so no rewrite needed there.

Doc files (`docs/architecture.md`, `docs/introduce.ja.md`, `docs/SPEC.md`,
`docs/reports/*.md`) still reference old names. **Not auto-updated**
because they describe historical state in some places. Refresh
piecemeal as docs get touched.

## Deprecation log

Path:

- Linux/macOS: `${XDG_STATE_HOME:-~/.local/state}/vrt/deprecated.log`
- Windows: `%LOCALAPPDATA%\vrt\deprecated.log`

Format (TSV, one line per shim invocation):

```
2026-05-18T03:14:15.926Z	png-diff	vrt diff png	/home/user/project
```

Read it before retiring shims at 1.0.0:

```bash
# Names still being used:
cut -f2 ~/.local/state/vrt/deprecated.log | sort -u
```

If the file is unwritable (read-only FS, sandbox), the shim falls
back to stderr-only — never crashes.

## CI grep gate

`scripts/check-deprecated.sh` (run by
`.github/workflows/lint-deprecated.yml`) forbids `checkA11yTree` and
`evaluateDomEquivalence` from re-entering source. Allow-listed paths:

- `*.test.ts` (alias-verification tests legitimately use the old name)
- `packages/vrt-core/src/a11y-semantic.ts` + `dom-equivalence.ts`
  (the alias declarations live here)
- `packages/vrt-core/src/index.ts` (the curated barrel re-exports
  both names; the deprecated one is JSDoc-tagged)

If you add a new file that legitimately needs to mention the old
names (e.g. a fresh migration test, a new shim layer), extend
`ALLOWLIST` at the top of `scripts/check-deprecated.sh`.

## Version timeline

- **0.4.0** — current published. No breaking changes.
- **0.5.0** — *this release*. Renames + error class + CLI tree + shims + grep gate.
- **0.5.x** — bugfixes only; no new shims.
- **1.0.0** — remove deprecation shims; commit to API stability.
  Cutover criterion: zero entries in `deprecated.log` from
  maintainer CI for ≥1 calendar month.

## Items intentionally not done

Per maintainer decision ("外部ユーザーはいない想定でいい"):

- **No `vrt migrate` codemod** — there are no external consumers
  whose code needs rewriting; the in-repo cleanup was done by hand
  (see this PR's diff).

Per proposal §11 (out of scope):

- API package extraction.
- Crater as default backend.
- `.d.ts` generation.
- VS Code extension.
- Removing `T | null` from diff functions (`compareScreenshots`,
  `generateDiffReport`).
- Default a11y spec / `A11Y_STRICT|RECOMMENDED|MINIMAL` constants.
