# Non-blog pattern dogfood

Date: 2026-05-20

## Scope

ブログ以外の UI パターンで、`docs/design-pattern-feasibility.md` の分類が
実際の vlmkit loop に耐えるかを確認した。

この run は AI 生成画像ではなく synthetic target HTML から PNG を作った。
目的は visual quality ではなく、既存の `build component` signal がどの
パターンで足りなくなるかを早く見ること。

対象:

- landing page: hero / CTA / media slot / next-section hint
- Discord-like app shell: rail / sidebar / main scrollport / member panel
- dashboard: filter form / KPI repeats / chart region / table / alerts
- responsive stretch: mobile/tablet/desktop/wide width stress
- canvas game: screenshot ではなく canvas state / input / frame delta が主語
- expressive menu: semantic menu / selected state / composition metadata が主語

## Commands

```bash
node design-runs/patterns-20260520/capture-targets.mjs

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/landing/target.png \
  design-runs/patterns-20260520/landing/current.html \
  --goal landing \
  --output-dir design-runs/patterns-20260520/landing/reports/component

node src/cli/vlmkit.ts contract introspect \
  design-runs/patterns-20260520/app-shell/current.html \
  --pattern app-shell \
  --goal app-shell \
  --viewport desktop:1440x900 \
  --viewport mobile:390x844 \
  --out design-runs/patterns-20260520/app-shell/ui.contract.json

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/app-shell/target.png \
  design-runs/patterns-20260520/app-shell/current.html \
  --contract design-runs/patterns-20260520/app-shell/ui.contract.json \
  --output-dir design-runs/patterns-20260520/app-shell/reports/component

node src/cli/vlmkit.ts contract introspect \
  design-runs/patterns-20260520/dashboard/current.html \
  --pattern dashboard \
  --goal app \
  --viewport desktop:1440x900 \
  --viewport mobile:390x844 \
  --out design-runs/patterns-20260520/dashboard/ui.contract.json

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/dashboard/target.png \
  design-runs/patterns-20260520/dashboard/current.html \
  --contract design-runs/patterns-20260520/dashboard/ui.contract.json \
  --output-dir design-runs/patterns-20260520/dashboard/reports/component

node src/cli/vlmkit.ts contract introspect \
  design-runs/patterns-20260520/responsive-stretch/current.html \
  --pattern landing \
  --goal app \
  --viewport desktop:1440x900 \
  --viewport mobile:390x844 \
  --viewport tablet:768x900 \
  --viewport wide:1920x1080 \
  --out design-runs/patterns-20260520/responsive-stretch/ui.contract.json \
  --profile

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/responsive-stretch/target.png \
  design-runs/patterns-20260520/responsive-stretch/current.html \
  --contract design-runs/patterns-20260520/responsive-stretch/ui.contract.json \
  --output-dir design-runs/patterns-20260520/responsive-stretch/reports/component

node src/cli/vlmkit.ts contract introspect \
  design-runs/patterns-20260520/game/current.html \
  --pattern canvas \
  --goal canvas \
  --viewport desktop:1280x720 \
  --out design-runs/patterns-20260520/game/ui.contract.json

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/game/target.png \
  design-runs/patterns-20260520/game/current.html \
  --contract design-runs/patterns-20260520/game/ui.contract.json \
  --output-dir design-runs/patterns-20260520/game/reports/component

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/expressive-menu/target.png \
  design-runs/patterns-20260520/expressive-menu/current.html \
  --contract design-runs/patterns-20260520/expressive-menu/ui.contract.json \
  --output-dir design-runs/patterns-20260520/expressive-menu/reports/component

node src/cli/vlmkit.ts contract validate \
  design-runs/patterns-20260520/app-shell/ui.contract.json

node src/cli/vlmkit.ts contract validate \
  design-runs/patterns-20260520/game/ui.contract.json

node src/cli/vlmkit.ts contract validate \
  design-runs/patterns-20260520/dashboard/ui.contract.json

node src/cli/vlmkit.ts contract validate \
  design-runs/patterns-20260520/responsive-stretch/ui.contract.json

node src/cli/vlmkit.ts contract validate \
  design-runs/patterns-20260520/expressive-menu/ui.contract.json

node design-runs/patterns-20260520/check-patterns.mjs
```

## Results

| Pattern | Goal result | Component metrics | Pattern checks |
|---|---|---|---|
| landing | `landing` pass | pixel 8.00%, landscape 1.12% | CTA in first viewport, next-section hint, media slot all pass |
| app-shell | `app-shell` fail | pixel 4.00%, landscape 0.14% | channels and members scroll; messages is broken |
| dashboard | `app` pass | pixel 17.53%, landscape 1.06% | semantic shell, filter form, 4 KPIs, 5 rows, chart, alerts all pass |
| responsive-stretch | `app` pass | pixel 7.41%, landscape 0.67% | no horizontal scroll, bounded wide container, readable measure, bounded cards, stable media aspect all pass |
| game | `canvas` pass | pixel 0.95%, landscape 0.02% | canvas nonblank, frame delta, input response, state hook fields all pass |
| expressive-menu | `expressive-menu` pass | pixel 7.30%, landscape 2.54% | semantic shell, selected state, pixel-sampled contrast, composition markers all pass |

The app-shell case is the important Red:

```text
App shell fail: landscape 0.14% <= 5.00%, scrollports 2/3 ok, 1 broken
expected 2/3 ok, 1 expected broken: messages
scrollports: 2/3 ok, 1 broken
scrolled induced 1.62% (2 applied)
```

The visual layout is close enough, but the goal now fails because the actual UI
is broken: `messages` has overflowing content and `overflow-y: visible`, so the
message list is not an independent scrollport.

## Findings

### Finding 1: landing needs CTA/hero gates, not only landscape

`--goal landing` worked for the synthetic landing target:

- landscape 1.12% is low enough to trust the broad layout
- pixel 8.00% reflects acceptable media/decorative drift
- first viewport checks confirmed CTA, media slot, and next-section hint

The `landing` profile keeps landscape as a major signal and adds
product-specific gates:

- primary CTA visible in first viewport
- hero offer / product name visible
- next section hint visible
- media slot has stable aspect ratio and crop bounds

### Finding 2: app-shell can visually pass while behavior fails

The app-shell run deliberately kept the screenshot close while breaking the
message scrollport. Before this dogfood, `build component` only said:

- `layout` pass
- `region "Messages"` had `Scroll: none`

That was useful but too buried, and it did not summarize app-shell behavior.
The implementation now adds a first-class `Scrollport inspector` section for
explicit `[data-scrollport]` candidates.

Current report evidence:

```text
| broken | `messages` | 336,58 848x769 | visible/visible | 848x769 | 848x1335 | content overflows but overflow is not scrollable |
```

This is now part of the `app-shell` goal profile. A shell with expected
scrollports does not pass only because landscape is close.

### Finding 3: dashboard is a useful introspection stress case

The dashboard scenario exercises the middle layer between document landmarks
and visual pixels:

- semantic shell: `header`, `nav`, `main`, named `search`, named `region`,
  and `complementary`
- repeat evidence: 4 KPI cards, 5 account rows, and 3 alert rows
- content evidence: form controls, table text, chart region, and alert density
- responsive evidence: desktop 2-column dashboard collapses to mobile
  one-column order through `responsive` rules

The component run passed with pixel 17.53% and landscape 1.06%:

```text
Practical app pass: landscape 1.06% <= 3.00%, pixel 17.53% <= 25.00%
scrollports: 1/1 ok, expected 1/1 ok
```

This is a good scenario for checking whether the intermediate UI Contract IR
is doing real work. Pixel diff stays high because chart/table paint and text
details differ, but landscape and semantic content are close enough to move
forward as an application implementation.

### Finding 4: responsive stretch needs width stress, not just screenshots

The responsive-stretch scenario checks whether a design still feels plausible
when widened or narrowed:

- no horizontal scroll at 390, 768, 1440, and 1920px
- wide container remains bounded instead of becoming a 1920px line
- readable text measure stays under 700px
- repeated cards do not become huge tiles on tablet or desktop
- media slot keeps a stable 4:3-ish aspect ratio
- next section remains visible in large first viewports

The useful Red was not a pixel mismatch. The first tablet pass let `.copy` and
cards stretch too much, so the view looked technically responsive but visually
loose. Green came from keeping the copy width bounded, allowing tablet cards to
stay multi-column, and stacking cards only below 640px.

Current check evidence:

```text
mobile 390: container 350, measure 350, max card 350, media 1.33
tablet 768: container 707, measure 660, max card 225, media 1.33
desktop 1440: container 1160, measure 624, max card 373, next visible
wide 1920: container 1160, left 380, measure 624, max card 373, next visible
```

This should become a reusable scenario shape: one target image can still be
desktop-sized, but the contract/check phase must include width stress probes
for liquid regions, scroll regions, and min/max bounds.

### Finding 5: game/canvas needs a different command family

The game target passed `canvas`:

- pixel 0.95%
- landscape 0.02%
- canvas nonblank
- frame delta detected
- `ArrowRight` changes `window.__gameState.playerX`
- `window.__gameState` exposes `mode`, `frame`, `playerX`, `playerY`,
  `score`, and `assetsReady` from the UI Contract

The component report still sees `main "Skyline runner"` at the DOM layer, but
it now also emits a `Canvas inspector` section with Contract-derived state hook
and required field checks. This is enough for a first `build component` goal. A
future `build interactive` or `build canvas` flow should add multi-state
screenshots, HUD overlap, asset visibility, and richer input assertions.

### Finding 6: synthetic targets are useful for Red/Green loops

AI-generated mocks are still the real target for design dogfood, but synthetic
HTML targets are faster for feature development:

- deterministic PNGs
- easy to create intentional failures
- good for testing report semantics
- cheaper than running image generation for every tool iteration

This suggests two dogfood layers:

1. synthetic targets for tool signal development
2. generated mocks for real design quality and prompt feasibility

### Finding 7: expressive UI needs a composition lane, not pixel chasing

The red/black poster menu stayed practical when layout and decoration were
split:

- semantic shell: `header`, `nav`, `main`, named status `section`
- menu affordance: real buttons with real text, selected state, focus-visible
  and hover states
- composition metadata: `data-composition-layer` and `data-shape`
- feasibility gate: high contrast and diagonal/layered evidence

The component run passed with pixel 7.30% and landscape 2.54%. Pixel diff is
still useful for local polish, but the acceptance signal should be the
semantic/composition contract:

```text
Expressive menu pass: landscape 2.54% <= 5.00%, expressive selected ok,
menu text ok, items 5, composition 6 layers/9 shapes, diagonal ok,
contrast ok, contrast min 5.03, 0 low contrast, hover changed, focus changed
```

Forced states also became visible:

```text
:hover induced 5.35% (5 forced)
:focus-visible induced 5.35% (5 forced)
```

This confirms the flow: keep the underlying layout editable with grid/flex and
landmarks, then let the composition lane describe the non-orthogonal visual
language.

## Implementation changes from this run

Added scrollport reporting to `vlmkit build component`:

- capture explicit scrollport candidates from:
  - `data-scrollport`
  - `data-vlmkit-scrollport`
  - `data-ui-scrollport`
  - `data-scroll-region`
- report status:
  - `ok`: content overflows and overflow is scrollable
  - `broken`: content overflows but overflow is not scrollable
  - `empty`: marked as scrollport but content does not overflow
- print CLI summary, e.g. `scrollports: 2/3 ok, 1 broken`

Added `--goal app-shell`:

- uses the same broad landscape threshold as layout-first app shells;
- fails when any explicit scrollport is broken;
- sends missing or empty scrollport evidence to review instead of pass.

Added `--contract` to `build component`:

- reads UI Contract `goal` when `--goal` is omitted;
- injects pseudo-state captures from `requiredStates` when `--states` is omitted;
- compares captured app-shell scrollports against `expectedScrollports`, so
  the summary can name the broken expected region, e.g. `messages`.
- applies `scrolled` state by scrolling contract-targeted scrollports and
  reporting the rendered delta.

Added `--goal landing`:

- uses landscape + a looser pixel threshold for media/decorative drift;
- checks current DOM evidence for hero, primary CTA, next-section hint, and
  media slot;
- fails when the primary CTA or hero is missing from the first viewport.

Added `--goal canvas`:

- uses loose landscape/pixel thresholds suitable for art-direction screenshots;
- checks current-side canvas nonblank state;
- checks a short frame delta;
- checks optional `window.__gameState` response to `ArrowRight`;
- when a UI Contract provides `canvas.stateHook` and
  `canvas.requiredStateFields`, fails missing hook/field evidence and reports
  the observed state fields.

Added `--goal expressive-menu`:

- uses landscape as the primary metric and does not require pixel-perfect
  reproduction;
- checks current-side composition metadata from `data-composition-layer` and
  `data-shape`;
- requires visible selected state, semantic menu text, at least three
  focusable menu items, diagonal/layered evidence, and high contrast;
- reviews missing `hover` / `focus-visible` probes and fails inert probes when
  they were requested;
- emits an `Expressive menu inspector` section in component reports.

Added UI Contract IR support for expressive composition:

- `pattern` / `goal`: `expressive-menu`
- `expectedScrollports` for app-shell scroll areas
- `canvas.stateHook` and `canvas.requiredStateFields` for canvas/game scenes
- `requiredStates` for pattern-specific selected / hover / focus-visible /
  scrolled states
- screen or landmark-level `composition`
- `layers`, `shapes`, `motion`, and `contrast` metadata
- validator gates for composition plus selected / hover / focus-visible
  requirements

Added expressive-menu introspection:

- `contract introspect --pattern expressive-menu --goal expressive-menu`
  now captures `data-composition-layer`, `data-shape`, selected state, and
  selected / hover / focus-visible requirements;
- `contract introspect --pattern app-shell --goal app-shell` now turns
  `data-scrollport` markers into `expectedScrollports` with axis and overflow
  hints, and preserves selected / scrolled states as required states;
- `contract introspect --pattern canvas --goal canvas` now captures procedural
  canvas assets, `window.__gameState`, and its serializable state field names;
- when CSS min/max constraints are missing, measured landmark width is kept as
  a draft `max` bound so introspected contracts avoid `fluid unbounded`.

Added responsive/content introspection and profiling:

- multiple `--viewport` captures now emit landmark `responsive` rules by
  matching landmarks across viewports by role/name first, then path/order;
- landmark content probes recover title/control/media/canvas/adornment slots,
  repeat counts, content kind, text length, and rough density;
- `contract introspect --profile` prints browser / navigation / landmark /
  hint timings, and `--profile-json` writes the same breakdown as JSON;
- local file inputs use `load` instead of `networkidle`, removing the ~500ms
  idle wait per viewport observed in the first profile run.

Added responsive-stretch dogfood:

- checks 390, 768, 1440, and 1920px widths for horizontal overflow;
- treats readable measure, bounded wide containers, card sizing, media aspect,
  and next-section visibility as first-class pass/fail evidence;
- adds the scenario to the introspection benchmark so multi-viewport cost is
  visible.

Current 3-round dogfood benchmark:

| Case | Avg total | p95 | Avg browser launch | Avg viewport work | Avg goto | Avg landmark |
|---|---:|---:|---:|---:|---:|---:|
| app-shell | 263ms | 423ms | 155ms | 97ms | 7ms | 29ms |
| expressive-menu | 182ms | 197ms | 83ms | 89ms | 6ms | 24ms |
| dashboard | 194ms | 202ms | 80ms | 104ms | 32ms | 11ms |
| responsive-stretch | 280ms | 291ms | 78ms | 190ms | 12ms | 60ms |
| canvas | 127ms | 132ms | 79ms | 41ms | 7ms | 3ms |

The remaining performance cost is mostly browser launch, especially on the
cold first app-shell run. The responsive-stretch case shows the expected extra
viewport cost from four captures. Precision improved most from responsive rules
and landmark content/repeat probes; decoration and motion are still better kept
in hand-authored contract metadata until the introspector learns those fields.

Additional dogfood fixes:

- component report drilldown now shows measured fluid width instead of
  `fluid-unbounded`, e.g. `fluid measured 848px`;
- composition layer ids are validated as unique, and introspection suffixes
  duplicates such as `foreground-2`;
- high-contrast checks resolve transparent element backgrounds through
  ancestors;
- expressive-menu contrast now uses the minimum visible menu-item ratio,
  rather than passing because one accent happens to be readable;
- rendered screenshot pixel sampling is used when menu text sits over
  overlapping composition layers that are not DOM ancestors. Current report:
  `Contrast source | pixel`, `Minimum menu contrast | 5.03`;
- state direction warnings no longer flag a dark menu item that intentionally
  lightens on hover.

## Next implementation candidates

1. Promote canvas checks into `build interactive` / `build canvas` with HUD
   overlap, asset visibility, richer input assertions, and multi-input probes.
2. Add Contract syntax for expected input deltas, e.g. `ArrowRight` must
   increase `playerX`.
3. Add mobile/collapsed app-shell contract variants from the new responsive
   introspection data.
4. Reuse a browser across batch introspection to remove launch time from
   multi-page benchmark runs.
5. Add decoration/motion introspection without overwriting hand-authored
   contract metadata.
6. Promote responsive-stretch checks into a reusable contract goal instead of
   keeping them only in the dogfood script.

## Verification

```bash
node --test packages/vlmkit-markup/src/component/semantic-drilldown.test.ts
node --test packages/vlmkit-markup/src/component/component-from-image.test.ts
node --test packages/vlmkit-markup/src/component/component-goal.test.ts
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/landing/target.png design-runs/patterns-20260520/landing/current.html --goal landing --output-dir design-runs/patterns-20260520/landing/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/app-shell/target.png design-runs/patterns-20260520/app-shell/current.html --contract design-runs/patterns-20260520/app-shell/ui.contract.json --output-dir design-runs/patterns-20260520/app-shell/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/dashboard/target.png design-runs/patterns-20260520/dashboard/current.html --contract design-runs/patterns-20260520/dashboard/ui.contract.json --output-dir design-runs/patterns-20260520/dashboard/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/responsive-stretch/target.png design-runs/patterns-20260520/responsive-stretch/current.html --contract design-runs/patterns-20260520/responsive-stretch/ui.contract.json --output-dir design-runs/patterns-20260520/responsive-stretch/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/game/target.png design-runs/patterns-20260520/game/current.html --contract design-runs/patterns-20260520/game/ui.contract.json --output-dir design-runs/patterns-20260520/game/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/expressive-menu/target.png design-runs/patterns-20260520/expressive-menu/current.html --contract design-runs/patterns-20260520/expressive-menu/ui.contract.json --output-dir design-runs/patterns-20260520/expressive-menu/reports/component
node src/cli/vlmkit.ts contract validate design-runs/patterns-20260520/app-shell/ui.contract.json
node src/cli/vlmkit.ts contract validate design-runs/patterns-20260520/dashboard/ui.contract.json
node src/cli/vlmkit.ts contract validate design-runs/patterns-20260520/responsive-stretch/ui.contract.json
node src/cli/vlmkit.ts contract validate design-runs/patterns-20260520/game/ui.contract.json
node src/cli/vlmkit.ts contract validate design-runs/patterns-20260520/expressive-menu/ui.contract.json
node src/cli/vlmkit.ts contract introspect design-runs/patterns-20260520/expressive-menu/current.html --pattern expressive-menu --goal expressive-menu --viewport desktop:1440x900
node src/cli/vlmkit.ts contract introspect design-runs/patterns-20260520/app-shell/current.html --pattern app-shell --goal app-shell --viewport desktop:1440x900 --viewport mobile:390x844 --profile
node src/cli/vlmkit.ts contract introspect design-runs/patterns-20260520/dashboard/current.html --pattern dashboard --goal app --viewport desktop:1440x900 --viewport mobile:390x844 --profile
node src/cli/vlmkit.ts contract introspect design-runs/patterns-20260520/responsive-stretch/current.html --pattern landing --goal app --viewport desktop:1440x900 --viewport mobile:390x844 --viewport tablet:768x900 --viewport wide:1920x1080 --profile
node src/cli/vlmkit.ts contract introspect design-runs/patterns-20260520/game/current.html --pattern canvas --goal canvas --viewport desktop:1280x720
node src/experiments/benchmark/introspect-bench.ts --rounds 3 --out test-results/introspect/benchmark.json
node design-runs/patterns-20260520/check-patterns.mjs
node --test 'packages/vlmkit-markup/src/**/*.test.ts' src/cli/cli.test.ts
```
