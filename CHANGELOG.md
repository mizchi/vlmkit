# Changelog

All notable changes to this project will be documented in this file.
Dates are YYYY-MM-DD.

## Unreleased

The gates became a plugin architecture. A gate is now a declaration — id,
command, rule table, inputs, and four functions — handed to one core runner
that owns `--help`, `--json`, `--advisory`, the run ledger, the verdict and
the exit code. Every one of the 26 gates goes through it, including the two
that live outside `vlmkit-markup`, and a project can add its own gate with the
same standing as a bundled one. See
[`docs/design/gate-plugin-architecture.md`](docs/design/gate-plugin-architecture.md).

The visible payoff is that the exit-code contract `gate-exit.ts` has documented
all along is now true of every gate rather than of six of them, and that
suppression works per *rule* instead of per whole gate.

### Breaking

- **Nine gates now fail on a suspect.** `check motion` and `check animation`
  previously required `--fail-on-suspect`; `check a11y touch`, `check a11y
  focus`, `check drift component`, `check drift pages`, `stress i18n`,
  `stress media` and `scan scroll` had no exit logic at all. They follow the
  documented contract now — a suspect exits 1, `--advisory` prints and exits 0,
  `--fail-on-suspect` is an accepted no-op. `check theme` and `check tokens`
  were migrated the same way but keep exiting 0, because their findings are
  `warn` by default (the design doc explains that split).
- **`check perf` no longer exits 2.** It used exit 2 for a
  `needs-improvement` verdict and 1 for `poor`, under `--strict`. The shared
  contract has two outcomes, so the third state moved into the findings:
  `poor` is a suspect (exit 1) and `needs-improvement` is a warn (exit 0). A
  script branching on exit code 2 should read `counts.warn` from `--json`.
  `--strict` is an accepted no-op, since `poor` now fails by default.
- **`--json` returns one envelope for every gate**:
  `{ gate, command, verdict, counts, findings, suppressed, retuned, report }`.
  A gate's previous JSON is `report`, verbatim — clients reading it need one
  `.report` hop, and in exchange can gate on `verdict` / `counts` without
  knowing which gate produced them. MCP tool results are unchanged.
- **Gate measurement modules are no longer executable.** `node
  path/to/a11y-contrast.ts` did something before and does nothing now; the
  module is measurement code, and `vlmkit check a11y contrast` is the command.
  Library imports (`runA11yContrast` and friends) are unaffected.
- `vlmkit gates` now **fails** on a gate command that does not resolve inside
  `check` / `scan` / `stress` / `verify`, with a did-you-mean. It previously
  ran the command anyway and reported the child process exiting non-zero,
  which read like a page defect rather than a typo.
- `parseCraterSmokeArgs` no longer handles `--help` or returns `json`; the core
  runner owns both.

### Added

- **`vlmkit rules`** lists every gate with its rule count and plugin;
  **`vlmkit rules <gate>`** prints that gate's rules, default severities and
  docs. 115 rules across 26 gates.
- **Gate categories.** Every gate declares what *kind* of question it answers —
  `correctness`, `behavior`, `design-system`, `verdict`, `infrastructure` — and
  `vlmkit rules` groups by that rather than by CLI verb, because
  `check`/`scan`/`stress` says how a command is spelled while a category says
  what a failure means. Deliberately independent of which plugin a gate ships
  in: a plugin is a unit of distribution, a category a unit of meaning.
- **`vlmkit rules --json`** emits the whole catalog —
  `{ categories, gates: [{ id, command, title, summary, category, plugin, rules }] }`
  — so a job that wants "fail the build if a gate appears un-triaged" reads
  structure instead of scraping the listing. `vlmkit rules <gate> --json` is the
  same shape for one gate.
- **[`docs/authoring-gates.md`](docs/authoring-gates.md)** — the user-facing
  guide to adding your own metric: the contract field by field, choosing
  severities and a category, reading budgets out of `vlmkit.config.json`,
  measuring in a browser, testing, and publishing a plugin.
- **`examples/gate-plugin/` is now a runnable project** with its own
  `vlmkit.config.json`, two fixtures and two gates: `house-gates.ts` (the
  smallest useful gate) and `dom-budget.gate.ts` (the shape a real house metric
  takes — render, measure, compare against budgets that resolve flag > config >
  default, with the source of each number reported). Both are covered by
  `src/cli/plugin-e2e.test.ts` against the real CLI, so a broken example fails a
  test rather than a reader's first attempt.
- **Rule settings.** `--rule <gateId>/<ruleId>=off|suspect|warn|info` re-tunes
  or disables one rule for a run; a `"rules"` block in `vlmkit.gates.json`
  (at `defaults` scope or per page) persists it. References are validated
  against the gate's declared rule table, so a misspelled rule is a config
  error rather than a line that silences nothing — and suppressed findings are
  reported *as suppressed* next to the verdict, so a gate that passes because
  three rules were turned off says so.
- **Custom gates.** `"plugins": ["./tools/house-gates.ts"]` in
  `vlmkit.config.json` loads a module whose default export is
  `definePlugin({ name, gates })`. A plugin gate is indistinguishable from a
  bundled one: same help, same `--json`, same exit contract, same ledger entry,
  same config validation. Worked example in `examples/gate-plugin/`.
- Every gate accepts `--rule`, `--rules`, `--advisory` and `--json`, and writes
  a `.vlmkit/run-ledger.jsonl` entry. Several had one or more of these missing.
- `check integrity` accepts `--advisory`. `check integrity` and `check layout`
  accept `--storage-state` uniformly. The MCP `check_integrity` tool exposes
  `timeout` and `waitUntil`, which the gate always supported.
- Terminal summaries for `check tokens`, `check theme`, `check perf`,
  `check a11y *`, `check drift *`, `stress *` are now exported functions
  (`formatDesignTokensReport` and siblings) instead of `console.log` blocks
  inside the measurement. `TouchReport.required` and `PerfReport.observeMs`
  are on their reports for the same reason.

### Changed

- `verify markup` runs the gates it folds into its verdict through the core
  runner, so **a project's rule settings now affect that verdict** — they did
  not before. Its `GateVerdict.gate` is the gate's command (`scan scroll`)
  rather than a bare leaf name, plus a `gateId`, and the kickback names a
  command that can be pasted. The folded-in set is overridable.
- `vlmkit check --help` (and every group's help) is generated from the
  registry, so a gate appears in it by existing.
- `numeric flags reject a flag-shaped value` across all gates:
  `--max-findings --json` was `NaN` before, which failed silently.
- Configuration errors — bad `vlmkit.gates.json`, bad rule reference, a
  `check drift` selector matching too few elements — print one line instead of
  a stack trace.

### Fixed

- **Two CI jobs were running commands that no longer exist.** The `compare` job
  invoked `vlmkit compare`, removed in 0.9.1 in favour of `vlmkit diff html`, so
  it failed with "Unknown command" and uploaded an empty artifact — which reads
  like a broken fixture rather than a stale workflow. The `smoke-test` job
  invoked `vlmkit smoke` (now `vlmkit inspect smoke`) and, because that step ends
  in `|| true`, reported success while running nothing. `tests/workflow-commands.test.mjs`
  now resolves every `vlmkit` command the workflows invoke against the real
  dispatcher, so a rename fails a five-second test instead of a fifteen-minute
  browser job — or instead of nothing.
- The `compare` job now installs the MoonBit toolchain. `diff html` classifies
  diff regions through `markup-core`, which is loaded at runtime and is not
  produced by the `:js` build, so the job would have died on
  `spawnSync moon ENOENT` immediately after the command name was fixed.
- The `vrt-compare` report artifact points at `diff-report.json`. 0.9.1 removed
  the `migration-report.json` duplicate but the workflow still asked for it.
- `vlmkit inspect smoke` with no target printed
  `Usage: node src/smoke-runner.ts …` — a module path that has not been runnable
  since the dispatcher took over. It prints the command now.
- `pnpm sync:skills` exposes the skill-package sync that already existed as a
  script, and the drift assertions in `tests/skill-package.test.mjs` name it.
  The failure was a 10 KB buffer diff with no hint that a generator owns those
  files, which invites hand-editing one of the three copies.
- `check breakpoints` no longer calls `process.exit(1)`, which could truncate
  its own buffered output.
- A stale legacy dispatch entry for `check tokens` shadowed the gate; combined
  with the module no longer being executable, the command silently did nothing.
  `src/cli/gate-registry.test.ts` now asserts the composed registry so a
  shadowed or dropped gate fails a test rather than a user's run.

## 0.9.1 — 2026-08-04

This release makes vlmkit easier to adopt in existing frontend repositories:
the installed skill selects the relevant workflow, browser-backed gates work
with long-lived and replayed network traffic, and Playwright is shared with
the consumer instead of duplicated. The project site now demonstrates the
same screenshot-to-implementation and verification loop that vlmkit provides.

### Breaking

- Removed the deprecated top-level CLI aliases and workflow aliases. Use the
  canonical grouped commands such as `vlmkit diff png`, `vlmkit check theme`,
  and `vlmkit workflow capture`.
- Removed `vlmkit diff region`; use deterministic `diff png --elements-html`,
  `check integrity`, and `check equivalence` signals instead.
- Removed deprecated public APIs (`checkA11yTree`,
  `evaluateDomEquivalence`, and `deriveComponentContractRuntime`) and the
  ignored `minOverlapRatio` option.
- Removed legacy `.vrt/`, `vrt.config.*`, and `VRT_*` discovery. Project state,
  configuration, and environment variables now use only `.vlmkit/`,
  `vlmkit.config.*`, and `VLMKIT_*`.
- Migration tooling now reads and writes only `diff-report.json`; the
  `migration-report.json` duplicate and fallback are gone.

### Changed

- `vlmkit -h` is now a compact command index. Detailed subcommands, options,
  and examples live under `vlmkit <command> --help`.
- The GitHub Pages introduction now leads with `apm install` and `npx skills`,
  shows real target, implementation, and diff artifacts, and presents the
  VLM-assisted implementation and deterministic browser checks as one loop.

### Added

- `check integrity` and `check design` accept `--timeout`, `--wait-until`, and
  `--har`. Long-polling pages can be measured after `domcontentloaded` or
  `load`, while HAR replay makes third-party data deterministic and aborts
  unrecorded requests.
- `check design --exclude <selector>` removes vendor-owned subtrees before
  component-reuse and spacing measurement. Repeatable exclusions report their
  root match counts, total omitted elements, and stale selectors that matched
  nothing.

### Fixed

- `check a11y contrast` now exits with status 1 when it reports WCAG contrast
  failures, so CI cannot silently pass an inaccessible page.
- The Pages dogfood workflow installs the MoonBit toolchain required by the
  contrast gate instead of failing before it can evaluate the page.
- The distributed `spec-to-playwright` seed template no longer has a filename
  collected by consumer Vitest/Jest defaults; it is copied from
  `seed.spec.template.ts` to `tests/seed.spec.ts` only when the workflow is
  adopted.
- Public vlmkit packages reuse the consumer's Playwright through a required
  `>=1.61 <2` peer instead of installing an independently resolved browser
  build; the root package also accepts `@playwright/test` as an optional peer.
  Missing-browser errors name the resolved version and invoke its exact CLI
  path.

## 0.9.0 — 2026-08-02

The theme of this release is gates that were confidently wrong. Nine of
them reported a defect in the page — or reported nothing at all — when
the real problem was that they had measured the wrong document: an
unstyled one, a login page, a pre-render placeholder. Each fix carries a
differential regression test, because none of these were visible in a
single run; every one needed two runs and a comparison.

### Breaking

- **A suspect finding now fails the command by default.** `check copy`,
  `check asset`, `scan scroll`, `check scroll`, and `check breakpoints`
  previously printed their suspects and exited 0 unless you passed
  `--fail-on-suspect`, while `check integrity`, `check layout`,
  `verify flow`, `verify markup`, `check interactions`, and
  `scan handlers` already exited non-zero — two commands in the same
  `scan` group disagreed. Every gate now shares one contract: a suspect
  exits 1, a warn never affects the exit code, and `--advisory` opts back
  into print-and-succeed for gates being piloted before they gate CI.
  `--fail-on-suspect` is still accepted as a no-op, so existing scripts
  keep working. **If you relied on a gate exiting 0 while reporting
  defects, add `--advisory`.**
- **A malformed `verify flow` file is now a usage error.** An unknown
  assert name used to be reported as an unmet post-condition
  (`FAIL (unknown assert)`), and an unknown action was worse: the step
  performed nothing, had no post-conditions to fail, and the run returned
  `done: true`. Both are now rejected before a browser opens, naming the
  offending step and listing the valid names. An empty `steps` array is
  rejected too. **A flow that was silently passing on a typo'd action
  will now error — that flow was never verifying anything.**

### Added

- `check design` — coherence of the design system a page implies, with no
  reference: spacing-scale and type-scale concentration, palette size,
  and component-signature reuse. The `scale-outlier` rule is `info`, not
  `warn`, because the study behind it showed spacing concentration
  overlaps between designed and generated pages.
- `vlmkit batch` — run gates over many pages with bounded concurrency,
  stride sharding for CI matrices, and exit-code-as-verdict. Per-job logs
  are named by a full-path slug plus a hash, so two pages with the same
  basename cannot overwrite each other's output.
- `vlmkit gates` + `vlmkit.gates.json` — one reviewed config for which
  gates run against which pages, with `gates list | run | suppressions`.
  A suppression must carry a reason, may carry an owner and an expiry,
  and stops applying once expired. An empty gate list is a parse error
  rather than a run that silently does nothing.
- `check integrity --allow "<kind>[@<selector>][@<viewport>];<reason>"` —
  accept an intentional pattern without editing the markup. A reason is
  required, an unknown kind is an error listing the valid ones, exempted
  findings stay in the report under `exempted`, and a rule that matched
  nothing is reported so dead config gets deleted. Four kinds
  (`js-error`, `degenerate-render`, `unstyled-page`, `redirected`) can
  never be exempted — they mean the page is broken or unmeasurable.
- `--json` on `check a11y contrast | touch | focus` and `stress i18n`.
  These were the gates without it, and their console output caps its list,
  so the full finding set had no machine-readable route out.
- URL support on `check a11y contrast | touch | focus` and `check design`
  — they previously accepted only local files.
- Authenticated pages: `--storage-state <file>` on URL-capable gates, or
  `VLMKIT_STORAGE_STATE=<file>` for all of them at once, accepting the
  Playwright storage-state file that `playwright codegen --save-storage`
  and `context.storageState()` produce. Validated eagerly — a missing,
  malformed, or empty state throws with a capture hint rather than
  silently measuring an unauthenticated page.

### Fixed

- **Six gates were measuring an unstyled document.** They loaded local
  HTML with `setContent(readFile(...))`, which gives the page an
  `about:blank` base URL, so every relative `<link rel=stylesheet>`,
  `<img>` and webfont silently failed to resolve. `check a11y contrast`
  reported 0 failures where the same CSS inlined reported 1; worse,
  `check a11y touch` *inverted* — an unstyled control keeps its intrinsic
  size, so a CSS-shrunk tap target measured as passing. All six now
  navigate to the file URL. (Injecting a `<base href>` was tried and does
  not work: an opaque origin blocks `file://` subresources.)
- **Five more gates reported success for a login page.** `check
  breakpoints`, `check scroll` and `scan scroll` returned `status: ok`
  for a route that 302s to `/login`, while `check layout` and
  `verify flow` failed against the sign-in page and blamed the markup.
  All five now report the redirect. The hint also stopped claiming
  "vlmkit cannot inject a session", which had been false since
  `--storage-state` landed.
- **Six gates were reading the pre-render DOM.** `verify flow` reported
  `count .card expected 2, measured 0` on a page where `check layout`
  measured 2 at the same instant; `build page` screenshotted a candidate
  at 5.3% of its settled ink, so every component came back missing; and
  `scan contract` returned zero landmarks for a built SPA opened as a
  file. Playwright actions auto-wait, but `page.evaluate`,
  `page.screenshot` and `getBoundingClientRect` do not — and that is how
  every gate measures.
- `check integrity` findings were attributed to whichever viewport the
  caller happened to list first, so `--allow "…@1280"` was silently
  order-dependent and a page-wide defect could read as mobile-only. The
  sweep is now sorted widest-first and records every width a finding was
  seen at, which also makes "breaks at 1280/768 but not 375" expressible
  for the first time.
- `check a11y contrast | touch | focus` printed a headline count and then
  five rows with no indication the list was cut — twelve findings looked
  like five. The cap is now disclosed and `--json` carries every row.
  `stress i18n` capped at six rows and is now disclosed too.
- `--json` on those four gates prints **only** JSON. It was added in this
  cycle and shipped emitting the human block first, so `JSON.parse` threw
  on line 1 — while the truncation notice pointed the reader at exactly
  that stream. Found by running the built CLI during release prep; the
  original check had read `report.failures.length` from the run function,
  which never touches stdout.
- The four gates above no longer print `vrt` in their headers, usage
  lines, or fix instructions. There is no `vrt` binary and the old
  subcommand names are deprecated, so a fix instruction reading
  "Re-run `vrt a11y-contrast`" was wrong twice over.
- `check integrity` text-collision false positives: collisions are
  compared on measured ink bands rather than line boxes, text inside a
  closed `<details>` is not a collision candidate, and character-level
  grazes are reported by ink-overlap fraction. An 8-page × 3-viewport A/B
  against the previous revision found **0 new collisions and 16
  disappeared** — every one a pre-existing false positive the old
  area-ratio gate had been masking (MDN 14, from closed-`<details>`
  content that keeps its layout boxes; APG 2, from an element paired with
  its own inline descendant).
- `check integrity` no longer treats an invisible overlay as an occluder —
  found while running the gate against a real authenticated app.
- `verify markup` scored low-contrast fills as clean instead of detecting
  them.
- Numeric CLI flags are validated in one place, which fixed five bugs
  that had each been hand-rolled independently — including a `NaN`
  concurrency that made the worker pool silently run nothing and return
  holes, and `--min-reuse 2` printing `drift` next to a `COHERENT`
  verdict. `--gate "check a11y contrast"` no longer splits on the space.
- Gates no longer report on a page they did not measure: a redirect away
  from the requested URL (typically a login wall) is reported instead of
  silently measured, which previously produced `verdict: CLEAN` for a
  protected page that never rendered.
- `check interactions` and `scan handlers` waited only for `load`, so on
  client-rendered apps they inventoried the pre-render DOM — reporting
  `interactive elements: 0` and `status: ok` on a page with real controls
  and a pointer-only `<div>`. Both now settle before measuring.
- Horizontal-overflow kickbacks name the element actually at fault. The
  culprit is measured (neutralize its width, re-read `scrollWidth`)
  rather than ranked by right edge, which in grid/flex shells promoted
  stretched ancestors over the rigid child causing the overflow.
- `check copy` sees text inside open shadow roots, so component-library
  copy is no longer reported missing; hidden shadow copy is still
  classified by reason (e.g. `zero-size`).
- `check integrity` waits for `document.fonts.ready`, and detects text
  occluded by `pointer-events: none` overlays.
- `snapshot` and `scan breakpoints` now append to the run ledger.
- `unprobed-handler-types` counts only element-specific handlers, so a
  framework delegation root no longer lists ~80 event types as findings.

### Known issues

- **Other commands still print `vrt` in their output.** The four gates
  above were fixed because they were already in the release diff; a full
  sweep found roughly 250 occurrences across ~80 distinct phrases in
  user-facing strings (`vrt snapshot`, `vrt workflow`, `vrt diff-pr`,
  `vrt baseline` …). Most need only the binary name changed, but some
  refer to commands that no longer exist at all (`vrt compare`,
  `vrt elements`, `vrt smoke`) and some are prose. Deliberately left for
  its own change rather than folded into a release commit — a fix
  instruction you cannot paste is a real defect, and it deserves a diff
  someone can review.
## 0.8.1 — 2026-08-01

### Packaging hotfix

- Publish compiled JavaScript and declarations for every public workspace
  package instead of exposing raw TypeScript to Node.js consumers.
- Preserve the existing deep-import contract, fix the `vlmkit-plan` and
  `vlmkit-generate` executable targets, and include the generated MoonBit
  runtime required by `@mizchi/vlmkit-markup`.
- Add a clean-install smoke test that packs and exercises all seven public
  workspace packages before release.

## 0.8.0 — 2026-08-01

### Verified markup workflow

- Add contract-driven page scaffolding and deterministic `build page` /
  `verify markup` loops, including breakpoint, scroll, animation, copy,
  integrity, layout, and visual-equivalence checks.
- Add mock-image mode, stronger region pairing and presence analysis,
  attributed kickback diagnostics, and guarded Stage-2 auto-fix support.
- Harden markup verification against hidden text, occlusion, clipping,
  overflow, interaction regressions, and intentional-pattern false positives.

### Interaction verification and MCP

- Add accessibility event-state maps, handler-surface checks, and verified
  browser flows whose actions must satisfy explicit DOM post-conditions.
- Expose the deterministic verification surface through the bundled
  `vlmkit mcp` server while keeping the workspace MCP package internal.

### Packaging and reliability

- Bundle internal runtime packages into the root CLI and add a packed,
  clean-install markup-loop smoke test.
- Improve cold-start behavior, selector-heal calibration, package license
  coverage, and OpenRouter model selection.

## 0.7.0 — 2026-07-01

### Markup loop

- Add `vlmkit markup-loop init|observe|doctor|run` for drop-in
  real markup work: scaffold loop files, observe a live page with
  Playwright, check readiness, then run planner + generator + VRT gates.
- Add a reproducible local example under `examples/markup-loop-project/`
  that runs `init`, `observe`, `doctor`, and `run --dry-run` without an
  LLM API key.
- Ship `@mizchi/vlmkit-plan`, `@mizchi/vlmkit-generate`, and
  `@mizchi/vlmkit-heal` as runtime dependencies of the root package so
  installed agents can run the loop from a consuming project.

### Playwright generation

- Add planner and generator contracts for turning UI observations into
  gated Playwright smoke tests.
- Add guardrail context and VRT handoff summaries so generated tests can
  be evaluated and repaired without weakening the original scenario.

### A/B validation series (control vs vlmkit, external repo)

First controlled evaluation of the product claim "vlmkit makes a
coding agent better at visual repair": three runs on
`startbootstrap-agency` with a bare-handed control arm. Result: cost
parity once v1's friction was fixed, and a repair-quality edge for
vlmkit in v3 (3/5 vs 2/5 mutations, screenshot-free localization) via
the deterministic signal layer. The VLM `diff region` path was
net-negative in every run. Reports:
`docs/reports/2026-06-06-ab-external-synthesis.md` (+ v1/v2/v3).
Each fix below cites the agent complaint it answers
(`docs/issues-drafts/01-12`, 7 still open).

### `diff png`

- Reports baseline/current image dimensions and Δheight (a reflow
  indicator) in text and `--json` output. (draft 03)
- Per-region translation estimates: `shift: {dx, dy, confidence}` via
  mean-subtracted NCC of luminance profiles; semantic classifier
  reports "Content translated by (+36, +0) px" instead of
  `element-added` with meaningless identical color samples. (draft 04)
- `--elements-html <url>` / `--elements-json <path>` /
  `--elements-viewport <WxH>`: deterministic DOM hit-test attaches a
  `selectorCandidate` (selector, confidence, coverage) to every diff
  region — no VLM, no API key. (draft 07)
- Identical-hex color samples are omitted from descriptions; a
  measured in-place recolor is no longer masked by the wide-band
  "layout shift" shape hint.

### `diff region`

- Auto-downscales images so no edge exceeds `--max-image-edge`
  (default 7500; Anthropic rejects >8000px) and maps VLM bboxes back
  to original pixel coordinates. Fixes the crash on full-page mobile
  captures. (draft 01)
- `--max-tokens` default 600 → 1500; truncated responses
  (finish_reason=length or mid-JSON cut) retry once with doubled
  tokens. (draft 02)

### Internal

- `estimateRegionShift` in `@mizchi/vlmkit-core/region-shift.ts`.
- Region-bbox → DOM-selector matcher extracted to
  `@mizchi/vlmkit-markup/region-selector-match.ts` (shared by
  `diff png` and `vlm-region-diff`).
- `readPngDimensions` exported from `@mizchi/vlmkit-core/image-resize.ts`.
- A/B harness under `fixtures/ab-external/harness/` (seeded block
  deletion + value mutation `--mutate N [--subtle]`, deterministic
  capture, fixed scorer).

## 0.6.0 — 2026-05-19 (rebrand: vrt → vlmkit)

The project scope had grown well beyond visual regression. Markup
synthesis from screenshots, design-token / theme / a11y / i18n
audits, and a 2-stage VLM + LLM CSS auto-repair loop now account for
the majority of the surface. Rebrand the umbrella to **vlmkit**;
visual regression becomes one of several offered features.

### Breaking — package + CLI rename

| Old | New |
|---|---|
| GitHub repo `mizchi/vrt` | `mizchi/vlmkit` (auto-redirect in place) |
| `@mizchi/vrt` (root) | `@mizchi/vlmkit` |
| `@mizchi/vrt-core` | `@mizchi/vlmkit-core` |
| `@mizchi/vrt-capture` | `@mizchi/vlmkit-capture` |
| `@mizchi/vrt-ai` | `@mizchi/vlmkit-ai` |
| `@mizchi/vrt-markup` | `@mizchi/vlmkit-markup` |
| CLI binary `vrt` | `vlmkit` |
| `dist/vrt.mjs` | `dist/vlmkit.mjs` |
| Deprecation prefix `[vrt deprecated]` | `[vlmkit deprecated]` |

The `vrt verb …` CLI form is no longer supported as a binary
shortcut — type `vlmkit verb …` instead. (Inside the `vlmkit` CLI
the deprecation shims from 0.5.0 still work, e.g. `vlmkit png-diff
--help` forwards to `vlmkit diff png`.)

### Repository structure

`@mizchi/vrt@0.5.0` on npm is now deprecated. The current package
under that name is `@mizchi/vlmkit`. A future minor version will
carve out `packages/vrt/` as a leaf package containing the VRT-
specific subset (`snapshot`, `diff html`, regression-watch,
`diff-pr`, `baseline`, `watch`); see Phase 2 plan in the repo.

### State files preserved

The `.vrt/` state directory name is unchanged — existing users'
`.vrt/last-diff-for-agent.json` continues to work.

### Verified

- 776 tests / 11 dist smoke probes pass on the new structure.
- `vlmkit diff html` against `fixtures/element-compare/` runs
  end-to-end.
- All cross-package imports resolve under the new `@mizchi/vlmkit-*`
  scope.

---

## 0.5.0 — 2026-05-19 (first public release)

The internal 0.4.x history is preserved in commits; npm publication
starts here. Two work streams since `0.4.0` rolled up under this
release: the **0.5.0 CLI restructure + dispatcher rewrite** (this
section) and the prior **design-md / markup-assistance** sections
below.

### CLI restructure — verb groups

Every command now lives under a verb group. Single-token names from
0.4.x remain as deprecation shims that print a one-line hint and
forward.

| Old | New |
|---|---|
| `vrt compare` | `vrt diff html` |
| `vrt png-diff` | `vrt diff png` |
| `vrt elements` | `vrt diff elements` |
| `vrt cross-browser` | `vrt diff browsers` |
| `vrt diff-for-agent` | `vrt diff agent` |
| `vrt compare-runs` | `vrt diff runs` |
| `vrt a11y-{contrast,touch,focus-order}` | `vrt check a11y {contrast,touch,focus}` |
| `vrt design-tokens` | `vrt check tokens` |
| `vrt theme-parity` | `vrt check theme` |
| `vrt perf` | `vrt check perf` |
| `vrt {component,multi-page}-consistency` | `vrt check drift {component,pages}` |
| `vrt interact` / `vrt explore` / `vrt smoke` | `vrt inspect {interact,explore,smoke}` |
| `vrt i18n-stress` / `vrt media-variants` | `vrt stress {i18n,media}` |
| `vrt component-extract` | `vrt scan component` |
| `vrt component-from-image` | `vrt build component` |
| `vrt flipbook` | `vrt snapshot flipbook` |
| `vrt migration {compare,blind,subagent}` | unchanged (already grouped) |
| `vrt snapshot`, `vrt workflow`, `vrt manifest`, `vrt watch`, `vrt diff-pr`, `vrt baseline` | unchanged |

### Dispatcher rewrite for bundled `dist/vrt.mjs`

`src/cli/cli.ts` previously routed leaves via
`import.meta.resolve(<source-relative-path>)`, which only worked from
the source tree. The bundled binary failed with
`ERR_MODULE_NOT_FOUND` on every leaf. Rewritten in this release:

- SPECS is a `{ name, loader }` map where `loader` is a
  `() => import("literal-path")` closure. tsdown statically discovers
  the import and code-splits each leaf into a chunk under `dist/`.
- A per-leaf signal (`__VRT_DISPATCHER_LEAF__=<name>`) replaces the
  earlier `process.argv` swap. Each leaf's CLI-entry guard checks the
  env var against its *own* name, so cross-leaf static imports
  (e.g. `diff-pr.ts` ↔ `media-variants.ts` for shared types) don't
  accidentally fire a sibling's `main()`.
- `scripts/smoke-dist.sh` runs strict by default and gates every
  documented subcommand.

### Workspace packages published

`@mizchi/vrt-core`, `@mizchi/vrt-capture`, `@mizchi/vrt-ai`, and
`@mizchi/vrt-markup` all 0.5.0. Each ships raw `.ts` via the `exports`
map — consumers need Node 24+ with `--experimental-strip-types`, or a
bundler that resolves `.ts` extensions. The packages expose both a
curated barrel and deep per-module exports (e.g.
`@mizchi/vrt-core/png-diff.ts`).

### Agent skills (APM-distributable)

Five skill packs at `.claude/skills/`:

- `vrt-visual-diff` — `vrt diff html` → `vrt diff agent` workflow.
- `vrt-migration-eval` — `vrt migration compare|blind|subagent`.
- `vrt-markup-synth` — five DOM/pixel-based signal tools (no VLM).
- `vrt-regression-watch` — stateful `--previous` / `--persist-summary`.
- `vrt-css-fix-loop` — VLM + LLM 2-stage repair loop.

Install via `apm install mizchi/vrt/.claude/skills/<name>` (or pin to
`@v0.5.0`).

### Diff-report filename

`vrt diff html` / `vrt migration compare` now write both
`diff-report.json` (canonical, prefer this) and
`migration-report.json` (legacy alias, byte-identical). Pinning the
canonical name lets the legacy alias be removed in a future major.

### Repo / task-runner

Migrated from `justfile` to `Taskfile.pkl` (pkfire). Doc snippets
across the repo and CLAUDE.md now read `pkf run <task>`. Tasks that
take positional flags carry `acceptsArgs = true`; tasks with named
params use the `--<param> <value>` syntax.

---

## 0.5.0 — design-md scenario branch (2026-05-15)

A single branch of work — `claude/design-md-scenario-2026-05-15` —
turning vrt from a single-shot diff tool into a complete UI-regression
workflow. Driven by 9 closed-loop subagent runs (a → i) against a
DESIGN.md → HTML/CSS reproduction scenario; each run surfaced
friction, each friction got closed in code.

### Headlines

- **18 GitHub issues filed and closed** (#22 – #36, plus 3 drafts
  shipped as `vrt manifest` / `vrt watch` / `vrt diff-pr`).
- **38 commits, 183 tests across 32 suites.**
- Closed-loop floor moved from **10.3% mobile** (agent-a, original
  vrt) to **0.2% mobile** (agent-d, post-fix) on a 5-round budget;
  3-round budget reached **3.45% mobile** (agent-f).
- 4 a11y gate layers + 2 quality-extension gates added to the CI
  surface, all with manifest suppression.

### New top-level CLIs

| Command | Purpose |
|---|---|
| `vrt manifest add/list/rm/check` | Author the approval manifest. Per-rule kinds: `visual` (default), `a11y-contrast`, `a11y-touch`, `a11y-focus-order`, `a11y-semantic`, `media-variant`, `cross-browser`. `--from-run <output-dir>` synthesizes rules from a recent compare's wireframe-fix candidates. |
| `vrt watch <baseline> <variant>` | File-watcher inner-loop with round-vs-round delta (newly-introduced / resolved / persisted suggestions + zero-crossing detection). |
| `vrt diff-pr {pin,verify,post}` | CI gate. Per-route diff against pinned baselines; per-viewport thresholds; optional a11y + media-variants + cross-browser gates. |
| `vrt baseline {pin,verify,post,list,rm}` | Canonical alias over `vrt diff-pr` with two extra utilities (`list` / `rm`) for inspecting baseline state. |

### Wireframe fix suggestions (new "what to edit" layer)

When DOM correspondence is missing, vrt's compare now emits actionable
fix candidates with a layered scope hierarchy:

```
STRUCTURAL  >  REFLOW  >  HIGH-IMPACT  >  DIVERGENT  >  MAG-DIVERGENT  >  SUBSET  >  (all)
```

- `[STRUCTURAL]` — 3+ child suggestions share a parent path with
  heterogeneous deltas; names the specific parent layout-strategy
  mismatch (e.g. `display: flex (now) → grid (target)`); flags
  conflicting child margins that will compound with the new gap.
- `[REFLOW]` — one viewport's magnitude is ≥ 3× others; suggestion
  steers toward typography upstream rather than spacing tokens.
- `[HIGH-IMPACT]` — one suggestion's magnitude dominates the set
  (≥ 12px AND ≥ 1.5× the next-largest).
- `[DIVERGENT]` — opposite-sign deltas across viewports; needs a
  media query.
- `[MAG-DIVERGENT]` — same sign but materially different magnitudes;
  suggestion includes predictive overshoot ("applying 40px globally
  would overshoot mobile by 16px").
- `[SUBSET]` — observation covers only some viewports.

Plus per-suggestion annotations:

- `current → target` notation on candidate CSS rules — agent reads
  arrow left-to-right matching the natural edit direction.
- `[cascades to siblings]` on box-size-mutating candidates.
- `⚠ component height differs intrinsically` when bbox heights
  themselves differ.
- `⚠ N suggestions converge on .selector` (same-selector cumulative
  overshoot).
- `⚠ cross-edit: A + B all cascade-affect` (multi-selector cascade).

### CI gate layers (`vrt diff-pr`)

- **Visual diff**: per-route per-viewport pixel ratio against pinned
  baseline; per-route threshold overrides.
- **a11y gate**: contrast (WCAG 2.1) / touch-target size / focus-
  order (Tab cycling) / semantic (heading hierarchy / form-label /
  image-alt). Findings demoted by manifest rules.
- **Media-variants gate**: forced-colors / reduced-motion / print /
  rtl / zoom-200. Suspect / warn verdict counts gate.
- **Cross-browser gate**: chromium / firefox / webkit. Auto-skip on
  CI runners that don't have all three.

All gates emit a unified markdown `summary.md` suitable for
`gh pr comment --body-file`.

### Cross-round signals

- `vrt compare --against-previous <output-dir>`: emits per-viewport
  diff% change, newly-introduced / resolved suggestions, and
  zero-crossing detection (a component flipped sign → damp ~50%).
- `vrt watch` emits the same delta on every save event.

### Render correctness

- `vrt compare` file-mode no longer produces a false 0% PASS when
  the same `<link>` href fails to resolve on both sides (#22 — the
  bug that bit the first two agents in round 1).
- Render-sanity warnings (font 404, stylesheet 404) promoted to a
  red banner at the top; variant side now probed alongside baseline.
- Symmetric failures downgrade to a single dimmed line so diff
  numbers stay readable.

### Triptych output

Every per-viewport compare now emits a `<route>-<viewport>-triptych.png`
with `BASELINE | VARIANT | HEATMAP` panels labeled in color.

### DESIGN.md token integration

Pass `--tokens <path>` to `vrt compare` and hex pairs in the palette
diff back-resolve to token names; bbox magnitudes snap to the
nearest declared spacing token.

### Issues closed

| # | Title | Severity |
|---|---|---|
| #22 | False 0% PASS in `vrt compare` file-mode (3 stacked bugs) | critical |
| #23 | Token-aware fix candidates in wireframe mode | major |
| #24 | `BASELINE / VARIANT / HEATMAP` triptych PNG per viewport | minor |
| #25 | Default-on computed-style + DOM-position diff | major |
| #26 | Reverse hex → DESIGN.md token lookup | major |
| #27 | Render-sanity banner + variant probe | major |
| #28 | `migration-report.json` state-leak (duplicate of #22) | minor |
| #29 | Viewport scope tags (DIVERGENT / SUBSET) | major |
| #30 | Wireframe suggestions name candidate CSS selector | major |
| #31 | MAG-DIVERGENT classification | minor |
| #32 | Symmetric sanity banner downgrade | minor |
| #33 | Text-reflow detection (REFLOW scope) | major |
| #34 | Cross-suggestion overshoot aggregation | major |
| #35 | STRUCTURAL parent layout-strategy detail | minor |
| #36 | Cross-edit interaction warning (multi-selector cascade) | minor |

Plus three drafts shipped as new CLIs (`vrt manifest` / `vrt watch` /
`vrt diff-pr`).

### Reports

Detailed analysis of each validation run is under
`docs/reports/2026-05-15-design-md-scenario-v{1..9}.md`. Each
report quotes the agent's friction verbatim and records what was
fixed in response.

## 0.5.0 — Markup-assistance toolkit (2026-05-13)

A new suite of commands focused on the LLM-agent markup-authoring loop:
build from screenshot, verify a11y / theme / i18n / cross-browser
regressions, enforce design-system scales. The full scenario coverage
matrix is at `docs/reports/2026-05-13-scenario-matrix.md`; the
capability survey at `docs/reports/2026-05-13-capability-survey.md`.

### New commands

- `vrt component-from-image <target.png> <current.html>` — build a
  component from a target screenshot, iterate until pixel diff is
  low. Surfaces structured signals: bbox matches with IoU, heatmap
  region clusters with dominant fill + content-kind classification,
  text-row Δy with per-gap spacing-fix table, typography hints
  (estimated font-size / weight bucket), palette diff with
  near-neighbor distance, dominant background colors, and a
  multi-state pass (`--states hover focus-visible …`) that surfaces
  `suspect` / `_subtle_` / `ua-likely` / `direction?` flags. Optional
  `--device-scale-factor` for retina target captures.

- `vrt theme-parity <html>` — render under
  `prefers-color-scheme: light` and `dark`, flag components whose
  fill is identical across themes (hard-coded colors that defeat
  the theme switch).

- `vrt media-variants <html>` — render under five user-preference
  variants in one pass: `forced-colors`, `reduced-motion`, `print`,
  `rtl`, `zoom-200`. Each gets a heuristic verdict combining pixel
  delta with stylesheet-text static analysis (catches missing
  `@media (prefers-reduced-motion: reduce)`, `forced-color-adjust:
  none` opt-outs, physical-property usage that breaks RTL).

- `vrt cross-browser <html|url>` — render in Chromium, Firefox,
  WebKit. Engines not installed in the local Playwright cache
  auto-skip with `npx playwright install` hints.

- `vrt i18n-stress <html>` — inflate every text node by a factor
  (default 1.4× ≈ German), detect horizontal overflow / wrap / parent
  bounds violations. Dedupes ancestor reports.

- `vrt design-tokens <html|url>` — scale-conformance for
  `border-radius`, `padding`, `margin`, `z-index`, `box-shadow`.
  Configurable scales via CLI flags or JSON config. Per-violation
  report with nearest in-scale replacement.

- `vrt a11y-contrast <html>` — walks every visible text node,
  computes WCAG AA contrast ratio (4.5:1 normal, 3:1 large text),
  surfaces failures with foreground/background hex pairs.

- `vrt a11y-touch <html|url>` — interactive elements below
  44×44 (`--level AAA`) or 24×24 (`--level AA`) flagged with
  cluster-spacing check.

- `vrt a11y-focus-order <html|url>` — drives Tab through the page,
  detects visual-order mismatches (reverse / trap / skip-row).

- `vrt multi-page-consistency --selector <sel> --urls ... | --files ...` —
  drift check: same component across N pages.

- `vrt component-consistency <html> --selector <sel>` — drift check:
  N instances of selector on one page (catches inline-vs-component
  leak after refactors).

- `vrt interact <html|url> --sequence <path.json>` — scripted
  Playwright action sequence (snapshot / click / hover / focus /
  blur / press / type / fill / select / scroll / wait /
  waitForSelector). Per-transition pixel diff + heatmap regions.
  Per-row "dead" flag for actions that produced no visible change
  (selector miss or no-op detection).

- `vrt perf <html|url>` — Web-Vitals visual-stability check via
  in-page PerformanceObserver. Captures CLS / LCP / FCP / TTFB in
  ~3s without a Lighthouse dependency. CLS-source attribution
  surfaces the specific element triggering layout shift; LCP-element
  identity points at the largest contentful node. For full Web
  Vitals (TBT, INP, bundle size) defer to Lighthouse / PageSpeed.

### Infrastructure

- All new CLIs registered under the unified `vrt` dispatcher
  (`src/cli/vrt.ts` + `src/cli/router.ts`). Fixed a long-standing
  dispatcher bug where `process.argv[1]` was a relative path,
  silently breaking each module's `isCliEntry` check in dev mode.
- Smoke test (`scripts/smoke-all-clis.sh`) — runs every
  markup-assistance CLI on its fixture, asserts exit 0 + expected
  output. 15/15 PASS at HEAD.
- New fixtures under `fixtures/` for every command, each engineered
  to exercise a specific bug class:
  - `wireframe/pricing-card/` (component-from-image)
  - `multi-state/hover-button/` (multi-state)
  - `multi-page/footer-drift/` (multi-page-consistency)
  - `component-consistency/inline-leak/` (component-consistency)
  - `theme-parity/card-with-bug/` (theme-parity)
  - `i18n-stress/button-overflow/` (i18n-stress)
  - `media-variants/card/` friendly + hostile (media-variants)
  - `design-tokens/off-scale/` (design-tokens)
  - `a11y-contrast/low-contrast/`, `a11y-touch/small-targets/`,
    `a11y-focus-order/reversed/`, `typography/wrong-size-weight/`,
    `interact/dropdown-form/`

### Reports for review

- `docs/reports/2026-05-13-capability-survey.md` — what the toolkit
  can and can't do, ROI-ranked next directions.
- `docs/reports/2026-05-13-scenario-matrix.md` — 97 markup-flow
  scenarios × coverage status (currently 44 ✅ / 32 🟡 / 10 ❌ / 11 ⚪
  = 89% useful coverage).
- `docs/reports/2026-05-13-comprehensive-dogfood.md` — subagent
  evaluation of the integrated toolkit; identified 3 follow-up
  improvements (all shipped).

## 0.4.0 — Prior releases

(See git history for changes before this entry was added.)
