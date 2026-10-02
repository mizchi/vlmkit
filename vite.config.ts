import { defineConfig } from "vite-plus";

/**
 * Vite+ configuration: tests (`vp test`, Vitest 5), library builds (`vp pack`, tsdown 0.23),
 * and the lint / format settings `vp lint` and `vp fmt` will use.
 *
 * Replaces vitest.config.ts, tsdown.config.ts and tsdown.packages.config.ts. The test suite was
 * written against `node:test`, and the move to Vitest was a specifier change: the assertions are
 * `node:assert/strict` either way. Vitest adds coverage (v8, with no instrumentation step) and a
 * pool of workers, one per test file.
 */

/** The workspace packages `vp pack` builds and npm publishes. `vlmkit-mcp` is built by its own script. */
const publicWorkspacePackages = [
  "vlmkit-judge",
  "vlmkit-core",
  "vlmkit-ai",
  "vlmkit-capture",
  "vlmkit-animation-eval",
  "vlmkit-generate",
  "vlmkit-plan",
  "vlmkit-markup",
  "vlmkit-heal",
] as const;

/**
 * tsdown 0.23 changed `deps.resolveDepSubpath` to default false. The old behaviour is kept until
 * the emitted subpath imports have been checked against consumers. To adopt the new default,
 * delete this setting and check the packed workspaces (`pnpm smoke:pack:workspaces`).
 * https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
 */
const resolveDepSubpath = true;

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

    // Vitest 5 clears mock call history before each test. No test here relies on calls recorded
    // by setup or by an earlier test, but this keeps v4's behaviour until that has been checked.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    clearMocks: false,

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
    // Top-level since Vitest 4. The first draft of this setting used
    // `poolOptions: { forks: { maxForks: 4 } }`, which v4 REMOVED. It printed a
    // deprecation notice and applied nothing, so the cap this comment justifies was
    // not in force at all. That is exactly the kind of silent no-op the gates exist to catch.
    maxWorkers: 4,

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
       * Coverage is reported over the SOURCE this repo ships, which is the only number that
       * means anything. Since Vitest 4 an `include` list is what puts an untested file in the
       * denominator at 0% (v3's `all: true`). Vitest 5 matches these patterns against relative
       * paths more precisely; `src/**` and `packages/*` are relative already.
       */
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
       * test:coverage`). `vp test run --coverage <one-file>` reports the whole `include` set with
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

  /**
   * Every build `vp pack` runs, in one list, because `vp pack` has a `--filter` but no `--config`.
   * A string filter matches a config's `name` or its `cwd` exactly (tsdown's `filterConfig`):
   * - the root CLI, client and Playwright entry are the configs whose cwd is `.`, so `pnpm build`
   *   runs `vp pack --filter .`. A `/regex/` filter given on the command line matched nothing.
   * - each workspace package's own `build` script runs `vp pack --filter @mizchi/<name>`.
   * A bare `vp pack` builds all of them.
   */
  pack: [
    {
      name: "vlmkit-root:cli",
      entry: { vlmkit: "scripts/vlmkit-bundled.mjs" },
      format: ["esm"],
      platform: "node",
      outDir: "dist",
      clean: true,
      deps: {
        alwaysBundle: [/^@mizchi\/vlmkit-/],
        neverBundle: ["typescript"],
        resolveDepSubpath,
      },
    },
    {
      name: "vlmkit-root:client",
      entry: { client: "src/api/client.ts" },
      format: ["esm"],
      platform: "node",
      dts: true,
      outDir: "dist",
      clean: false,
      deps: { resolveDepSubpath },
    },
    {
      name: "vlmkit-root:playwright",
      entry: { playwright: "src/playwright.ts" },
      format: ["esm"],
      platform: "node",
      dts: true,
      outDir: "dist",
      clean: false,
      deps: { resolveDepSubpath },
    },
    ...publicWorkspacePackages.map((directory) => ({
      name: `@mizchi/${directory}`,
      cwd: `packages/${directory}`,
      entry: ["src/**/*.ts", "!src/**/*.test.ts"],
      root: "src",
      outDir: "dist",
      clean: true,
      format: ["esm" as const],
      platform: "node" as const,
      target: "node24",
      dts: true,
      unbundle: true,
      deps: {
        neverBundle: [/^@mizchi\/vlmkit-/],
        resolveDepSubpath,
      },
    })),
  ],

  /**
   * Settings for `vp lint` and `vp fmt`. NEITHER RUNS YET: no script, hook or CI job calls them,
   * and the repository has never been formatted by a tool, so a first `vp fmt` rewrites most
   * files. That rewrite belongs in its own commit. These values only match what the code
   * already does, so it stays small: double quotes, semicolons, and 120 columns (p99 line
   * length is 126).
   */
  lint: {
    ignorePatterns: ["**/dist/**", "**/fixtures/**", "**/node_modules/**", "test-results/**", ".pages/**"],
  },
  fmt: {
    printWidth: 120,
    semi: true,
    singleQuote: false,
    ignorePatterns: ["**/dist/**", "**/fixtures/**", "**/node_modules/**", "test-results/**", ".pages/**"],
  },
});
