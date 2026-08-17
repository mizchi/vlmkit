/**
 * "Was this module run, or imported?"
 *
 * The repo answered it by hand in several spellings. Two are wrong, and both were
 * measured rather than reasoned about:
 *
 *   - `process.argv[1]?.endsWith("thing.ts")` — a suffix match, so `run.ts` and
 *     `dry-run.ts` are indistinguishable (this repo had that collision for real, between
 *     `src/vrt/snapshot/snapshot.ts` and `src/cli/commands/snapshot.ts`), and it stops
 *     matching once the file is built to `.mjs`: `node dist/png-diff.mjs --help` printed
 *     nothing at all.
 *   - `new URL(import.meta.url).pathname === process.argv[1]` — a URL pathname is
 *     percent-encoded and argv is not, so any path containing a space fails:
 *     `/tmp/has%20space/x.mjs` never equals `/tmp/has space/x.mjs`. It is also broken on
 *     Windows, where `pathname` carries a leading slash before the drive letter. (Node
 *     absolutizes `argv[1]`, so a *relative* invocation does match — an earlier commit
 *     message of mine gave that as the reason and was wrong about it, though not about
 *     the fix.)
 *
 * It matters more than a tidiness question. Eleven command modules had NO guard at
 * all — a bare `main().catch(...)` at the bottom — so importing one for a type or a
 * helper *ran the command*. That is why they had 0% coverage: a test cannot import
 * what executes on import. Giving them a guard is what makes them callable, and a
 * guard is only trustworthy if it is exactly right about which module is the entry.
 */
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve symlinks when we can, and fall back to a plain resolve when we cannot.
 *
 * This is what npm's bin shims require. `node_modules/.bin/vlmkit-generate` is a symlink
 * to `dist/cli.mjs`, so `argv[1]` is the shim while `import.meta.url` is the real file:
 * comparing resolved-but-not-realpathed paths gives `false`, and the CLI does nothing.
 * Measured through a symlink — `resolve` only: false; `realpathSync` both sides: true.
 * `vlmkit-generate` and `vlmkit-plan` had figured this out and carry their own
 * `realpathSync` guard; they do not depend on core, which is why they keep it.
 *
 * `realpathSync` throws for a path that does not exist, which is why the fallback is
 * here rather than at the call site — a guard that throws takes down the import instead
 * of answering the question.
 */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

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
    // Canonical on both sides: `node src/x.ts` matches from any directory, a symlinked
    // bin matches its target, and `dry-run.ts` never matches a guard belonging to
    // `run.ts`.
    return canonical(invoked) === canonical(fileURLToPath(moduleUrl));
  } catch {
    // A non-file URL (a data: or node: specifier) is not an entry point.
    return false;
  }
}
