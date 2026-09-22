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
 * ## Scope: browser scripts by name, not every template literal
 *
 * Still narrow deliberately — a repo-wide sweep of every template literal reports the regex
 * literals inside docstrings and the ordinary `${}` code, ~40 hits of which one was real, and a
 * test nobody can read the output of is not a test. But the naming convention has three shapes,
 * not one: `*SCRIPT` / `*_FN` / `*SOURCE` as originally written, plus `*_JS` for a spliceable
 * fragment (`CONTRAST_BACKGROUND_JS`, `ANIMATION_HELPERS_JS`) and `COLLECT_*` for a gate's
 * `page.evaluate` payload, both of which grew up after this test and were outside it. Measured
 * when they were brought in: **39 constants to 61, and 0 new suspects** — the widening is free,
 * which is exactly when to take it.
 *
 * Six browser scripts follow none of the three (`TAG_STATE_ACTIONS`, `READ_SELECTION`, …), so
 * they are listed by hand below. `NEUTRALIZE_ANIMATIONS` in `a11y-on-page.ts` is deliberately
 * NOT on that list: it is a stylesheet, not script, and `addStyleTag` is how it ships.
 *
 * ## Two views of one literal, and why both are needed
 *
 * The escape check reads the body's **source spelling**, because `\s` and `\\s` are the defect
 * and the fix and they differ only there. The syntax check below reads the body's **cooked
 * value**, because that is what reaches the browser. Scanning the cooked value for eaten escapes
 * reports all 23 correct `\\s` spellings as defects; that was measured too, by doing it.
 */
const sourceRoots = ["src", "packages", "e2e", "scripts"] as const;
const ignoredDirectories = new Set(["node_modules", "dist", "_build", "target"]);
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * `const FOO_SCRIPT = ` or `const FOO_JS = String.raw` followed by the opening backtick.
 *
 * Anchored to the start of a line (indent and `export` allowed) so that a declaration written
 * inside a comment or a string is not one. Measured when the syntax check below was added:
 * unanchored it matched 68 declarations, anchored 58, and all ten it dropped were prose — nine
 * probe strings and doc lines in THIS file, plus `stable-selector.ts`'s usage example, whose
 * `…` is not valid JavaScript and read as a broken script. No real browser script is declared
 * anywhere but at the start of a line.
 */
const SCRIPT_DECL =
  /^[ \t]*(?:export\s+)?(?:const|let|var)\s+((?:COLLECT[A-Za-z0-9_$]*)|(?:[A-Za-z0-9_$]*(?:SCRIPT|_FN|SOURCE|_JS)))\s*(?::[^=]+)?=\s*(String\.raw)?`/gm;
/**
 * Browser scripts whose names follow none of the four shapes. A hand list is the audit trail:
 * an entry that gets renamed to the convention is one that must be deleted here.
 */
const ALSO_BROWSER_SCRIPTS = new Set([
  "TAG_STATE_ACTIONS",
  "AWAIT_RENDER_COMMIT",
  "READ_SELECTION",
  "DETECT_THEME_STRATEGY",
  "PROBE",
]);
const ALSO_DECL = new RegExp(
  `^[ \\t]*(?:export\\s+)?(?:const|let|var)\\s+(${[...ALSO_BROWSER_SCRIPTS].join("|")})\\s*(?::[^=]+)?=\\s*(String\\.raw)?\``,
  "gm",
);
/** A backslash the literal will eat: an odd number of backslashes before one of these. */
const DROPPED_ESCAPE = /(?<!\\)(?:\\\\)*\\([sdwSDWbB])/;

type Suspect = { file: string; constant: string; escape: string };
type Script = { file: string; constant: string; raw: boolean; source: string; value: string };

/**
 * The index just past the `}` closing a `${…}` run that starts at `open` (the `{`).
 *
 * Depth starts at 1 because `open` is already inside it — starting at 0 makes the first `}`
 * take the count negative and the scan runs to the end of the file, which read as "this script
 * does not parse" for 24 of 61 constants when it was written that way.
 *
 * A quote inside the expression is skipped whole, which is the case that matters: `${"`"}` is
 * how a backtick gets into a `String.raw` literal, and a scanner that treats every backtick as
 * the end of the literal stops there. `RUNTIME_SOURCE` was being read as its first 445 bytes
 * instead of all 15777 for exactly that reason — the sweep silently covered 3% of the largest
 * browser script in the repo.
 */
function endOfInterpolation(text: string, open: number): number {
  let depth = 1;
  let j = open + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      j++;
      while (j < text.length && text[j] !== ch) {
        if (text[j] === "\\") j++;
        j++;
      }
      j++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return j + 1;
    }
    j++;
  }
  return text.length;
}

/** The literal's body as written, from `start` to the backtick that closes it. */
function bodyFrom(text: string, start: number): string {
  let i = start;
  while (i < text.length) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === "$" && text[i + 1] === "{") {
      i = endOfInterpolation(text, i + 1);
      continue;
    }
    if (text[i] === "`") break;
    i++;
  }
  return text.slice(start, i);
}

/** Undo the literal's own escapes, the way the engine does. `String.raw` keeps them. */
function cook(body: string, raw: boolean): string {
  if (raw) return body;
  return body.replace(/\\(.)/g, (_, ch: string) =>
    ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "r" ? "\r" : ch,
  );
}

/** Blank out `${…}` runs: inside an interpolation, `\s` is real code and keeps its backslash. */
function withoutInterpolations(body: string): string {
  let out = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "$" && body[i + 1] === "{") {
      const end = endOfInterpolation(body, i + 1);
      // Same length, so reported offsets still line up with the source.
      out += " ".repeat(end - i);
      i = end;
      continue;
    }
    out += body[i];
    i++;
  }
  return out;
}

export function findBrowserScriptsInText(content: string, file = "<text>"): Script[] {
  const scripts: Script[] = [];
  for (const decl of [...content.matchAll(SCRIPT_DECL), ...content.matchAll(ALSO_DECL)]) {
    const source = bodyFrom(content, decl.index + decl[0].length);
    scripts.push({
      file,
      constant: decl[1]!,
      raw: !!decl[2],
      source,
      value: cook(source, !!decl[2]),
    });
  }
  return scripts;
}

export function findEatenEscapesInText(content: string, file = "<text>"): Suspect[] {
  const suspects: Suspect[] = [];
  for (const script of findBrowserScriptsInText(content, file)) {
    if (script.raw) continue; // String.raw keeps every backslash
    const hit = withoutInterpolations(script.source).match(DROPPED_ESCAPE);
    if (hit) suspects.push({ file, constant: script.constant, escape: "\\" + hit[1] });
  }
  return suspects;
}

/** A `${…}` expression simple enough to stand in for its own value: a string or a number. */
const VALUE_LITERAL = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)$/;

/**
 * The script as the browser would receive it, with every `${…}` resolved.
 *
 * Three cases, in order. A fragment name known to the table is replaced by that fragment's own
 * resolved body — nested composition is the established pattern, not a smell:
 * `ANIMATION_HELPERS_JS` splices `${STABLE_SELECTOR_JS}` and is itself spliced twice.
 * A string or number literal is replaced by its value, which is not pedantry — `${"`"}` is how
 * `runtime.ts` writes a backtick inside `String.raw`, and it carries SYNTAX, not data.
 * Anything else is a host value the call site supplies (`${JSON.stringify(selector)}`,
 * `${MAX_TARGETS}`) and stands in as `0`, which parses wherever such a value can appear.
 */
function resolveScript(body: string, table: Map<string, Script>, seen = new Set<string>()): string {
  let out = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "$" && body[i + 1] === "{") {
      const end = endOfInterpolation(body, i + 1);
      const expr = body.slice(i + 2, end - 1).trim();
      const fragment = table.get(expr);
      if (fragment && !seen.has(expr)) {
        out += resolveScript(fragment.value, table, new Set([...seen, expr]));
      } else if (VALUE_LITERAL.test(expr)) {
        out += JSON.parse(expr.startsWith("'") ? `"${expr.slice(1, -1)}"` : expr) as string;
      } else {
        out += "0";
      }
      i = end;
      continue;
    }
    out += body[i];
    i++;
  }
  return out;
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

async function collectBrowserScripts(): Promise<Script[]> {
  const repoRoot = process.cwd();
  const scripts: Script[] = [];
  for (const root of sourceRoots) {
    for (const file of await collectSourceFiles(join(repoRoot, root))) {
      const content = await readFile(file, "utf8");
      scripts.push(...findBrowserScriptsInText(content, relative(repoRoot, file)));
    }
  }
  return scripts;
}

test("no browser script silently loses a regex escape", async () => {
  const scripts = await collectBrowserScripts();
  const suspects = scripts.flatMap((script) => {
    if (script.raw) return [];
    const hit = withoutInterpolations(script.source).match(DROPPED_ESCAPE);
    return hit ? [{ file: script.file, constant: script.constant, escape: "\\" + hit[1] }] : [];
  });
  // The sweep is worthless if the naming convention stopped matching anything, and a
  // rename could quietly take it to zero. 28 script-shaped constants when this was written
  // against `*SCRIPT` / `*_FN` / `*SOURCE`, 39 when `*_JS` and `COLLECT_*` were added, 61 after.
  assert.ok(
    scripts.length >= 50,
    `only ${scripts.length} script constants matched — has the naming convention changed?`,
  );
  // And the four that the narrow pattern missed, by name, because a count can be met while the
  // constants this widening was for sit outside it again after a rename.
  const covered = new Set(scripts.map((script) => script.constant));
  for (const name of ["CONTRAST_BACKGROUND_JS", "COLLECT_COLOR_ROLES", "COLLECT_COMPOSITION", "READ_SELECTION"]) {
    assert.ok(covered.has(name), `${name} is a browser script the sweep no longer reads`);
  }
  assert.deepEqual(
    suspects,
    [],
    suspects.map((s) => `${s.file}: ${s.constant} loses ${s.escape} — use String.raw\`…\` or double the backslash`)
      .join("\n"),
  );
});

/**
 * The check `contrast-background.ts` already promised and nobody had written.
 *
 * Its header said "`tests/browser-script-syntax` parses every such constant, which is what
 * catches a fragment that stops being valid JavaScript". No such file existed, in tests/ or
 * anywhere — the claim had nothing behind it for the whole life of the fragment. This is it.
 *
 * What it buys over the compiler: TypeScript checks that the LITERAL is well-formed, never that
 * its contents are. A fragment is written in one file, spliced into another, and only the
 * browser ever parses the result — so a stray brace, a `return` outside a function, or a
 * `continue` with no loop reaches `page.evaluate`, which reports it as a page error from the
 * gate's own payload. `new Function` compiles without executing, and the scripts are written to
 * be exactly that: a function body (`CONTRAST_BACKGROUND_JS` is a run of declarations, the
 * `COLLECT_*` are IIFEs).
 *
 * This is also how the escape sweep's own blind spot was found. Nothing here parsed until
 * `${…}` was skipped when scanning for the closing backtick, because `runtime.ts` writes
 * `${"`"}` to get a backtick into `String.raw` — and that same scan is what feeds the sweep
 * above, which had been reading `RUNTIME_SOURCE` as its first 445 of 15777 bytes.
 */
test("every browser script parses as JavaScript once its fragments are spliced in", async () => {
  const scripts = await collectBrowserScripts();
  const table = new Map(scripts.map((script) => [script.constant, script]));
  const broken = scripts.flatMap((script) => {
    try {
      new Function(resolveScript(script.value, table));
      return [];
    } catch (error) {
      return [`${script.file}: ${script.constant} — ${(error as Error).message}`];
    }
  });
  assert.deepEqual(broken, [], `\n  ${broken.join("\n  ")}\n`);

  // Non-vacuity, in the two shapes the compiler cannot see. A run of declarations and an IIFE
  // are both valid function bodies; an unbalanced brace and a bare `continue` are not, and
  // TypeScript accepts either inside a template literal without a word.
  for (const bad of [
    "const X_JS = `function f() { return 1;`;",
    "const COLLECT_Y = `(() => { continue; })()`;",
  ]) {
    const [script] = findBrowserScriptsInText(bad);
    assert.ok(script, `the probe itself has to match: ${bad}`);
    assert.throws(() => new Function(resolveScript(script!.value, new Map())), SyntaxError, bad);
  }
  // And one that must NOT throw, so "it always throws" cannot pass the assertion above.
  const [good] = findBrowserScriptsInText("const Z_JS = `(() => { for (;;) { continue; } })()`;");
  new Function(resolveScript(good!.value, new Map()));
});
