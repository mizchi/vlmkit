# vlmkit CLI reference

The complete command reference. For "which command do I want" start
with the use-case map in the [README](../README.md#when-to-use-what)
or `vlmkit --help`; for task recipes and done-condition sets see
[`markup-assist.md`](./markup-assist.md).

The CLI is organized into verb groups. Run `vlmkit <group> --help`
for options.

| Group | Subcommands |
|---|---|
| `vlmkit diff` | `html`, `png`, `matrix`, `elements`, `component`, `browsers`, `agent`, `runs` |
| `vlmkit check` | `integrity`, `copy`, `layout`, `interactions`, `equivalence`, `asset`, `breakpoints`, `scroll`, `animation`, `motion`, `a11y {contrast,touch,focus}`, `palette`, `tokens`, `design`, `theme`, `perf`, `drift {component,pages}`, `crater` |
| `vlmkit scan` | `component`, `breakpoints`, `scroll`, `mock`, `handlers` |
| `vlmkit build` | `component`, `page` |
| `vlmkit verify` | `markup`, `flow` |
| `vlmkit contract` | `introspect`, `validate`, `scaffold` |
| `vlmkit heal` | `selector`, `markup` |
| `vlmkit inspect` | `interact`, `explore`, `smoke` |
| `vlmkit stress` | `i18n`, `media` |
| `vlmkit snapshot` | `[<url>...]`, `approve`, `fix-prompt`, `stability`, `flipbook`, `strip`, `record-har`, `report` |
| `vlmkit migration` | `compare`, `blind`, `subagent` |
| `vlmkit workflow` | `init`, `capture`, `verify`, `approve`, `graph`, `affected`, `introspect`, `spec-verify`, `expect` |
| Standalone | `vlmkit batch`, `vlmkit gates`, `vlmkit rules`, `vlmkit mcp`, `vlmkit watch`, `vlmkit manifest`, `vlmkit diff-pr`, `vlmkit baseline`, `vlmkit markup-loop`, `vlmkit api`, `vlmkit bench`, `vlmkit report`, `vlmkit skill` |

## Features

- **Pixel diff** — pixelmatch v7 + heatmap generation; per-region
  measured colors, translation estimates (`shift {dx, dy}`), and
  deterministic DOM selector candidates (`--elements-html`). This
  deterministic signal layer is the agent-facing core — see the
  controlled A/B evaluation in
  `docs/reports/2026-06-06-ab-external-synthesis.md`.
- **Computed style diff** — `getComputedStyle` capture including hover/focus states
- **A11y tree diff** — accessibility snapshot comparison
- **CSS challenge bench** — automated CSS deletion/recovery with detection rate tracking (96.7%)
- **2-stage AI pipeline** — VLM (image → structured diff) + LLM (diff → CSS fix)
- **Migration VRT** — compare HTML before/after across responsive viewports
- **Snapshot** — URL-based multi-viewport capture with baseline diff
- **Mask** — selector-based masking for dynamic content (animations, counters). Each
  `--mask` selector is validated in the page and injected on its own, so a malformed one
  cannot take the others with it, and the run warns about any that were invalid CSS or
  matched no element anywhere
- **Crater integration** — lightweight prescanner via BiDi (1.66x speedup,
  0% false positive) plus a layout-only JS/WASM backend.
- **Markup-assistance toolkit** (10+ commands): build from screenshot, theme-parity,
  i18n stress, a11y contrast / touch / focus-order, media-variant adaptations,
  cross-browser parity, design-token conformance, interaction sequences.
- **Self-healing Playwright tests** (`@mizchi/vlmkit-heal`) — a cost-optimized
  loop that runs a test, observes the failure, and patches the test (or updates
  a VRT baseline), escalating cheap → strong models under a shared budget cap.
  See [`packages/vlmkit-heal`](packages/vlmkit-heal/README.md) /
  [日本語ガイド](packages/vlmkit-heal/README.ja.md).
- **Playwright planning/generation contracts** (`@mizchi/vlmkit-plan`,
  `@mizchi/vlmkit-generate`) — runtime-neutral prompt/API layers for turning a
  user story + seed test + UI observations into `specs/<topic>.md`, then into a
  Playwright spec source file.


## Quick Start

The examples below assume the `vlmkit` command is already installed and available on your PATH.

```bash
pnpm install

# Run tests
pnpm test

# Compare two HTML files
vlmkit diff html before.html after.html --output reports/

# Render the diff into an agent-friendly Markdown report
vlmkit diff agent reports/diff-report.json > reports/diff.md

# Compare two existing PNG screenshots without Playwright
vlmkit diff png baselines/home.png snapshots/home.png

# Compare two URLs
vlmkit diff html --url http://localhost:3000/ --current-url http://localhost:8080/ \
  --output reports/

# Snapshot URLs (creates baseline on first run, diffs on subsequent runs)
vlmkit snapshot http://localhost:3000/ http://localhost:3000/about/ --output snapshots/

# Use explicit labels when URL-derived names are not ideal
vlmkit snapshot http://localhost:3000/issues?severity=critical --label critical-issues

# Fail CI when diffs or new baselines are detected
vlmkit snapshot http://localhost:3000/ --fail-on-diff --fail-on-new-baseline --max-diff-ratio 0.01

# Promote accepted snapshot diffs to the new baseline
vlmkit snapshot approve --output snapshots/

# Load snapshot targets from vlmkit.config.json
vlmkit snapshot

# Dev inner loop with rich signal output (token-aware + cross-round)
vlmkit diff html baseline.html variant.html --tokens DESIGN.md --output reports/
vlmkit watch baseline.html variant.html --tokens DESIGN.md

# Plan and generate a Playwright spec with diagnostics-driven retries
vlmkit-plan --title "Guest Checkout" --request-file specs/checkout.request.md \
  --observations specs/checkout.observations.json --out specs/checkout.plan.md \
  --locator-inventory-out specs/checkout.locators.json \
  --provider anthropic --max-attempts 2
vlmkit-generate --plan specs/checkout.plan.md --rules specs/_generation-rules.md \
  --locator-inventory specs/checkout.locators.json --helper-import ../support/goto-app \
  --out tests/checkout.spec.ts --provider anthropic --max-attempts 2 \
  --overwrite --gate-command "pnpm exec playwright test --list {testFile}"

# Drop-in markup agent loop for real UI work
vlmkit markup-loop init --topic checkout --title "Guest Checkout Smoke" \
  --base-url http://localhost:3000 --provider anthropic
vlmkit markup-loop observe
vlmkit markup-loop doctor
vlmkit markup-loop run --dry-run
vlmkit markup-loop run

# Reproduce the drop-in flow with a local example project
node examples/markup-loop-project/run.mjs

# Author approval rules (sub-pixel deviations, intentional design exceptions, etc.)
vlmkit manifest add --selector .hero__body --max-px 2 --reason "AA artifact" --expires 2026-08-15
vlmkit manifest add --a11y-contrast --selector "button" --reason "decorative" --expires 2026-08-15
vlmkit manifest add --from-run .vlmkit/runs/diff-pr/  # auto-acknowledge sub-pixel deltas
vlmkit manifest list

# CI gate — declare routes in vlmkit.config.json, pin baselines, gate per PR
vlmkit baseline pin                                       # on main
vlmkit baseline verify                                    # in PR
vlmkit baseline post --pr owner/repo#123                  # send summary.md as PR comment

# No URL to open? Start from PNGs — native renderers, or a broken headless capture.
vlmkit baseline pin    --from-dir captures/                # no browser launched
vlmkit baseline verify --from-dir current/                 # thresholds + summary + approvals
vlmkit baseline pin    --from-png f.png --route hud --viewport desktop

# Legacy internal-dogfood verification loop (vlmkit's own e2e suite)
vlmkit workflow init
vlmkit workflow capture
vlmkit workflow verify

# Workflow loop with external-project routes/config
vlmkit workflow init --config ./vlmkit.config.json
vlmkit workflow capture --config ./vlmkit.config.json

# Prepare a migration diff packet for an external fixer
pkf run migration-subagent-prepare -- --report test-results/migration/diff-report.json --output test-results/migration/subagent-task.md

# Attach VLM region-diff JSON/Markdown handoff files to a migration compare report
vlmkit migration compare before.html after.html --region-diff --region-diff-format both

# Measure success rate from before/after migration reports
pkf run migration-subagent-evaluate -- --before-report test-results/migration/diff-report.json --after-report test-results/migration/diff-report.after.json

# Inspect blind migration scenarios
pkf run migration-blind-list
pkf run migration-blind-show --scenario shadcn-to-luna
pkf run migration-blind-prepare --scenario shadcn-to-luna -- --packet test-results/migration/blind/shadcn-to-luna/task.md
pkf run migration-blind-solo --scenario shadcn-to-luna -- --output test-results/migration/blind/shadcn-to-luna/solo/after-blind.html --report-output-dir test-results/migration/blind/shadcn-to-luna/solo-report
pkf run migration-blind-evaluate --scenario shadcn-to-luna -- --before-report test-results/migration/blind/shadcn-to-luna/diff-report.json --after-report test-results/migration/blind/shadcn-to-luna/solo-report/diff-report.json --rounds 1

# Mask dynamic content
vlmkit snapshot http://localhost:3000/ --mask ".marquee-container,.hero-badge"

# Detect broken baseline renders (e.g. CDN failed to load) — on by default
vlmkit diff html --dir fixtures/migration/tailwind-to-vanilla \
  --baseline before.html --variants after.html
# Add --strict-baseline-sanity to exit non-zero when warnings fire,
# or --no-baseline-sanity to skip the check entirely.

# CSS challenge benchmark
pkf run css-bench --fixture page --trials 30
vlmkit bench --backend prescanner --fixture page --trials 20 --no-llm

# Fix loop (break CSS → VLM analyze → LLM fix → verify)
pkf run fix-loop --fixture page --seed 42
```


### Task runner & spec gates (pkfire / pkspec)

Tasks live in `Taskfile.pkl` (typed; replaces the previous bash
justfile). Specs live in
`Spec.pkl` (Goals + Scenarios) and `Test.pkl` (smoke implementations).

```bash
# List every available task
pkf list

# Run a task (mirrors any old `just <name>` invocation)
pkf run smoke-all
pkf run vrt-test

# Spec gates
pkf run spec-check    # pkspec check Spec.pkl Test.pkl
pkf run spec-render   # render Spec.pkl → docs/SPEC.md
pkf run spec-run      # execute every Test.pkl test
```

Install `pkf` / `pkspec` via nix flake:

```bash
nix run git+https://github.com/mizchi/pkfire -- list
nix run git+https://github.com/mizchi/pkspec  -- check Spec.pkl Test.pkl
```


## CLI Surface

### Diff (compare two things)

```bash
vlmkit diff html <baseline> <variant>          # HTML/URL pair → multi-viewport diff + report.json
vlmkit diff agent <report.json>                # Render report.json as agent-friendly Markdown
vlmkit diff png <baseline.png> <current.png>   # Direct PNG pixel diff + heatmap
  # per region: measured colorSamples, translation estimate (shift dx/dy),
  # image-size delta; add --elements-html <url> (or --elements-json <path>) for a
  # deterministic DOM selector candidate per region (no VLM, no API key)
  # --region-grid <px>   region-detection cell size; default adapts to the image
  #                      (32 at >=720px short side, 16 at >=480, else 8)
  # --elements-top <N>   report N attribution candidates per region, not just the winner
  # --ignore-region "<x>,<y>,<w>x<h>"   repeatable; area never measured
vlmkit diff elements [options]                 # Element-level diff with shift isolation
vlmkit diff browsers <html|url>                # chromium / firefox / webkit parity
vlmkit diff runs <dir...>                      # Aggregate multiple VRT runs into one table
```

### Snapshot (URL → baseline + diff)

```bash
vlmkit snapshot <url1> [url2] ...              # First run: baseline. Subsequent: baseline + diff
vlmkit snapshot approve                        # Promote *-current.png → *-baseline.png
vlmkit snapshot fix-prompt                     # Emit a subagent-ready prompt from snapshot-report.json
vlmkit snapshot stability <url...>             # Run N iterations and report false-positive rate
vlmkit snapshot flipbook                       # Diff three-frame (baseline ↔ current ↔ heatmap) HTML flipbooks
vlmkit snapshot report                         # Render snapshot-report.json as Markdown
```

### Integrity exemptions

```bash
# Accept an intentional pattern the tool does not recognise as one.
# Reason is mandatory; `;` separates it (so `#` stays available for ID selectors).
vlmkit check integrity page.html \
  --allow "near-misalignment@.badge;icon is optically centred" \
  --allow "text-collision@#refund@1280;deliberate graze, design sign-off DS-412"
```

An accepted finding is still printed, under "Exempted by --allow (your call)", and
a rule that matched nothing is reported so dead config gets deleted. Kinds that
mean the page is broken (`js-error`, `degenerate-render`, `unstyled-page`,
`redirected`) cannot be exempted. Put the rule in `vlmkit.gates.json` when it
needs an owner and an expiry — an expired suppression stops being applied.

For a URL that never reaches network idle, select a navigation milestone and
timeout explicitly. A HAR makes third-party responses reproducible and aborts
requests not present in the recording:

```bash
vlmkit check integrity http://localhost:3000/ \
  --wait-until domcontentloaded --timeout 60000 --har fixtures/app.har
```

#### Every gate that navigates takes these three

`--timeout`, `--wait-until` and `--har` are on **all 20 gates that open a page**, not just
`check integrity`. They come from one shared declaration (`PAGE_LOAD_INPUTS` /
`parsePageLoad` in `@mizchi/vlmkit-core/page-load.ts`), so a new URL gate gets them by
spreading it — and `src/cli/gate-page-load.test.ts` fails if it doesn't.

**An SPA that never reaches network idle can now be gated directly.** That was the reported
blocker: a page renders in ~480ms but one third-party request stays in flight forever, so
`networkidle` never fires and every URL gate timed out before running a single check. A slow
tile server does the same.

```bash
vlmkit check a11y touch http://localhost:5173/ --wait-until domcontentloaded --timeout 10000
```

**Lowering the milestone still waits for the render.** `domcontentloaded` alone would hand a
gate the pre-render DOM, and it would report the "loading…" placeholder as the page — so a
lowered milestone gets a bounded settle (idle wait, webfonts, one frame) before measuring.
That is what the hand-rolled capture harnesses were doing, and it is why you no longer need
one: serializing to static HTML first was lossy for canvas content and script-driven state.

Two exceptions, both deliberate:

- **`check perf` takes `--timeout` and `--wait-until` but rejects `--har`**, with a reason.
  Replay serves every response off local disk, so TTFB / LCP / FCP would measure disk reads —
  precisely the numbers the gate exists to produce, silently made meaningless. Note also that
  lowering its milestone moves the *start* of the `--observe` window, so the two numbers are
  not comparable across settings.
- **`check drift component` takes none of them.** It reads the file and sets content; nothing
  is navigated. Its input is spelled `<html-or-url>` and a URL has never worked — the `--help`
  now says so rather than leaving it to be discovered.

**`--har` aborts what it did not record**, deliberately: `fallback` would let the
never-settling request through and the run would hang exactly as before. The cost is that an
**incomplete HAR turns every un-recorded subresource into a failed request**, and on
`check integrity` that surfaces as `broken-image` / `failed-stylesheet` / `broken-font` — a
gap in the recording reading as a defect in the page. On the geometry and style gates it
changes the measurement rather than inventing a finding, which is subtler but the same class
of problem. Record completely, or leave `--har` off and use `--wait-until`.

#### Baselines from PNGs, with no URL (`--from-dir` / `--from-png`)

For the case where the frames exist but a page cannot be opened: a native renderer writing
PNGs, or a headless canvas capture that does not work (the reporter's Linux/Dawn build never
completes `copyTextureToBuffer` + `mapAsync`, and canvas screenshots come back transparent).
`diff png` already compares two files, but that is a one-shot — it has no per-route
thresholds, no markdown summary and no region-level approvals. `--from-dir` puts PNG-only
callers inside the real `baseline verify` workflow instead.

**File → route mapping.** Identity on disk is already the pair `(route.name, viewport
label)`, so nothing new was invented. A file matches only if its path equals one of these
for a **declared** pair:

| form | when |
|---|---|
| `<route>/<viewport>.png` | canonical — identical to the pinned layout, so `--from-dir <baselineDir>` round-trips |
| `<route>-<viewport>.png` | flat; the separator `snapshot.ts` already uses |
| `<route>.png` | only when exactly one viewport is declared, since otherwise the viewport is unknowable |

Matching is against the declared cross-product rather than by splitting on `-`, which is
what makes the flat form safe: `"form-app-mobile".split("-")` gives route `form`, while
comparing against `` `${route.name}-${vp}` `` does not. A stem two pairs both claim is
reported ambiguous, never guessed. Any disagreement is an error naming both sides — an
unmapped file, two files for one pair, or a declared pair with no file — and nothing is
pinned. Arbitrary renderer filenames use the single-file escape hatch
(`--from-png f.png --route r --viewport v`, both halves required); there is no sidecar
manifest to version.

**What verify can and cannot do from PNGs.** Working: pixel diff, per-route and per-viewport
thresholds, markdown summary, worst offenders, region-bbox approvals from `approval.json`,
exit code, run dir with heatmaps. Not possible without a page, and **reported as not
evaluated rather than passed**: a11y (contrast / touch / focus-order / semantic),
media-variants, cross-browser. A run that names one route prints
`**Partial run**: 1 of 2 declared route(s) checked` rather than letting the others show an
empty green row.

**File mode honours the viewport label as declared**, so `"viewports": ["frame"]` works — a
supplied PNG carries its own dimensions. The browser path still intersects labels with its
three built-ins; changing that would need real dimensions per custom label.

#### `check copy` without a DOM

Same input as image-only `check integrity`, for the same reason: canvas-drawn strings are
invisible to the DOM text-block walk, so the gate finds nothing to compare a manifest
against.

```bash
vlmkit check copy --elements elements.json --manifest copy.txt      # + optional --image frame.png
```

Each element's `text` is what the renderer drew; element order is treated as reading order
(top, then left) so a manifest line can span two adjacent drawn strings the way it spans two
text nodes in the DOM.

Three of the five copy rules run here; `redirected` and `copy-image-mismatch` need a
navigation result and a reference screenshot, and are named in the report's coverage block.
`copy-invisible` covers 2 of its 7 reason classes — `zero-size` and, with `--image`,
`unpainted` (a text bbox the frame shows as flat means the glyphs were never drawn: missing
font, alpha 0, skipped draw call). The other five need computed styles.

One rule is new and only fires here: **`copy-truncated`**. It needs `textMeasured` and a
`clip` rect, and it exists because the manifest matches the string the *renderer* reports —
so `Score: 1234567890` reads as satisfied while the user sees `Score: 12345…`. As in image
mode for `check integrity`, text wider than its box with no clip rect *overdraws* rather
than truncating, so a `clip` is required rather than assumed.

`--target`, `--vlm`, `--out` and `--storage-state` are **rejected** in this mode rather than
ignored, and there is no disclosure-state sweep (opening `<details>` and clicking tabs needs
a live page), which the coverage block states.

#### Masking areas that change every frame (`--ignore-region`)

Particles, noise and timer readouts change by construction. `baseline approve --region`
is the wrong instrument for them: it is an *approval*, so a permanently-noisy area
pollutes the approval history on every run and shows up in the `gates suppressions`
stocktake. `--ignore-region` is the other concept — **never measured**, rather than
measured and forgiven — and it writes no state, so it is absent from that stocktake by
construction.

```bash
vlmkit diff png base.png cur.png --ignore-region "0,300,640x60" --ignore-region "16,16,200x20"
```

**The ratio's denominator shrinks with the mask.** `diffRatio` is "the fraction of the
pixels that were actually measured which changed", i.e.
`imagePixels − ignoredPixels`. This is deliberate and it is the non-obvious part: with a
full-frame denominator, adding a mask would make every *unrelated* regression look less
severe than it did before the mask existed. Measured on a 640x360 frame — masking a
38400px particle band takes a real HUD recolor from 1.84% to 2.08%; under a full-frame
denominator the same regression would have read 1.74%, i.e. *better* than unmasked. The
trade-off is that a masked run's ratio is not directly comparable to an unmasked one's,
which is why the mask block always prints.

Ignored pixels leave both the diff count **and** region detection. Masking only the count
would leave a detected region with `diffPixelCount: 0`, which `--elements-json` would
then confidently attribute to an element.

Every masked run prints its own accounting, because a silently-shrunk diff is the
dangerous failure here:

```
  diff:     0.00% (0 / 226400 px measured)
  ignored:  1 region(s), 4000 px (1.7% of the 230400 px compared area) — never measured
    (16,16) 200x20 — 4000 px, 1800 of them differed
    1800 diff px discarded; denominator 230400 - 4000 = 226400
```

Note the last two lines: a mask that swallowed the entire finding still says how many
diff pixels it swallowed, and the denominator arithmetic is spelled out so
`compared − ignored = measured` is checkable. A rect that misses the frame prints
`0 px — outside the compared area, masks nothing` rather than looking applied. In the
heatmap PNG ignored pixels are painted pale blue, not white, so the hole is visible.

Not masked, deliberately: shift detection (`globalShift` / `shiftRegions`) reads per-row
luminance from the source images, and masking rows out of a row average would perturb the
numbers on unmasked rows too. A surviving region's `colorSample` also averages over the
source pixels — the mask governs what counts as a *difference*, not what a region's
colours are.

#### Without a DOM: canvas / WebGPU / native renderers

A canvas UI has one `<canvas>` element, so every `getBoundingClientRect` rule finds
nothing and the gate reports `clean` on a frame that may be visibly broken. Pass element
rects instead of a page — no browser, no DOM:

```bash
vlmkit check integrity --elements elements.json --image frame.png
```

`elements.json` is the same schema `diff png --elements-json` accepts (`path`, `tag`,
`top`, `left`, `width`, `height`), plus optional fields that each unlock one rule:

| field | unlocks |
|---|---|
| `text` | `text-collision` |
| `text_measured: {width,height}` + `clip: {top,left,width,height}` | `text-clipped` |
| `overlay`, `z_index`, `aria_hidden` | excludes layered / decorative text from collisions |

Containment comes from `path` prefixes (`hud[0]>bar[0]`), so protrusion, collapsed
containers and near-misalignment need no extra fields. Because the capture may omit
uninteresting nodes, findings name the **nearest recorded ancestor** rather than claiming
a parent.

**Six of eighteen rules are evaluable this way**, and the report lists the other twelve
with the reason each needs a DOM. That is deliberate: a `clean` verdict is only worth
what it rules out, so the gap is printed next to the verdict rather than left implicit.
`--elements` and a page source are mutually exclusive — the two modes evaluate different
rule sets, so a combined run's verdict would be ambiguous.

Text drawn wider than its box is **not** reported as clipped unless a `clip` rect says so:
on a canvas that overdraws, which the collision and protrusion rules cover.

### Check (gates: a11y / tokens / design / theme / perf / drift)

```bash
vlmkit check a11y contrast <html|url>          # WCAG AA contrast scan
vlmkit check a11y touch    <html|url>          # Touch target size (WCAG 2.5.5 / 2.5.8)
vlmkit check a11y focus    <html|url>          # Tab order vs visual order
vlmkit check palette       <target.png> [current.png]  # Dominant colors, or palette diff (missing/extra hex)
vlmkit check tokens        <html|url>          # radius/spacing/z-index/shadow scale conformance (declared scale)
vlmkit check design        <html|url>          # coherence of the scale the page itself implies (no config)
vlmkit check theme         <html|url>          # prefers-color-scheme dark / unthemed components
vlmkit check perf          <html|url>          # Web Vitals (CLS / LCP / FCP)
vlmkit check drift component <html> --selector .card
vlmkit check drift pages     --selector .footer --files A.html B.html C.html
```

Exclude vendor-owned subtrees before `check design` computes role reuse and
spacing. Every selector and root match count is reported; unmatched selectors
are warned:

```bash
vlmkit check design <html|url> --exclude ".maplibregl-ctrl" --exclude ".embed"
```

### Batch (many pages, one glob)

```bash
# Run a gate over every matched page; verdict per page is that run's exit code.
vlmkit batch --gate "check integrity" "routes/**/*.html"

# Several gates, wider pool, logs kept for CI.
vlmkit batch --gate "check integrity" --gate "check design" "dist/**/*.html" \
  --concurrency 4 --output ci-logs/

# One shard of three runners (stride-sliced, so neighbouring pages split up).
vlmkit batch --gate "check integrity" "routes/**/*.html" --shard 2/3
```

Measured concurrency / sharding numbers and the reason the summary reports
"jobs in flight" rather than a speedup:
[`docs/reports/2026-08-02-batch-runner-ci-budget.md`](./reports/2026-08-02-batch-runner-ci-budget.md).

### Gates config (per-page gate sets + auditable suppressions)

```bash
vlmkit gates init --pages "routes/**/*.html" --gate "check integrity"
vlmkit gates list            # resolved page x gate plan, exact commands, no run
vlmkit gates run             # run it (same pool/sharding as `batch`)
vlmkit gates suppressions    # every silenced check: reason, owner, expiry, days left
```

`vlmkit.gates.json` holds which gates run on which pages plus every
suppression. Two rules make it reviewable: a suppression **must** carry a
`reason` (parsing fails without one), and an **expired** suppression stops
being applied — the gate it silenced runs unmuted and the run exits non-zero,
because a stale entry is a config defect even when the page now passes.
Worked example: [`examples/vlmkit.gates.json`](../examples/vlmkit.gates.json).

An optional `webServer` block starts a dev server before the run and stops it
after — including on a thrown error or Ctrl-C — so a config with URL sources is
committable on its own instead of needing a wrapper script that does start /
trap kill / poll-for-ready. Shaped after Playwright's, deliberately:

```jsonc
{
  "webServer": {
    "command": "npm run dev",
    "url": "http://localhost:5173/",   // required, and polled until it answers
    "timeout": 60000,                  // default 60000
    "reuseExistingServer": true,       // default: true locally, false under CI
    "cwd": "app",                      // relative to the config file
    "env": { "NODE_ENV": "test" }
  },
  "pages": [{ "source": "http://localhost:5173/" }]
}
```

`url` is required because "started" has to mean "serving": without a readiness
probe the first gate races the bundler, and a flake there is indistinguishable
from a real finding. Any HTTP status counts as ready, including 404 — the
question is whether something is listening. If the command exits before the URL
answers, the error reports its exit code rather than spending the timeout and
then blaming the timeout. `reuseExistingServer` follows Playwright's default for
Playwright's reason: locally a listening port is your own `npm run dev`, while in
CI it is usually a leak from an earlier job, and adopting it would gate a build
nobody asked about. `vlmkit gates list` names the server without starting it.

### Rules (tune or disable one rule, not one whole gate)

```bash
vlmkit rules                      # every gate, grouped by the kind of question it answers
vlmkit rules --json               # the whole catalog, machine-readable
vlmkit rules check integrity      # that gate's rule ids, default severities, docs
vlmkit check integrity page.html --rule check.integrity/near-misalignment=off
vlmkit check breakpoints page.html --rules   # same table, from the gate itself
```

`vlmkit rules` groups by **category** — `correctness`, `behavior`,
`design-system`, `verdict`, `infrastructure` — not by CLI verb, because
`check`/`scan`/`stress` says how a command is spelled and a category says what a
failure means (`scan scroll` and `check breakpoints` answer the same kind of
question). `--json` emits `{ categories, gates: [{ id, command, title, summary,
category, plugin, rules }] }`, which is what a job that wants "fail the build if
a gate appears un-triaged" should read.

A gate declares its rules, so a rule is addressable: `<gateId>/<ruleId>` set to
`off`, `suspect`, `warn` or `info`. Persist the decision under `"rules"` in
`vlmkit.gates.json`, at `defaults` scope or per page (page keys merge over
defaults). Each entry takes either the bare setting or the **long form**, which
carries `reason` (required in that form), `owner` and `expires`:

```jsonc
{
  "defaults": {
    "rules": {
      "check.breakpoints/overflow-at-boundary": "suspect",
      "check.integrity/low-contrast-text": {
        "setting": "warn",
        "reason": "Brand grey is 4.1:1; signed off pending the 2027 palette refresh.",
        "owner": "design-system",
        "expires": "2027-03-31"
      }
    }
  },
  "pages": [
    { "id": "docs", "source": "routes/docs/**/*.html",
      "rules": { "check.integrity/near-misalignment": "off" } }
  ]
}
```

The long form resolves onto the same shape as a suppression, so
`vlmkit gates suppressions` enumerates it (tagged `[rule]`), `--require-expiry`
and `--require-owner` cover it, and **past its expiry the setting is dropped and
the rule fails again** — the contract suppressions have always had. Reach for it
whenever the answer is "the tool is wrong here" rather than "this rule is not for
us". The short form stays valid because `--rule` on the command line cannot carry
a reason, and a config that cannot express what the CLI does would be worse.

References are validated against the declared table, so a misspelled rule is a
config error rather than a line that silences nothing. Suppressed findings are
reported as suppressed next to the verdict — a gate that passes because three
rules were turned off says so.

Every gate shares one exit-code contract and one `--json` envelope: a suspect
exits 1, `--advisory` prints and exits 0, `--fail-on-suspect` is an accepted
no-op, and the JSON is always

```jsonc
{ "gate": "check.integrity", "command": "check integrity",
  "verdict": "fail", "counts": { "suspect": 2, "warn": 1, "info": 0 },
  "findings": [ … ], "suppressed": [ … ], "retuned": [ … ],
  "report": { /* the gate's own report, verbatim */ } }
```

so a client gates on `verdict` / `counts` without knowing which gate ran. All
27 gates are registry-driven; `vlmkit rules` lists them. Commands that produce
artifacts rather than verdicts (`diff`, `build`, `contract`, `snapshot`, …) are
not gates and keep their own flags.

### Component-focused VRT (`check story`)

```bash
# Mount one story from your Playwright component-testing gallery and diff
# ONLY that component. First run writes the baseline.
vlmkit check story components/Button/Primary --gallery http://localhost:5173/playwright/gallery/index.html

# Several stories, one browser.
vlmkit check story components/Button/Primary components/Card/Default --gallery "$G"

# Props, a smaller viewport, a looser threshold, a different mount root.
vlmkit check story components/Button/WithTitle --gallery "$G" --props '{"title":"Hello"}'
vlmkit check story components/Button/Primary --gallery "$G" --viewport 400x300 --threshold 0.02
vlmkit check story components/Button/Primary --gallery "$G" --update-baseline
```

For repairing one component, a full-page diff is the wrong instrument: the image
is large, it cascades (nudge a header and every row below reports as changed), and
the part under repair is buried in the part that is not. `check story` screenshots
the mounted component only — measured on `examples/story-gallery/`, 30,448px
across three stories against 1,440,000px for the same count of full-viewport
shots, **47x smaller** — and an unrelated story stays clean when a shared
stylesheet changes.

It drives the **gallery's page-side contract** directly, via `page.evaluate`, the
same way Playwright's own `mount` fixture does:

```js
window.mount({ story, props })   // renders into #root, rejects on failure
window.unmount()
```

So it needs no spec files, no config dialect, and no particular Playwright
version — the `mount` *fixture* is 1.62+, this is not, and vlmkit keeps Playwright
as a peer dependency it does not force forward. It does require those two
functions on `window`: a page that merely renders one component per URL is not
enough (Storybook exposes no `window.mount` and would need a shim).

Three rules, and the distinction between the first two matters: `story-drift` is
the finding you asked for, while `mount-failed` means *nothing was measured* — an
unknown story id, a render throw, a page that is not a gallery. `new-baseline` is
a `warn` rather than a pass, because a gate that accepts whatever it first sees
cannot fail on the run that matters.

Baselines live in `.vlmkit/stories/<story>/<viewport>.png`, keyed on the story id
**as written** (the gallery owns resolution and the contract offers no way to ask
what an id resolved to, so `Button/Primary` and `components/Button/Primary` get
separate baselines — pick one spelling and list it in `vlmkit.gates.json`).

Runnable example plus a React + Vite gallery to copy:
[`examples/story-gallery/`](../examples/story-gallery/).

### Cost (which gates and rules your CI is paying for)

```bash
vlmkit check integrity page.html --timing        # per-phase ms for one run
vlmkit bench gates page.html                    # every page gate, ranked by cost
vlmkit bench gates a.html b.html --repeat 5 --probe-suppression --md
vlmkit bench gates page.html --category behavior
vlmkit bench gates page.html --gate "check breakpoints --sweep"
```

`--timing` splits a run into `parse` / `run` / `findings` / `rules` / `format` /
`ledger`. It is opt-in even under `--json`, so the envelope stays byte-stable for
equal inputs.

`vlmkit bench gates` runs every gate that works from a bare page — its positional
input is a page and nothing else is required, which is 18 of the 26 — and reports
cost next to yield: median/min/max, the measurement's share of the total,
findings, rules fired out of rules declared, and ms per finding. Name the other
eight explicitly with `--gate`, arguments included.

**Per-rule cost is attributed, not isolated.** A gate performs one measurement and
every rule it declares reads that same report, so rules are not separately
executed and cannot be separately timed — measured on this repo, `run` is ~100% of
a gate's wall clock and the projection across all 18 gates totals under a
millisecond. Two things follow, both easy to guess wrong:

- **`--rule x=off` does not make a run faster.** Rule settings apply to the
  findings *after* the measurement, by design, so a silenced finding can still be
  reported as silenced. `--probe-suppression` measures this instead of asserting
  it.
- **The cost unit is the gate.** To spend less, drop a gate or narrow its inputs
  (fewer viewports, no `--sweep`, a shorter `--observe`). Pruning rules buys
  clarity, not time.

Measured baseline: [`docs/reports/2026-08-06-gate-rule-cost-bench.md`](reports/2026-08-06-gate-rule-cost-bench.md)
— a full sweep is ~30s serial per page and four gates are 60% of it.

### Custom gates (plugins)

```jsonc
// vlmkit.config.json
{ "plugins": ["./tools/house-gates.ts", "@acme/vlmkit-brand-gates"] }
```

A plugin module default-exports `definePlugin({ name, gates })`, where each
gate comes from `defineGate({...})`. A plugin gate is indistinguishable from a
bundled one: it appears in group help and `vlmkit rules`, dispatches as
`vlmkit <group> <leaf>`, and inherits the shared `--json` / `--advisory` /
`--rule` behaviour, the run-ledger entry, and `vlmkit.gates.json` validation.
Relative specifiers resolve against the config's directory, not the cwd.

The bundled gates load the same way, from three plugins — `@mizchi/vlmkit-markup`
(24 gates), `@mizchi/vlmkit-capture` (`check crater`) and the app itself
(`check perf`) — so there is no privileged built-in path to diverge from.

**Adding your own metric: [`docs/authoring-gates.md`](authoring-gates.md)** —
the contract field by field, choosing severities and a category, reading project
config, measuring in a browser, testing, and publishing.

Runnable examples: [`examples/gate-plugin/`](../examples/gate-plugin/) — a
project with its own `vlmkit.config.json` and two gates,
[`house-gates.ts`](../examples/gate-plugin/house-gates.ts) (the smallest useful
one) and [`dom-budget.gate.ts`](../examples/gate-plugin/dom-budget.gate.ts) (the
shape a real house metric takes: render, measure, compare against budgets).
Design and migration status: [`docs/design/gate-plugin-architecture.md`](design/gate-plugin-architecture.md).

### Build / Scan / Inspect / Stress (markup-assistance)

```bash
# Build component from a target screenshot, iterate until close.
vlmkit build component <target.png> <current.html>
  # signals: bbox + heatmap regions + dominant fill + typography hints
  # + spacing-fix table + palette diff + multi-state suspect flags.

# Page-level multi-component composition diff.
vlmkit build page <target.png> <current.html|current.png> [--crop dir/] [--json]
  # Pairs component bboxes spatially (rank-free), reports per-component
  # position/size/fill deltas, missing/extra components, section ordering,
  # stacking-gap deltas. --crop writes target/current crop pairs so each
  # component can be drilled into with `build component`.

# Converged page -> story gallery: the construction -> maintenance handoff.
vlmkit build gallery <html|url> [--out dir/] [--selector .c-card] [--include-all] [--json]
  # Deterministic (no VLM). Captures each component's rendered markup plus the
  # page's CSS into a gallery implementing window.mount/unmount, writes
  # stories.json, and prints the vlmkit.gates.json fragment plus the
  # `check story` commands to run.
  #
  # Two things worth knowing before using the output:
  #   - Discovery groups by class and PROPOSES. Every candidate carries its
  #     evidence (instances, size, what it contains); rejects say why.
  #     --selector overrides it, --include-all keeps the rejects.
  #   - Each story gets its own --threshold, derived from a pixel budget
  #     (--noise-pixels, default 24) rather than one ratio for every component:
  #     0.5% of a button is a few pixels, 0.5% of a hero is over a thousand, so
  #     a single ratio protects small components and not large ones.
  #
  # Captured markup is frozen: --props do nothing and behaviour is not
  # exercised. For prop- or state-varying stories, hand-write the gallery from
  # the component-vrt skill's templates.

# Detect components in a screenshot.
vlmkit scan component <screenshot.png>         # Crop to standalone PNGs
  # --top-n <N>          max components returned (default 8) — see the note below
  # --min-area <px>      min filled px per component (default 200)
  # --preset game-ui     = --min-area 24 --top-n 24, for small high-contrast frames
vlmkit scan breakpoints <html-file>            # Discover responsive breakpoints
vlmkit scan scroll <html|url>                  # Annotation-free scroll inventory: real scroll containers
                                               # (axis / overflow px / bbox), unintended page overflow-x
                                               # with offenders, overflow:hidden cut-off suspects, nested
                                               # scrolling; --json emits UI Contract expectedScrollports

# UI Contract IR: extract from existing markup, validate, or compile to a scaffold.
vlmkit contract introspect <html|url> --out ui.contract.json
vlmkit contract validate   ui.contract.json
vlmkit contract scaffold   ui.contract.json --out dir/
  # Emits <screen>.scaffold.html: semantic landmarks + grid/flex CSS from
  # layout policies + responsive @media rules + slot/marker placeholders.
  # Round-trips: introspecting the scaffold recovers the contract's landmarks.

# Heal a selector that no longer matches (ranked replacement candidates).
vlmkit heal selector <html|url> ".broken-selector"

# Scripted / exploratory interaction.
vlmkit inspect interact <html|url> --sequence <path.json>
vlmkit inspect explore  <html|url>             # Auto-discover declared actions and diff each
vlmkit inspect smoke    <html|url>             # A11y-driven exploratory smoke test

# Checks.
vlmkit check motion <html|url>                 # CSS motion / reduced-motion detection (declarations)
vlmkit check animation <html|url>              # Frame-sampled animation evaluation: pause + seek each
                                               # animation (CSS @keyframes / transitions / element.animate,
                                               # no page instrumentation), verify it visibly moves pixels,
                                               # report motion bbox, settle time, infinite animations (VRT
                                               # mask hints), behavioral prefers-reduced-motion parity, and
                                               # uncontrolled motion (rAF/video/GIF) that WAAPI can't pause
vlmkit check breakpoints <html|url>            # Boundary quickcheck: render at B-1/B/B+1 per discovered
                                               # breakpoint and verify each discrete style property at B
                                               # matches a neighbor — catches off-by-one media queries
                                               # (a width styled by neither/both regimes), elements that
                                               # vanish exactly on the boundary, overflow at boundary widths
vlmkit check crater                            # Crater BiDi backend smoke check

# Stress tests.
vlmkit stress i18n  <html>                     # Text-node inflation overflow detection
vlmkit stress media <html>                     # forced-colors, reduced-motion, print, RTL, 200% zoom
```

All emit a self-contained Markdown report under `--output-dir`. Each
finding includes pasteable hex / px values + a heuristic remediation
hint. `build component` also writes a machine-readable `report.json`
twin next to `report.md` (the full `ComponentFromImageReport` object)
so agents can consume the signals without scraping Markdown. See
`docs/reports/2026-05-13-capability-survey.md` for the full
scenario × coverage matrix.

Snapshot labels are query-aware by default, so `/issues` and `/issues?severity=critical` no longer share the same baseline name.
Use repeated `--label` flags to override labels explicitly when needed.
The same `--label` flag can be used with `vlmkit snapshot approve` to approve only selected labels.

Minimal `vlmkit.config.json`:

```json
{
  "baseUrl": "http://localhost:3000",
  "routes": [
    "/",
    { "path": "/issues?severity=critical", "label": "critical-issues" }
  ],
  "outputDir": "test-results/snapshots/sample-webapp-2026",
  "threshold": 0.1,
  "failOnDiff": true,
  "maxDiffRatio": 0.01,
  "workflow": {
    "captureSpec": "./e2e/vrt-capture.spec.ts"
  }
}
```

When `vlmkit.config.json` exists in the current directory, `vlmkit snapshot` loads it automatically. Use `--config <path>` to point at another file, and pass URLs or flags directly when you want CLI values to override config defaults.
`vlmkit workflow init` and `vlmkit workflow capture` also auto-load the same file, reuse `baseUrl`/`routes`, and accept `workflow.captureSpec` or `--capture-spec <path>` when you want a custom Playwright entrypoint.

#### Subagent-ready fix prompt

`vlmkit snapshot fix-prompt` reads the last `snapshot-report.json` and emits a structured task list that a coding agent can act on:

```bash
# Markdown prompt to stdout (default)
vlmkit snapshot fix-prompt --output test-results/snapshots

# Limit to the 5 worst diffs, write to a file
vlmkit snapshot fix-prompt --output test-results/snapshots --limit 5 --out fix-prompt.md

# Filter by label, minimum diff ratio, and emit JSON for programmatic use
vlmkit snapshot fix-prompt --label home --min-diff 0.01 --format json
```

The prompt includes per-task URL, viewport, diff ratio (with shift compensation), and relative paths to the baseline / current / heatmap PNGs plus the captured HTML, so a subagent can map the visual regression back to source code.

#### Measuring false-positive rate

`vlmkit snapshot stability` captures the same URLs across N iterations against a
baseline locked in on iteration 0, then reports how often comparisons showed a
non-zero diff. Useful for tracking renderer noise, animation leakage, or mask
gaps before turning on `--fail-on-diff` in CI:

```bash
# 3 iterations (default), any non-zero diff counts as a positive
vlmkit snapshot stability http://localhost:3000/ http://localhost:3000/about/

# Fail CI if the overall FP rate exceeds 5%
vlmkit snapshot stability http://localhost:3000/ \
  --iterations 5 \
  --fail-above-rate 0.05 \
  --output test-results/stability

# Only count diffs above 1% as positives (filters out subpixel noise)
vlmkit snapshot stability http://localhost:3000/ --fp-threshold 0.01
```

The run writes `stability-report.json` to the output directory with per-URL +
per-viewport FP rate, mean / max diff ratios, and shift-compensated max — well
suited to artifact upload + over-time tracking.

#### Capture backend (`--backend`)

By default `vlmkit snapshot` launches a local Chromium via Playwright. To offload
capture to [Cloudflare Browser Run](https://blog.cloudflare.com/browser-run-for-ai-agents/)
without installing Playwright browsers in CI, switch the backend:

```bash
# Connect via CDP WebSocket; credentials come from env vars
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
  vlmkit snapshot --backend cloudflare http://localhost:3000/
```

Resolution order for the backend selector:

1. `--backend <local|cloudflare>` CLI flag
2. `VLMKIT_CAPTURE_BACKEND` env var
3. Default `local`

For the Cloudflare backend, additional env vars are required:

| Variable | Required | Purpose |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | yes | Account id for the CDP URL |
| `CLOUDFLARE_API_TOKEN` | yes | Token with Browser Rendering permissions |
| `CLOUDFLARE_BROWSER_RUN_ENDPOINT` | no | Override the default WS endpoint |
| `CLOUDFLARE_BROWSER_RENDERING_API_BASE` | no | Override the Quick Actions REST API base |

See `examples/vrt-snapshot-cloudflare.workflow.yml` for a complete GitHub
Actions template that skips the local Playwright install step.

The HTTP API also supports Cloudflare Browser Run Quick Actions when
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are present:
`POST /api/cloudflare/screenshot`, `POST /api/cloudflare/crawl`, and
`GET /api/cloudflare/crawl/:jobId/routes`.

For browserless Crater layout checks, point `VLMKIT_CRATER_WASM_MODULE` at a
Crater JS/WASM module that exports `renderHtmlToJsonForWpt(html, width,
height)`, for example:

```bash
VLMKIT_CRATER_WASM_MODULE=../crater/conformance/_build/js/release/build/wpt/wpt.js \
  vlmkit api serve --port 3456
```

Then call `POST /api/crater/layout` with `{ "html": "...", "viewport": {
"width": 800, "height": 480 } }`. This path returns layout JSON and summary
diagnostics only; paint output remains on the Crater BiDi path for now.

When using `just start-bidi-with-font` from the Crater checkout, pass the
generated session URL to BiDi clients with either `VLMKIT_CRATER_BIDI_URL` or
`VLMKIT_CRATER_ROOT`:

```bash
VLMKIT_CRATER_ROOT=../crater vlmkit bench --backend prescanner
```

#### Declaring a variant deliberate — `check drift component --allow`

`check drift component` asks "these instances should look the same", and a design
system's variants are the standing exception. Without a way to say so the gate is
permanently red on any page with one:

```bash
vlmkit check drift component page.html --selector .card \
  --allow "background-color@.card--featured;variant accent" \
  --allow "border-*-color@.card--featured;variant accent"
```

```
✗ instance #1   18.40%  Δ +28 / 0
    padding-top: 16px → 30px            ← still fails: not declared
    exempted border-top-color: … — user exemption (border-*-color@.card--featured): variant accent
```

Same syntax and the same two properties as `check integrity --allow`, which is the
point: an exempted difference is **still listed** with the reason recorded, and a rule
that matched nothing is reported (`! 1 --allow rule(s) matched nothing: …`) so a rule
kept past the variant it covered gets deleted rather than quietly widening the blind
spot.

The unit is a **property**, not a whole instance — `"this variant may differ in its
background and border"` is the shape of the real permission, and blessing an instance
wholesale would hide the geometry mistake sitting next to the intentional colour. `*`
covers a family (`padding-*`, `border-*-color`); a bare `*` is refused, because that is
`--rule instance-drift=off` and should be written as such.

#### Recording the network a gate replays — `snapshot record-har`

`--har` pins a data-driven page so a gate measures the same bytes every run. Producing
the recording used to be a doc sentence, so every project wrote the same twenty-line
Playwright script:

```bash
vlmkit snapshot record-har http://localhost:5173/ --out fixtures/app.har
vlmkit check integrity http://localhost:5173/ --har fixtures/app.har
```

It defaults to `--wait-until load`, not `networkidle`: the reason `--har` exists is a
page with a held-open stream, and a recorder that waited for idle would hang on
exactly those pages. `--settle 1000` (default) catches the late XHR a dashboard fires
after the milestone — a recording without it is stale before it is written.

The output names the origins it covers, because the recording is keyed on the full
URL: replay it against a different host or port and nothing matches. That case is
reported at replay time too, rather than surfacing as a page whose every resource
broke.

#### One image instead of a sequence — `snapshot strip`

A flipbook animates; a strip has to be readable **as a still** — pasted into an
issue, diffed by eye, or handed to a model, which sees one image and cannot press
play. Same input, different job:

```bash
# A numbered sequence into one PNG (single row by default)
vlmkit snapshot strip round-0.png round-1.png round-2.png --out rounds.png

# Wrap into a grid, cap the sheet width (default 1600; 0 disables)
vlmkit snapshot strip frames/*.png --columns 4 --max-width 1200 --out sheet.png
```

Frames are composited **in the order given**, and a glob expands
lexicographically — so `anim-0-100.png` lands before `anim-0-20.png` and the strip
reads backwards. The command detects that and prints the numeric order it would
have used; zero-pad the names or list them explicitly.

Frames of different sizes are placed top-left inside a uniform cell, never
centred: a `translateX` strip is read by comparing where the element sits from
cell to cell, and centring would subtract exactly that offset.

`check animation` writes one directly, cropped per animation to the motion it
produced:

```bash
vlmkit check animation page.html --samples 6 --strip strip.png
# → Strip: strip.png (1526x492, 4 animation(s) x 6 sample(s))
```

One row per animation, every cell in a row sharing one crop rect. Without the crop
each cell is the whole viewport, so a small animated element yields near-identical
screenshots — on `fixtures/css-challenge/dashboard.html` cropping took the sheet
from 1448x422 to 890x232 and made each row show only its own element.

**Columns are shared instants on the page timeline**, not each animation's own
0→1 progress. That is what makes a stagger visible: three cards with 0/60/120ms
delays read as a diagonal cascade rather than as three identical rows. The window
defaults to one iteration of the slowest animation, and `--strip-window <ms>` narrows
it to the part under review:

```bash
vlmkit check animation page.html --samples 6 --strip-window 380 --strip cards.png
# → Strip: cards.png (1496x484, 4 animation(s) x 6 sample(s); 1 omitted as no-visible-effect)
#   caption: columns are 63ms / 127ms / 190ms / 253ms / 317ms / 380ms on the page
#   timeline (window 380ms, one shared clock); rows top to bottom are …
```

The window defaults to **when the last finite animation ends**, not to one iteration of
the slowest animation on the page — an infinite spinner would otherwise set the
timebase for the entrance animations under review and most columns would show a
settled page.

`--strip-selector <css>` restricts the rows to animations on matching elements, which
is how you keep a permanent spinner out of a sheet about card entrances. The gate still
evaluates and reports every animation; only the image is scoped. A selector matching
nothing animated fails with the list of what is animated.

**The sheet labels itself**: sample times across the top, `selector animation-name`
above each row, drawn from a built-in 5x7 bitmap font rather than a system one. The
worry that stopped this earlier was that text makes output depend on font rendering —
true for a VRT baseline, but a strip is an attachment, nothing pixel-compares it, and a
sheet whose rows are identified only in the terminal is unreadable the moment it is
pasted anywhere else. Owning the glyphs keeps both: identical bytes on every platform,
no fontconfig, no web font to race the screenshot. A row label longer than the sheet
truncates with `..` from the end, so the head that maps it back to the terminal survives.

The fuller caption — window, sample list, omission counts — is still printed rather than
drawn, since it is prose. Paste it under the image.

`snapshot strip` takes labels explicitly, `--label` per column and `--row-label` per
row, both repeatable and in order, with `--label-scale <n>` for size (1 unit = 5x7px,
default 2):

```bash
vlmkit snapshot strip f-0.png f-1.png f-2.png --label 0ms --label 125ms --label 250ms --out strip.png
```

Writing a strip does not change the verdict — a page with real defects still exits 1,
which surprises a caller whose only goal was the attachment. Add `--advisory` when the
image is the point and the exit code is not.

Animations that moved no pixels get no row — they are already reported as
`no-visible-effect`, and a row showing nothing would size the uniform cell for every
other row. The count is named in the output (`1 omitted as no-visible-effect`) rather
than dropped silently.

##### WebP output

A `.webp` output extension encodes lossless WebP, which needs the optional
`@jsquash/webp` peer (`npm install --save-dev @jsquash/webp`). Without it, PNG works
with no extra dependency and the error names the two ways forward.

```bash
vlmkit check animation page.html --strip strip.webp
vlmkit snapshot strip frames/*.png --out sheet.webp
vlmkit snapshot strip frames/*.png --out sheet.webp --quality 75   # lossy; see below
```

Measured on the real sheets this writes:

| | 1526x492 sheet | 2584x736 sheet |
|---|---|---|
| PNG | 106.8 KB | 165.3 KB |
| WebP lossless | **24.0 KB** | **39.3 KB** |
| WebP quality 90 | 55.9 KB | 72.6 KB |
| WebP quality 75 | 36.7 KB | 47.3 KB |

Lossless is the default because on flat UI screenshots it is both smaller *and*
artifact-free — lossy first adds noise it then has to encode, so quality 90 is more
than twice the size of lossless here. `--quality` exists for photographic content.

Three encoders were measured for this. `@jsquash/webp` (libwebp as WASM, 1.1 MB
installed) and `sharp` (libvips, 29 MB installed) produce byte-identical output, so
the light one is the peer. `mizchi/image` 0.4.3 would have added no npm dependency
at all — it is MoonBit, which this repo already builds — but its `encode_webp`
emits a valid VP8L stream (verified: decodes to 1526x492 in Chromium) that is
**6.6x larger than the PNG it replaces**, i.e. 29x libwebp. A correct minimal
encoder, not a competitive one.

#### Visualizing the VRT process — flipbooks + video

The VRT process can be saved as a self-contained HTML "flipbook" (PNGs
embedded as base64, vanilla-JS play/pause/scrub controls). One file
per scenario, no external assets, opens in any browser, attachable to
PRs:

```bash
# 1. Fix-loop convergence (or any ordered PNG sequence)
vlmkit snapshot flipbook round-0.png round-1.png round-2.png \
  --label "round 0" --label "round 1" --label "round 2" \
  --title "Fix-loop convergence" --out fix-loop.html

# 2. Diff three-frame (baseline ↔ current ↔ heatmap) for every regressed entry
vlmkit snapshot flipbook --output test-results/snapshots
# → test-results/snapshots/flipbooks/<label>-<viewport>.html

# 3. Stability iterations as flipbook per (URL, viewport)
vlmkit snapshot stability http://localhost:3000/ \
  --iterations 5 --flipbook --output test-results/stability
# → test-results/stability/flipbooks/<label>-<viewport>-stability.html

# 4. WebM recording of a smoke-test session (Playwright recordVideo)
vlmkit inspect smoke --url http://localhost:3000/ --max-actions 20 --record-video videos/
# → videos/<hash>.webm
```

Common flags: `--delay <ms>` controls per-frame duration (default 700),
`--no-loop` stops at the last frame, `--no-autoplay` opens paused.

#### Agent-friendly diff summary

When a coding agent is iterating with `vlmkit diff html`, the natural workflow
(see [`docs/reports/2026-05-12-dogfood-shadcn-luna.md`](docs/reports/2026-05-12-dogfood-shadcn-luna.md))
is: read the worst-viewport PNGs side-by-side, then write a CSS patch.
`vlmkit diff agent` collapses the inputs the agent needs into a single
Markdown blob:

```bash
vlmkit diff html --dir fixtures/migration/shadcn-to-luna \
  --baseline before.html --variants working.html \
  --output test-results/iter1
vlmkit diff agent test-results/iter1/diff-report.json --max-viewports 2
```

The output contains: a worst-first diff table, category totals across
viewports, fix candidates aggregated by `(selector, property)` with the
number of viewports each is flagged on, and absolute paths to the
baseline / current / heatmap PNGs for the worst N viewports — all in
one context window.


### Workflow Commands

These commands manage state under the current project root: `baselines/`, `snapshots/`, `output/`, `vrt-report.json`, `expectation.json`, and `spec.json`.

Before running them, start the target app and point `VLMKIT_BASE_URL` at it when needed.
The built-in capture workflow defaults to `http://127.0.0.1:4174`.
`vlmkit workflow verify` itself only compares the PNG and `.a11y.json` artifacts already present under `baselines/` and `snapshots/`; it does not launch Playwright.

```bash
vlmkit workflow init
vlmkit workflow capture
vlmkit workflow verify
vlmkit workflow approve
vlmkit workflow report
vlmkit workflow graph
vlmkit workflow affected
vlmkit workflow introspect
vlmkit workflow spec-verify
vlmkit workflow expect
```

If `vlmkit.config.json` defines `routes`, the built-in capture spec uses those routes instead of the repo-local defaults.

The PR workflow also runs a deterministic snapshot false-positive check against `fixtures/css-challenge` using `.github/vrt-snapshot-ci.config.json`.
It creates baselines once, re-runs the same URLs, and summarizes `test-results/snapshots/ci/snapshot-report.json` with `vlmkit snapshot report`.

For migration workflows, `vlmkit migration subagent` packages the highest-impact diff per variant into a prompt for an external fixer, then compares before/after `diff-report.json` files to measure resolved/improved success rates.
Blind migration scenarios are declared in `fixtures/migration/blind-scenarios.json`, including the existing reset-css blind target and a scaffolded `shadcn-to-luna/after-blind.html` target for reproducible E3 runs. `vlmkit migration blind` supports `list`, `show`, `prepare`, `solo`, and `evaluate` so the blind run can emit a fresh compare report, generate a fixer packet, run a deterministic reference-CSS repair, and check the `diff < 1% within 3 rounds` contract without hand-assembling paths.

`vlmkit report` remains the detection pattern report, so verification output lives under `vlmkit workflow report`.

#### Capture routes for external projects

`vlmkit workflow init|capture` runs `e2e/vrt-capture.spec.ts`, which now resolves
its route list from your project rather than hard-coding vlmkit's own pages.
Drop a `vlmkit.config.json` next to your app with a `capture` block:

```json
{
  "baseUrl": "http://localhost:3000",
  "capture": {
    "routes": [
      { "name": "home", "path": "/", "waitFor": "main" },
      { "name": "about", "path": "/about" },
      "/contact"
    ]
  }
}
```

Each route accepts `name` (defaults to a sanitized form of `path`), `path`, and
an optional `waitFor` CSS selector.

`waitFor` is a readiness contract, not a hint: if the selector does not become
visible within 10s, `diff-pr` and `diff-pr pin` both fail that viewport and say
which selector did not match. `pin` writes no PNG in that case — a baseline
captured before the page rendered is worse than a missing one, because every
later run agrees with it. It used to be swallowed, so a typo cost 10 silent
seconds per viewport and then reported a green comparison of two placeholders.

Resolution order:

1. `VLMKIT_CAPTURE_ROUTES` env var (JSON-encoded array) — outranks `--config`, and the
   run prints a line saying so when both are set, so a flag you typed is never silently
   ignored
2. `--config <path>` flag or `VLMKIT_CONFIG_PATH` env var
3. `vlmkit.config.json` auto-discovered in the working directory
4. Built-in defaults (vlmkit's own UI — useful only when developing vlmkit itself)

```bash
# External project usage
vlmkit workflow init --config ./vlmkit.config.json --base-url http://localhost:5173
vlmkit workflow capture --config ./vlmkit.config.json
vlmkit workflow verify
```


### API Commands

```bash
vlmkit api serve [--port 3456]                # Start HTTP API server
vlmkit api status [--url http://localhost:3456]
```

Compatibility aliases:

- `vlmkit serve` -> `vlmkit api serve`
- `vlmkit status` -> `vlmkit api status`


## HTTP API

Start the server:

```bash
vlmkit api serve --port 3456
```

The shared Hono app also exposes a Cloudflare Workers entry point at `worker/index.ts`.

Available endpoints:

- `GET /api/openapi.json` — OpenAPI 3.1 spec for the current HTTP surface
- `GET /api/status` — server version, backends, and capabilities
- `GET /api/execution-results` — searchable stored run summaries for dashboards
- `GET /api/visual-diffs` — grouped baseline/current/heatmap/triptych display models
- `GET /api/detection-series` — benchmark detection-rate time-series points
- `GET /api/component-status-matrix` — snapshot report label/component × viewport status matrix
- `GET|POST /api/approvals` — list/add/remove approval manifest rules for review UIs
- `POST /api/cloudflare/screenshot` — Cloudflare Browser Run Quick Actions screenshot proxy
- `POST|GET /api/cloudflare/crawl` — start/read crawl jobs and extract route candidates
- `POST /api/crater/layout` — render HTML to Crater layout JSON via a JS/WASM module
- `POST /api/compare` — compare baseline/current HTML or URLs across viewports
- `POST /api/compare-renderers` — compare Chromium vs Crater rendering
- `POST /api/reason` — VLM/LLM reasoning pipeline for diff analysis and fixes
- `POST /api/smoke-test` — random or reasoning-guided a11y smoke test

When running on Workers, `/api/status` also reports detected `R2` / `KV` / `D1` storage bindings.

TypeScript client:

```ts
import { VrtClient } from "@mizchi/vlmkit/client";

const client = new VrtClient("http://localhost:3456");
const status = await client.status();
const result = await client.compareHtml(
  "<main><button>Before</button></main>",
  "<main><button class='primary'>After</button></main>",
);
```

Install: `pnpm add @mizchi/vlmkit`

`compareUrls(...)` is intended for public HTTP(S) targets. The API server rejects localhost and private-network URLs.


## Architecture

```
HTML (file or URL)
    │
    ├── Pixel diff (pixelmatch v7 → heatmap → diff ratio)
    ├── Computed style diff (getComputedStyle → property-level changes)
    ├── A11y tree diff (accessibility snapshot → structural changes)
    └── Paint tree diff (Crater BiDi → layout tree comparison)
          │
          ▼
    Detection & Classification
          │
          ▼
    AI Fix Pipeline (optional)
      Stage 1: VLM (cheap) → structured CHANGE report
      Stage 2: LLM (accurate) → CSS fix suggestions
          │
          ▼
    Dry-run verification → rollback if worse
```


## Project Structure

```
src/
  vrt.ts                    # Unified public CLI entry point
  vrt-command-router.ts     # Root command routing + usage text
  vrt-cli.ts                # Stateful workflow CLI
  vrt-client.ts             # TypeScript client for the HTTP API
  snapshot.ts               # URL snapshot + baseline diff
  migration-compare.ts      # HTML/URL comparison across viewports
  css-challenge-bench.ts    # CSS deletion/recovery benchmark
  fix-loop.ts               # AI-powered CSS fix loop
  vrt-reasoning-pipeline.ts # 2-stage VLM + LLM pipeline
  heatmap.ts                # Pixel diff + heatmap generation
  mask.ts                   # Selector-based visibility masking
  vlm-client.ts             # OpenRouter / Gemini VLM client
  llm-client.ts             # Multi-provider LLM client
  api/
    api-server.ts           # Hono API server
packages/vlmkit-capture/src/
  crater-client.ts          # Crater BiDi WebSocket client
  crater-wasm.ts            # Crater layout-only JS/WASM adapter
packages/vlmkit-heal/src/
  router.ts                 # Cost-escalation model router (shared budget)
  heal.ts                   # Self-healing loop state machine
  clients.ts                # Observe (VLM) / codegen (LLM) tiers
  cost.ts                   # Token×price billing so the budget cap works
packages/vlmkit-plan/src/
  plan.ts                   # User story + seed + observations -> Markdown test plan
packages/vlmkit-generate/src/
  generate.ts               # Markdown plan + rules -> Playwright spec source
fixtures/
  css-challenge/            # 9 HTML fixtures for CSS bench
  migration/                # Migration comparison fixtures
docs/
  knowledge.md              # Accumulated experimental findings
  reports/                  # Dated experiment reports
```
