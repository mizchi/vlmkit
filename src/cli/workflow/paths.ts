import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

/**
 * Shared paths for `vrt workflow` commands.
 *
 * - `HARNESS_ROOT` is the installed vrt package root (used to locate
 *   `dist/e2e/vrt-capture.spec.mjs` or `e2e/vrt-capture.spec.ts`).
 *   Resolved by walking up from the CLI entry until a `package.json` is
 *   found, so it works in both the source layout (`src/cli/vlmkit.ts`) and
 *   the bundled CLI (`dist/vrt.mjs`).
 * - `PROJECT_ROOT` is the *target* project — where baselines, snapshots,
 *   output, and report files land. Overridable via `VRT_PROJECT_ROOT`;
 *   defaults to the caller's cwd.
 *
 * The two were previously conflated under a single `VRT_ROOT`, which
 * broke for the packaged CLI: `paths.ts` sat several directories deep
 * and `resolve(import.meta.dirname, "..", "..", "..")` skipped past
 * the package root after tsdown flattened everything into `dist/`.
 */

function findHarnessRoot(): string {
  const start = process.argv[1] ? resolve(process.argv[1]) : fileURLToPath(import.meta.url);
  let dir = dirname(start);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: this file's grandparent (source layout: src/cli/workflow → src/cli → src → repo)
  return resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
}

export const HARNESS_ROOT = findHarnessRoot();
export const PROJECT_ROOT = resolve(process.env.VRT_PROJECT_ROOT ?? process.cwd());

export const BASELINES_DIR = join(PROJECT_ROOT, "baselines");
export const SNAPSHOTS_DIR = join(PROJECT_ROOT, "snapshots");
export const OUTPUT_DIR = join(PROJECT_ROOT, "output");
export const REPORT_PATH = join(PROJECT_ROOT, "vrt-report.json");
export const EXPECTATION_PATH = join(PROJECT_ROOT, "expectation.json");
export const SPEC_PATH = join(PROJECT_ROOT, "spec.json");
