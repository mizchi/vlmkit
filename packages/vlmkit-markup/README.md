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
| Component geometry | `component/component-geometry`, `component/component-bbox` | BBox / DOM geometry helpers. |
| Palette | `style/palette-diff`, `style/palette-extract` | Color extraction + diff. |
| Project graph | `inspect/dep-graph`, `inspect/introspect` | Build dep graph; generate `spec.json` from a11y snapshots. |
| Heal | `heal/fix-prompt` | Markdown fix-prompt for snapshot diffs. |

## What's included (CLI commands, deep import)

`component-extract`, `component-from-image`, `component-consistency`,
`design-tokens`, `theme-parity`, `i18n-stress`, `media-variants`,
`cross-browser`, `multi-page-consistency`, `multi-state`, `interact`,
`explore`, `heal/selector-heal`.

## License

MIT
