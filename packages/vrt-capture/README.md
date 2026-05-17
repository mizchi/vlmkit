# @mizchi/vrt-capture

Playwright / Crater capture infrastructure for VRT — viewport discovery,
multi-route capture, prescanner integration.

Part of the [`vrt`](https://github.com/mizchi/vrt) monorepo.

## Install

```bash
pnpm add @mizchi/vrt-capture
```

## Usage

```ts
import { discoverViewports, resolveCaptureRoutes } from "@mizchi/vrt-capture";

const html = await readFile("page.html", "utf-8");
const { viewports, breakpoints } = discoverViewports(html, {
  randomSamples: 1,
  maxViewports: 15,
});

const routeSet = resolveCaptureRoutes({
  cwd: process.cwd(),
  configPath: "vrt.config.json",
});
```

`capturer.ts` (Playwright bootstrap) is intentionally **not** in the barrel —
deep-import when you need it:

```ts
import { capturePage } from "@mizchi/vrt-capture/capturer.ts";
```

## What's included

| Module | Purpose |
|---|---|
| `capture-config` | `vrt.config.json` resolution + route schema. |
| `viewport-discovery` | Parse CSS media queries to suggest test viewports. |
| `crater-client` | Bidi-protocol client for the Crater browser engine. |
| `playwright-analyzer` | Auto-detect Playwright config from project. |
| `prescanner` | Pre-flight check (server reachability, breakpoints). |
| `capturer` (deep import) | Playwright-based screenshot capture. |

## License

MIT
