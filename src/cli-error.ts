/**
 * Shared CLI error-prettifier. Recognizes common error shapes that
 * make `vrt` look user-hostile (ENOENT stack traces, Playwright
 * navigation errors with absolute source paths) and rewrites them
 * to a one-line message.
 *
 * Use:
 *   main().catch(handleCliError);
 */
export function handleCliError(e: unknown): never {
  const err = e as { code?: string; message?: string; name?: string };
  const msg = String(err?.message ?? e);

  // ENOENT — missing local file path.
  if (err?.code === "ENOENT") {
    const path = msg.match(/ENOENT: no such file or directory[^']*'([^']+)'/)?.[1] ?? "?";
    process.stderr.write(`error: file not found: ${path}\n`);
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
