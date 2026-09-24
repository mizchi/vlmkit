/**
 * A bad flag or missing argument — the caller's typo, not a defect. Thrown by
 * `arg-reader` and by the `--allow` parsers, and printed as one line, because a
 * stack trace for `--concurrency abc` buries the one sentence that fixes it.
 *
 * It lives in the bottom layer rather than in `vlmkit-core/cli-error.ts` so a
 * pure judge can refuse a malformed exemption without importing `node:fs`.
 * `cli-error.ts` re-exports this very class, so `instanceof UsageError` is one
 * identity across every package.
 */
export class UsageError extends Error {
  override readonly name = "UsageError";
}
