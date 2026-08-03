import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      vlmkit: "scripts/vlmkit-bundled.mjs",
    },
    format: ["esm"],
    platform: "node",
    outDir: "dist",
    clean: true,
    deps: {
      alwaysBundle: [/^@mizchi\/vlmkit-/],
      neverBundle: ["typescript"],
    },
  },
  {
    entry: {
      client: "src/api/client.ts",
    },
    format: ["esm"],
    platform: "node",
    dts: true,
    outDir: "dist",
    clean: false,
  },
  {
    entry: {
      playwright: "src/playwright.ts",
    },
    format: ["esm"],
    platform: "node",
    dts: true,
    outDir: "dist",
    clean: false,
  },
  {
    entry: {
      "e2e/vlmkit-capture.spec": "e2e/vlmkit-capture.spec.ts",
    },
    format: ["esm"],
    platform: "node",
    outDir: "dist",
    clean: false,
  },
]);
