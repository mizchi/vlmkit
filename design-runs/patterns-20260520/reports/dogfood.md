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
- canvas game: screenshot ではなく canvas state / input / frame delta が主語

## Commands

```bash
node design-runs/patterns-20260520/capture-targets.mjs

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/landing/target.png \
  design-runs/patterns-20260520/landing/current.html \
  --goal landing \
  --output-dir design-runs/patterns-20260520/landing/reports/component

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/app-shell/target.png \
  design-runs/patterns-20260520/app-shell/current.html \
  --goal app-shell \
  --output-dir design-runs/patterns-20260520/app-shell/reports/component

node src/cli/vlmkit.ts build component \
  design-runs/patterns-20260520/game/target.png \
  design-runs/patterns-20260520/game/current.html \
  --goal canvas \
  --output-dir design-runs/patterns-20260520/game/reports/component

node design-runs/patterns-20260520/check-patterns.mjs
```

## Results

| Pattern | Goal result | Component metrics | Pattern checks |
|---|---|---|---|
| landing | `landing` pass | pixel 8.00%, landscape 1.12% | CTA in first viewport, next-section hint, media slot all pass |
| app-shell | `app-shell` fail | pixel 4.00%, landscape 0.14% | channels and members scroll; messages is broken |
| game | `canvas` pass | pixel 0.95%, landscape 0.02% | canvas nonblank, frame delta, input response all pass |

The app-shell case is the important Red:

```text
App shell fail: landscape 0.14% <= 5.00%, scrollports 2/3 ok, 1 broken
scrollports: 2/3 ok, 1 broken
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

### Finding 3: game/canvas needs a different command family

The game target passed `canvas`:

- pixel 0.95%
- landscape 0.02%
- canvas nonblank
- frame delta detected
- `ArrowRight` changes `window.__gameState.playerX`

The component report still sees `main "Skyline runner"` at the DOM layer, but
it now also emits a `Canvas inspector` section. This is enough for a first
`build component` goal. A future `build interactive` or `build canvas` flow
should add multi-state screenshots, HUD overlap, asset visibility, and richer
input assertions.

### Finding 4: synthetic targets are useful for Red/Green loops

AI-generated mocks are still the real target for design dogfood, but synthetic
HTML targets are faster for feature development:

- deterministic PNGs
- easy to create intentional failures
- good for testing report semantics
- cheaper than running image generation for every tool iteration

This suggests two dogfood layers:

1. synthetic targets for tool signal development
2. generated mocks for real design quality and prompt feasibility

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

Added `--goal landing`:

- uses landscape + a looser pixel threshold for media/decorative drift;
- checks current DOM evidence for hero, primary CTA, next-section hint, and
  media slot;
- fails when the primary CTA or hero is missing from the first viewport.

Added `--goal canvas`:

- uses loose landscape/pixel thresholds suitable for art-direction screenshots;
- checks current-side canvas nonblank state;
- checks a short frame delta;
- checks optional `window.__gameState` response to `ArrowRight`.

## Next implementation candidates

1. Add contract fields for `pattern`, `expectedScrollports`, and required states.
2. Add scrolled-state snapshots for app shells.
3. Promote canvas checks into `build interactive` / `build canvas` with HUD
   overlap, asset visibility, and richer input assertions.

## Verification

```bash
node --test packages/vlmkit-markup/src/component/semantic-drilldown.test.ts
node --test packages/vlmkit-markup/src/component/component-from-image.test.ts
node --test packages/vlmkit-markup/src/component/component-goal.test.ts
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/landing/target.png design-runs/patterns-20260520/landing/current.html --goal landing --output-dir design-runs/patterns-20260520/landing/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/app-shell/target.png design-runs/patterns-20260520/app-shell/current.html --goal app-shell --output-dir design-runs/patterns-20260520/app-shell/reports/component
node src/cli/vlmkit.ts build component design-runs/patterns-20260520/game/target.png design-runs/patterns-20260520/game/current.html --goal canvas --output-dir design-runs/patterns-20260520/game/reports/component
node design-runs/patterns-20260520/check-patterns.mjs
```
