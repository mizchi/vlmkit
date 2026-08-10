/**
 * Shared CLI error-prettifier. Recognizes common error shapes that
 * make `vlmkit` look user-hostile (ENOENT stack traces, Playwright
 * navigation errors with absolute source paths) and rewrites them
 * to a one-line message.
 *
 * Use:
 *   main().catch(handleCliError);
 *
 * Every CLI entry must go through it, *including* `scripts/vlmkit-bundled.mjs`
 * — that is the one `tsdown.config.ts` builds into the published `bin`. It used
 * to `console.error(error)` instead, which made everything below dead code in
 * the shipped CLI while it kept working in the workspace (issue #112, item 2).
 * `tests/playwright-peer-contract.test.mjs` guards that.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A bad flag or missing argument — the caller's typo, not a defect. Thrown by
 * `arg-reader` and printed as one line, because a stack trace for
 * `--concurrency abc` buries the one sentence that fixes it.
 */
export class UsageError extends Error {
  override readonly name = "UsageError";
}

/**
 * The `playwright` peer range. Duplicated from this package's own
 * `peerDependencies` because the shipped bundle has no reliable path back to
 * its manifest (tsdown flattens `dist/`, and the root CLI bundle inlines this
 * module into a hashed chunk). `tests/playwright-peer-contract.test.mjs` reads
 * the manifest and fails if the two drift, so the duplication cannot rot
 * silently.
 */
export const PLAYWRIGHT_PEER_RANGE = ">=1.61 <2";

/** Playwright install target: which `playwright` *this* process resolved. */
export interface PlaywrightInstallTarget {
  version: string;
  /** Directory of the resolved `playwright` package — the identity the reporter of #112 could not see. */
  packageDir: string;
  cliPath: string;
  nodePath: string;
}

function shellArg(value: string): string {
  return /^[A-Za-z0-9_./:@+-]+$/.test(value) ? value : JSON.stringify(value);
}

/**
 * Resolve the `playwright` that vlmkit itself imports, not the one a package
 * manager would pick for `pnpm exec`.
 *
 * Issue #112 (item 2): with two Playwright versions in the tree, the launch
 * failure told the user to run `pnpm exec playwright install`, which resolves
 * from the *project* root and downloads that Playwright's browser build. In the
 * report that was build 1228 while vlmkit's own Playwright wanted 1234, so the
 * advice never fixed anything. `createRequire(import.meta.url)` resolves from
 * this module's location, i.e. from inside vlmkit's own package — the same
 * lookup the `import { chromium } from "playwright"` at the 51 launch sites
 * performs — so the command we print targets the installation that failed.
 */
function resolvePlaywrightInstallTarget(): PlaywrightInstallTarget | null {
  try {
    const require = createRequire(import.meta.url);
    const manifestPath = require.resolve("playwright/package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string };
    if (!manifest.version) return null;
    const packageDir = dirname(manifestPath);
    return {
      version: manifest.version,
      packageDir,
      cliPath: join(packageDir, "cli.js"),
      nodePath: process.execPath,
    };
  } catch {
    return null;
  }
}

/**
 * Which engine to reinstall, read off the executable path Playwright printed.
 *
 * Hardcoding `chromium` was wrong for `stress cross-browser`, which launches
 * firefox and webkit too. Playwright names the download directory after the
 * engine (`firefox-1490/`, `webkit-2247/`, `chromium_headless_shell-1228/`), so
 * the missing path is itself the answer. Both chromium flavours map to
 * `chromium`: `playwright install chromium` fetches the headless shell as well
 * (verified against the 1.61.1 CLI, which lists both under that one name).
 */
export function playwrightEngineFromLaunchError(message: string): "chromium" | "firefox" | "webkit" {
  if (/\bwebkit[-_]/i.test(message)) return "webkit";
  if (/\bfirefox[-_]/i.test(message)) return "firefox";
  return "chromium";
}

/** `node <resolved playwright>/cli.js install <engine>` — quoted for a shell. */
export function playwrightInstallCommand(
  target: PlaywrightInstallTarget,
  engine: "chromium" | "firefox" | "webkit" = "chromium",
): string {
  return [target.nodePath, target.cliPath, "install", engine].map(shellArg).join(" ");
}

function missingExecutablePath(message: string): string | null {
  return message.match(/Executable doesn't exist at\s+(\S+)/i)?.[1] ?? null;
}

export function formatMissingPlaywrightBrowserError(
  error: unknown,
  target: PlaywrightInstallTarget | null = resolvePlaywrightInstallTarget(),
): string | null {
  const message = String((error as { message?: string })?.message ?? error);
  if (!/browserType\.launch:[\s\S]*Executable doesn't exist at/i.test(message)) return null;
  const engine = playwrightEngineFromLaunchError(message);
  if (!target) {
    // `playwright` is loaded (it threw the launch error) but we could not
    // resolve its manifest from here — a bundling accident rather than a user
    // error. Say what is missing without inventing a command that may be wrong.
    return `error: Playwright has no ${engine} browser executable installed, and vlmkit could not resolve`
      + ` its own playwright package to name the install command.`;
  }
  const missing = missingExecutablePath(message);
  const lines = [
    `error: Playwright ${target.version} has no ${engine} browser executable installed.`,
    ...(missing ? [`       missing:  ${missing}`] : []),
    `       resolved: playwright@${target.version} at ${target.packageDir}`,
    `       run:      ${playwrightInstallCommand(target, engine)}`,
    // The whole point of the diagnosis. `pnpm exec playwright install` resolves
    // the *project's* playwright, which in a tree with two versions downloads a
    // different browser build and leaves this error in place.
    `       (\`npx/pnpm exec playwright install\` may resolve a different playwright and download a different build)`,
  ];
  return lines.join("\n");
}

/**
 * `playwright` absent entirely, rather than present-but-browserless.
 *
 * It is a **required** peer, deliberately — the argument and its measurement
 * live in `tests/playwright-peer-contract.test.mjs`, because a JSON manifest
 * cannot hold a comment. Short version: the gate registry statically imports
 * `perf.gate`, which statically imports `playwright`, so even the pixel-only
 * commands fault at module load without it. Measured 2026-08-10: in a tree with
 * the package removed, `vlmkit diff png --help` dies with ERR_MODULE_NOT_FOUND
 * before printing usage. That raw stack is what this turns into one sentence.
 */
export function formatMissingPlaywrightModuleError(error: unknown): string | null {
  const err = error as { code?: string; message?: string };
  const message = String(err?.message ?? error);
  const isModuleNotFound = err?.code === "ERR_MODULE_NOT_FOUND"
    || /ERR_MODULE_NOT_FOUND/.test(message)
    || /Cannot find (?:package|module)/i.test(message);
  if (!isModuleNotFound) return null;
  if (!/Cannot find (?:package|module) ['"]playwright['"]/i.test(message)) return null;
  const importer = message.match(/imported from\s+(\S+)/i)?.[1] ?? null;
  return [
    `error: the \`playwright\` package is not installed.`,
    `       vlmkit declares it as a required peer dependency (${PLAYWRIGHT_PEER_RANGE}). Every`,
    `       command loads it, the pixel-only ones included, because the gate`,
    `       registry imports the browser gates eagerly.`,
    ...(importer ? [`       imported by: ${importer}`] : []),
    `       run: npm install --save-dev playwright  (or pnpm add -D / yarn add -D)`,
    `       then install its browsers with that installation's own CLI:`,
    `            node node_modules/playwright/cli.js install chromium`,
  ].join("\n");
}

/**
 * Best-effort sanity check used by tests: does the resolved playwright actually
 * have a `cli.js` to invoke? Kept exported so the happy-path test can assert the
 * command we print is runnable rather than merely well-formed.
 */
export function resolvedPlaywrightHasCli(): boolean {
  const target = resolvePlaywrightInstallTarget();
  return target !== null && existsSync(target.cliPath);
}

export { resolvePlaywrightInstallTarget };

/**
 * The one-line diagnosis for an error, or `null` when there isn't one.
 *
 * Split out of `handleCliError` so the branches are testable. They were not:
 * the only entry point ended in `process.exit`, so covering a branch meant
 * spawning a child process, and in practice nothing covered any of them. That
 * is how the `ERR_FILE_NOT_FOUND` gap below reached a release — the ENOENT
 * branch it duplicates has printed the right line since 2026-05-15, and no test
 * noticed when ten gates stopped reaching it.
 *
 * `null` rather than a generic string on purpose: an unrecognized error should
 * reach the developer whole, stack and all. A prettifier that invents a summary
 * for everything is worse than one that admits it has nothing to add.
 */
export function formatCliError(e: unknown): string | null {
  // Node fs errors carry the offending path on `.path`; that's more
  // reliable than parsing it out of `.message` (which sometimes
  // doesn't include the path at all, e.g. EISDIR from readFile).
  const err = e as { code?: string; message?: string; name?: string; path?: string };
  const msg = String(err?.message ?? e);

  if (err?.name === "UsageError") return `error: ${msg}`;

  // `browser-launch.ts` already ran the diagnosis at the launch (so library
  // callers get it too, not only the CLI) and put the finished text — "error: "
  // prefix and all — in `message`. Returned verbatim: re-prefixing would give
  // "error: error: …", and returning null would print a stack where this should
  // print two lines. Matched by name rather than `instanceof` so this module
  // keeps its zero Playwright imports.
  if (err?.name === "BrowserLaunchError") return msg;

  // ENOENT — missing local file path.
  if (err?.code === "ENOENT") {
    const path = err.path ?? msg.match(/ENOENT: no such file or directory[^']*'([^']+)'/)?.[1] ?? "?";
    return `error: file not found: ${path}`;
  }
  // EISDIR — caller passed a directory where an HTML file (or other
  // single-file artifact) was expected. Surfaced repeatedly in
  // back-to-back cold-start dogfoods (2026-05-15) as the worst raw-
  // stack-trace first impression in the toolkit. Almost every vlmkit
  // subcommand accepts `<html-or-url>` as its first positional, so
  // catching the directory case here covers all of them at once.
  // Node's fsPromises.readFile drops `err.path`, so we fall back to
  // scanning argv for any positional that exists as a directory.
  if (err?.code === "EISDIR") {
    const argvDir = findDirectoryArg();
    const path = err.path ?? msg.match(/EISDIR:[^']*'([^']+)'/)?.[1] ?? argvDir ?? "?";
    const hint = path === "?"
      ? "       hint: pass the path to a specific .html file."
      : `       hint: pass the path to a specific .html file inside it (e.g. ${path}/page.html).`;
    return `error: expected an HTML file, got a directory: ${path}\n${hint}`;
  }
  const missingBrowser = formatMissingPlaywrightBrowserError(e);
  if (missingBrowser) return missingBrowser;
  // Checked after ENOENT above on purpose: a missing `playwright` package
  // surfaces as ERR_MODULE_NOT_FOUND from the ESM resolver, which carries no
  // `.code === "ENOENT"`, so the two cannot collide.
  const missingModule = formatMissingPlaywrightModuleError(e);
  if (missingModule) return missingModule;
  // A missing local file, reported by the browser rather than by `fs`.
  //
  // Deliberately handled next to the ENOENT branch above and worded identically,
  // because the two are the *same user error* reached by two different loaders.
  // The base-URL refactor moved ten gates off `readFile` + `setContent` onto
  // `page.goto(pathToFileURL(file))` — see `page-open.ts` for why — and in doing
  // so it silently traded this message for a stack trace. Measured on the same
  // missing path in the same tree (2026-08-10):
  //
  //   vlmkit diff html nope.html ...  ->  error: file not found: /abs/nope.html
  //   vlmkit check a11y focus nope.html  ->  14 lines of `page.goto:` + Call log
  //                                          + `at runFocusOrder (…/dist/…)`
  //
  // A typo'd path is the most common way to invoke any of these commands wrong,
  // so it is the message that most needs to be one line.
  if (/net::ERR_FILE_NOT_FOUND/i.test(msg)) {
    return `error: file not found: ${navigationTargetPath(msg)}`;
  }
  // Playwright navigation failure (DNS / connection refused / unsafe port / SSL).
  if (
    /net::ERR_NAME_NOT_RESOLVED/i.test(msg)
    || /net::ERR_CONNECTION_REFUSED/i.test(msg)
    || /net::ERR_UNSAFE_PORT/i.test(msg)
    || /Cannot navigate to invalid URL/i.test(msg)
  ) {
    const url = msg.match(/Navigating to ([^,]+)/i)?.[1]
      ?? msg.match(/(https?:\/\/[^\s"]+)/)?.[1]
      ?? "the URL";
    let reason = "failed to load";
    if (/ERR_NAME_NOT_RESOLVED/i.test(msg)) reason = "host could not be resolved (check the URL)";
    else if (/ERR_CONNECTION_REFUSED/i.test(msg)) reason = "connection refused (is the server running?)";
    // Not a defect in the page or the server: Chromium keeps a blocklist of
    // ports it refuses to fetch over HTTP (1, 7, 22, 25, 6000, …), so a URL on
    // one of them fails before any request leaves the browser. Worth naming,
    // because the generic "failed to load" sends the reader to check a server
    // that was never contacted.
    else if (/ERR_UNSAFE_PORT/i.test(msg)) {
      reason = "Chromium refuses to fetch this port (it is on the blocked-port list) — try another port";
    } else if (/invalid URL/i.test(msg)) reason = "not a valid URL";
    return `error: cannot load ${url}: ${reason}`;
  }
  // Playwright timeout.
  if (/Timeout \d+ms exceeded/i.test(msg)) {
    return `error: page load timed out (${msg.match(/Timeout \d+ms exceeded[^.]*/i)?.[0] ?? msg})`;
  }
  return null;
}

export function handleCliError(e: unknown): never {
  const diagnosis = formatCliError(e);
  if (diagnosis !== null) {
    process.stderr.write(`${diagnosis}\n`);
    process.exit(1);
  }
  // Default: full error for the developer.
  console.error(e);
  process.exit(1);
}

/**
 * The path a failed `page.goto` was aiming at, as an ordinary filesystem path.
 *
 * Playwright reports `net::ERR_FILE_NOT_FOUND at file:///abs/nope.html`, and a
 * `file://` URL is the wrong thing to echo back: the caller typed a path, and a
 * percent-encoded URL of it is harder to compare against what they typed. This
 * decodes it so the message matches the ENOENT branch's exactly.
 *
 * Falls back to the raw match, then to scanning argv, because a message shape
 * that changes with a Playwright upgrade should degrade to a worse path rather
 * than to no message at all.
 */
function navigationTargetPath(msg: string): string {
  const url = msg.match(/(file:\/\/\/[^\s"']+)/)?.[1];
  if (url) {
    try {
      return fileURLToPath(url);
    } catch {
      return url;
    }
  }
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("-") && /\.html?$/i.test(arg)) return arg;
  }
  return "?";
}

/**
 * EISDIR fallback: Node's `fsPromises.readFile` doesn't attach `.path`
 * to the error, and the message string doesn't include the path
 * either. Scan argv for the first positional that exists as a
 * directory — close enough since most vlmkit subcommands take exactly
 * one path argument and the failure happens during the initial read.
 */
function findDirectoryArg(): string | undefined {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("-")) continue;
    try {
      if (statSync(arg).isDirectory()) return arg;
    } catch {
      // arg doesn't exist as a path; keep scanning.
    }
  }
  return undefined;
}
