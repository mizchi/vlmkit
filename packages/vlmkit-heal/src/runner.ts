import { exec } from "node:child_process";
import type { ErrorKind } from "./types.ts";

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Run a shell command; ok = exit code 0. Never rejects. */
export function runTest(command: string, cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    exec(command, { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: err == null, stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

// Order matters: more specific signatures first.
const RULES: Array<[RegExp, ErrorKind]> = [
  [/screenshot comparison failed|toHaveScreenshot|pixels? (differ|are different)/i, "vrt-diff"],
  [/timeout\s+\d+ms exceeded|timed out/i, "timeout"],
  [/locator|getby\w+|resolved to \d+ elements?|waiting for/i, "locator"],
];

export function classify(output: string): ErrorKind {
  for (const [re, kind] of RULES) {
    if (re.test(output)) return kind;
  }
  return "other";
}
