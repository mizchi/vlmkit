import { resolve, join } from "node:path";

/**
 * Shared paths for `vrt workflow` commands.
 *
 * - `VRT_ROOT` is the harness repo root (where baselines/snapshots/output land).
 * - `PROJECT_ROOT` is the *target* project (overridable via `VRT_PROJECT_ROOT`),
 *   used for git diffs, dep-graph scanning, and resolving capture configs.
 *
 * `baselines/` and `snapshots/` live outside `test-results/` so Playwright
 * doesn't clear them between runs.
 */
export const VRT_ROOT = resolve(import.meta.dirname!, "..", "..", "..");
export const PROJECT_ROOT = resolve(process.env.VRT_PROJECT_ROOT ?? process.cwd());

export const BASELINES_DIR = join(VRT_ROOT, "baselines");
export const SNAPSHOTS_DIR = join(VRT_ROOT, "snapshots");
export const OUTPUT_DIR = join(VRT_ROOT, "output");
export const REPORT_PATH = join(VRT_ROOT, "vrt-report.json");
export const EXPECTATION_PATH = join(VRT_ROOT, "expectation.json");
export const SPEC_PATH = join(VRT_ROOT, "spec.json");
