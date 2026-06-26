import { execFileSync } from "node:child_process";

/**
 * Optional intent signal for reviewVrtDiff: the last commit message plus a
 * truncated code diff. In CI pass `base` (e.g. "origin/main") to get the PR diff.
 * reviewVrtDiff itself only takes a string, so this stays decoupled — use it or
 * supply your own context.
 */
export function collectGitContext(cwd: string, opts?: { base?: string; maxChars?: number }): string {
  const max = opts?.maxChars ?? 4000;
  const git = (args: string[]): string => {
    try {
      return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    } catch {
      return "";
    }
  };
  const message = git(["log", "-1", "--format=%B"]).trim();
  const diff = opts?.base
    ? git(["diff", "--stat", `${opts.base}...HEAD`]) + "\n" + git(["diff", `${opts.base}...HEAD`])
    : git(["diff", "HEAD"]);
  const parts = [message && `Commit message:\n${message}`, diff.trim() && `Code diff:\n${diff.trim()}`].filter(Boolean);
  return parts.join("\n\n").slice(0, max);
}
