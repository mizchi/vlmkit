# @mizchi/vlmkit-markup

VLM-driven markup-assistance tooling — component extraction, design-token
conformance, theme parity, i18n stress, palette diff, dep-graph, selector heal.

Part of the [`vlmkit`](https://github.com/mizchi/vrt) monorepo. Most modules
double as CLI commands routed by the `vlmkit` CLI (`vlmkit scan component`,
`vlmkit check theme`, `vlmkit check tokens`, `vlmkit stress i18n|media`, …).

## Install

```bash
pnpm add @mizchi/vlmkit-markup
```

## Usage

### As a library

```ts
import {
  buildDepGraph,
  introspect,
  introspectToSpec,
  verifySpec,
  diffPalettes,
} from "@mizchi/vlmkit-markup";

const graph = await buildDepGraph(projectRoot);
const result = await introspect("./snapshots");
const spec = introspectToSpec(result);
const verification = verifySpec(spec, new Map([
  ["home", { a11yTree: homeTree, screenshotExists: true }],
]));
```

### Spec sidecars

`introspect("./snapshots")` always reads `*.a11y.json` files. Optional
sidecars enrich the generated low-cost invariants:

```text
home.a11y.json
home.contrast.json
home.responsive.json
```

`home.contrast.json` may be the `vlmkit check a11y contrast` report shape:

```json
{ "totalText": 2, "failures": [] }
```

`home.responsive.json` records viewport probes for coarse responsive checks:

```json
{
  "snapshots": [
    { "viewport": { "width": 375, "height": 812 }, "clientWidth": 375, "scrollWidth": 375 },
    {
      "viewport": { "width": 1440, "height": 900 },
      "clientWidth": 1440,
      "scrollWidth": 1440,
      "regions": [{ "role": "main", "width": 960, "maxWidth": 960 }]
    }
  ]
}
```

The generated spec can now include `heading-hierarchy`,
`aria-relationships`, `color-contrast`, and `responsive-layout` checks.
`verifySpec()` accepts matching `SpecPageData` fields directly when the caller
already has contrast samples, contrast failures, or responsive snapshots in
memory.

### CLI-style modules (deep import — Playwright required)

```ts
import { runDesignTokens } from "@mizchi/vlmkit-markup/style/design-tokens.ts";
import { runComponentFromImage } from "@mizchi/vlmkit-markup/component/component-from-image.ts";
```

## What's included (library API)

| Domain | Module | Purpose |
|---|---|---|
| MoonBit policy core | `markup-core`, `markup-core-cli` | Pure component-goal, contract-plan, semantic-drilldown, and UI-contract evidence policy compiled to JS and called from TypeScript wrappers. |
| Component geometry | `component/component-geometry`, `component/component-bbox` | BBox / DOM geometry helpers. |
| Palette | `style/palette-diff`, `style/palette-extract` | Color extraction + diff. |
| Project graph | `inspect/dep-graph`, `inspect/introspect` | Build dep graph; generate `spec.json` from a11y snapshots. |
| Heal | `heal/fix-prompt` | Markdown fix-prompt for snapshot diffs. |

## MoonBit core boundary

`evaluateComponentGoal()` keeps the public TypeScript API and report-summary
formatting, but delegates the deterministic pass / review / fail decision to
the MoonBit `markup-core` package through the generated `markup-core-api` JS
module, with the generated CLI kept as a fallback and manual debugging surface.
`deriveComponentContractPlan()` likewise keeps JSON object shaping in
TypeScript while MoonBit owns probe-state normalization and scroll-target
selection policy.
`buildSemanticDrilldown()` keeps browser capture and overlap scoring in
TypeScript while MoonBit owns layout-vs-decoration flow selection, priority
scoring, reason ids, and next-action ordering.
`validateUiContract()` keeps JSON traversal, issue paths, and report text in
TypeScript while MoonBit owns pattern-specific evidence, boundary checks,
layout-policy issue id selection, plus composition, decoration, marker,
optional-range, metadata-presence, state, and expected-scrollport predicate ids.

This keeps the policy owner single while TypeScript continues to own file I/O,
Playwright/browser integration, and package ergonomics.

## What's included (CLI commands, deep import)

`component-extract`, `component-from-image`, `component-consistency`,
`design-tokens`, `theme-parity`, `i18n-stress`, `media-variants`,
`cross-browser`, `multi-page-consistency`, `multi-state`, `interact`,
`explore`, `heal/selector-heal`.

## License

MIT
