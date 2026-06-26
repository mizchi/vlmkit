import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Playwright writes artifacts to an outputDir ("test-results") that is NOT
// always <cwd>/test-results — depending on rootDir it can land in a parent.
// So we search cwd and a couple of ancestors for a test-results dir.
function testResultsRoots(cwd: string): string[] {
  const roots: string[] = [];
  let dir = cwd;
  for (let i = 0; i < 3; i++) {
    const candidate = join(dir, "test-results");
    if (existsSync(candidate)) roots.push(candidate);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return roots;
}

function newestMatching(cwd: string, endsWith: string): string | undefined {
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
  for (const root of testResultsRoots(cwd)) walk(root);
  return best?.path;
}

/** Newest Playwright `*-actual.png` (the screenshot from a failed toHaveScreenshot). */
export function findActualScreenshot(cwd: string): Buffer | undefined {
  const path = newestMatching(cwd, "-actual.png");
  return path ? readFileSync(path) : undefined;
}

/**
 * Newest Playwright `error-context.md` — contains a `# Page snapshot` aria tree
 * with the real accessible names/roles on the page. This is what lets codegen
 * fix a broken locator (it can see e.g. `button "Submit"`).
 */
export function findErrorContext(cwd: string): string | undefined {
  const path = newestMatching(cwd, "error-context.md");
  return path ? readFileSync(path, "utf8") : undefined;
}
