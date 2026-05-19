# Landmark drilldown design

Date: 2026-05-19

## Problem

AI-generated mock targets are useful as visual direction, but exact VRT
convergence is too strict for early design work. `Landscape diff` gives a
coarse page-level signal, but agents still need a structured way to drill down
from page landscape into actionable regions.

This design is the visual-analysis half of the larger UI Contract DSL plan:

- `docs/ui-contract-dsl-moonbit-renderer.md`

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

## Flow Separation

Layout and decoration should be handled as separate lanes.

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

## Next Generalization

1. Promote `semantic-drilldown` from component-specific reporting to a shared
   visual analysis layer.
2. Add an HTML-to-HTML mode that matches baseline and variant landmarks by
   role, accessible name, and geometry.
3. Add `--goal landscape`, `--goal layout`, and `--goal decoration` so agents
   can choose convergence criteria.
4. Add artifact JSON for drilldown rows so agent loops can consume the lane
   data without scraping markdown.
