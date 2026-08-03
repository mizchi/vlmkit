/**
 * Shared CLI error-prettifier. Recognizes common error shapes that
 * make `vlmkit` look user-hostile (ENOENT stack traces, Playwright
 * navigation errors with absolute source paths) and rewrites them
 * to a one-line message.
 *
 * Use:
 *   main().catch(handleCliError);
 */
import { statSync } from "node:fs";

/**
 * A bad flag or missing argument — the caller's typo, not a defect. Thrown by
 * `arg-reader` and printed as one line, because a stack trace for
 * `--concurrency abc` buries the one sentence that fixes it.
 */
export class UsageError extends Error {
  override readonly name = "UsageError";
}

export function handleCliError(e: unknown): never {
  // Node fs errors carry the offending path on `.path`; that's more
  // reliable than parsing it out of `.message` (which sometimes
  // doesn't include the path at all, e.g. EISDIR from readFile).
  const err = e as { code?: string; message?: string; name?: string; path?: string };
  const msg = String(err?.message ?? e);

  if (err?.name === "UsageError") {
    process.stderr.write(`error: ${msg}\n`);
    process.exit(1);
  }

  // ENOENT — missing local file path.
  if (err?.code === "ENOENT") {
    const path = err.path ?? msg.match(/ENOENT: no such file or directory[^']*'([^']+)'/)?.[1] ?? "?";
    process.stderr.write(`error: file not found: ${path}\n`);
    process.exit(1);
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
    process.stderr.write(`error: expected an HTML file, got a directory: ${path}\n${hint}\n`);
    process.exit(1);
  }
  // Playwright navigation failure (DNS / connection refused / SSL).
  if (
    /net::ERR_NAME_NOT_RESOLVED/i.test(msg)
    || /net::ERR_CONNECTION_REFUSED/i.test(msg)
    || /Cannot navigate to invalid URL/i.test(msg)
  ) {
    const url = msg.match(/Navigating to ([^,]+)/i)?.[1]
      ?? msg.match(/(https?:\/\/[^\s"]+)/)?.[1]
      ?? "the URL";
    let reason = "failed to load";
    if (/ERR_NAME_NOT_RESOLVED/i.test(msg)) reason = "host could not be resolved (check the URL)";
    else if (/ERR_CONNECTION_REFUSED/i.test(msg)) reason = "connection refused (is the server running?)";
    else if (/invalid URL/i.test(msg)) reason = "not a valid URL";
    process.stderr.write(`error: cannot load ${url}: ${reason}\n`);
    process.exit(1);
  }
  // Playwright timeout.
  if (/Timeout \d+ms exceeded/i.test(msg)) {
    process.stderr.write(`error: page load timed out (${msg.match(/Timeout \d+ms exceeded[^.]*/i)?.[0] ?? msg})\n`);
    process.exit(1);
  }
  // Default: full error for the developer.
  console.error(e);
  process.exit(1);
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
