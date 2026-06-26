import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Find the newest Playwright `*-actual.png` under <cwd>/test-results — the
 * screenshot captured when a toHaveScreenshot() assertion failed. Returns its
 * bytes, or undefined if none exists.
 */
export function findActualScreenshot(cwd: string): Buffer | undefined {
  const root = join(cwd, "test-results");
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
      if (st.isDirectory()) {
        walk(p);
      } else if (name.endsWith("-actual.png") && (!best || st.mtimeMs > best.mtimeMs)) {
        best = { path: p, mtimeMs: st.mtimeMs };
      }
    }
  };

  walk(root);
  return best ? readFileSync(best.path) : undefined;
}
