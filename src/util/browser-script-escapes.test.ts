import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { test } from "vitest";

/**
 * Browser scripts are template literals, and a template literal EATS `\s`.
 *
 * `` `split(/\s+/)` `` evaluates to `split(/s+/)`: JS drops the backslash from any escape it
 * does not recognise, silently, with no warning from the compiler and none from a linter. The
 * script still parses in the browser, `/s+/` is still a valid regex, and it splits on the
 * letter *s*.
 *
 * The occurrence that prompted this test: `handler-map.ts`'s drag probe re-derived each
 * element's path with `className.trim().split(/\s+/)[0]` to join its rows back to the surface
 * entries. Emitted as `/s+/`, the join failed for any element (or ancestor) whose first class
 * contains an `s`, and every probe-derived finding vanished. Measured end to end: renaming one
 * container class `row` → `rows` on the drag fixture — no behavioural change whatsoever — took
 * the run from 1 `dragover-not-prevented` + 3 `dragstart-transfers-nothing` to zero findings.
 * `sortable`, `list`, `cards`, `items` are ordinary class names, so real pages hit this by
 * default rather than by accident.
 *
 * `String.raw` is the fix and the idiom (`OBSERVE_SCRIPT` in `markup-loop.ts` already used
 * it), so this test accepts a `String.raw` tag OR a doubled backslash and rejects a lone one.
 *
 * Scope: template literals bound to a const named `*SCRIPT`, `*_FN` or `*SOURCE`. Narrow
 * deliberately — a repo-wide sweep of every template literal reports the regex literals inside
 * docstrings and the ordinary `${}` code, ~40 hits of which one was real, and a test nobody can
 * read the output of is not a test. The naming convention is what every browser script in this
 * repo already follows.
 */
const sourceRoots = ["src", "packages", "e2e", "scripts"] as const;
const ignoredDirectories = new Set(["node_modules", "dist", "_build", "target"]);
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

/** `const FOO_SCRIPT = ` or `const FOO_SCRIPT = String.raw` followed by the opening backtick. */
const SCRIPT_DECL = /(?:const|let|var)\s+([A-Za-z0-9_$]*(?:SCRIPT|_FN|SOURCE))\s*(?::[^=]+)?=\s*(String\.raw)?`/g;
/** A backslash the literal will eat: an odd number of backslashes before one of these. */
const DROPPED_ESCAPE = /(?<!\\)(?:\\\\)*\\([sdwSDWbB])/;

type Suspect = { file: string; constant: string; escape: string };

/** Blank out `${…}` runs: inside an interpolation, `\s` is real code and keeps its backslash. */
function withoutInterpolations(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "$" && body[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < body.length && depth > 0) {
        if (body[j] === "{") depth++;
        else if (body[j] === "}") depth--;
        j++;
      }
      // Same length, so reported offsets still line up with the source.
      out += " ".repeat(j - i);
      i = j - 1;
      continue;
    }
    out += body[i];
  }
  return out;
}

export function findEatenEscapesInText(content: string, file = "<text>"): Suspect[] {
  const suspects: Suspect[] = [];
  for (const decl of content.matchAll(SCRIPT_DECL)) {
    let i = decl.index + decl[0].length;
    let body = "";
    while (i < content.length) {
      if (content[i] === "\\") {
        body += content[i]! + (content[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (content[i] === "`") break;
      body += content[i];
      i++;
    }
    if (decl[2]) continue; // String.raw keeps every backslash
    const hit = withoutInterpolations(body).match(DROPPED_ESCAPE);
    if (hit) suspects.push({ file, constant: decl[1]!, escape: "\\" + hit[1] });
  }
  return suspects;
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await collectSourceFiles(join(dir, entry.name)));
      continue;
    }
    if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(join(dir, entry.name));
  }
  return files.sort();
}

test("detects the escape a template literal eats, and only that", () => {
  // The real defect, in the shape it shipped in.
  const broken = "const PROBE_SCRIPT = `\n  el.className.trim().split(/\\s+/)[0]\n`;";
  assert.deepEqual(findEatenEscapesInText(broken, "broken.ts"), [
    { file: "broken.ts", constant: "PROBE_SCRIPT", escape: "\\s" },
  ]);

  // Three spellings that are correct, so the test cannot pass by flagging everything:
  // String.raw, a doubled backslash, and an escape inside an interpolation.
  const raw = "const A_SCRIPT = String.raw`el.className.split(/\\s+/)`;";
  const doubled = "const B_SCRIPT = `el.className.split(/\\\\s+/)`;";
  const interpolated = "const C_SCRIPT = `${text.replace(/\\s+/g, \" \")}`;";
  for (const [label, source] of [["String.raw", raw], ["doubled", doubled], ["interpolated", interpolated]]) {
    assert.deepEqual(findEatenEscapesInText(source!), [], label);
  }
});

test("no browser script silently loses a regex escape", async () => {
  const repoRoot = process.cwd();
  const suspects: Suspect[] = [];
  let scanned = 0;
  for (const root of sourceRoots) {
    for (const file of await collectSourceFiles(join(repoRoot, root))) {
      const content = await readFile(file, "utf8");
      const found = findEatenEscapesInText(content, relative(repoRoot, file));
      scanned += (content.match(SCRIPT_DECL) ?? []).length;
      suspects.push(...found);
    }
  }
  // The sweep is worthless if the naming convention stopped matching anything, and a
  // rename could quietly take it to zero. 28 script-shaped constants when written.
  assert.ok(scanned >= 20, `only ${scanned} script constants matched — has the naming convention changed?`);
  assert.deepEqual(
    suspects,
    [],
    suspects.map((s) => `${s.file}: ${s.constant} loses ${s.escape} — use String.raw\`…\` or double the backslash`)
      .join("\n"),
  );
});
