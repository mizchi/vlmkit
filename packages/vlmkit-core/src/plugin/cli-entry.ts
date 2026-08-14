/**
 * "Was this module run, or imported?"
 *
 * Thirty modules in this repo answered it by hand, in two spellings — an exact
 * `resolve(process.argv[1]) === fileURLToPath(import.meta.url)` and a looser
 * `process.argv[1]?.endsWith("thing.ts")`. The second is the one that bites: a
 * suffix match makes `run.ts` and `dry-run.ts` indistinguishable, and it silently
 * stops matching when the file is built to `.mjs`.
 *
 * It matters more than a tidiness question. Eleven command modules had NO guard at
 * all — a bare `main().catch(...)` at the bottom — so importing one for a type or a
 * helper *ran the command*. That is why they had 0% coverage: a test cannot import
 * what executes on import. Giving them a guard is what makes them callable, and a
 * guard is only trustworthy if it is exactly right about which module is the entry.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param moduleUrl always `import.meta.url` from the module asking.
 * @param dispatcherName the module's name in `vlmkit`'s command table, when it has
 *   one. `delegate()` sets `__VLMKIT_DISPATCHER_LEAF__` and then imports the module,
 *   so for a dispatched command the env var is the entry signal and argv[1] is the
 *   dispatcher rather than the module.
 */
export function isCliEntry(moduleUrl: string, dispatcherName?: string): boolean {
  if (dispatcherName && process.env.__VLMKIT_DISPATCHER_LEAF__ === dispatcherName) return true;
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    // Resolved on both sides, so `node src/x.ts` from any directory matches and
    // `dry-run.ts` never matches a guard belonging to `run.ts`.
    return resolve(invoked) === fileURLToPath(moduleUrl);
  } catch {
    // A non-file URL (a data: or node: specifier) is not an entry point.
    return false;
  }
}
