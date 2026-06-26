import { copyFileSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface PatchInput {
  file: string;
  content: string;
  /** Paths the loop is permitted to write (testFile + baseline files). */
  allow: string[];
}

/**
 * Back up the original, write new content, and return a rollback thunk.
 * Refuses any file not in `allow` so the loop can never touch app code.
 */
export function applyPatch(input: PatchInput): () => void {
  const target = resolve(input.file);
  const allowed = input.allow.map((p) => resolve(p));
  if (!allowed.includes(target)) {
    throw new Error(`patch target not allowed: ${input.file}`);
  }

  const backup = target + ".heal-bak";
  const existed = existsSync(target);
  if (existed) copyFileSync(target, backup);
  writeFileSync(target, input.content);

  return function rollback() {
    if (existed && existsSync(backup)) {
      const original = readFileSync(backup, "utf8");
      writeFileSync(target, original);
      rmSync(backup, { force: true });
    } else {
      rmSync(target, { force: true });
    }
  };
}

/** Drop the backup file, keeping the patched content (called on success). */
export function commitPatch(file: string): void {
  const backup = resolve(file) + ".heal-bak";
  rmSync(backup, { force: true });
}
