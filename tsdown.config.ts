import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      vrt: "src/cli/vrt.ts",
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
      "e2e/vrt-capture.spec": "e2e/vrt-capture.spec.ts",
    },
    format: ["esm"],
    platform: "node",
    outDir: "dist",
    clean: false,
  },
]);
