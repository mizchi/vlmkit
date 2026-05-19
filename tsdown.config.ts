import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      vlmkit: "src/cli/vlmkit.ts",
    },
    format: ["esm"],
    platform: "node",
    outDir: "dist",
    clean: true,
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
      "e2e/vlmkit-capture.spec": "e2e/vlmkit-capture.spec.ts",
    },
    format: ["esm"],
    platform: "node",
    outDir: "dist",
    clean: false,
  },
]);
