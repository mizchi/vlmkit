# @mizchi/vlmkit-markup

VLM-driven markup-assistance tooling — component extraction, design-token
conformance, theme parity, i18n stress, palette diff, dep-graph, selector heal.

Part of the [`vrt`](https://github.com/mizchi/vrt) monorepo. Most modules
double as CLI commands routed by the `vrt` CLI (`vrt scan component`,
`vrt check theme`, `vrt check tokens`, `vrt stress i18n|media`, …).

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
  buildFixPrompt,
  diffPalettes,
} from "@mizchi/vlmkit-markup";

const graph = await buildDepGraph(projectRoot);
const spec = await introspect("./snapshots");
```

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
the MoonBit `markup-core` package through the generated JS CLI.
`deriveComponentContractPlan()` likewise keeps JSON object shaping in
TypeScript while MoonBit owns probe-state normalization and scroll-target
selection policy.
`buildSemanticDrilldown()` keeps browser capture and overlap scoring in
TypeScript while MoonBit owns layout-vs-decoration flow selection, priority
scoring, reason ids, and next-action ordering.
`validateUiContract()` keeps JSON traversal, issue paths, and report text in
TypeScript while MoonBit owns pattern-specific evidence and layout-policy issue
id selection, plus marker, optional-range, state, and expected-scrollport
predicate ids.

This keeps the policy owner single while TypeScript continues to own file I/O,
Playwright/browser integration, and package ergonomics.

## What's included (CLI commands, deep import)

`component-extract`, `component-from-image`, `component-consistency`,
`design-tokens`, `theme-parity`, `i18n-stress`, `media-variants`,
`cross-browser`, `multi-page-consistency`, `multi-state`, `interact`,
`explore`, `heal/selector-heal`.

## License

MIT
