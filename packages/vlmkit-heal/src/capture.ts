import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Playwright writes artifacts to an outputDir that is NOT always
// <cwd>/test-results: the name is configurable (e.g. bacuri uses `e2e-results`)
// and, depending on rootDir, it can land in a parent. So we search cwd and a few
// ancestors for any of the common outputDir names (plus an explicit override).
const DEFAULT_OUTPUT_DIRS = ["test-results", "e2e-results"];

function resultRoots(cwd: string, outputDir?: string): string[] {
  const names = outputDir ? [outputDir, ...DEFAULT_OUTPUT_DIRS] : DEFAULT_OUTPUT_DIRS;
  const roots: string[] = [];
  let dir = cwd;
  for (let i = 0; i < 3; i++) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate) && !roots.includes(candidate)) roots.push(candidate);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return roots;
}

function newestMatching(cwd: string, endsWith: string, outputDir?: string): string | undefined {
  let best: { path: string; mtimeMs: number } | undefined;
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith(endsWith) && (!best || st.mtimeMs > best.mtimeMs)) {
        best = { path: p, mtimeMs: st.mtimeMs };
      }
    }
  };
  for (const root of resultRoots(cwd, outputDir)) walk(root);
  return best?.path;
}

/** Newest Playwright `*-actual.png` (the screenshot from a failed toHaveScreenshot). */
export function findActualScreenshot(cwd: string, outputDir?: string): Buffer | undefined {
  const path = newestMatching(cwd, "-actual.png", outputDir);
  return path ? readFileSync(path) : undefined;
}

/**
 * Newest Playwright `error-context.md` — contains a `# Page snapshot` aria tree
 * with the real accessible names/roles on the page. This is what lets codegen
 * fix a broken locator (it can see e.g. `button "Submit"`). Pass `outputDir` to
 * target a custom Playwright outputDir name; otherwise common names are tried.
 */
export function findErrorContext(cwd: string, outputDir?: string): string | undefined {
  const path = newestMatching(cwd, "error-context.md", outputDir);
  return path ? readFileSync(path, "utf8") : undefined;
}

/**
 * The three screenshots Playwright writes on a toHaveScreenshot failure:
 * `*-expected.png` (baseline), `*-actual.png`, `*-diff.png`. Fed to reviewVrtDiff.
 */
export function findVrtArtifacts(
  cwd: string,
  outputDir?: string,
): { baseline?: Buffer; actual?: Buffer; diff?: Buffer } {
  const read = (suffix: string): Buffer | undefined => {
    const p = newestMatching(cwd, suffix, outputDir);
    return p ? readFileSync(p) : undefined;
  };
  return {
    baseline: read("-expected.png"),
    actual: read("-actual.png"),
    diff: read("-diff.png"),
  };
}
