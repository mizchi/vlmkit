/**
 * Backward compatibility for the `vrt` → `vlmkit` rename of things that are not
 * text: the state directory, the config filename, and the environment
 * variables.
 *
 * The command-name rename was pure text — nothing on disk moved. These three
 * are different: rename them without a fallback and every existing project
 * silently loses its approved baselines, stops finding its config, and drops
 * whatever its CI exports. So each new name is preferred, each old name still
 * works, and using an old one prints one line saying so.
 *
 * ## Why per-subpath and not per-directory
 *
 * `.vlmkit/` already exists in any project that has run a gate — the run
 * ledger, `gates`, `markup-loop` and `copy-review` all live there, while
 * `baselines`, `runs` and `last-diff-for-agent.json` were still under `.vrt/`.
 * So "if `.vlmkit/` is missing, use `.vrt/`" would resolve to the new directory
 * immediately and lose the baselines anyway. The check has to be on the
 * specific entry: `.vlmkit/baselines` vs `.vrt/baselines`.
 *
 * ## What is deliberately NOT here
 *
 * Values that leave this process or land in someone else's file — the
 * `X-Title` header sent to OpenRouter, the Playwright `projectName` that
 * appears inside snapshot paths, the plan schema's `vrt?:` field, the published
 * OpenAPI title. Those are wire and data formats, not local state, and moving
 * them is a separate decision.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const STATE_DIR = ".vlmkit";
export const LEGACY_STATE_DIR = ".vrt";
export const CONFIG_FILE = "vlmkit.config.json";
export const LEGACY_CONFIG_FILE = "vrt.config.json";

/** One notice per distinct old name per process — a loop must not spam. */
const announced = new Set<string>();

export function noteLegacyName(oldName: string, newName: string, detail = ""): void {
  if (announced.has(oldName)) return;
  announced.add(oldName);
  const color = !process.env.NO_COLOR && process.stderr.isTTY;
  const tag = color ? "\x1b[33m[vlmkit legacy]\x1b[0m" : "[vlmkit legacy]";
  process.stderr.write(`${tag} using ${oldName} — rename to ${newName}; support ends in 1.0.0${detail ? `. ${detail}` : ""}\n`);
}

/** Reset between tests. */
export function resetLegacyNotices(): void {
  announced.clear();
}

/**
 * Absolute path for a state entry, preferring `.vlmkit/<entry>` and falling back
 * to an existing `.vrt/<entry>`.
 *
 * Writers get the new path unless the old one is already populated, so a
 * project keeps appending where its history is instead of starting a second,
 * half-empty baseline set beside it.
 */
export function resolveStatePath(cwd: string, entry: string): string {
  const next = resolve(cwd, join(STATE_DIR, entry));
  if (existsSync(next)) return next;
  const legacy = resolve(cwd, join(LEGACY_STATE_DIR, entry));
  if (existsSync(legacy)) {
    noteLegacyName(`${LEGACY_STATE_DIR}/${entry}`, `${STATE_DIR}/${entry}`, "move it to keep using one location");
    return legacy;
  }
  return next;
}

/**
 * Config filenames in search order: new before old, JSON before TOML (JSON wins
 * when both exist, which was the pre-rename behaviour). `legacy: true` entries
 * are what `findConfigPath` reports a notice for.
 *
 * Exported as data rather than a resolver because the caller also has to name
 * every candidate in its "not found" error — listing only the new one would
 * tell a project with a working `vrt.config.json` that it has no config.
 */
export const CONFIG_CANDIDATES: readonly { name: string; legacy: boolean }[] = [
  { name: CONFIG_FILE, legacy: false },
  { name: "vlmkit.config.toml", legacy: false },
  { name: LEGACY_CONFIG_FILE, legacy: true },
  { name: "vrt.config.toml", legacy: true },
];

/**
 * `VLMKIT_FOO`, falling back to `VRT_FOO`.
 *
 * Pass the suffix, not the whole name, so a call site cannot mismatch the two
 * halves — `readEnv("LLM_MODEL")` reads `VLMKIT_LLM_MODEL` then `VRT_LLM_MODEL`.
 * An empty string counts as unset, matching how the previous `process.env.X ||`
 * reads behaved.
 */
export function readEnv(suffix: string): string | undefined {
  const next = process.env[`VLMKIT_${suffix}`];
  if (next) return next;
  const legacy = process.env[`VRT_${suffix}`];
  if (legacy) {
    noteLegacyName(`VRT_${suffix}`, `VLMKIT_${suffix}`);
    return legacy;
  }
  return undefined;
}

/**
 * `DEBUG_VLMKIT`, falling back to `DEBUG_VRT`. Separate from `readEnv` because
 * this one is a prefix, not a suffix — `DEBUG_VRT`, not `VRT_DEBUG`.
 */
export function debugEnabled(): boolean {
  if (process.env.DEBUG_VLMKIT) return true;
  if (process.env.DEBUG_VRT) {
    noteLegacyName("DEBUG_VRT", "DEBUG_VLMKIT");
    return true;
  }
  return false;
}

/** Every env suffix that has both spellings, so the docs and tests can enumerate. */
export const ENV_SUFFIXES = [
  "BASE_URL",
  "CAPTURE_BACKEND",
  "CONFIG_FILE",
  "CONFIG_PATH",
  "LLM_MODEL",
  "LLM_PROVIDER",
  "PROJECT_ROOT",
  "VLM_MODEL",
] as const;
