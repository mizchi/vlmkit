import { defineConfig } from "tsdown";

const publicWorkspacePackages = [
  "vlmkit-core",
  "vlmkit-ai",
  "vlmkit-capture",
  "vlmkit-generate",
  "vlmkit-plan",
  "vlmkit-markup",
  "vlmkit-heal",
  "vlmkit-anim",
] as const;

export default defineConfig(
  publicWorkspacePackages.map((directory) => ({
    name: `@mizchi/${directory}`,
    cwd: `packages/${directory}`,
    entry: ["src/**/*.ts", "!src/**/*.test.ts"],
    root: "src",
    outDir: "dist",
    clean: true,
    format: ["esm"],
    platform: "node",
    target: "node24",
    dts: true,
    unbundle: true,
    deps: {
      neverBundle: [/^@mizchi\/vlmkit-/],
    },
  })),
);
