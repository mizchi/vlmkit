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
pkf run vlmkit-test

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
  # --kind               name each region text / color / position / presence with
  #                      TypeSafe Jev on its magnified crop (TYPESAFEAI_API_KEY,
  #                      ~$0.0003 a region); the only model-made field, marked
  #                      uncertain below 0.6 confidence. --kind-limit <N> (12),
  #                      --kind-model <id> (jev-1.14.0)
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
`copy-invisible` sorts drawn text with the page's own reason classes, as far as the scene
carries the facts for them, and the coverage block names which ran:

| class | from | means |
|---|---|---|
| `zero-size` | geometry | an empty box |
| `visually-hidden` | geometry | a box, or its `clip`, under 4px² — the sr-only shape |
| `hidden` | `opacity` on the text or a recorded ancestor | their product under 0.02 |
| `transparent` | `color` | the text colour's alpha under 0.02 |
| `camouflage` | `color` + `background` | within 8 per channel of the nearest opaque background behind it; an image behind or a `text_shadow` rescues it |
| `unpainted` | `--image` | the text bbox is flat in the frame: the glyphs were never drawn (missing font, alpha 0, skipped draw call) |

`unreachable` never runs: the page decides it from the scroll extent and every ancestor's
overflow clip, which element rects do not carry. Camouflage over nothing opaque is left
unjudged and counted — the page compares against white there, and a scene has no default
canvas colour.

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
| `color` on text + an opaque `background` on it or a recorded ancestor | `invisible-text`, `low-contrast-text` |
| `font_size`, `font_weight` | the WCAG floor (3:1 for large text, 4.5:1 otherwise) |
| `opacity`, `background_image`, `disabled`, `text_shadow` | opacity multiplies down the path; text over an image, disabled or shadowed text is exempted and listed |

Colours must be **resolved** (`rgb()`, `rgba()` or `#hex`): the renderer knows the sRGB it
paints, and vlmkit does the compositing and the WCAG arithmetic, the same code the browser
path uses. `oklch()` or a named colour is refused with the field named. A text element with
no opaque background anywhere up its path is not measured against an assumed white; it is
listed as exempted with that reason.

Containment comes from `path` prefixes (`hud[0]>bar[0]`), so protrusion, collapsed
containers and near-misalignment need no extra fields. Because the capture may omit
uninteresting nodes, findings name the **nearest recorded ancestor** rather than claiming
a parent.

**Six of eighteen rules are evaluable from rects alone, eight with paint**, and the report
lists the rest with the reason each needs a DOM. That is deliberate: a `clean` verdict is only worth
what it rules out, so the gap is printed next to the verdict rather than left implicit.
`--elements` and a page source are mutually exclusive — the two modes evaluate different
rule sets, so a combined run's verdict would be ambiguous.

Text drawn wider than its box is **not** reported as clipped unless a `clip` rect says so:
on a canvas that overdraws, which the collision and protrusion rules cover.

#### `check color` on a scene

The same schema, with a `role` on the elements the two WCAG rules read:

```bash
vlmkit check color --elements scene.json
```

| field | unlocks |
|---|---|
| `role: "field"` + `background` somewhere behind it + `border` / `border_color` (or `shadow` / `outline`) | `control-boundary-invisible` (WCAG 1.4.11) |
| `role: "link"` + `color`, inside a recorded ancestor with `color` and `text` (its prose) | `color-only-link`, `link-no-cue` (WCAG 1.4.1); `underline`, a `font_weight` step, `border` or `background` count as the cue |
| `role: "button"` | counted in the interactive ink, judged by neither rule |

Findings name elements by `path`, and `--allow` matches that path. A field or link with
nothing opaque behind it is listed as skipped rather than measured against an assumed white.

#### `check design` on a scene

```bash
vlmkit check design --elements scene.json
```

Elements are grouped by `role` (any string: `button`, `card`, `tab`…), or by heading level
(`heading: 1` or an `h1`-`h6` tag). Within a role, `padding` (one number or
`[top, right, bottom, left]`), `radius`, `border`, `background`, `font_size` and
`font_weight` form the style signature, which is the same signature a page's computed style
produces. Elements without a role are counted as skipped by `tag`. `--exclude` is refused:
a scene holds only what you wrote into it.

#### `check composition` on a scene

```bash
vlmkit check composition --elements scene.json [--viewport 1280]
```

Every element is a box, parented by its nearest recorded ancestor. A heading is `heading: 1-6`
or an `h1`-`h6` tag; `font_size` / `font_weight` carry the type hierarchy; `background`,
`border` and `radius` say whether a box paints its own group edge (a title inside such a box
is not judged for proximity); `overlay: true` takes a box out of flow, as `position: absolute`
does on a page. Boxes under 2px on either axis are not layout boxes and are dropped, as the page
collector drops them. The frame is `--viewport` wide, or as wide as its rightmost element; rails
are measured as a fraction of that width. Findings and `--allow` use scene paths.

### Check (gates: a11y / tokens / design / theme / perf / drift)

```bash
vlmkit check a11y contrast <html|url>          # WCAG AA contrast scan
vlmkit check a11y touch    <html|url>          # Touch target size (WCAG 2.5.8 AA default, 2.5.5 AAA via --level)
vlmkit check a11y focus    <html|url>          # Tab order vs visual order
vlmkit check a11y tree     <a11y.json>         # No DOM: names, reach, pixel contrast, target size from a platform's
                                               # accessibility tree + frame (Flutter, Android, …) — docs/a11y-tree.md
vlmkit check palette       <target.png> [current.png]  # Dominant colors, or palette diff (missing/extra hex)
vlmkit check tokens        <html|url>          # radius/spacing/z-index/shadow scale conformance (declared scale)
vlmkit check design        <html|url>          # coherence of the scale the page itself implies (no config; --elements for a scene)
vlmkit check composition   <html|url>          # 近接/整列/対比: label grouping, page rails, declared type hierarchy (--elements for a scene)
vlmkit check color         <html|url>          # palette by role (base/body ink/link ink) + where colour alone carries meaning (--elements for a scene)
vlmkit check theme         <html|url>          # dark mode by media query OR root class / attribute (detected); unthemed components
vlmkit check perf          <html|url>          # Web Vitals (CLS / LCP / FCP)
vlmkit check grounding     <html|url>          # Screenshot-space action map for a computer-use agent (see below)
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
35 gates are registry-driven; `vlmkit rules` lists them. Commands that produce
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

### Computer use (`check grounding`)

```bash
# The page as a screenshot-driven agent sees it: an action map in screenshot px.
vlmkit check grounding http://localhost:5173/

# The resolution the model actually reads the image at.
vlmkit check grounding <url> --resolution 1024x768
vlmkit check grounding <url> --resolution medium        # a preset from image-resize.ts

# The action map as JSON, and as a numbered overlay on the screenshot.
vlmkit check grounding <url> --json
vlmkit check grounding <url> --mark marked.png

# What would a click at this coordinate actually reach?
vlmkit check grounding <url> --at 473,96 --at 447,96

# The screen after some actions: replay them first, then map what is there.
vlmkit check grounding <url> --after "wheel 85,120 89" --after "click 85,172"
```

A computer-use agent receives a PNG, names a target in words, emits a pixel
coordinate, and learns what happened from the next PNG. Every other gate here
measures the page for a human reader or for selector-driven tooling, and three
things that decide whether the agent's turn succeeds are invisible to all of
them:

- **The coordinate it emits is the one the browser routes.** A control can be
  painted, focusable and keyboard-operable while `elementFromPoint` at its own
  centre returns a cookie banner. Playwright's `click()` would report the
  interception; an agent sending a raw coordinate just reads someone else's
  dialog back. → `occluded-target` (suspect).
- **The words it uses resolve to one target.** "Click Edit" is unanswerable when
  six rows each paint `Edit`. The message names the surrounding text that would
  disambiguate them, because that is what an accessible name should carry.
  → `ambiguous-target`, `label-mismatch`, `unlabeled-target`.
- **The screenshot it is given still resolves the target.** The PNG is
  downscaled before the model reads it, so a 24 CSS px control — passing WCAG
  2.5.8 and `check a11y touch` — is 12 screenshot px at scale 0.5 and 7 at a
  640px cap. → `imprecise-target`, `crowded-target`.

The positive output is the **action map**, which is the part an agent consumes
rather than reads: `--json` emits one row per target with its role, the label
painted on screen, the click point in screenshot px, the CSS-px point for a
caller driving a real browser, and the `risks` attached to that coordinate — so
a caller using the map alone still learns which coordinates not to trust. No VLM
and no API key: the judgement calls a vision model would make here are the ones
it gets wrong, and the ones it cannot make ("which element receives a click at
613,284?") are the ones that decide the turn.

A row's `point` is the coordinate to emit, and it is not always the box's
centre: when something covers that centre the gate sweeps the box and aims at
the middle of the largest clear pocket instead, with `aimedOffCentre` saying
where the centre was, why the point moved (`occluded` or `clipped`) and how much
room the new point has. A map whose coordinate does not reach its own target is
worse than no map — measured: a model handed the covered centre emitted it and
activated the banner on top of the button.

`inFrame` on a row means **painted**, not "inside the viewport": visibility is
measured against every clipping ancestor, so a list item scrolled out of a
220px scrollport is out of the frame exactly as a control below the page fold
is. Such a row is not a finding — a list with more rows than fit is ordinary
markup — and instead carries `clippedBy`: the container, whether it **scrolls**,
and how far it would have to (`dy` / `dx`). The report groups them under *Out of
the frame*, with the scroll that reaches the nearest one spelled as an action —
`--after "wheel 85,120 34"`, at a point inside the container — so a caller with
a wheel can plan the scroll rather than infer from pixels that a list exists at
all. A row the container cuts only **in part** is measured on what is painted:
`visibleBox`, `minSide` and the map's `149x1 painted of 149x28` all describe the
strip, it carries the same `clippedBy`, and a strip under the precision floor is
an `imprecise-target` that names the container and the scroll. Measuring it
against the frame alone reported a 1px strip as a full row whose only problem was
being `crowded-target` "0px from" the row above. Before this, such
rows were reported as `occluded-target` "by `html`" with the advice to move
`html`; three agents in a row worked the remedy out from the screenshot instead.

`--after` (repeatable, in order) replays computer-use actions before anything is
measured — `"click x,y"`, `"move x,y"` (hover) and `"wheel x,y dy"`, in
screenshot px like every other number here, `dy` included — so the map, `--at`
and `--mark` describe the screen those actions leave: the detail panel a click
opened, the rows a scroll revealed, the tooltip a hover drew. The report's
`screen:` line says which screen it measured, either way. Without it the gate
maps the first load however often it is re-run, and the round that named the gap had
both tool-using agents find the second screen's Archive button by sampling pixel
colours, six pixels from Delete. The spelling is the one a harness logs, so an
agent's own action history pastes in as-is.

With `--after`, the report also says **what the last action changed**. It compares
the screen before that action with the screen after it. For a click it names what
the click landed on, hit-tested on the screen it was sent to. It then lists the
controls that came onto the screen or left it, controls whose ARIA state
(`current`, `pressed`, `checked`, `selected`, `expanded`, `disabled`) or look
(`color`, `background-color`, `text-decoration-line`, `opacity`, `font-weight`)
changed, and painted text that appeared or went. For example:

```
What the last action (click (560,50)) changed:
  the click went to t15 "Archive"
  ~ t8 "Checkout webhook retries exhausted for region eu-west-1…" changed color, text-decoration-line
  ~ t15 "Archive" changed background-color — its :hover style, and the pointer is now on it
  + text "Archived."
```

A restyle is called `:hover` only when the pointer arrived on the control or left
it, and a `:hover` rule in the page's own stylesheets sets that same property.
"Nothing on screen" says what was compared, not that the click missed. When the
click reached a control, the line adds that the control may have done something
the page does not show. This answers "did my click work", which a map of one
screen cannot. The round that added it had a tool-using agent write "the tool's
action map does not track this state change; I had to trust the screenshot". An
agent without the tool archived the right ticket, read the "Archived."
confirmation as a menu item, clicked it five times and reported failure.

The map describes **the frame it measured**. Controls that appear only after an
interaction — a detail panel's buttons, a menu's items — are not in it, and
re-running the gate after the action is the way to see them.

`--at x,y` (repeatable) hit-tests a coordinate you already have — one of yours,
or one this report printed — and names the element a click there would reach. A
hit on a control's own icon resolves to that control; a hit on nothing in the
map says whether anything above it is interactive, rather than leaving "not a
target" to be read as "harmless".

`--mark <png>` draws the same map onto the screenshot as numbered boxes, red
where a row carries a risk — the set-of-mark prompt a vision model grounds
against far more reliably than raw pixels. Marks are drawn at the downscaled
resolution with the same nearest-neighbour resampling `image-resize.ts` uses, so
a mark's position in the file is the click point in the JSON.

Defaults: the viewport is `1280x720`, and with no `--resolution` the frame is
whatever `resolveResolutionForViewport` picks for it — `medium` (640x480) at
that width, i.e. the downscale this toolkit's own VLM path applies, giving a
640x360 frame at scale 0.5. `--precision-floor` (10) and `--aim-margin` (6) are
both in screenshot px.

What it deliberately leaves to its neighbours: WCAG touch size is
`check a11y touch` (CSS px, for a finger, with the criteria's exceptions), text
painted over by a `pointer-events: none` layer is `check integrity` (that layer
takes no clicks, so hit testing calls it clean), keyboard behaviour is
`check interactions`, and whether an action had a visible effect is
`vlmkit inspect explore`.

Fixtures: [`fixtures/grounding/`](../fixtures/grounding/) — `agent-hostile.html`
trips every rule, `groundable.html` trips none, `partly-covered.html` is the
sweep's own case. The gate is validated against agents rather than only against
tests: [`fixtures/grounding-scenario/`](../fixtures/grounding-scenario/) hands a
subagent one screenshot and six things a user asked for and scores its
coordinates by dispatching them at the live page —
[v1](./reports/2026-09-21-grounding-scenario-v1.md),
[v2](./reports/2026-09-21-grounding-scenario-v2.md),
[v3](./reports/2026-09-22-grounding-scenario-v3.md) — the last of which measures a
whole flow, with a harness that clicks and hands back the next screenshot.

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
vlmkit scan a11y <url|dump.xml> [--out a11y.json] # A platform's accessibility tree + frame as vlmkit-a11y/1:
                                               # Flutter web (semantics switched on, --click to reach a
                                               # screen) or an Android uiautomator dump (--density dpi)
vlmkit scan style <html|url> [--out snap.json] # One page load for check design / composition / color; then
                                               # `vlmkit check design|composition|color --from snap.json`
                                               # judges it with no browser, same report as the live run
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
vlmkit inspect interact <html|url> --sequence <path.json>   # a "frames" step records what an action set moving
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
vlmkit check flash <html|url|frames.json|video>  # WCAG 2.3.1 Three Flashes: every 60fps frame of page time on
                                               # the held clock, per-pixel transitions (ΔL ≥ 0.1, darker
                                               # < 0.8; saturated red), >6 in 1s over >21,824 CSS px² of a
                                               # 341x256 field fails; motion re-counted (motion-flicker).
                                               # A recording (mp4/webm/mov/mkv/gif) is decoded with YOUR
                                               # ffmpeg and every frame judged at its own time
vlmkit check breakpoints <html|url>            # Boundary quickcheck: render at B-1/B/B+1 per discovered
                                               # breakpoint and verify each discrete style property at B
                                               # matches a neighbor — catches off-by-one media queries
                                               # (a width styled by neither/both regimes), elements that
                                               # vanish exactly on the boundary, overflow at boundary widths
vlmkit check responsive <html|url>             # Property-based responsive check: the page's media queries
                                               # partition the width range; every transition's two sides and
                                               # seeded random viewports per regime (height, --text-scale,
                                               # scheme) are checked with integrity's layout judges plus
                                               # text-starved; each failure is shrunk to its exact width
                                               # range, anchored to a breakpoint, and explained by ddmin over
                                               # the declarations that clear it. --seed / --runs / --width
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
  "maxDiffRatio": 0.01
}
```

When `vlmkit.config.json` exists in the current directory, `vlmkit snapshot` loads it automatically. Use `--config <path>` to point at another file, and pass URLs or flags directly when you want CLI values to override config defaults.
`vlmkit workflow init` and `vlmkit workflow capture` also auto-load the same file and reuse `baseUrl`/`routes` — either at the top level or under `capture`.

A `"workflow": { "captureSpec": … }` key and a `--capture-spec <path>` flag were documented here and **have never existed** in any version of the code; the example even named `vrt-capture.spec.ts`, a filename nothing has had since the rename. There is no capture spec to point at any more either: capture used to spawn `npx playwright test e2e/vlmkit-capture.spec.ts`, which is why these two commands needed a source checkout (the published package excluded the spec), and it now runs in-process from the installed package like every other command. Each route is captured at 1280x720 and reports its own outcome — HTTP status, an unmatched `waitFor`, an empty body, a degraded a11y tree — instead of one subprocess exit code for the whole run. A non-2xx route exits 1 rather than quietly baselining the server's error page.

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

# The other answer: one file that actually plays (animated PNG)
vlmkit snapshot strip shots/*.png --animated --delay 120 --out anim.png
vlmkit check animation page.html --strip anim.png --strip-animated

# A frames.json (see "Frames at chosen instants" below): labels and delays from its times
vlmkit snapshot strip --manifest out/f/frames.json --out sheet.png
vlmkit snapshot strip --manifest out/f/frames.json --animated --out anim.png
vlmkit snapshot strip --manifest out/f/frames.json --max-frames 6 --out sheet.png   # evenly thinned, ends kept
```

`--animated` writes **APNG**, not animated WebP: `@jsquash/webp` wraps libwebp's
single-image encoder, and the alternative that can animate costs 29 MB installed
for identical static output. APNG needs no dependency, plays in a browser and in a
GitHub comment, and shows frame 0 in a viewer that does not know it — so the file
is still usable as a still. It has no inter-frame compression, so six frames are
roughly six PNGs. A `.webp` output path with `--animated` is refused rather than
silently written as APNG bytes.

`check animation --strip-animated` animates the **whole page** over the sampled
timeline instead of cropping each animation to its own row, with per-frame delays
taken from the real sample instants. Use it when the spatial arrangement matters
(three cards side by side stay side by side); use the still sheet when a small
element needs to be legible.

Frames are composited **in the order given**, and a glob expands
lexicographically — so `anim-0-100.png` lands before `anim-0-20.png` and the strip
reads backwards. The command detects that and prints the numeric order it would
have used; zero-pad the names or list them explicitly. Every `vlmkit-frames/1`
sequence is zero-padded (`0000-t000000.png`), and `--manifest` takes the order
from `frames.json` instead of the shell.

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
defaults to when the last finite animation the sheet shows ends, and `--strip-window <ms>`
narrows it to the part under review (or `--at` names the columns outright):

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

#### Frames at chosen instants — `--frames`, `--at`, `frames.json`

Three commands write the page at instants you choose as one kind of numbered
sequence, `vlmkit-frames/1`: PNGs named `NNNN-t<ms>.png` — the position
zero-padded, so a glob is in sequence order — and a `frames.json` saying what
each one shows.

```bash
# The viewport, uncropped, at instants of the page's own time; clock and animations held
vlmkit check animation page.html --at 0..600/100 --frames out/anim
# What each instant --timeline judged looked like, and the rest instant; one directory per width
vlmkit check integrity page.html --timeline-at 0,250,500 --frames out/tl     # out/tl/1280/, out/tl/768/, …
# After an action: a "frames" step in the sequence (below)
vlmkit inspect interact page.html --sequence drawer.json --output-dir out/drawer
# Any of them as one image, labelled with the time each frame shows
vlmkit snapshot strip --manifest out/anim/frames.json --out anim-sheet.png
```

Instants are ms when bare, and also `1.5s`, `00:01.500`, `6f` (frame 6 of the
held 60fps clock, 100ms) and ranges `0..1s/100ms` (the end is included when a
step lands on it). `--timeline-at` reads the same grammar; before it did,
`Number.parseInt` read `1.5s` as 1ms. A range is computed as `start + i * step`,
never by adding the step up — summed, `1000 / 60` drifts above a frame boundary
and the held clock runs a frame short — and in frames when its step is in frames
and its start is on one (`0..1s/5f`). A value within 1e-6ms of a whole ms or a
frame boundary is put on it, so `16.15s` is 16150 and not 16149.999999999998.
More than 1000 instants (or offsets) is refused.

```json
{ "format": "vlmkit-frames/1",
  "source": { "tool": "check animation", "url": "file:///…/page.html",
              "viewport": { "width": 1280, "height": 720 }, "deviceScaleFactor": 1,
              "browser": "chromium 141.0.7390.37", "clock": "held" },
  "frames": [ { "n": 0, "file": "0000-t000000.png", "atMs": 0, "stable": true },
              { "n": 1, "file": "0001-t000100.png", "atMs": 100, "stable": true } ] }
```

- **`n`** is 0-based: the image index a model is given when the files are passed in order.
- **`clock: "held"`** (`check animation`, `check integrity`): page time.
  `requestAnimationFrame`, timers, `Date` and every animation move only when the
  capture advances them. `check animation --frames` holds the clock whether or not
  `--virtual-time` is set, on a page of its own after the evaluation. Its old
  `--frames` output (`rest.png`, `anim-0-25.png`, `t-150ms.png`, …: the evaluation's
  internal captures, each on its own clock) is gone.
- **`clock: "wall"`** (`inspect interact`): ms after the action, in real time.
  CSS and Web Animations are held and seeked to the offset, so their frames are
  exact; scripts run on the real clock, and `shotMs` says when the frame was shot.
- **`stable: false`**: two consecutive captures never agreed in three tries, so
  something moves that nothing holds (a `<video>`, an animated image, a worker).
  The frame is written anyway, as one moment of that motion. Agreeing twice also
  covers a capture that lands before a seek is applied, which `check animation`
  measured in 2 runs of 30.
- A directory holds **one sequence**: frame files and a `frames.json` left by a
  previous run are removed first; nothing else in it is touched.
- `browser` and `deviceScaleFactor` are recorded because the pixels depend on them.

**After an action — `inspect interact` `frames` steps.** A sequence step
`{ "action": "frames", "name": "close", "at": "0..400/50" }` (or `"everyMs": 50,
"forMs": 400`; the default is every 50ms over 500ms) records what the action right
before it set moving, into `<output-dir>/close/`:

```json
{ "viewport": { "width": 1280, "height": 720 }, "steps": [
  { "action": "snapshot", "name": "open" },
  { "action": "press", "key": "Escape" },
  { "action": "frames", "name": "close", "at": "0..400/50" },
  { "action": "snapshot", "name": "closed" } ] }
```

`inspect interact` switches every transition and animation off for its run, as it
always has, and a `frames` step changes nothing about that run: the snapshots,
transitions and step failures are the same with it as without it. Each `frames`
step is recorded afterwards on a page of its own. The steps before it replay with
motion off, then motion goes on — removing `animation: none` restarts every CSS
animation, so what is moving, or due to start within a second, is finished with
`finish()` (so `finished` promises resolve, end events fire, and a stage chained on
one is finished too), and an infinite animation or a self-restarting loop is paused
at 0. Then the recorded action runs, and every animation it starts — including in
open shadow roots, at its own `playbackRate` and direction — is paused as it begins
and seeked to each offset, finished (not paused) once an offset is past its end. A
stage the page chains on one of those ends, from an end event, an `onfinish` or a
`finished` promise, is timed from that end, one end at a time. Scroll-driven
animations follow the scroll and are never held; one that was already running when
the action was armed (an exit in its delay) keeps its real time. Offset 0 is two
rendering updates after the action returns; one a timer starts later sits at the
real time it began, and no frame is shot before the page has lived that long. The
clock is epoch time, so a navigation (a link, a reload, a redirect) keeps the
offsets, and the new document's motion is held from then on; the report says when
it happened, and counts held animations the page cancelled or retargeted
mid-window. The steps before a frames step therefore run twice — a URL source with
server state sees their requests twice. Not held: CSS inside an iframe (its frames
read unstable), and an infinite CSS animation paused at 0 ignores the page's own
`animation-play-state` from then on.
Measured on a drawer with a 220ms linear slide that sets `hidden` on
`transitionend`: at 0 / 50 / 100 / 150 / 200ms its solid width is 200 / 154 / 109 /
63 / 18px and the antialiased edge pixel is 0.55 / 0.09 / 0.64 / 0.19 covered —
within 0.01 of `200 - 200t/220` — and seeking the paused transition past its end
fires `transitionend`, so the page's own handler runs between frames.

#### What a sequence shows happening — `snapshot storyboard`

```bash
vlmkit check animation page.html --at 0..1s/1f --frames out/f   # every frame of the first second
vlmkit snapshot storyboard out/f/frames.json                     # → out/f/storyboard/
vlmkit snapshot storyboard out/f/frames.json --ignore 960,40,320,180 --out story   # a video in that box
vlmkit snapshot storyboard rec.mp4.frames/frames.json --lossy    # a lossy recording (scan video), through the noise band
```

Reads any `vlmkit-frames/1` sequence and says, from the pixels alone, where the
frames hold still, where they depart from what they held, for how long, over
which box, and whether they come back. It writes four things:

| File | What it is |
|---|---|
| `story.json` | `vlmkit-storyboard/1`: the sequence's states, its events and a timeline, each event with its frames, times, box and keyframes (`@mizchi/vlmkit-judge/storyboard.ts`) |
| `SUMMARY.md` | the same as tables; every cell is a measurement, and the same frames give the same bytes |
| `sheet.png` | one row per event: its keyframes, each labelled with the time it shows, and the event's box outlined in magenta — the box the table prints, nothing else |
| `narrate/BRIEF.md` | the keyframes and a magnified crop of each event's box, for your own vision to say what each change *is*; nothing reads the answer back |

The rules, relative to an anchor — the frame of the state the page is in (frame 0, then the first
frame of each hold a change settles in, and an earlier state's own frame when the page returns to it):

| Kind | Rule |
|---|---|
| glitch | one frame differs from the anchor, and the next is back |
| transient | more than one frame, back within 5000ms of the first — whatever it held in between, so a toast that slides in, stays and leaves is one |
| change | not back within 5000ms; ends at the first 100ms of byte-identical frames, which is the next state — a new one, or an earlier one it is within the floor of — whose frame is the anchor from then on |
| drift | a change no frame-to-frame step of which, inside its box, moves a channel by more than 8 — a fade too slow to see from one frame to the next |

A pixel differs when one of its channels moves by more than 8 of 255; the anchor,
not the previous frame, is what a frame is compared with, so a sub-floor fade
accumulates until it shows (and `movedAfter` names the last frame of the visit in
which the event's own pixels were still exactly the state's). k blinks
are k events and the frames between them none. A state a change lands back in
(within the floor of its frame) is the first such state, visited again, and its
frame is the anchor again. Within the floor is not transitive, so equal bytes can
still carry two ids: a picture reached with no event keeps the state it drifted from. Times are intervals between
two frames: an event *began* after the last frame that showed the state and by
the first that did not.

What it does not do: name what changed — that is the brief's — or pass a verdict.
It is an artifact command, not a gate, and exits 0; a narrative gate stays off
until a bench shows narration adds something the table does not. Limits:

- **A lossy recording goes through a noise band, which has a floor of its own.**
  vlmkit's own captures and lossless recordings are compared exactly. Frames a lossy
  codec decoded are refused without `--lossy`, and with it the rules above are read
  through the band (below): a pixel differs past 32 of its 3x3 mean, not 8, and a
  change smaller than that is not seen.
- **What nothing holds never settles.** A `<video>`, an animated image or a
  spinner the clock does not drive makes every frame differ, and one change
  swallows the rest of the sequence. `--ignore x,y,w,h` (the frames' pixels,
  repeatable) leaves that box out of every comparison; the never-settling event's
  own box is the one to pass.
- **No hold by the last frame is all it says.** A change whose last frame differs
  from the one before it is reported as reaching no hold (`noHold` in story.json),
  not as moving: on a
  sparse sequence (`check integrity --timeline --frames` ends on a rest instant
  two seconds on) the page may well have been still by then.
- **Sampling bounds what is seen.** At `0..1s/100ms` an event shorter than 100ms
  can fall between frames, and a glitch is one frame of the sequence, not one
  rendered frame; `SUMMARY.md` says so. On the wall clock (`inspect interact`) a
  script is wherever it was when each frame was shot.

Self-check: `fixtures/storyboard/planted.html` plants each kind on the held clock
(a glitch on frame 30, blink trains, a toast on timers, an eased slide, a 6% fade,
a spinner), and `storyboard-cli.test.ts` requires every one back on the frames it
was planted on.

#### Flashing — `check flash` (WCAG 2.3.1)

```bash
vlmkit check flash page.html                         # every 60fps frame of 2-10s of page time, 1280x720
vlmkit check flash page.html --window 5s --viewport 1920x1080
vlmkit check flash page.html --frames out/flash --strip worst.png   # keep the frames; one STILL sheet of the worst window
vlmkit check flash out/flash/frames.json             # judge the saved frames again, no browser
```

The page is loaded with its clock and every animation held, then shot at every
frame of a 60Hz display (frame n at `n * 1000 / 60` ms of page time). At each CSS
pixel (device pixels averaged in linear light):

| Measured | Rule |
|---|---|
| general transition | relative luminance moves ≥ 0.1 between a peak and a valley, the darker state < 0.80 |
| red transition | u′v′ moves > 0.2 to or from a saturated red: R/(R+G+B) ≥ 0.8 on linear channels, and (R − G − B) > 20/320 (IRIS's floor; without it `#000`↔`#010000` is a full-field red flash) |
| flashing pixel | more than 6 transitions in a window (t − 1s, t]; exactly 3 flashes a second passes |
| failure | the flashing pixels, closed 3x3 (a dither counts as its region), exceed 21,824 CSS px² inside some 341x256 field, slid over every position (G176; the Understanding text's 87,296 is the whole field) |

Per-pixel counting is literal: scrolling text "flashes" at every pixel it crosses.
So each failing run is re-counted, whole, with motion compensated, and is a flash
when either test still fails: a failing field's mean colour strobes (whatever
moves in front of it), or the flicker left after each pixel's state is carried
along its 16x16 block's motion (matched to a quarter or third of a pixel, either
direction) still exceeds the limit. Motion is trusted only when nothing else
explains the block as well: not a level change in place, not a pattern moved by
half its period (it matches both ways: counterphase), not a jump of more than
24px beyond how the content was moving, not a block reversing more than six
times a second. Otherwise it is `motion-flicker` (warn).

| Rule | Severity | Fires when |
|---|---|---|
| `general-flash` | suspect | the general track fails, not explained by motion |
| `red-flash` | suspect | the red track fails, not explained by motion |
| `motion-flicker` | warn | per-pixel flicker over the limit that motion explains (the solitaire deal, a carousel, a ticker) |
| `flash-unmeasured` | suspect / info | a `<video>` (paused at load, and searched for again during the sweep), an animated image (GIF / APNG / WebP / AVIF, sniffed from its frames, wherever it is drawn: `<img>`, a CSS background, mask, border image, list marker, pseudo-element content, SVG `<image>`, inside shadow roots and in every frame of the page), an image whose bytes could not be read, or pixels that change with the clock held; suspect when they — alone, or with what flashes beside them — cover more than the limit in one field, which makes the verdict "not judgeable" |
| `flash-unjudgeable` | suspect | a sequence where no 1s window holds 7 frames |
| `flash-undersampled` | warn | a pass on a sequence that is not every frame of its span (a saved sequence thinned, or a live sweep with frames that never held still), or one cut at the 10s cap |

What the held clock holds: `requestAnimationFrame`, timers (nested zero-delay
ones at 4ms, as browsers clamp them), `Date`, `performance.now`, every CSS and
Web Animation (at its own playback rate, forwards or back, never one the page
paused or cancelled; one the seek takes to its end is ended, so `finished` and
`onfinish` run and what a page chains on them begins), inside open shadow roots
and in every frame of the page (each from when its document appeared), SMIL on
each SVG's own timeline, and pages that draw on `vlmkit:seek`. A page that
navigates during the sweep is followed onto the new document.

The window defaults to each finite animation's end; for one that repeats
forever, one period past its start and a second more; for timers pending at
load, two seconds past the latest; at least 3s when something repeats or runs by
script; between 2s and 10s (`--window` takes 1s to 60s). Every frame's
animations and timers count, and at the window's end what the page began during
the sweep (an animation an `animationend` or a later timer started, an interval
set up late) extends it the same way. A page where nothing
can move under the held clock is one frame, unless `--window` is given. `--strip`
is always one still PNG of the track that carries the verdict — an animation of
a failing window would itself strobe for whoever opens it — and says so when
nothing flashed. A pass is "no flash measured under these criteria", not a
certification. Not judged: WCAG's 0.1° exception for fine balanced patterns
(such patterns are reported), a page's own video (its file is: `check flash
rec.mp4`, below), states reached by interaction,
absolute luminance (HDR), moving-pattern hazards (a grating of narrow bars moving
less than half its period a frame reads as motion; bars 16px wide or more read as
flash, since a block inside one is flat and nothing matches its motion).

#### Recordings — `scan video` (your own decoder)

```bash
vlmkit scan video rec.mp4                            # every frame → rec.mp4.frames/NNNN-t<ms>.png + frames.json
vlmkit scan video rec.mp4 --from 10s --to 20s        # the frames on screen during that span
vlmkit scan video rec.webm --at 0..3s/250ms --out k  # the frame on screen at each instant
vlmkit check flash rec.mp4 --display-width 1280      # = scan video, then check flash rec.mp4.frames/frames.json
vlmkit check flash rec.mp4 --from 10s --to 12s       # windows ending in the span, the 3s before it decoded as history
vlmkit check flash anim.gif                          # a GIF / APNG timed and looped as a browser plays it
vlmkit snapshot strip --manifest rec.mp4.frames/frames.json --max-frames 8 --out sheet.png
vlmkit scan video frames/ --pts frames/pts.txt --every-frame   # frames another decoder wrote, with their times (and keyframes)
```

vlmkit ships, depends on and downloads **no video decoder**: the ffmpeg builds on
npm are GPL and pull an 80 MB binary, and Playwright's private one decodes VP8 and
MJPEG only. `scan video` runs **your** ffmpeg and ffprobe, **5.1 or later**
(`-fps_mode`, which keeps every frame, is 5.1's; an older one is refused by name):
`--ffmpeg` / `--ffprobe`, else `VLMKIT_FFMPEG` / `VLMKIT_FFPROBE`, else the
ffprobe beside a given ffmpeg (or beside what a symlink points to), else both
found on `PATH` — never in the working directory, which Windows would search
first (only absolute entries; on POSIX an executable file, on Windows the `.com`
/ `.exe` a spawn without a shell runs). They run as separate processes with
arguments, never a shell, are killed if vlmkit is, and when missing the error
says how to install them. Any other
decoder works through the import form: numbered PNGs (named so they sort in
order) plus one timestamp in seconds per line, or `--fps` for a constant rate;
`--every-frame` says the directory holds every frame (the recipe's passthrough
writes them all), and without it nothing vouches that another tool did not thin
them, so a pass on them is not backed. The recipe in `scan video --help` names
the stream `scan video` judges (`source.video.stream`; index 0 can be a one-frame
cover track) and holds for progressive video that does not loop: plain ffmpeg
writes interlaced frames woven and a GIF as one pass. One pass of a looping
animation another tool composited is imported with `--loop <plays|forever>`,
its timestamp file ending with the pass's end, and repeated as a browser repeats it.

The frames are a `vlmkit-frames/1` sequence on the **stream clock**: `atMs` is
each frame's presentation time on the recording's own timeline, the one a
browser's `video.currentTime` counts (a video that starts 0.7s in shows its first
frame until then, and `--at 1s` is the frame a player shows at 1s); a frame is
shown until the next one's `atMs`; `index` is its position among the frames the
recording shows (a decoded frame hidden behind a successor with its timestamp is
not counted, an interlaced frame's two fields are two, every pass of a looped
GIF counts); `key` marks keyframes, and `gop` is the GOP a frame was coded in, counted in
decode order (ffprobe's `pkt_pos`) from 0: a keyframe after a predicted frame begins one, a run
of keyframes is one (only keyframes shown one after another: x264 `--open-gop` with a GOP no longer
than its B-frames decodes two keyframes back to back with frames shown between them), and an open
GOP's leading B-frames (shown before its keyframe, decoded after
it and predicted from it) are counted in it. Every frame carries it, so a selection (`--at`, a
span) that skips a keyframe still says where the codec re-quantized. An import has both when its
timestamp file is ffprobe's `key_frame,best_effort_timestamp_time,pkt_pos` (the `--help` recipe).

```json
{ "format": "vlmkit-frames/1",
  "source": { "tool": "scan video", "url": "file:///…/rec.mp4",
              "viewport": { "width": 1280, "height": 720 }, "deviceScaleFactor": 1.5,
              "browser": "ffmpeg 6.1.1", "clock": "stream",
              "video": { "file": "rec.mp4", "decoder": "ffmpeg 6.1.1", "codec": "h264", "lossless": false,
                         "streamFrames": 300, "selection": { "kind": "all" }, "pixelFormat": "yuv420p",
                         "color": { "matrix": "bt709", "range": "tv", "transfer": "bt709",
                                    "primaries": "bt709", "assumed": [] } } },
  "frames": [ { "n": 0, "file": "0000-t000000.png", "atMs": 0, "stable": true, "index": 0, "key": true, "gop": 0 },
              { "n": 1, "file": "0001-t000033.png", "atMs": 33.36666666666667, "stable": true, "index": 1, "key": false, "gop": 0 } ] }
```

What `check flash` makes of it: the frames of a whole recording are its whole
content, so consecutive indices from the first frame to the last are complete —
a pass on 25fps is a real pass, and a recording with no 7 frames inside any one
second (6fps or less) cannot fail at all — nor can a span decoded with its
history. A span is not the whole recording: `check flash rec.mp4 --from/--to`
decodes the 3 seconds before the span too and judges only the windows that end
inside it — the one ending at `--from` included, whether or not anything
transitions on it, and `--from` itself rather than the start of the frame on
screen then — so a strobe in a short span still fails, one that stops just
before `--from` fails too, and a span inside a held frame is not judged on the
second before the hold. No `--to` is to the end (a looping GIF / APNG: a
pass and a second past `--from`). Those 3 seconds are history, not the whole
past: a pixel's count depends on whether the change it is in was already counted,
so a pixel in one slow change through all of them can count one transition
differently from the whole recording, and a span verdict that one transition
decides says so, by area (judge the whole recording for the exact count; a span
whose history reaches the start counts each pixel as the whole recording does).
The motion re-count of a failing run starts 2s before its first window, the
same warm-up, judges only the windows ending in the span, and never excuses a
run it explained no step of. A damaged span is still judged only from its start. A span `scan video` wrote without its
history is reported as not backed (`flash-undersampled`), and `--at` leaves gaps.

What is measured rather than trusted (ffmpeg 6.1.1, Chromium 141 / 149; report
`docs/reports/2026-10-13-scan-video-v1.md`):

- **Which frames.** The frame table is ffprobe's decoded frames
  (`best_effort_timestamp`, which ffmpeg itself gives a decoded frame as its pts).
  ffmpeg writes the chosen ones by their index (`select`), with `-copyts`,
  `-fps_mode passthrough` and one filter graph for the whole stream
  (`-reinit_filter 0`: rebuilt on a format change, `select`'s count restarted),
  and every frame it writes is checked against the table through `showinfo`'s own
  lines: the same count and the same timestamp, so a selection one frame off fails
  even on a constant rate. `-ss` is never used: it takes the frame after a time
  where a player shows the one before it. Frames that share a timestamp are real
  (0, 0, 0, 33ms in an mkv): only the last is ever on screen, the others are
  counted as `hidden`.
- **Colour.** A tagged matrix and range are used as tagged; one the conversion
  cannot apply (ycgco, …) is refused unless `--color-matrix` names one. Untagged
  is read as BT.601 limited — ffmpeg's own default at every size, Chromium's for
  VP9 at every size, and what ffmpeg's encoder and Playwright's recordVideo write —
  and said to be assumed; `--color-matrix` / `--color-range` override it. It
  matters to a verdict: an untagged BT.709 `#00ff00`/`#00d700` strobe passes read
  as BT.601 (the green clips, ΔL 0.229 → 0.019) and fails read as BT.709. The
  conversion rounds with `accurate_rnd+full_chroma_int` (±1 level; the default
  errs by 2-3), always writes 8-bit RGB, and strips the colour chunks and ICC
  profile ffmpeg would copy from the stream (cICP / cHRM / gAMA / iCCP), because a
  browser colour-manages them and showed grey `808080` as `8c8c8c`.
- **Size and shape.** One frame pixel is one CSS pixel unless `--display-width`
  says how wide the video plays (at most 4096 CSS px a side); `check flash`
  measures its 341x256 field and 21,824 px² limit in those CSS px, so a 160x120
  strobe passes at its own size and fails played at 320px wide. Rotation is
  ffmpeg's autorotate, recorded. Non-square pixels are resampled square after the
  RGB conversion, nearest, and expanded, never shrunk, as Chromium plays a video
  (a GIF's aspect byte and a PNG's pHYs are not: a browser lays an image out at
  its pixel size).
- **Interlaced** frames are split into their fields, line-doubled, at twice the
  frame rate: woven, a field-rate strobe is a still comb that nothing flags. Each
  frame's own flag decides, so a stream that mixes progressive and interlaced
  frames splits only the interlaced ones, and a container's field-order tag over
  frames coded progressive splits none (it is said); only a codec whose frames
  carry no flag is split by the tag, in the tag's field order (a codec that flags
  nothing reads bottom first to ffmpeg). FFV1 v3 flags each frame. The doubled
  sample aspect the line-doubling leaves is undone, and a turned interlaced stream
  is split first and turned after (ffmpeg's autorotate would turn it first: a
  quarter turn splits columns). HEVC field pictures (one field per decoded frame)
  are line-doubled, never split again. Still fine detail in interlaced frames (a
  text slide, PsF) twitters at field rate once split, which the woven frames cannot
  tell from a field-rate strobe: a fail that neither field parity repeats, judged a
  frame at a time, is said not to be decisive (a strobe on one parity fails it).
- **Grey** frames of a YUV codec (AV1 4:0:0, HEVC RExt), and any grey tagged
  limited or given `--color-range`, are luma, limited range unless tagged, the
  range kept through the conversion; an untagged grey PNG or GIF is its own levels.
- **Alpha** is composited over `--background` white (default) or black, never
  dropped: dropping it shows whatever colour sits under transparent pixels, which
  can be a strobe nobody sees, or hide one they do. A WebM's alpha is decoded with
  libvpx, as ffmpeg's own VP8/VP9 decoders drop it.
- **A GIF / APNG plays as a browser plays it**, not as ffmpeg decodes it:
  each frame held for its stored delay, or 100ms when that is 10ms or less (Chromium,
  measured; an APNG delay in whole ms first), and looped as it loops (NETSCAPE2.0 or
  ANIMEXTS1.0; loop count N plays N + 1 times) — unrolled as far as the selection
  reaches, and by default to the frame on screen one second past one pass, which
  holds every one-second window of the loop. ffmpeg decodes one pass: a two-frame
  black/white GIF looping at 100ms is five flashes a second on screen and one
  transition in that pass. A `.png` that is an animated PNG (its `acTL`, found
  by walking chunk headers) is a recording; an APNG plays the frames its `acTL`
  declares, and is decoded as one (`-f apng`: ffmpeg's own probe reads an APNG
  with ~2 KB of metadata before its first frame as one still PNG). A GIF whose
  images ffmpeg merges (an image with no graphic control extension) is refused,
  with a recipe: fewer frames than the browser shows can only miss a flash. So is
  one ffmpeg composites otherwise, which needs a global colour table and an image
  with no transparent colour (else ffmpeg fills transparent, as a browser does): a
  first image larger than the logical screen, or smaller and opaque; a frame
  disposed to background, opaque, that the next image does not paint over; and
  restore-to-previous over ffmpeg's background fill (a sprite restored over an
  opaque first frame is not: both restore that frame). The recipe's import repeats
  the loop (`--loop`). After a finite animation's last pass its last frame stays on
  screen, so a span there is in the recording.
- **Lossy recordings.** Codec noise does not invent or hide a full-field strobe
  (measured at crf 23/35/45 and Playwright's VP8), but `check flash` says when a
  lossy or chroma-subsampled recording's area is within 5% of the limit (4:2:0 took
  a red/black box's 1px rim off, ringing grew a black/white one by 3%), and when a
  lossy stream with more than 3 keyframes a second fails (a two-frame GOP made dense
  static text pump). Near-black is black for chromaticity: a codec decodes black as
  (1,0,0), red's own chromaticity, and a red strobe just over the limit passed.
- **Refused, never black frames**: no video stream (cover art is not one), an HDR
  transfer (PQ / HLG: ffmpeg passes the code values through as SDR; tone-map to
  the SDR version you publish first), a stream that changes size (found in the
  frame table, before decoding), frames without timestamps (a raw elementary
  stream: re-encode it at its rate) or out of order, anything the decoder cannot
  read, and more frames than `--max-frames` (3600 by default, at most 9999: the
  files are numbered in four digits). A truncated file decodes what it holds and
  exits 0, so the decoder's error lines — those it logs at error level from the
  demuxer and decoder, never the metadata, plus the warnings that say a packet
  was corrupt or lost — are kept in `source.video.decodeErrors`. A lost packet
  makes the recording `damaged`: frames may be missing, so a pass on it is not
  backed. Frames that end well before the stream's stated end are a last frame
  held to it when the file decoded cleanly (a span may reach it), and a file cut
  short when the decoder reported errors (damaged; a span in the lost part is
  refused).
- **The output directory** is `<recording>.frames/` (`rec.mp4.frames/`, so
  `clip.mp4` and `clip.webm` do not share one), cleared of the previous scan only
  once the new frames are decoded and checked, never of the recording itself (a
  recording named like a frame, in the directory it is scanned into, is refused);
  a directory holding another tool's `frames.json` is refused, by an import too;
  a lock file keeps two scans out of one directory, in one process too, and one
  from another host or container (whose pid says nothing here) is taken as
  abandoned only after a day; a path that is a file is refused before anything
  is decoded.

`snapshot storyboard` compares a lossless recording (ffv1, png, qtrle, …) exactly,
like any capture: a planted one-frame glitch and a four-frame transient come back on
their frames. Frames from a lossy codec (`lossless: false`) are refused unless given
`--lossy`, which compares them through a noise band, because a codec does not give
back the picture it was given — the same still screen decodes differently frame to
frame, most of all at sharp edges and across a keyframe, and compared exactly a
lossy recording was one change that never settled:

| Rule | `--lossy` (`LOSSY_NOISE`) |
|---|---|
| what is compared | each pixel as the mean of its 3x3 neighbourhood (a codec's error is mostly ringing, which the mean cancels) |
| in the state, back, an earlier state | no mean more than 32 from the state's picture |
| return across a GOP | in a GOP that began during the event, a frame within the re-quantization bands of the state (no 8x8 block mean moved past 24, no mean past 96), nearer it than the event inside the event's first box and clear of the event there, away from that box a keyframe's re-encoding (as the keyframe row), the rest of the frame one picture with its GOP's keyframe (its first frame, before the keyframe is shown; outside everything past the floor where the event began on a keyframe), nothing inside the box 56 or more from both the state's picture and the event's (something new there: a counter that ticked inside a toast's box), and the page holding after it; the event's box and picture taken over the codec's smear (3 frames or 50 ms): dated back to the first frame of its GOP within 24 of it, and the state read again at the frame that holds. A settle across a GOP is judged the same way on the box it measured |
| one picture (a hold) | every mean within 24 of the hold's first frame, and the mean over the change's box (a line's thin side grown to whole 8x8 blocks, a codec's) within 3 of it (never only the frame before, or a slow ramp is one long hold) |
| drift | a change no step of which, between frames up to 50 ms or 3 frames apart and inside its box, moves a mean past 32 (a step inside 24 is none) |
| keyframe | on a GOP's opening (where it begins, by frames.json `gop`, else a keyframe after a predicted frame, through its keyframe: an open GOP's leading B-frames come first), a frame that is the state's picture as a keyframe re-encodes it: no 8x8 block mean moved past 24, no 16x16 block mean past 12 and no mean past 40 — or no mean past 48 and no more than a quarter of the means past the floor past 40, spread like a re-encoding (three separate spots across a quarter of the frame's width or height, or spots whose box spans a quarter of both) or in two or more spots apart whose 8x8 means moved by 12 at most, never one spot (a letter changed on a keyframe is one). Where the state's picture changed since its GOP's keyframe (it was coded by prediction, and the next keyframe codes it afresh), from the keyframe on, means past 40 to 56 in 8x8 blocks that moved by 12 at most. Around an event, for a return, one spot is a re-encoding too. Each frame of an opening is tested against the state's picture from before it. The state is read again there — except on a leading frame whose keyframe fails and moves a mean past 40 where the leading frame departs: that is the change's pre-echo, held (neither read again nor an event), so the change begins on the keyframe. Inside a run of keyframes (MJPEG, an intra-only encode) only spread, and only when the page then holds. A GOP whose keyframe a selection left out is opening throughout. Each re-read, and each return and settle read again, is in `reread` in story.json; SUMMARY.md names the first 12 and how each was judged |
| box | the decoded pixels past 32 inside the means' box grown by 2 px, each frame against the state's picture in its GOP: a 1 px caret is drawn 1 px wide on 10 of 13 encodings (3-4 px on the others), not the 3 px the means give. In a GOP where that picture is not known and whose keyframe (for a leading frame, the frame itself) moved a mean past the floor away from the event, only near blocks past re-quantization (an 8x8 mean past 24, or 3x3 means past 48 — two of them around a block, not a lone one), with the event's parts that do not look like a re-encoding (a 1px rule beside a label: past 40 with its 8x8 means moved), those on its first frame |

`--lossy` on frames that are not from a lossy recording changes nothing, and says so.
`--noise still,floor[,radius]` applies a band of one's own to any frames, with
`--lossy`'s hold and keyframe bands. The band was chosen on known answers:
`fixtures/storyboard/planted-ui.html` captured lossless and encoded with x264, x265, VP8
(as Playwright records), VP9, AV1 and MJPEG at several qualities, each storyboard scored
event by event against the lossless one
(`docs/reports/2026-10-16-storyboard-noise-floor-v1.md`). What it cannot see, which the
output does not detect: a change smaller than the floor over a 3x3 mean (a 6% fade: a fade
begins late and ends early by the part of it inside the floor); a change the keyframe row
admits — means past the floor by at most 8, or by 16 where spread (several changes made at once
count) or in spots apart whose blocks barely moved, by 24 where the picture changed since its
GOP's keyframe, no block moved — landing on a GOP's opening, or
anywhere in a run of keyframes when spread, where it reads as the page re-encoded (a label
recoloured 40% at a keyframe; the same change mid-GOP is reported on x264); a change within that
band made elsewhere while an event spanning a keyframe is up; blinks whose off-time is at most
the 100 ms hold, the first on a noisy opening, which merge, and a change inside an event's box
that settles within 100 ms of a keyframe, which merges with the event; an oscillation (a spring's
overshoot) that holds at a slow turning point and swings on as a second event; and a recording a
codec has destroyed (x264 crf 45). A faint part of an event that looks like a keyframe's
re-encoding on the keyframe it began on is cut from its box. What it reports and is wrong about,
flagged as beginning on a keyframe: a keyframe that re-encodes a still page past the keyframe row
— x264 at crf 35 and above, x264 `open-gop` at crf 32, a 1080p page at x264 crf 32, the last
keyframe of an x264 or x265 stream (coded coarser) from crf 27-29 — and the codec refreshing a
band at a time with no keyframe (intra refresh); an x265 leading frame's pre-echo past the band
that is gone before the keyframe, as a glitch before the change; x264's first two frames of an
intra-only stream (means 56 apart at crf 28, 16x16 blocks 14) are said by the run note when an
event begins there. For a lossy recording, SUMMARY.md says when no frame
is marked a keyframe, when a selection has no GOP numbers or left out a GOP's keyframe, when only
frame 0 is marked (a recording shorter than one GOP, or intra refresh; or frames inside one GOP)
and when every frame is (a run of keyframes); it names a leading frame read again, and an event
that begins on one, as what it is; it says when keyframes
fell inside an event that never settled, and that from those GOPs the box takes only blocks
that moved past re-quantization.

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
