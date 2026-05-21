# @mizchi/vlmkit-core

VRT diff engine and shared types. Pure-TypeScript image / DOM / a11y / visual
comparison primitives — no Playwright required for the lightweight surface.

Part of the [`vrt`](https://github.com/mizchi/vrt) monorepo.

## Install

```bash
pnpm add @mizchi/vlmkit-core
```

## Usage

The package ships both a curated barrel and deep per-module exports.

```ts
// Curated barrel (excludes CLI / Playwright modules)
import { diffPng, type VrtDiff } from "@mizchi/vlmkit-core";

// Deep import (use for CLI / Playwright-bound modules)
import { runA11yTouch } from "@mizchi/vlmkit-core/a11y-touch.ts";
```

## What's included

| Layer | Module | Purpose |
|---|---|---|
| Image diff | `png-diff`, `heatmap`, `heatmap-regions`, `diff-regions`, `region-classify`, `shift-origin`, `text-rows`, `grid-ratio`, `image-resize` | Pixel-level diff + region clustering + shift compensation. |
| DOM | `dom-equivalence`, `dom-position-styles`, `computed-style-diff`, `computed-style-capture` | DOM structural / style comparison. |
| Semantic | `a11y-semantic`, `visual-semantic`, `quality` | Accessibility-tree diff, visual-classification, quality scoring. |
| CLI tools (deep import) | `a11y-contrast`, `a11y-touch`, `a11y-focus-order`, `element-compare`, `mask` | Run via the `vrt` CLI or import the exported `runXxx` functions. |
| Shared | `types`, `terminal-colors`, `cli-args`, `cli-error`, `png-utils` | Cross-package types and utilities. |

## License

MIT
