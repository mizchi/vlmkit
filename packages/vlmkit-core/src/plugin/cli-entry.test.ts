import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isCliEntry } from "./cli-entry.ts";

/**
 * "Was this module run, or imported?" — the two ways of getting it wrong.
 *
 * Both were found in this repo and both were measured, not reasoned about:
 *
 *   - a suffix match (`argv[1].endsWith("x.ts")`) stops matching once the file is built
 *     to `.mjs`, which made `node dist/png-diff.mjs --help` print nothing;
 *   - `new URL(import.meta.url).pathname === argv[1]` compares a percent-encoded
 *     pathname against a raw path, so any directory with a space in it fails.
 *
 * And one way of being *incomplete*: comparing resolved-but-not-realpathed paths misses
 * a symlinked npm bin, which is how every `bin` in this workspace is installed.
 *
 * `process.argv[1]` is what the function reads, so each case sets it and puts it back.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-cli-entry-"));
const realArgv1 = process.argv[1];
const realLeaf = process.env.__VLMKIT_DISPATCHER_LEAF__;
afterEach(() => {
  process.argv[1] = realArgv1!;
  if (realLeaf === undefined) delete process.env.__VLMKIT_DISPATCHER_LEAF__;
  else process.env.__VLMKIT_DISPATCHER_LEAF__ = realLeaf;
});

/** A real file, because the function realpaths and that needs something on disk. */
function file(relative: string): string {
  const path = join(dir, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "// fixture\n");
  return path;
}

describe("isCliEntry", () => {
  it("matches the module it was invoked as", () => {
    const mod = file("tool.mjs");
    process.argv[1] = mod;
    assert.equal(isCliEntry(pathToFileURL(mod).href), true);
  });

  it("does not match a different module", () => {
    const mod = file("tool.mjs");
    const other = file("other.mjs");
    process.argv[1] = other;
    assert.equal(isCliEntry(pathToFileURL(mod).href), false);
  });

  it("matches through a relative invocation", () => {
    // Node absolutizes `argv[1]`, so this works for the resolve-based spelling too — but
    // pinning it stops a future rewrite from regressing the ordinary case.
    const mod = file("rel.mjs");
    process.argv[1] = mod;
    assert.equal(isCliEntry(pathToFileURL(mod).href), true);
  });

  it("is not fooled by a filename that is a suffix of another", () => {
    // The `endsWith` spelling could not tell these apart, and this repo had the
    // collision for real: `src/vrt/snapshot/snapshot.ts`'s guard also matched
    // `src/cli/commands/snapshot.ts`.
    const run = file("nested/run.mjs");
    const dryRun = file("nested/dry-run.mjs");
    process.argv[1] = dryRun;
    assert.equal(isCliEntry(pathToFileURL(run).href), false, "dry-run.mjs is not run.mjs");
    process.argv[1] = run;
    assert.equal(isCliEntry(pathToFileURL(dryRun).href), false);
  });

  it("matches a path containing a space", () => {
    // The `new URL(...).pathname === argv[1]` spelling fails here: the pathname is
    // percent-encoded (`/tmp/has%20space/x.mjs`) and argv is not. Four modules carried
    // that spelling. `resolve`/`realpath` never encode, so this passes for either of the
    // correct spellings — it is a pin against reintroducing the URL route, not a test
    // that distinguishes the two right answers.
    const mod = file("has space/tool.mjs");
    process.argv[1] = mod;
    assert.ok(pathToFileURL(mod).pathname.includes("%20"), "the fixture has to exercise encoding");
    assert.equal(isCliEntry(pathToFileURL(mod).href), true);
  });

  it("matches a symlinked bin against its target", () => {
    // How npm installs every `bin` in this workspace: `node_modules/.bin/x` is a symlink
    // to `dist/cli.mjs`, so argv[1] is the shim and `import.meta.url` is the real file.
    // Resolving without realpath returns false and the CLI silently does nothing —
    // `vlmkit-generate` and `vlmkit-plan` had discovered this and carried their own
    // realpath guard.
    const target = file("pkg/dist/cli.mjs");
    const binDir = join(dir, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    const shim = join(binDir, "tool");
    symlinkSync(target, shim);

    process.argv[1] = shim;
    assert.equal(isCliEntry(pathToFileURL(target).href), true, "the shim IS the target");
    // And the reverse direction, since a bin may be invoked by its real path too.
    process.argv[1] = target;
    assert.equal(isCliEntry(pathToFileURL(target).href), true);
  });

  it("returns false with no argv[1] at all", () => {
    const mod = file("noargv.mjs");
    delete (process.argv as unknown as Record<number, unknown>)[1];
    assert.equal(isCliEntry(pathToFileURL(mod).href), false);
  });

  it("returns false for a specifier that is not a file", () => {
    process.argv[1] = file("x.mjs");
    assert.equal(isCliEntry("data:text/javascript,void 0"), false);
    assert.equal(isCliEntry("node:fs"), false);
  });

  it("takes the dispatcher env var as the entry signal, for its own name only", () => {
    // `delegate()` sets the variable and then imports the leaf, so for a dispatched
    // command argv[1] is the dispatcher. The name check is what stops a leaf firing when
    // a *different* leaf is being dispatched — the bug that killed `vlmkit build page`.
    const mod = file("leaf.mjs");
    process.argv[1] = file("dispatcher.mjs");
    const url = pathToFileURL(mod).href;

    process.env.__VLMKIT_DISPATCHER_LEAF__ = "my-leaf";
    assert.equal(isCliEntry(url, "my-leaf"), true);
    assert.equal(isCliEntry(url, "another-leaf"), false, "a leaf must not fire for someone else's name");
    assert.equal(isCliEntry(url), false, "and a module with no name is not dispatched");
  });

  it("does not let a missing file throw", () => {
    // `realpathSync` raises for a path that is not there, and a guard that throws would
    // take down the import rather than answering the question.
    process.argv[1] = join(dir, "was-deleted.mjs");
    assert.equal(isCliEntry(pathToFileURL(join(dir, "also-gone.mjs")).href), false);
  });
});
