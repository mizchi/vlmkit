# Landmark drilldown design

Date: 2026-05-19

## Problem

AI-generated mock targets are useful as visual direction, but exact VRT
convergence is too strict for early design work. `Landscape diff` gives a
coarse page-level signal, but agents still need a structured way to drill down
from page landscape into actionable regions.

This design is the visual-analysis half of the larger UI Contract DSL plan:

- `docs/ui-contract-dsl-moonbit-renderer.md`
- `docs/design-pattern-feasibility.md`

## Principle

Use accessibility landmarks as the first semantic partition of the page.

MDN defines `landmark` as an abstract superclass for important page sections,
and says authors should use concrete landmark roles or semantic HTML rather
than `role="landmark"`. The concrete roles used by vlmkit are:

- `banner`
- `navigation`
- `main`
- `complementary`
- `contentinfo`
- `region`
- `search`
- named `form`

For image-target workflows, the target PNG has no DOM. The current DOM
landmarks therefore act as semantic lenses over the visual diff: they localize
landscape cells and heatmap regions into "header", "main", "aside", and named
sections.

For HTML-to-HTML migration workflows, the same abstraction can be upgraded to a
true landmark-to-landmark comparison by matching baseline and variant landmark
trees.

## Scope

Landmark drilldown is strongest for document-like pages, landing pages, and app
shells that have meaningful semantic DOM. It is not a universal model for every
visual surface.

For Discord-like app shells, landmarks are only the first layer. The primary
contract is the viewport shell: rails, named grid areas, independent
scrollports, selected state, and overflow policy.

For games, WebGL, canvas, and other scene-graph UIs, DOM landmarks should stop
at the outer shell. The inner scene needs a separate contract based on game
state, scene objects, HUD regions, input response, frame deltas, and canvas
pixel sanity checks. In the current UI Contract this starts with
`canvas.stateHook` and `canvas.requiredStateFields`; richer input delta
assertions should live in the same scene contract layer, not in DOM landmark
drilldown.

## Flow Separation

Layout and decoration should be handled as separate lanes.

## Goal Profiles

`diffRatio` should not be interpreted as a single universal pass/fail number.
For AI mock workflows, the practical question is whether the page is usable and
semantically close to the target, not whether every generated glyph and texture
matches.

`vlmkit build component` therefore separates two concepts:

- `--threshold`: pixelmatch sensitivity, used while counting pixel diffs.
- `--goal`: convergence profile, used to interpret the resulting pixel and
  landscape ratios.

Current profiles:

| Goal | Primary | Pass | Review | Use case |
|---|---|---|---|---|
| `app` | landscape | landscape <= 3%, pixel <= 25% | landscape <= 5%, pixel <= 35% | practical AI mock to usable UI |
| `layout` | landscape | landscape <= 3% | landscape <= 5% | geometry/order first, decoration later |
| `pixel` | pixel | pixel <= 3%, landscape <= 1% | pixel <= 8%, landscape <= 3% | deterministic screenshot reproduction |
| `draft` | landscape | landscape <= 6%, pixel <= 35% | landscape <= 8%, pixel <= 45% | early mock exploration |
| `app-shell` | landscape + scrollports | landscape <= 3%, no broken scrollports | landscape <= 5%, no missing/empty scrollport evidence | persistent sidebar/app shells |
| `landing` | landscape + first viewport | landscape <= 3%, pixel <= 30%, hero/CTA/media/next hint present | landscape <= 5%, pixel <= 40% | landing pages with hero and CTA gates |
| `canvas` | landscape + canvas evidence | landscape <= 6%, pixel <= 35%, nonblank/frame/input evidence, contract state fields when present | landscape <= 8%, pixel <= 45% | canvas/game art direction and basic interaction |

The default is `app`. In dogfood, the blog mock converged to:

- desktop: pixel 18.42%, landscape 2.14% — `app` pass
- mobile: pixel 22.57%, landscape 2.52% — `app` pass

This is intentionally not a pixel-perfect threshold. It says the large page
regions, responsive order, and first-viewport information scent are close
enough to continue as a normal app implementation.

## Layout Contract

`Landscape diff` should not be modeled as a flat screenshot grid only. It
should be paired with a layout contract that can be mapped back to semantic
HTML/CSS.

Each landmark should carry:

- viewport assumptions: CSS viewport size, DPR, and target image size
- width policy: fluid, bounded by `min-width`, bounded by `max-width`, or fixed
- height policy: content-sized, bounded, or scrollport
- scroll policy: none, x, y, or xy
- grid policy: block/flex/grid, explicit grid tracks, and whether `subgrid` is
  expected

This keeps three different problems separate from the start:

1. **Liquid regions**: containers that should stretch within min/max bounds.
2. **Scroll regions**: panels or content areas whose internal content scrolls.
3. **Decorative regions**: paint/media/text details that should not drive
   landmark geometry.

The implementation should prefer `display: grid` for page and landmark shells,
and `subgrid` where child sections need to align with parent tracks. This makes
the target easier to recover as semantic markup than a pile of absolute bboxes:
the agent can edit grid tracks, min/max constraints, and named regions instead
of chasing per-pixel positions.

For generated mock workflows, the prompt should ask for explicit layout
structure:

- page shell min/max width
- content column max width
- side rail min/max width
- which region scrolls independently
- which sections share grid tracks
- where subgrid alignment is expected

For implementation workflows, `vlmkit build component` should report these
contracts from the current DOM so the agent can see whether a drift is caused
by missing `max-width`, over-flexing, a wrong scroll container, or a missing
grid/subgrid structure.

### Layout lane

Triggered by coarse `Landscape diff` cells overlapping a landmark.

Use this lane for:

- section placement
- landmark bbox size
- grid/flex tracks
- vertical rhythm
- major content ordering
- responsive breakpoint shape

This lane should run before pixel-level work. A section that is in the wrong
place will create misleading color and text diffs.

### Decoration lane

Triggered by heatmap regions inside landmarks when coarse landscape is stable.

Use this lane for:

- palette tokens
- media/icon fill
- image crop or density
- text color and local typography
- border and shadow details

This lane should generally wait until the layout lane is stable.

## Current Implementation

`vlmkit build component` now:

1. Renders current HTML.
2. Captures current DOM landmark bboxes.
3. Computes page-level `Landscape diff`.
4. Clusters heatmap regions.
5. Assigns landscape cells and heatmap regions to landmarks.
6. Emits `Landmark drilldown` with separate `Layout lane` and
   `Decoration lane` tables.

The current implementation deliberately ignores `role="landmark"`, and only
treats named `<section>` and named `<form>` as landmarks to avoid noisy generic
containers.

`vlmkit contract introspect` now also uses landmark capture as contract
evidence:

- repeated `--viewport` captures are matched back to the base landmark by
  role/name, then path/order, and emitted as `responsive` layout rules;
- each landmark can carry coarse content probes: slots, repeat counts, content
  kind, text length, and density;
- `--profile` and `--profile-json` expose browser launch, navigation,
  landmark capture, and hint capture timing;
- local file inputs wait for `load` instead of `networkidle`, which keeps
  dogfood introspection under roughly a few hundred milliseconds after cold
  browser start.

## Next Generalization

1. Promote `semantic-drilldown` from component-specific reporting to a shared
   visual analysis layer.
2. Add an HTML-to-HTML mode that matches baseline and variant landmarks by
   role, accessible name, and geometry.
3. Extend the current `--goal app|layout|pixel|draft` profiles with explicit
   decoration and accessibility gates.
4. Add artifact JSON for drilldown rows so agent loops can consume the lane
   data without scraping markdown.
