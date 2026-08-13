import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * The suite it runs was written against `node:test`, and the migration was a
 * specifier change — `describe`/`it`/`test`/`before`/`after`/`afterEach` have the
 * same names in vitest, and the assertions are `node:assert/strict` either way,
 * so nothing about how a test reads had to change. What vitest adds is coverage
 * (v8, no instrumentation step) and a per-file worker pool.
 *
 * Two settings here are load-bearing and would look arbitrary without the
 * measurement behind them.
 */
export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "worker/**/*.test.ts",
      "tests/**/*.test.mjs",
      "examples/**/*.test.mjs",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**", "**/fixtures/**"],

    /**
     * Most of this suite drives a real browser. Playwright launches Chromium per
     * test file that needs one, and the default worker pool (one per core) puts
     * as many browsers on the machine at once — which is how a 4-core CI box
     * ends up swapping rather than testing.
     *
     * `vlmkit bench gates` measured the same effect inside a single gate run:
     * nine `check integrity` runs summed to 34.9s at concurrency 1 and 64.9s at
     * concurrency 8, so oversubscription inflates total work rather than
     * dividing it.
     */
    pool: "forks",
    // Top-level in Vitest 4. The first draft of this file used
    // `poolOptions: { forks: { maxForks: 4 } }`, which v4 REMOVED — it printed a
    // deprecation notice and applied nothing, so the cap this comment justifies was
    // not in force at all. Exactly the class of silent no-op the gates exist to catch.
    maxWorkers: 4,
    minWorkers: 1,

    /**
     * A browser launch plus a page load plus a settle is routinely past vitest's
     * 5s default, and a timeout there reads as a broken test rather than a slow
     * one. The bundled gates' own page-load default is 30s; a test that drives
     * several viewports needs room above that.
     */
    testTimeout: 120_000,
    hookTimeout: 120_000,

    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "test-results/coverage",
      /**
       * Coverage is reported over the SOURCE this repo ships, which is the only
       * number that means anything: `all: true` so an untested file counts as 0%
       * rather than being absent from the denominator.
       */
      all: true,
      include: ["src/**/*.ts", "packages/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        // CLI entry points: argv dispatch with a `process.exit`, covered through
        // the CLI tests that spawn them rather than by importing them.
        "**/*-cli.ts",
        "src/cli/vlmkit.ts",
        "src/cli/cli.ts",
        // Generated MoonBit FFI glue — not hand-written, and its behaviour is
        // covered through the wrappers that call it.
        "**/markup-core-ffi*.ts",
        "**/*.gen.ts",
        // Type-only modules contribute no statements and would sit at 0% forever.
        "**/types.ts",
        "**/contract.ts",
      ],
    },
  },
});
