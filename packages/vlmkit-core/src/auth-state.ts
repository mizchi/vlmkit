/**
 * Authenticated-page support for the gates.
 *
 * The 2026-08-01 hard-target audit made the auth gap loud (a redirect to a
 * login wall is now a reported defect instead of a silent CLEAN), but loud
 * failure is not access: for most product apps the interesting pages —
 * dashboard, checkout, settings — are all behind a session. This closes
 * that by accepting a Playwright storage-state file, which is the format
 * `playwright codegen --save-storage` and `context.storageState()` already
 * produce, so teams reuse the artifact their e2e suite has.
 *
 * Two ways in, because gate invocations live in CI yaml / npm scripts and
 * threading a flag through every one of them is the exact config sprawl
 * this project is trying not to create:
 *   - `--storage-state <path>` on any URL-capable gate
 *   - `VLMKIT_STORAGE_STATE=<path>` for all of them at once
 *
 * An explicit flag always wins over the environment.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const STORAGE_STATE_ENV = "VLMKIT_STORAGE_STATE";

/**
 * Explicit flag beats env; returns undefined when neither is set. A blank
 * explicit value counts as "not passed" and falls through to the
 * environment, so `--storage-state "$MAYBE_UNSET"` in a script does not
 * silently disable an env-configured session.
 */
export function storageStatePath(explicit?: string): string | undefined {
  for (const candidate of [explicit, process.env[STORAGE_STATE_ENV]]) {
    if (candidate && candidate.trim() !== "") return candidate;
  }
  return undefined;
}

/**
 * Validate eagerly and loudly. A silently ignored auth file would send the
 * caller straight back to the failure this feature exists to fix — an
 * unauthenticated measurement that looks like a real result.
 */
export function readStorageState(path: string): { cookies: unknown[]; origins: unknown[] } {
  const abs = resolve(path);
  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch {
    throw new Error(
      `storage state file not found: ${abs}\n` +
        `Create one with: npx playwright codegen --save-storage=auth.json <your-login-url>`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`storage state file is not valid JSON: ${abs}`);
  }
  const obj = parsed as { cookies?: unknown; origins?: unknown };
  if (!obj || typeof obj !== "object" || (!Array.isArray(obj.cookies) && !Array.isArray(obj.origins))) {
    throw new Error(
      `storage state file has no "cookies" or "origins" array: ${abs}\n` +
        `Expected a Playwright storage-state file (context.storageState() output).`,
    );
  }
  const cookies = Array.isArray(obj.cookies) ? obj.cookies : [];
  const origins = Array.isArray(obj.origins) ? obj.origins : [];
  if (cookies.length === 0 && origins.length === 0) {
    throw new Error(
      `storage state file carries no cookies and no origins: ${abs}\n` +
        `It would authenticate nothing — re-capture it after logging in.`,
    );
  }
  return { cookies, origins };
}

/**
 * Merge `storageState` into Playwright page options when configured.
 * `browser.newPage(options)` forwards context options, so every gate can
 * adopt this by wrapping its existing options object.
 */
export function withAuthState<T extends object>(base: T, explicit?: string): T & { storageState?: string } {
  const path = storageStatePath(explicit);
  if (!path) return base;
  readStorageState(path); // throw before we navigate, not after
  return { ...base, storageState: resolve(path) };
}

/** One-line notice so a run that used auth says so in its output. */
export function authStateNotice(explicit?: string): string | null {
  const path = storageStatePath(explicit);
  return path ? `auth: storage state from ${resolve(path)}` : null;
}
