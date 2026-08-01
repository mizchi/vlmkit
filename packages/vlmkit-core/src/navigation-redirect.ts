/**
 * Redirect disclosure for gates that navigate.
 *
 * Discovered by the 2026-08-01 hard-target audit: pointing a gate at an
 * auth-walled route (`/dashboard` behind a session cookie) silently
 * followed the 302 to `/login` and measured THAT page. `check integrity`
 * reported `verdict: CLEAN` — a green gate on a page that never rendered,
 * which is worse than an error, and `check copy` reported the dashboard's
 * copy as "missing" when the real problem was that it was never visited.
 *
 * A gate must never report on a URL it did not measure. This helper
 * compares requested vs. final URL and returns a message when they differ
 * in a way the caller should hear about.
 *
 * Deliberately quiet about cosmetic redirects — scheme upgrade, added or
 * dropped trailing slash, host canonicalization (www.) — because those
 * still land on the intended page and crying wolf about them would train
 * users to ignore the warning.
 */

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

/**
 * Returns a human-readable warning when the final URL is a different page
 * than the one requested, or `null` when the navigation landed where the
 * caller intended (or when either URL is unparseable / not http(s)).
 */
export function describeRedirect(requested: string, final: string): string | null {
  if (!requested || !final || requested === final) return null;
  let a: URL, b: URL;
  try {
    a = new URL(requested);
    b = new URL(final);
  } catch {
    return null; // file:// paths and malformed inputs: nothing useful to say
  }
  if (a.protocol !== "http:" && a.protocol !== "https:") return null;

  const hostA = a.hostname.replace(/^www\./, "");
  const hostB = b.hostname.replace(/^www\./, "");
  const samePath = normalizePath(a.pathname) === normalizePath(b.pathname);
  if (samePath && hostA === hostB) return null; // scheme/slash/www only

  const looksLikeAuth = /login|signin|sign-in|auth|sso|account\/login/i.test(b.pathname);
  const hint = looksLikeAuth
    ? " This looks like a login wall: the gate measured the sign-in page, NOT the page you asked about. vlmkit cannot inject a session — point it at a route that does not need auth, or render the page to a local file."
    : " The gate measured the destination, not the URL you passed.";
  return `redirected: requested ${a.pathname}${a.search} but measured ${b.href}.${hint}`;
}
