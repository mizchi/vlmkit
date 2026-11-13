/**
 * Run a generated spec with `@playwright/test`'s own runner, in a directory of its own, and say
 * whether it passed. `vlmkit export playwright --verify` runs a spec twice this way before calling
 * it reproducible.
 *
 * The directory links `@playwright/test` from where it resolves (the user's project, or vlmkit's
 * own dependency), so the spec's import works wherever the directory is. Playwright's CLI is
 * started by path with `node`, never through a shell.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface SpecRun {
  passed: boolean;
  exitCode: number;
  output: string;
}

/** `@playwright/test`'s package directory, resolved from `from` (default: the working directory). */
export function resolvePlaywrightTest(from = process.cwd()): string {
  const require = createRequire(join(from, "noop.js"));
  try {
    return dirname(realpathSync(require.resolve("@playwright/test/package.json")));
  } catch {
    const own = createRequire(import.meta.url);
    try {
      return dirname(realpathSync(own.resolve("@playwright/test/package.json")));
    } catch {
      throw new Error(
        "@playwright/test is not installed here: install it (npm i -D @playwright/test) to run the generated spec",
      );
    }
  }
}

export function runSpec(source: string, options: { name?: string; timeoutMs?: number; keep?: boolean } = {}): SpecRun {
  const pkg = resolvePlaywrightTest();
  const dir = mkdtempSync(join(tmpdir(), "vlmkit-spec-"));
  try {
    mkdirSync(join(dir, "node_modules", "@playwright"), { recursive: true });
    symlinkSync(pkg, join(dir, "node_modules", "@playwright", "test"), "dir");
    const name = `${options.name ?? "recorded"}.spec.ts`;
    writeFileSync(join(dir, name), source);
    writeFileSync(
      join(dir, "playwright.config.mjs"),
      `export default { testDir: ".", reporter: "line", workers: 1, retries: 0, timeout: ${options.timeoutMs ?? 30000}, use: { headless: true, trace: "off" } };\n`,
    );
    const cli = join(pkg, "cli.js");
    const r = spawnSync(process.execPath, [cli, "test", name, "--config", "playwright.config.mjs"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const exitCode = r.status ?? 1;
    return { passed: exitCode === 0, exitCode, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  } finally {
    if (!options.keep) rmSync(dir, { recursive: true, force: true });
  }
}
