import { dirname, join } from "node:path";
import { mkdirSync, appendFileSync } from "node:fs";
import { homedir, platform } from "node:os";

/**
 * Print a deprecation warning to stderr and append an entry to a local
 * log file. The log path is consulted before removing shims at 1.0.0.
 *
 * Log path:
 *   Linux/macOS: ${XDG_STATE_HOME ?? ~/.local/state}/vrt/deprecated.log
 *   Windows:     ${LOCALAPPDATA}\vrt\deprecated.log
 *
 * Failure modes (read-only FS, missing env vars, EACCES) fall through
 * to stderr-only — never crash the CLI.
 */
export function reportDeprecation(oldName: string, newName: string): void {
  // Respect NO_COLOR (https://no-color.org/) — useful for CI grep + tests.
  const useColor = !process.env.NO_COLOR && process.stderr.isTTY;
  const tag = useColor ? "\x1b[33m[vlmkit deprecated]\x1b[0m" : "[vlmkit deprecated]";
  process.stderr.write(`${tag} '${oldName}' → '${newName}' — old name removed in 1.0.0\n`);
  try {
    const logPath = resolveLogPath();
    if (!logPath) return;
    mkdirSync(dirname(logPath), { recursive: true });
    const line = `${new Date().toISOString()}\t${oldName}\t${newName}\t${process.cwd()}\n`;
    appendFileSync(logPath, line, { encoding: "utf-8" });
  } catch {
    // Swallow — log is best-effort.
  }
}

/**
 * Where the deprecation log file lives. Exported for tooling and tests.
 */
export function getDeprecationLogPath(): string | null {
  return resolveLogPath();
}

function resolveLogPath(): string | null {
  if (platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return null;
    return join(localAppData, "vrt", "deprecated.log");
  }
  const base = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  return join(base, "vrt", "deprecated.log");
}
