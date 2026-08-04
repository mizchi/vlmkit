import { resolve } from "node:path";

export const STATE_DIR = ".vlmkit";
export const CONFIG_FILE = "vlmkit.config.json";
export const CONFIG_CANDIDATES = [CONFIG_FILE, "vlmkit.config.toml"] as const;

/** Resolve a project-owned state entry below the canonical state directory. */
export function resolveStatePath(cwd: string, entry: string): string {
  return resolve(cwd, STATE_DIR, entry);
}

/** Read a canonical VLMKIT_* environment variable. */
export function readEnv(suffix: string): string | undefined {
  return process.env[`VLMKIT_${suffix}`] || undefined;
}

export function debugEnabled(): boolean {
  return Boolean(process.env.DEBUG_VLMKIT);
}

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
