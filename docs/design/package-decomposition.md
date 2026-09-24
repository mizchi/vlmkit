# Package decomposition: split by layer, not by feature

Status: phase 1 landed (`@mizchi/vlmkit-judge`: the three design-quality gates,
then `check integrity`). Phases 2-5 are proposals with the measurements they
rest on. The agent-facing surface — `vlmkit` CLI verbs,
flags, JSON reports, MCP tools, skills — does not change in any phase. Import
paths don't change either: every module that moves leaves a re-export behind.

## What was measured (2026-09-24)

| Package | Source lines (non-test) | What it actually holds |
|---|---:|---|
| `vlmkit-markup` | 47,098 | 28 of 30 gates, *and* their collectors, judges, formatters, Playwright runners, the MoonBit markup core, and the markup-synthesis loop |
| `src/` (root CLI) | 37,846 | CLI router (6k), VRT snapshot/compare (6k), experiments (15k), API server, demos |
| `vlmkit-anim` | 15,420 | explanatory animation IR, compilers, runtime, CLI |
| `vlmkit-core` | 11,181 | plugin runtime + pixel diff engine + **1,894 lines of Playwright-bound driver code** (`browser-launch`, `page-open`, `page-load`, `mask`, `element-compare`) |
| `vlmkit-capture` | 3,269 | Crater / Playwright capture, viewport discovery |
| others | ~7,500 | `ai`, `heal`, `generate`, `plan`, `mcp`, `animation-eval` |

The weight is not spread across features. It sits in the fact that **every
check module holds the same four layers in one file**:

```
COLLECT_X   = `(() => { … })()`   // in-page JS: DOM + getComputedStyle → plain snapshot
judgeX(input, opts)               // pure: snapshot → findings + verdict
formatXReport(report, rules)      // presentation: ANSI prose, markdown
runXCheck(options)                // driver: withBrowser → goto → settle → evaluate → judge → ledger
```

35 modules in `vlmkit-markup` call `withBrowser` themselves, and 17 hold 30
in-page collector scripts. The judges were already pure *in intent* — "pure,
so every threshold above is testable without a browser" is in the source — but
living next to `runXCheck` meant they inherited its imports. The one real leak
found: `selector-exemption.ts` (the `--allow` parser that every style gate
uses) was pure except for `UsageError`, whose module imports `node:fs`.

So the proposed packages follow the layers, and each of the four areas you
named corresponds to one layer:

| Layer | Package | The contract it owns |
|---|---|---|
| Pure judgement: geometry, colour, rules | `@mizchi/vlmkit-judge` (new) | snapshot types in, findings out. No DOM, no Playwright, no `node:*` |
| Browser as a computer | collectors (`COLLECT_*`), phase 2 | DOM → snapshot. Strings with no imports, run by whatever driver there is |
| Driver | `@mizchi/vlmkit-capture` + core's Playwright half, phase 3 | open / settle / evaluate / screenshot behind one interface |
| Generation loop + eval datasets | `vlmkit-markup` (what remains), `heal`, `generate`, `plan` | agents converge markup against the gates |
| Diagrams for explanation | `vlmkit-anim` (+ d2 skills), phase 5 | separate library |

## Phase 1 (done): `@mizchi/vlmkit-judge`

Moved, with every original path re-exporting the moved symbols:

| From | To | Lines |
|---|---|---:|
| `vlmkit-markup/src/style/composition.ts` (judge half) | `vlmkit-judge/src/composition.ts` | 854 |
| `vlmkit-markup/src/style/color-roles.ts` (judge half) | `vlmkit-judge/src/color-roles.ts` | 450 |
| `vlmkit-markup/src/style/design-policy.ts` (judge half) | `vlmkit-judge/src/design-policy.ts` | 595 |
| `vlmkit-markup/src/inspect/selector-exemption.ts` | `vlmkit-judge/src/allow.ts` | 170 |
| `UsageError` from `vlmkit-core/src/cli-error.ts` | `vlmkit-judge/src/errors.ts` | 13 |
| `vlmkit-markup/src/inspect/integrity-check.ts` (15 judges, A1-A13 types) | `vlmkit-judge/src/integrity.ts` | 1,119 |
| `vlmkit-markup/src/inspect/integrity-exemption.ts` | `vlmkit-judge/src/integrity-allow.ts` | 188 |

`check integrity` followed as the largest single win: 15 exported judges and
9 in-page collectors in one 2,172-line file, now 1,119 lines of judges and 1,088
of collectors + runner. Its judges already had a second, non-browser caller:
`integrity-image.ts`, the image mode `vlmkit#116` asked for on behalf of a
canvas/WebGPU game engine (a frame PNG plus an element-rect JSON — the DOM as
one adapter among several). That adapter imported the judges *through*
`integrity-check.ts`, so it loaded 21 modules including `playwright` to call
pure functions. It now imports `@mizchi/vlmkit-judge/integrity.ts` directly and
its built module graph is 2 modules with no `playwright` (checked by walking
`dist/`). That is the scene-graph case of phase 2 already in production, with
its adapter living beside the DOM one.

Why the three design-quality gates came first: they are the design-quality gates (`check design`,
`check composition`, `check color`), they already share their plumbing, and
their inputs are the most scene-shaped — boxes with a parent index, a rect,
font size and weight, paint. They are also the gates whose thresholds carry
the most measurement history, so moving them unchanged (a line-range slice,
not a rewrite) is the safest proof that the split is mechanical.

What holds the layer in place:

- `vlmkit-judge/src/purity.test.ts` fails if any source file imports anything
  outside the package or touches `window` / `document` / `process` / `Buffer` /
  `require`. Mutation-checked: adding `import … from "node:fs"` to `allow.ts`
  fails it.
- `vlmkit-judge/src/scene-graph.test.ts` runs `judgeComposition` on a game
  settings menu written as a scene graph (positions local to the parent, as an
  engine stores them). It catches a title that drifted toward the section above
  it and honours an `--allow` written against the scene path. Its adapter is
  kept in the test on purpose: see phase 2.
- `UsageError` moved to the bottom layer and `cli-error.ts` re-exports the same
  class, so `instanceof UsageError` is one identity everywhere.
  `scripts/smoke-packed-workspaces.mjs` asserts that on the packed tarballs,
  and that `vlmkit-markup/style/composition.ts` re-exports the judge rather than
  holding a copy.

Dependency direction after phase 1: `judge ← core ← capture ← markup`. Judge
depends on nothing.

## Phase 2: the snapshot is the contract (collector ↔ judge)

Status: the contract and the colour arithmetic landed. What is left is below the first
"Next" heading.

### What landed

- **The scene contract is the image-mode elements file.** `@mizchi/vlmkit-judge/scene.ts`
  defines `SceneElement`. It is the `--elements` JSON that `check integrity` and `check copy`
  already accepted in image mode, which is itself a superset of `diff png --elements-json`.
  So no second shape exists, and an engine that already emits the file speaks the contract.
  New optional fields carry paint (`color`, `background`, `background_image`, `opacity`,
  `text_shadow`, `disabled`) and type (`font_size`, `font_weight`, `heading`, `border`,
  `radius`). The parser, the integrity adapter (`judgeSceneIntegrity`) and the skipped-rule
  list moved there from `integrity-image.ts`, which is now the 112-line half that reads files.
- **Two adapters out of the contract**: `judgeSceneIntegrity` for `check integrity`, and
  `sceneToCompositionInput` for `check composition`. **One adapter into it**:
  `sceneFromTree` flattens an engine-style graph (positions local to the parent) into frame
  space. `scene-graph.test.ts` now uses the library adapters, not an inline one.
- **`@mizchi/vlmkit-judge/color.ts`**: `parseColor` (resolved colours only), `blendColor`,
  `contrastRatio`, `compositeBackground`, `textContrastFloor`, `measureTextContrast`. These are
  the page's own functions, including the 0.03928 threshold and the output rounding.
- **The rule, end to end, in one place.** Image mode now runs `invisible-text` and
  `low-contrast-text` whenever text elements carry `color`. The engine hands over the RGBA it
  paints, and the judge composites and measures. An elements file without paint reports
  byte-for-byte what it did before, skipped-rule order included.
- **Held to the browser by a test, not by care.** `vlmkit-markup/src/contrast-parity.test.ts`
  runs `CONTRAST_BACKGROUND_JS`'s functions in Node against `color.ts` over a grid of
  inputs. It then runs the real `COLLECT_TEXT_CONTRAST` on a page, collects the same page as a
  scene, and requires identical candidates (colours, ratio, floor, font size). A mutation
  check confirms it bites: dropping opacity from `measureTextContrast` fails it on the one
  faded element.

One deliberate difference from the page: a browser composites a missing background over
white, because white is what it paints under an unpainted document. A scene has no such
default (an engine's clear colour is whatever it is). So a text element with no opaque
background on itself or a recorded ancestor is **refused and listed**, not measured against
a white the frame may not contain.

### Next


For a game's scene graph to use the judges, the snapshot has to hold **facts**,
not conclusions the browser already reached. Today the boundary is wherever it
was convenient:

- `COLLECT_COLOR_ROLES` computes `contrastRatio(blendColor(…))` *inside the
  page* and ships the ratio. A scene graph would have to reimplement that to
  produce a `ControlBoundary`. The composite and the ratio belong in the judge;
  the collector should ship the resolved colours.
- Contrast / luminance math exists five times in TypeScript (`asset-check`,
  `component-from-image` ×2, `spec-checks`, `page-compose-diff`) plus the
  in-page copy in `CONTRAST_BACKGROUND_JS`. One `vlmkit-judge/color.ts` would
  replace the TypeScript ones. The in-page copy stays, because some of it can
  only be done by the browser — see below.

What **is** browser computation and stays in the collector: layout (rects),
`getComputedStyle`, and colour-space conversion. `CONTRAST_BACKGROUND_JS` reads
`lab()` / `oklch()` back by rasterising a pixel, which is the browser's own
gamut mapping. That was the fix that took `check a11y contrast` from 10 to 501
inspected elements on tailwindcss.com. A pure judge must not try to redo it.
The rule: **the collector resolves, the judge decides.**

Still to do on the DOM side:

- ~~Move the in-page ratios out of `COLLECT_COLOR_ROLES`.~~ Done. The collector now ships
  `ControlSample` (the composited surface behind the field, its own fill, each painted
  border's colour) and `LinkSample` (both inks, and the surface under them or `null` over
  an image). The judge's `controlBoundary` / `linkCue` compute `fillRatio`, `borderRatio`,
  `best` and `vsBody` with `color.ts`. `judgeColorRoles` still accepts the old measured rows,
  so a saved snapshot judges the same. **Proof that nothing moved:** `check color --json` on
  15 pages (css-challenge fixtures, the demo sites, a composition fixture; 17 controls and
  ~200 links, several with findings) was byte-identical before and after. What stays in the
  page is compositing the palette's ink rows (`hex(blendColor(behind.bg, fg))`). That is an
  aggregation keyed by the painted colour, not a verdict, and moving it would mean shipping
  every box.
- ~~`COLLECT_TEXT_CONTRAST` ships ratios.~~ Done. It now ships `TextContrastSample`s: the
  text's resolved colour, the background layers behind it (innermost first, from the new
  in-page `textBackgroundLayers`), its inherited opacity, font size and weight, and the
  disabled / shadowed flags, or `composite: true` over an image. The judge's
  `textContrastCandidates` composites, measures, applies the WCAG floor and the 60-candidate
  cap. The scene adapter builds the same samples and goes through the same function, so the
  page and a scene no longer have two loops. **Proof that nothing moved:** `check integrity
  --json` on 16 pages was byte-identical before and after. One of those pages was built to
  cross the cap: 80 low-contrast rows, with text over gradients before and after the 60th
  candidate. Between them the 16 pages have 32 contrast findings and 27 contrast exemptions.
- A scene adapter for `check color`. The arithmetic no longer needs a browser, but the
  roles still come from the DOM: which element is a text field, which link sits in a prose
  flow. A scene would need a `role` (`field`, `link`) and the flow's own text length to
  produce `ControlSample` / `LinkSample`.
- Replace the five TypeScript copies of contrast/luminance (`asset-check`,
  `component-from-image` ×2, `spec-checks`, `page-compose-diff`) with `color.ts`. Check each
  one's threshold first: not all of them use 0.03928.
- Let the DOM collectors emit `SceneElement`s directly, so one page collection feeds
  integrity, composition and colour. That is the "collect once, judge many" of phase 3.
- A `DesignSample` adapter for `check design`. Its signature is a joined style string, so the
  scene would need a `signature` field or the judge would need to build one from the fields.

Next judges to move, ranked by pure functions already exported:

| Module | Lines | Exported pure judges | Note |
|---|---:|---:|---|
| `a11y-touch.ts` | 549 | 2 | |
| `inspect/grounding-scan.ts` | 1,228 | 2 | |
| `inspect/copy-check.ts` | 981 | 1 | |
| `stress/breakpoint-check.ts`, `inspect/scroll-scan.ts`, `a11y-contrast.ts`, `a11y-focus-order.ts` | 400-640 each | 1 | |

`handler-map.ts` (4,384 lines, 0 exported judges) and `interaction-map.ts` are
driver-shaped: they patch and probe a live page. They belong in phase 3, not
here.

## Phase 3: one driver interface

Each of the 35 `runXCheck` functions repeats the same sequence: `withBrowser` →
`newPage(withAuthState(…))` → optional `routeFromHAR` → `goto` → `settlePage`
→ `describeRedirect` → `evaluate(COLLECT)` → judge → `appendRunLedger`.
Extract that sequence as a `collect(source, script, opts)` behind an interface
that covers `goto / evaluate / screenshot / setViewport / route`, and move
core's 1,894 Playwright-bound lines to `vlmkit-capture` (renamed in spirit to
the driver), with core re-exporting as usual.

That interface is where the alternatives plug in:

- `mizchi/chaosdriver` for debugging: the same collect call replayed under
  perturbation.
- A `jev-ultrafast`-style driver (browser-use/jev-ultrafast): a warm browser
  and a cheaper round trip per evaluate.
  `docs/reports/2026-08-06-gate-rule-cost-bench.md` measured `run` at ~100% of
  a gate's wall clock, and four gates at ~60% of a sweep. So the driver is the
  only layer where speed can be bought.

Collect once, judge many is the payoff: `check design`, `check composition`
and `check color` each launch a browser today to read nearly the same boxes.

## Phase 4: loop and datasets

What stays in `vlmkit-markup` after phases 2-3 is the generation side: verify
/ autofix, component-from-image, contract scaffold, story-vrt, the MoonBit
markup core. Together with `heal` / `generate` / `plan`, that is the markup
loop. The evaluation data it's judged against is spread around today:
`fixtures/`, `design-runs/`, `examples/sites/*/judgment.sqlite`,
`examples/markup-vrt-eval/`, `fixtures/composition/` paired mutants. Give it
one manifest (id, source, what it's for, expected verdicts per gate) before
moving any files, so a dataset entry can be judged by name.

## Phase 5: diagrams out

`vlmkit-anim` already has **zero** static imports of other workspace packages.
It reaches `animation-eval` and `ai` only through optional peers and dynamic
import. Moving it to its own repository is a repo move: `docs/anim-ir.md`,
`fixtures/anim-scenario/`, the `explain-with-anim` / `explanatory-animation` /
`d2-*` skills, the `pr-visual` workflow. The shared evaluator
(`vlmkit-animation-eval`) stays here as the thing both depend on.

## What did not change, and what to watch

- CLI verbs, flags, `--json` shapes, MCP tools, skills: untouched. The gates
  still import from their old module paths.
- `@mizchi/*` resolves through `exports` to `dist/`, so the new package has to
  be built before a typecheck or a CLI run sees it. `pnpm build:packages`
  orders it first, because core now depends on it.
- A re-export shim (`export * from …`) keeps the old path working. Remove
  those shims only in a major version, after the CHANGELOG says where each
  symbol went.
