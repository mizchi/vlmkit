# @mizchi/vlmkit-core

VRT diff engine and shared types. Pure-TypeScript image / DOM / a11y / visual
comparison primitives — no Playwright required for the lightweight surface.

Part of the [`vlmkit`](https://github.com/mizchi/vrt) monorepo.

## Install

```bash
pnpm add @mizchi/vlmkit-core
```

## Usage

The package ships both a curated barrel and deep per-module exports.

```ts
// Curated barrel (excludes CLI / Playwright modules)
import { diffPng, type VrtDiff } from "@mizchi/vlmkit-core";

// Deep import (use for low-level modules not in the barrel)
import { decodePng } from "@mizchi/vlmkit-core/png-utils.ts";
```

## What's included

| Layer | Module | Purpose |
|---|---|---|
| Image diff | `heatmap`, `heatmap-regions`, `diff-regions`, `text-rows`, `image-resize` | Pixel-level diff + region clustering + shift compensation. |
| DOM | `dom-equivalence`, `dom-position-styles`, `computed-style-diff`, `computed-style-capture`, `authored-style-capture`, `authored-style-diff` | DOM structural / style comparison. |
| Semantic | `a11y-semantic` | Accessibility-tree diff. |
| Shared | `types`, `terminal-colors`, `cli-args`, `cli-error`, `png-utils` | Cross-package types and utilities. |

Playwright-driven CLIs (`a11y-contrast`, `a11y-touch`, `a11y-focus-order`,
`png-diff`, `region-classify`, `visual-semantic`, `quality`, etc.) and
their MoonBit-backed policy live in `@mizchi/vlmkit-markup`.

## License

MIT
