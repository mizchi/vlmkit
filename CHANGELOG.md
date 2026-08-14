# Changelog

All notable changes to this project will be documented in this file.
Dates are YYYY-MM-DD.

## Unreleased

The gates became a plugin architecture. A gate is now a declaration — id,
command, rule table, inputs, and four functions — handed to one core runner
that owns `--help`, `--json`, `--advisory`, the run ledger, the verdict and
the exit code. Every one of the 27 gates goes through it, including the two
that live outside `vlmkit-markup`, and a project can add its own gate with the
same standing as a bundled one. See
[`docs/design/gate-plugin-architecture.md`](docs/design/gate-plugin-architecture.md).

The visible payoff is that the exit-code contract `gate-exit.ts` has documented
all along is now true of every gate rather than of six of them, and that
suppression works per *rule* instead of per whole gate.

### Breaking

- **Eleven command modules no longer run when imported.** `snapshot.ts`,
  `detection-report.ts`, the four `demo/*` scripts and five experiment harnesses
  were bare `main()` functions that called themselves at the bottom of the file,
  so importing one for a type or a helper executed the command. Each now exports a
  named runner (`runSnapshotCli`, `runDetectionReport`, …) and guards its own
  invocation through the new `isCliEntry(import.meta.url, name?)`. Both dispatch
  paths are unchanged — the `vlmkit` dispatcher's env var and direct
  `node src/x.ts` — but a caller that relied on the import side effect must now
  call the exported function.
- **`runSnapshotCli` returns an exit code instead of assigning `process.exitCode`,
  and takes argv and cwd as arguments.** The same shape every gate has. A relative
  `--output` now resolves against the cwd it was given rather than the process's,
  which also fixes an inconsistency: the parser already resolved its *default*
  against that cwd, so an explicit `--output` and the default landed relative to
  different directories.

- **`formatGateVerdict` and `computeLandscapeClampByte` are removed.** The first named
  three consumers in its docstring — `verify markup`, `batch`, MCP — and all three
  build their own verdict instead; a helper whose every named consumer declined it is
  speculative, not shared. The second was a TS wrapper over a markup-core command with
  no caller and no entry in the migration parity harness, so the command and both its
  positional dispatch arms go with it (61 → 60 commands). The MoonBit function stays:
  `landscape_cell_hex` calls it and `core_test.mbt` covers it.

- **`runWorkflowCli` and the three `workflow/spec.ts` commands return an exit code
  instead of calling `process.exit`.** Sixteen `process.exit()` calls lived inside
  those command bodies. `runWorkflowCli` was typed `Promise<void>` while actually
  deciding whether `vlmkit workflow verify` failed, and `runSpecVerify`'s
  exit-1-on-failed-invariant — the whole point of the command — was observable only
  by dying. `runIntrospect`, `runSpecVerify` and `runExpect` now return `number`.
  Exit statuses through the CLI are unchanged.

- **`ExploreOptions.strict` is gone.** It never affected the measurement, only the
  verdict, so the decision moved to `runExploreCli`, which reads the counts the
  report now carries. `--strict` on the command line is unchanged.

- **The gate-authoring argv helpers moved from `@mizchi/vlmkit-markup` to
  `@mizchi/vlmkit-core`.** `firstPositional`, `runOutputDir`, `viewportFlag`,
  `numberList` and five others lived in `vlmkit-markup/src/gates/arg-helpers.ts`;
  they are now `@mizchi/vlmkit-core/plugin`. Every one is pure and imports only
  core, so the old location meant a plugin author took a dependency on the markup
  package to read argv. Import them from the plugin entry; the markup path no
  longer resolves.

- **A gate's prose honours the project's rule settings.** `format` takes an optional
  `RuleView` — one question, `effective(ruleId)` — so a gate that lists findings can
  render what the settings made of them. Before, `--rule low-contrast-text=off` printed
  `3 finding(s) suppressed by rule settings` **and then printed all three anyway**, and
  counted them on the verdict line, because the prose renders from the gate's own report
  while suppression happens on the runner's normalized list. `check integrity` honours it
  now: `off` disappears from both the list and the counts (the suppression count still
  prints, so it is silenced rather than hidden), `info` gets its own tier with its own
  icon instead of reading as a warning, and `suspect` promotes. Optional by design — a
  gate that ignores the argument renders exactly as before, so this is not a migration all
  27 must do at once.
- **`low-contrast-text` reports one finding per colour pair, not per element.** A
  three-row table used to produce three warnings differing only in the row index; three
  CSS colours produced eight lines across two gates. Identity is the colour pair plus
  the applicable floor, because that is the shape of the fix — one CSS declaration. The
  selectors still travel (`evidence.selectors`, and the first few named in the message),
  and the finding's canonical `selector` stays the first element so per-selector tooling
  and `--allow` are unaffected. `invisible-text` stays per element: it is a `fail` at
  that element, not a colour choice to revisit.
- **`check integrity`'s contrast floor now follows the text's size.**
  `low-contrast-text` cut at a flat 3:1, which is WCAG's *large-text* floor
  applied to every piece of text; it is now 4.5:1, or 3:1 for large text
  (>=24px, or >=18.66px at weight 700+). **A page that was `CLEAN` can now
  carry warnings.** The rule stays `warn`, so no gate newly *fails*, and the
  notice added below says a warn was let through. Found because `check
  integrity` and `check a11y contrast` disagreed about the same three elements
  at 3.03:1, with the reference-free gate giving the green. On this repo's own
  `fixtures/css-challenge/page.html` it surfaces three real AA failures.
- **Relative paths in `vlmkit.gates.json` resolve against the config file, not
  the process cwd.** Gate processes run in the config's directory and `source`
  globs expand from the same base, so a `--har`, a `--manifest` or a glob means
  the same thing wherever the command is typed. A config at the repo root is
  unaffected (base and cwd are the same directory); a config in a subdirectory
  changes behaviour, and previously only worked from its own directory.
- **`check a11y *` and `check drift component` default output directories gained
  a per-source subdirectory** (`test-results/a11y-contrast/page-e5562293/`).
  Two pages checked in a row used to share `report.md` *and* `page.png`, so the
  second silently replaced the first. Scripts reading the old fixed path need
  updating, or `--output-dir` pinned.

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

- **The test suite runs on vitest, with coverage.** `pnpm test` is `vitest run`;
  `pnpm test:coverage` reports v8 coverage into `test-results/coverage`. The
  migration changed no test's meaning — node:test and vitest agree on
  `describe`/`it`/`test`/`beforeEach`/`afterEach` and the assertions are
  `node:assert/strict` either way — so the same 2662 tests pass in the same
  ~222s. Three mechanical differences: `before`/`after` are `beforeAll`/`afterAll`,
  node:test's default export is `test` and vitest has none, and a per-test
  `context.after` is `onTestFinished`.
- **New tests for the plugin argv toolkit, image resize, the semantic drilldown's
  pure half, `check theme` and `stress media`** — the last two had no test at all,
  and neither is reachable from a pure function: both render the page repeatedly
  under different emulation and compare, so a fixture and a real page load are the
  only instruments. Statements 56.1% → 57.3%.

- **A declared plugin API: `@mizchi/vlmkit-core/plugin` and
  `@mizchi/vlmkit-core/plugin/browser`.** A third-party gate could always exist,
  but the entry point could not be found: an author deep-imported five internal
  files and guessed which counted as public. The first subpath carries exactly
  what the 27 bundled gates import — counted, not chosen — plus
  `PLUGIN_API_VERSION` so a published plugin can refuse a version it was not
  built for. The browser helpers are a second subpath because that is 17x the
  import cost (~25ms vs ~441ms more, before Playwright itself loads), and a gate
  that only reads a file should not pay it. `examples/gate-plugin/` uses those
  two and nothing else, with a test that fails if it ever reaches past them.
- **A declared deterministic layer: `@mizchi/vlmkit-markup/rules`.** Every gate
  is two halves — a `COLLECT_*` string evaluated in a page, and a pure judge over
  the plain-JSON samples it returns — which was the architecture from the start
  and was reachable only by deep-importing whichever file a gate happened to live
  in. 33 judges and 14 collector scripts now have one entry, so a project can run
  a rule from its own driver (Playwright, Puppeteer, CDP, jsdom), test a rule
  against its own fixtures without starting a browser, or reuse one inside a house
  gate. Purity is enforced by a test that inspects `process.moduleLoadList` after
  importing the barrel — verified to fail by injecting a browser import into a
  judge — and no `run*`/`format*` export is allowed in, since either would make
  that check depend on import order.

- **`gates run --json` returns the gates' own structured findings**, as
  `jobs[].gateReport` — verdict, counts and findings per gate — instead of one
  ANSI-escaped string of the child's terminal output. On the adoption scenario
  that is 24 addressable findings across three gates where there was one opaque
  blob. A child that printed prose rather than an envelope (a gate that died in
  navigation) falls back to `unparsedOutput`, so one early failure cannot cost the
  run its JSON.
- **`check a11y touch` and `check a11y contrast` take `--allow
  "<selector>;<reason>"`.** `check integrity` reports the same colours as a *warn*
  and has had a per-selector exemption for a while; `check a11y contrast` reports
  them as a *fail* and had none, so one approved brand grey forced the whole rule
  off — "red CI or contrast off, nothing between". Same three properties as every
  other exemption here: a reason is required, an exempted finding is still listed
  rather than subtracted, and a rule that matched nothing is reported. Three
  exemption parsers already existed, so the `<selector>;<reason>` form now lives in
  one place and `check design` uses it too.
- **`vlmkit gates` refuses a plan whose gates cannot start.** Seven gates declare a
  required flag (`check layout --contract`, `check story --gallery`, `check
  equivalence` declares two); `gates list` validated rule names and not those, so a
  job read as runnable and surfaced as `did not run` only after the browser work.
  Checked against the resolved command line, so a suppression that supplies the
  flag counts.
- **`gates init` scaffolds a `webServer` for a localhost source**, the same
  reasoning that already scaffolds the page-load flags for a URL. The command is a
  placeholder and the output says to replace it: a wrong command that looks
  configured would start something unrelated and gate whatever answered.
- **`scan handlers` reports a page that presents controls and registers no
  handlers at all.** It only ever inventoried elements that already had one, so a
  static document and a page of dead buttons both printed `registrations: 0 across
  0 element(s)` and `status: ok`. The control count is the denominator that was
  missing. The finding names all three explanations — inert controls, handlers it
  cannot attribute, or a page that needs none — because only one is a defect and
  this gate cannot tell which. `warn` by default.
- **`check design` says `NOT JUDGED` instead of `COHERENT` when no role had enough
  instances to judge**, and a role under `--min-instances` renders `not judged`
  rather than `ok`. Found by re-running the dogfood scenarios against the
  `--allow` flag added the day before: allowing 1 of 3 buttons leaves 2, under the
  default floor, so the role stopped being judged — and a skipped role printed
  identically to a coherent one, under a green verdict, with the row itself
  reading `reuse 1x, 2 one-off`. A fix for a false positive had introduced a false
  negative. The arithmetic is unchanged (two instances genuinely cannot clear a 3x
  floor); the silence is what is fixed. When `--allow` is what pushed a role under
  the floor the run says so and names the remedy — **both** `--min-instances 2
  --min-reuse 2`, since lowering the instance floor alone leaves a 2-instance role
  unable to reach 3x. New `nothing-judged` rule (info, so a small page is not a
  defect) makes it enforceable: `--rule nothing-judged=suspect` requires that this
  gate actually measured something. 124 rules across 27 gates.
- **A batch/`gates run` summary names the warns its passing gates found**
  (`24 warn(s) in 3 passing gate(s) — not shown above`) and the untracked paths
  the run created. `gates run` is the path a project adopts, and it reported only
  pass/fail: ten measured findings existed in child-process output nobody kept,
  and the per-gate first-write notice for `.vlmkit/` was invisible there for the
  same reason.
- **`vlmkit.gates.json` takes a `webServer` block** — start a dev server before
  `gates run`, stop it after, including on a thrown error or Ctrl-C. Playwright
  has had this for years and this config did not, so a config declaring URL
  sources still needed a wrapper script doing start / trap kill /
  poll-for-ready, once per CI job. v6's adopting agent got around it with a HAR
  recording and said the HAR was what made it moot. Shaped and named after
  Playwright's on purpose: `command`, `url`, `timeout`, `reuseExistingServer`,
  `cwd`, `env`. Two departures, both deliberate — `url` is **required** (there is
  no `port` alternative) because "started" has to mean "serving" or the first
  gate races the bundler and produces a flake indistinguishable from a finding;
  and a command that exits before the URL answers is reported with its exit code
  rather than after the full timeout, since a timeout is the wrong diagnosis for
  a command that never ran. `reuseExistingServer` defaults to true locally and
  false under CI, as Playwright's does. The server is spawned in its own process
  group and torn down as a group, so `npm run dev` → bundler → watcher does not
  survive as a held port. `vlmkit gates list` names the server without starting
  it, and `vlmkit gates run` never leaves one behind — a leaked server would be
  adopted by the next run via `reuseExistingServer`, silently gating a stale
  build, which is worse than the missing feature was.
- **A `rules` entry can carry `reason`, `owner` and `expires`, and an expired one
  is dropped.** `suppressions` had all three from the start; `rules` — the
  narrow, gate-agnostic instrument, and the one a false positive actually calls
  for — had none. v6's adopting agent: *"`suppressions` have `reason` / `owner` /
  `expires` and an expired one re-fails the build. `rules` has none of that. […]
  So the only mechanism for 'the tool is wrong about this rule' is the one
  mechanism with no audit trail and no expiry."* The long form is
  `{"setting": "warn", "reason": "...", "owner": "...", "expires": "2027-03-31"}`;
  a reason is required in it, and it resolves onto the same shape as a
  suppression, so `vlmkit gates suppressions` enumerates it (tagged `[rule]`),
  `--require-expiry` / `--require-owner` cover it, and past its expiry the
  setting stops being applied and the rule fails again. The short form
  (`"rule": "off"`) stays valid: `--rule` on the command line cannot carry a
  reason, so requiring one everywhere would leave the config unable to express
  what the CLI does. The `//`-prefixed comment key still parses, but a comment
  cannot expire and nothing enumerates it — prefer the long form.
- **`examples/vlmkit.gates.json` no longer recommends a threshold that cannot
  reach the case.** The payment-tiles entry used `--min-reuse 2` to approve
  deliberately per-provider button styling, which — reuse being an average —
  changes nothing on a small role; it is now `check design --allow`. The example
  also demonstrates the long-form `rules` entry at both scopes.
- **The run ledger is a declared output rather than a side effect:
  `--ledger <path>` and `--no-ledger` on every gate.** It has always been
  written to `.vlmkit/run-ledger.jsonl` with no flag, no mention in any output,
  and an env-var-only opt-out, so the only ways to find it were `ls` and reading
  the source. v6's adopting agent found it the first way and wrote the
  `.gitignore` by hand: "adopting the tool dirtied the repo silently." The
  **first** append — the moment the repo changes shape — now says what was
  created, that it is not ignored, what to ignore, and both flags. Subsequent
  appends say nothing, and nothing is printed when the path is already ignored
  or the directory is not a git repo. Implemented at the ledger module rather
  than in the runner, because 14 of the 16 call sites append from inside
  measurement functions and runner-only flags would have missed them.
- **`vlmkit gates init` writes the `.gitignore` entries** (`.vlmkit/`,
  `test-results/`) — the step the adopting agent had to do by hand. It appends
  and only adds what is missing; a `.gitignore` is someone else's file.
- **`check design` says how much of the page its verdict covers.** The old line
  was `skipped: 123 (no inferable role)` and nothing more, which cannot
  distinguish "this page is links and table cells" from "the measurement broke"
  — the reader's actual question. It now prints the fraction
  (`coverage: 18 of 141 visible element(s) carried an inferable role`), the
  skipped elements tallied **by tag** (`no role: a x37, td x21, div x19,
  span x18, ...`), and, only when something was skipped, where a role comes
  from at all: `role="..."` or `button`/`input`/`select`/`textarea`/`h1`-`h6`.
  `div`/`span`/`p`/`a` have none, so a large skip count is normal — the gate
  judges components, not every box, and the way to widen coverage is to add
  `role="..."` where an element *is* a component.
- **`check design --allow "<selector>;<reason>"`** declares one instance's
  deviation deliberate. `--min-reuse` was documented as the lever for this
  (`examples/vlmkit.gates.json` recommends `--min-reuse 2` for approved button
  variants) and cannot reach it: the metric is `instances / distinct styles`, an
  **average**, so a three-element role with one intentional variant sits at 1.5x
  and no threshold clears it short of `--min-reuse 1`, which disables the check.
  An allowed instance leaves the arithmetic before the average is taken, so the
  role's figure reflects the elements still under judgement, and it is still
  reported (`allowed: 1 button instance(s) declared deliberate and left out of
  the reuse figure`) — an exemption a reader cannot see is a blind spot, not a
  decision. Same syntax and same two properties as `check integrity --allow`: a
  reason is required, and a rule that matched nothing is named back
  (`1 --allow rule(s) matched nothing: ...`) rather than widening the blind spot
  in silence. A bare `*` is refused, because that is `--rule component-drift=off`
  without the runner's `re-tuned:` line to show it.
- **`snapshot strip` and `check animation --strip`** composite a numbered
  sequence into ONE still image. A flipbook animates; a strip has to be readable
  pasted into an issue or handed to a model, which sees one image and cannot
  press play. Frames sit top-left in a uniform cell, never centred — a
  `translateX` strip is read by comparing where the element sits, and centring
  would subtract exactly that offset. **Columns are shared instants on the page
  timeline**, not each animation's own 0->1 progress, which is what makes a
  stagger visible instead of reading as "all at once".
- **WebP output for strips**, chosen by the file extension alone
  (`--strip x.webp`). `@jsquash/webp` is an optional peer; lossless beats lossy
  on UI screenshots (24.0 KB vs 55.9 KB at q90), and `sharp` was measured and
  rejected at 29 MB for a still encoder already available.
- **The strip labels itself** — sample times across the top, `selector
  animation-name` above each row — from a 5x7 bitmap font drawn in-repo
  (`bitmap-font.ts`). Identical bytes on every platform, no fontconfig, no web
  font to race a screenshot. A sheet whose rows are identified only in the
  terminal is unreadable the moment it is pasted anywhere else.
- **`snapshot record-har <url>`** produces the recording `--har` replays.
  Defaults to `--wait-until load` rather than `networkidle` (the reason `--har`
  exists is a page with a held-open stream) and settles 1000ms for the late XHR
  a dashboard fires after the milestone. Prints the origins the file covers,
  because a HAR is keyed on the full URL.
- **`check drift component --allow "<property>[@<selector>];<reason>"`** declares
  a style difference deliberate, so a design system's variant stops making the
  gate permanently red. Modelled on `check integrity --allow` down to the two
  properties that keep it reviewable: an exempted delta is still listed, and a
  rule that matched nothing is reported. The unit is a *property*, not a finding
  kind, so a whole-instance exemption cannot hide the geometry mistake sitting
  next to the intentional colour.
- **`--timeout` / `--wait-until` / `--har` on every gate that navigates** — 0.9.1
  gave them to `check integrity` and `check design`; the other 19 URL-accepting
  gates could not be told otherwise, so the only way to gate a page that never
  reaches network idle was a hand-rolled Playwright harness. Declared once in
  `page-load.ts` and spread, with a test asserting **identity** with that
  fragment rather than equal text — a copy that starts out identical is still a
  copy, and that is how two gates came to be missing a hint the fragment gained.
- **`diff png --ignore-region`**: areas that are never measured, as distinct from
  areas whose differences are forgiven.
- **`stale-har-fixture` rule on `check integrity`** (rules 122 -> 123). A request
  a `--har` recording does not hold is aborted, so the page is measured without
  it; that is now reported against the fixture ("this is a stale fixture, not a
  broken page") instead of as the page's broken resources.

- **`vlmkit rules`** lists every gate with its rule count and plugin;
  **`vlmkit rules <gate>`** prints that gate's rules, default severities and
  docs. 125 rules across 27 gates.
- **`component-vrt` skill**, with copyable gallery reference implementations.
  Playwright's docs are explicit that the gallery is framework-specific and yours
  to own with **no template to copy**, which makes it the one part of the setup an
  agent cannot just be told to do. `.claude/skills/component-vrt/assets/` now ships
  it: a zero-dependency vanilla gallery that runs over `file://`, React and Vue
  galleries with `import.meta.glob` story discovery, the host page, a story file
  showing the hidden-form state pattern, the contract as a reference doc, and the
  1.62 CT config preset for projects that also want behavioural specs. Every
  template awaits layout (not just render) and freezes animation, because those are
  the two things that make a component screenshot flake. The vanilla gallery is
  byte-identical to `examples/story-gallery/index.html` and a test enforces that,
  so the installable copy cannot rot while the runnable example stays green.
- **`vlmkit check story`** — VRT scoped to one mounted component, for the repair
  loop where a full-page diff is the wrong instrument. Mounts a story in your
  Playwright component-testing gallery and screenshots only that component:
  measured on `examples/story-gallery/`, 30,448px across three stories against
  1,440,000px for the same count of full-viewport shots (**47x smaller**), and an
  unrelated story stays clean when a shared stylesheet changes. Reports region
  geometry and shift estimates so a ratio becomes an edit.

  It drives the gallery's **page-side contract** (`window.mount({ story, props })`
  / `window.unmount()` into `#root`) through `page.evaluate`, the same way
  Playwright's own `mount` fixture does — so it needs no spec files, no config
  dialect, and no Playwright version bump. The fixture itself is 1.62+; this is
  not, and Playwright stays a peer dependency vlmkit does not force forward.
  Several stories share one browser. `--props`, `--viewport`, `--threshold`,
  `--root`, `--settle`, `--update-baseline`. Runnable example and a React + Vite
  gallery to copy: `examples/story-gallery/`.

  It also reports a `sub-perceptual-drift` warn, which exists because the A/B
  measurement found the gate's one blind spot. A story diff is pixels only, and a
  comparator with a perceptual threshold scores a uniform low-amplitude recolour
  at 0.0%: measured on a hero whose gradient went from a blue tint to a purple
  one, **246,914 of 256,632 pixels differed, by at most 8/255 per channel**, and
  the ratio was zero. `diff html` catches that from its computed-style diff; a
  story diff has no equivalent, so the honest fix is to say what the pixels did.
  The rule keys on **coverage** (≥50% of pixels moved, max delta ≥2), because
  antialiasing moves edges while a recolour moves everything. It is a warn, so the
  comparator still owns the verdict — promote it in `vlmkit.gates.json` if tint
  drift is a regression for your project. This does not make `check story` a
  replacement for a page diff; see
  `docs/reports/2026-08-06-component-vs-page-vrt-signal.md`.
- **`vlmkit build gallery`** — the construction → maintenance handoff, which had
  been a manual checklist. `build component` converges markup toward a target it
  does not yet match; `check story` asks whether an edit broke a component that
  was already correct. Nothing converted one into the other, so a component that
  converged had no protection against the next edit unless someone remembered to
  hand-write a gallery, a story per component and per state, and a threshold.

  Point it at the page that just converged and it derives all of that:
  per-component rendered markup plus the page's CSS captured into a gallery
  implementing `window.mount` / `window.unmount`, `stories.json`, the
  `vlmkit.gates.json` fragment, and the `check story` commands to run.
  Deterministic — no VLM. BEM modifiers become variants of one component rather
  than separate components, and DOM state attributes (`disabled`,
  `aria-expanded`) become their own stories, so "a story per named state" comes
  from the page instead of from memory.

  **Each story gets its own `--threshold`, derived from a pixel budget rather
  than a shared ratio.** A ratio coarsens as area grows: 0.5% of an 88x36 button
  is 16 pixels, 0.5% of a 1216x203 hero is 1,234, so the default that catches a
  button regression misses a corner-radius change on a hero. `--noise-pixels`
  (default 24) is converted per story, clamped between a renderer-noise floor and
  the gate's own default — it will not loosen a gate, only tighten one.

  Discovery **proposes**: it groups by class, which is not the same as finding the
  boundaries a codebase wants, so every candidate carries its evidence (instance
  count, size, what it contains) and rejected ones say why. `--selector`
  (repeatable) overrides it; `--include-all` keeps the rejects. A stylesheet the
  browser will not expose is re-fetched by URL, and one that still cannot be read
  is reported loudly rather than skipped — a gallery missing its CSS produces a
  baseline that looks fine and is wrong.

  Captured markup is frozen, and the generated gallery says so: `props` are
  accepted and ignored, behaviour is not exercised. It answers "did this CSS or
  token edit change how the component looks". Prop- or runtime-state-varying
  stories still want a hand-written gallery — `component-vrt`'s `assets/`.
- **`check_story` and `build_gallery` MCP tools**, so component-scoped VRT is
  reachable from an MCP client and not only from the CLI. `check_story` is a
  `gateTool()` call (`--out` omitted: a per-call baseline directory would silently
  write a fresh baseline instead of comparing against the committed one).
  `build_gallery` is hand-written like `build_page`, because it returns an
  artifact rather than findings — but it still decides `failed`, on the two
  outcomes that leave the caller worse off than before: no stories written, or a
  stylesheet that could not be read. The gates-config fragment travels in the
  structured result so a client does not re-derive per-story thresholds and reach
  for one number for every component.
- **A `Component VRT` CI job** that runs the loop for real: generate a gallery
  from a committed page, write baselines, prove a clean re-run, then break one
  component and require a non-zero exit with no cascade to its neighbours. Both
  assertions are properties of a *different machine* than the one that wrote the
  baselines, which is the only way to know the render is reproducible in CI — and
  a suite that only ever sees passes cannot tell a working gate from one that
  always passes. Keyless and deterministic.
- **`vlmkit bench gates`** — where a ruleset spends its time. Runs every gate that
  works from a bare page (18 of the 26; the set is derived from each gate's
  declared `inputs`, not from a list) and reports cost beside yield: median /
  min / max, the measurement's share of the total, findings, rules fired out of
  rules declared, and ms per finding. Plus an attributed per-rule table and the
  list of rules that never fired. `--category`, `--repeat`, `--gate "<command>"`,
  `--md` / `--json`, `--out`.

  Per-rule cost is **attributed, not isolated**: a gate performs one measurement
  and every rule reads that same report, so rules cannot be timed separately —
  `run` is ~100% of a gate's wall clock and the projection across all 18 gates
  totals under a millisecond. `--probe-suppression` measures the consequence
  rather than asserting it: turning every rule off changes the runtime by 0.4%,
  i.e. nothing, because settings apply to the findings after the measurement.
  Baseline report: `docs/reports/2026-08-06-gate-rule-cost-bench.md`.
- **`--timing`** on every gate splits a run into `parse` / `run` / `findings` /
  `rules` / `format` / `ledger`. Opt-in even under `--json`, so the envelope stays
  byte-stable for equal inputs; `GateOutcome.timing` is always populated for
  in-process callers.
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

- **A navigation timeout says what it was waiting for.** The whole failure used
  to be `error: page load timed out (Timeout 30000ms exceeded)`. It now names the
  milestone, the still-open requests and how long each has been open, the flags
  that end the wait, and the one that will not help. Instrumented at the launch
  choke point rather than in a navigation helper: there are 42 `.goto(` call
  sites across 20 files and three hand-roll the same options object, so a fix in
  one helper reached a fraction of them.
- **A `--har` origin mismatch is named instead of crashing.** Replaying a
  recording made against one host or port at another aborts even the document
  request, which surfaced as a raw `net::ERR_FAILED` stack. It now reports the
  mismatch, the file, and the origins the file actually contains.
- **`gates run` tells a broken page apart from a broken run**, keyed on the gate's own
  banner rather than on a `verdict:` line — 4 of 12 gates (`check a11y contrast`,
  `check a11y touch`, `check a11y focus`, `check tokens`) print no such line, so the
  first version of this reported a gate that had measured the page and failed as
  `DID NOT RUN`. Four gates that
  all died in navigation used to print `4 FAILED (0 passed)` with no reasons and
  no distinction between "found defects" and "never ran". Now `0 FAILED, 2 DID
  NOT RUN` with the reason inline. The hint under the failure list no longer
  offers `--output <dir>` when `--output` was just passed.
- **`gates init` scaffolds a config that can run against a URL.** A `http(s)`
  source gets `--wait-until load --timeout 15000` on every gate, since a URL
  source implies the class of page that may never reach the default
  `networkidle` milestone — the old scaffold timed out on every gate.
- **`check integrity` no longer prints `CLEAN` over a run with warnings.**
  `verdict: NO DEFECTS, 3 WARN (...) — exits 0; --rule <id>=suspect to gate on
  one`. `report.verdict` keeps its two values; only the printed word gains the
  middle case.
- **Every gate's `--help` says how to persist a flag**: a `"gates"` entry in
  `vlmkit.gates.json` is the whole command, tokenized quote-aware, so any flag
  belongs there and is committed with the page. Only rule settings were
  documented as persistable before.
- **A `//`-prefixed key inside `rules` is a comment**, matching the convention this
  config already uses at the top level (`"//rules"`, `"//suppressions"`). It was
  rejected one level down, which is where a reason matters most: `suppressions` carry
  `reason` / `owner` / `expires`, and `rules` — the mechanism for "the tool is wrong
  about this finding" — carried none, so the justification could not sit next to the
  decision.
- **A live URL says it is unpinned.** A run whose source is `http(s)`, on a gate that
  accepts `--har`, with no `--har` passed, ends with one dim line naming the URL and
  the `record-har` command that pins it. Decidable without running anything twice,
  which is why it states the risk rather than measuring it.
- **A passing run with warnings says so, directly under the verdict**:
  `exits 0 — N warn(s) did not fail this command. To gate on one: --rule
  <id>=suspect`. Silent under `--json`. The runner inserts it after the gate's
  `verdict:` / `status:` line for all 27 gates rather than each gate appending its
  own, and falls back to appending for a gate with no such line. Appending alone
  had proved insufficient: `verdict: DRIFT` with exit 0 was resolved only by the
  last line of the output, below the findings.
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

- **`node dist/png-diff.mjs` printed nothing.** Fifteen modules still guarded their
  entry with `process.argv[1]?.endsWith("thing.ts")`, and nine of those tested for a
  `.ts` suffix only — so in the published `dist/` the direct-invocation branch was
  dead. The dispatched path (`vlmkit diff png`) always worked, which is why it went
  unnoticed. The same spelling also cannot tell suffix-sharing files apart:
  `src/vrt/snapshot/snapshot.ts`'s guard matched `src/cli/commands/snapshot.ts` too.
  All fifteen use `isCliEntry(import.meta.url, name)` now, and a test fails on any
  reintroduction.

- **The two CSS-corruption fixes had missed two more copies.** `css-challenge.ts` was
  a fork of `css-challenge-core.ts` carrying five local copies, and `fix-loop.ts`
  hand-rolled its own patcher — where it mattered most, since that is the
  fix-*application* path: a proposed fix for `color` on
  `.card { border-color: red; color: blue; }` rewrote `border-color` and left `color`
  untouched, and the apply-and-rollback gate then blamed the model. Four copies of the
  same two defects across three files; a rename (`removeCssProperty` →
  `removeCssLine`) was enough to hide one from every search.

- **`vlmkit workflow affected` said "(no git changes)" when it could not tell.** git
  failing means the change set is unknown, and reporting an unknown as an empty one
  says nothing is affected — the answer a caller acts on — about a project the command
  never inspected. It now distinguishes "git answered: nothing changed" from "git could
  not answer", returns 1 for the latter, and no longer lets `execSync` dump git's usage
  block to stderr.

- **Two constants that existed to prevent divergence were never used.**
  `GATE_EXIT_HELP` is documented as the shared `--advisory` help line "so every gate
  documents the contract identically", and the runner — its only call site — held a
  byte-identical copy of the string instead. `authStateNotice` was never called, so a
  gate could measure a page behind a login and say nothing about it;
  `VLMKIT_STORAGE_STATE` makes that the easy case, since no flag reaches the command
  line. Gates now print `auth: storage state from …` when a session was actually
  applied — read from `withAuthState` rather than from what was configured, so a gate
  that ignores auth never claims to have used one.

- **`vlmkit skill run` had been failing every check since 0.9.0.** It spawned
  `node --experimental-strip-types src/vrt.ts <tool>`, a path that stopped existing
  when the entry was renamed to `src/cli/vlmkit.ts` — so every check died in Node's
  module resolution, and even before the rename it could only work when the cwd
  happened to be a checkout of this repository. The entry now comes from
  `__VLMKIT_CLI_ENTRY__`, which the dispatcher already records. `KNOWN_TOOLS`, a
  hand-maintained copy of the command table used to *validate*, is gone: it still
  listed the pre-0.9 single-token names, so a skill naming a removed command passed
  validation and then failed at spawn. Those names survive as *aliases* (a skill file
  saying `a11y-contrast` still runs `check a11y contrast`), validation is the CLI's
  own "Unknown command", and multi-token commands spawn correctly. A launch failure
  is no longer rendered as a failing check — the report segregates checks that never
  ran, gives them no exit code, and the run exits 1 rather than 0.

- **Two CSS mutators in the css-challenge experiment could corrupt the sheet.**
  `removeCssProperty` matched a property name mid-token, so
  `.card { border-color: red; color: red; }` became `.card { border- color: red; }` —
  mangling a property the caller never named and leaving the named one in place, which
  puts the corruption in the experiment's ground truth rather than in a crash.
  `applyCssFix` concatenated onto a body with no trailing semicolon (legal CSS),
  producing `.card { color: red padding: 4px; }`. Neither was reachable from the
  current corpus — verified byte-identical output across all 2,391 declarations in the
  ten fixtures — so no recorded bench number changes. `css-challenge.ts`'s
  byte-identical copy of `applyCssFix` is deleted in favour of core's; the semicolon
  bug was in both.

- **`vlmkit inspect interact --help` exited 1.** Help and missing arguments printed
  the same usage and shared an exit code, so asking for help failed in any `&&` chain.

- **`check drift pages` stayed quiet about the worst drift there is.** A route the
  selector is absent from carries `diffRatio: NaN`, and the finding filter read
  `diffRatio > threshold` — false for NaN — so the gate exited 0 while its own
  markdown row said `_(selector missing)_` and its terminal summary printed `n/a`. A
  shared header or footer that vanished from one route was the only case it did not
  report. Now a second rule, `selector-missing` (warn), checked before the pass-line
  comparison; no threshold can express "absent". The ledger headline counts missing
  pages separately from drifting ones.

- **`inspect explore` measured the mouse instead of the handler.** The virtual
  pointer belongs to the page, not the document, so it survived the `setContent`
  that resets state between actions: each action's baseline still carried the hover
  highlight left on whatever element the *previous* action clicked, and the
  un-hover was measured as this action's delta. An inert `<span>` reported 0.28%
  with its changed region sitting on a different element; an inert `<button>`
  reported 0.42% from the pointer merely arriving, so a dead action — the thing the
  gate exists to find — read as alive. The pointer is now placed where it will be
  for the after-shot before the baseline is taken. Both inert elements measure
  exactly 0, and an action that does paint is credited only with what it painted.

- **`inspect explore` and `inspect interact` no longer set the host process's exit
  code from inside the measurement**, and no longer print from it. `runExplore`
  returns `deadActions` / `silentHandlers` / `failedActions`; `runInteract` returns
  `stepFailures`; `formatExploreReport` / `formatInteractReport` own the prose, and
  `runExploreCli` / `runInteractCli` return the code. Terminal output and exit
  status are unchanged.

- **`inspect interact` discarded every failed step.** A step that threw was printed
  once, the healer's suggestions with it, and then dropped — so all a consumer saw
  was a transition with a near-zero delta, which the report's own prose explains as
  "usually a sign the selector didn't match". It had the reason and threw it away.
  `InteractReport.stepFailures` now carries the step index, action, message and
  healer suggestions, and the markdown gains a "Steps that failed" section *above*
  the transitions, since a failed step is the reason a transition is dead.

- **`vlmkit workflow spec-verify` printed git's usage block in a non-git project.**
  `execSync` inherits stderr, so `git diff --name-only HEAD` outside a repository
  dumped forty lines of unrelated help above the verification. The failure was
  already handled; it just could not un-print what git wrote to the terminal.

- **An expected-scrollport contract with an empty `id` produced a blank label.**
  `??` treats `""` as present, so the positional fallback (`expected-1`) was
  unreachable and the report read `1 expected missing` while naming nothing.

- **`check a11y touch` measures identical siblings as separate targets.** Dedupe
  keyed on the generated CSS path, which three `<button>`s in one `<div>` share, so
  a whole toolbar collapsed into one element — and cluster detection, which compares
  each target against the *others*, had nothing left to compare against. Same
  pixels, and the verdict moved with the markup: distinct classes gave
  `inspected 3 | failures 3 | clustered 3`, identical markup gave
  `inspected 1 | failures 1 | clustered 0`. So the most common clustered case, a row
  of identical icon buttons, could never report a cluster. Its `usage` is corrected
  too: clustering annotates a finding and never causes one, the shorter side is what
  is measured, and WCAG's spacing exception is deliberately not applied.
- **One run writes one ledger.** The gate children run with the config's directory
  as their cwd, while the batch process appended to `process.cwd()`, so
  `gates run --config ../proj/...` from a sibling directory produced two ledgers in
  two places, each holding half the run.
- **A rule setting only reaches the gates it names.** Every setting was appended to
  every gate's command line, so `check copy` carried
  `--rule check.a11y.touch/target-undersized=off`, and one typo'd key printed the
  same config error once per gate. An unresolvable key is still passed through
  rather than dropped, because dropping it would turn a config error into a setting
  that quietly does nothing.

- **`page-overflow-x` carries the element it blames**, so
  `--allow "page-overflow-x@table.orders;…"` matches. It printed `caused by:
  table.orders` while leaving `selector` unset, so the only exemption that worked
  was page-wide — which silenced the whole rule, meaning accepting one known
  overflow accepted every future one. Set only where a single element was actually
  blamed; where rigid siblings mean no one element relieves the overflow there is
  nothing honest to put in the field.
- **A `webServer`'s output goes to stderr, not stdout**, so `gates run --json`
  parses. The spawn inherited stdout so a boot failure would reach the terminal —
  it still does, stderr being a terminal too — but stdout is the command's result
  and `--json` is a contract other tools parse.

- **`check animation` was blind to short animations and to finished ones
  entirely.** A `fill: none` animation is deleted from `getAnimations()` when it
  ends, so the gate saw 1 of 5 on a three-card entrance and drew a filmstrip of
  the wrong element. Animations are recorded and held at `animationstart`, with
  the author's own play state captured before the pause so "the page paused this"
  stays distinguishable from "we paused it". The strip's window is derived from
  the rows it actually shows, so neither an infinite spinner nor a *dead*
  animation sets the timebase.
- **`check motion` asserted a rule was absent from CSS it had never read.** A
  linked stylesheet on a `file://` document throws `SecurityError` on `cssRules`;
  that was swallowed and reported as "no `prefers-reduced-motion` found". It now
  re-reads the sheet (disk for `file:`, `page.request` for http(s)) and raises
  `unreadable-stylesheet` when absence is unproven.
- **`check drift component` judged text as drift.** Two instances of one
  component holding different copy differ in pixels and in height, and that is
  not drift; the verdict follows tracked computed style, with the pixel ratio
  kept as context and each row stating its own reason. `--threshold` was also
  doubling as the comparator's per-pixel tolerance, so raising the pass line
  moved the measurement — split into `--threshold` and `--pixel-tolerance`.
- **`check integrity` named the wrong cause for an overflow**, then looked
  exhaustive when it was not. First `130px wide; constraining it removes 46px`
  where the cause was `left: 660px`; now both terms, and no prescription of the
  one that is usually not the fix. It also states what the named cause does
  *not* account for — rigid siblings each measure 0 when probed alone, so a
  439px overflow could be reported with a 77px cause and read as the whole
  story.
- **`check design` said three things it did not mean.** The reuse figure was an
  average printed as a per-style claim, contradicting its own next sentence
  (`each style reused only 1.5x` ... `Dominant style, used 2x`); the style
  fingerprints hid which property actually differed; and `--exclude` appeared
  nowhere in the output that needs it. All three fixed, the last by noticing that
  a dominant style painting no text in a zero-padding, zero-radius, transparent
  box is vendor chrome and can be named as such.
- **`check a11y focus` could only run at one width.** It takes `--viewport WxH`;
  focus order is judged from each stop's x/y, so the width was always part of the
  question.
- **Ten gates measured unstyled markup.** `page.setContent(await readFile(f))`
  leaves the document at `about:blank`, so a `<link rel=stylesheet>` never
  resolves. All ten navigate to the source now.
- **The launch-failure advice pointed at the wrong Playwright** — a generic
  `playwright install` resolves to the consumer's copy, not the one that failed.

- **`check integrity` and `check scroll` wrote two ledger rows per run.** Their
  measurement functions still called `appendRunLedger` themselves after the
  migration gave their gates a `ledger`, so every run double-counted — and for
  `check scroll` both rows carried the same `tool` name, so no summary could tell
  them apart. It also bypassed `VLMKIT_NO_LEDGER` and the runner's
  `ledger: false`, which is how `verify markup` keeps its folded-in gates out of
  the ledger. The runner is the only owner now; `check-integrity`'s entry keeps
  the `fails` / `warns` split the removed row carried.
- **Value-taking flags placed before the positional could steal the source.**
  `vlmkit check equivalence --target t.png --region 0,0,10x10 attempt.html`
  parsed `t.png` as the attempt and compared the target with itself, and
  `vlmkit check copy --vlm <model> page.html` tried to open the model id as the
  page. `firstPositional` only skips the flags it is told about, and the migration
  from the hand-written parsers dropped `--target`, `--out` and `--vlm`. `--vlm`
  is optionally-valued so it needs `withoutOptionalValue`, which follows
  `vlmFlag`'s own rule — the two cannot disagree about which token is the model.
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
