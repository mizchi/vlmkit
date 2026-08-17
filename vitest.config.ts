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
      /**
       * A floor, not a target. Measured 2026-08-16: statements 69.9-70.0%, branches 61.2%,
       * functions 73.7%, lines 71.8%.
       *
       * Set ~1pp below each measurement on purpose. Consecutive full runs of this suite differ by
       * up to 0.05pp on statements — browser teardown and timing-dependent paths execute or not —
       * so a threshold at the measured value fails on noise, and a CI check that fails randomly
       * gets deleted. What this catches is a real drop: a module added without tests, or a test
       * file deleted.
       *
       * These are GLOBAL thresholds, so they only mean anything on a full run (`pnpm
       * test:coverage`). `vitest run --coverage <one-file>` reports the whole `include` set with
       * one file's tests and fails all four by construction — that is not a regression, it is the
       * wrong command for the question.
       *
       * Statements sit ~2pp below lines because of `page.evaluate` bodies. Those run in the
       * BROWSER, where node's v8 coverage cannot see them, so `check integrity`'s collectors,
       * `semantic-drilldown`'s landmark walk and `computed-style-capture` count as uncovered no
       * matter how thoroughly they are tested. Raising statements much further means deleting
       * browser-side code, not testing more of it.
       */
      thresholds: {
        statements: 69,
        branches: 60,
        functions: 72,
        lines: 70,
      },
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
        /**
         * Research and demo RUNNERS: a shebang or `isCliEntry` entry point that **nothing
         * imports**, needs an API key or a 30-trial loop to do anything, and is invoked as
         * `node src/...` from `Taskfile.pkl` rather than shipped in the bundle.
         *
         * Excluded for the same reason as `*-cli.ts` above, and by a rule rather than by taste:
         * a file is listed here only if no non-test file imports it. That is why
         * `migration-compare.ts` is NOT here despite having its own CLI entry — six modules
         * import it and `vlmkit diff html` runs it, so it is shipped library code and belongs in
         * the denominator at whatever percentage it has earned. Same for
         * `migration-subagent.ts`, `flaker-vrt-runner.ts` and every `*-core.ts`.
         *
         * The point of the metric is to find code that should be tested and is not. 2,802
         * statements of key-requiring benchmark runners in the denominator made it worse at that
         * job, not more honest: the number moved when a bench script was added and never when a
         * gate lost its tests.
         */
        "src/demo/**",
        "src/experiments/benchmark/benchmark.ts",
        "src/experiments/benchmark/introspect-bench.ts",
        "src/experiments/benchmark/vlm-bench.ts",
        "src/experiments/css-challenge/css-challenge.ts",
        "src/experiments/css-challenge/css-challenge-bench.ts",
        "src/experiments/css-challenge/fix-loop.ts",
        "src/experiments/detection/detection-report.ts",
        "src/experiments/flaker/flaker-vrt-report-adapter.ts",
        "src/experiments/migration/aggregate-fix-summaries.ts",
        "src/experiments/migration/migration-blind.ts",
        "src/experiments/migration/migration-fix-loop.ts",
      ],
    },
  },
});
