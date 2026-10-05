/**
 * The macOS half of `vlmkit scan a11y --app`: compile the AX collector (`macos-ax-dump.swift.ts`)
 * once, run it against a running app, and hand its dump to `macos-ax.ts`.
 *
 * Needs, on the Mac running vlmkit:
 * - the Xcode Command Line Tools (`xcode-select --install`), for `swiftc`;
 * - Accessibility permission for the terminal (System Settings → Privacy & Security →
 *   Accessibility) — without it every attribute read fails, so the collector refuses;
 * - Screen Recording permission for the frame. Without it a window capture holds the desktop,
 *   not the window, so the collector does not capture and the tree has no frame: contrast is
 *   not measured, every other rule still is.
 *
 * The binary is cached under `~/Library/Caches/vlmkit/` keyed by the source's hash, so an
 * upgrade that changes the collector recompiles it and nothing else does.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { AX_DUMP_SWIFT } from "./macos-ax-dump.swift.ts";
import type { AxDump } from "./macos-ax.ts";

const run = promisify(execFile);

export interface MacosAxOptions {
  /** App name, bundle id or pid. */
  app: string;
  /** Pick the window whose title contains this; default the focused window. */
  window?: string;
  /** Press these by exact title or description, in order, before reading the tree. */
  clicks?: string[];
  /** Where to write the window capture. */
  framePath?: string;
  maxNodes?: number;
  /** Seconds to wait for the app to publish a window. */
  waitSeconds?: number;
  /** Ask macOS to show the Accessibility permission request when it is missing. */
  prompt?: boolean;
}

/** The collector's arguments. Pure, so the CLI-to-Swift contract is tested off a Mac. */
export function axDumpArgs(options: MacosAxOptions): string[] {
  return [
    "--app",
    options.app,
    ...(options.window ? ["--window", options.window] : []),
    ...(options.clicks ?? []).flatMap((c) => ["--click", c]),
    ...(options.framePath ? ["--frame", options.framePath] : []),
    ...(options.maxNodes ? ["--max-nodes", String(options.maxNodes)] : []),
    ...(options.waitSeconds !== undefined ? ["--wait", String(options.waitSeconds)] : []),
    ...(options.prompt ? ["--prompt"] : []),
  ];
}

const cacheDir = () => process.env.VLMKIT_CACHE_DIR ?? join(homedir(), "Library", "Caches", "vlmkit");

/** Compile the collector if this version of it is not cached yet. Returns the binary's path. */
export async function ensureAxDumpBinary(): Promise<string> {
  const hash = createHash("sha256").update(AX_DUMP_SWIFT).digest("hex").slice(0, 12);
  const dir = cacheDir();
  const bin = join(dir, `ax-dump-${hash}`);
  if (
    await stat(bin).then(
      (s) => s.isFile(),
      () => false,
    )
  )
    return bin;
  await mkdir(dir, { recursive: true });
  // A single file named main.swift is compiled as the program's entry, top-level code and all.
  const srcDir = join(dir, `ax-dump-${hash}-src`);
  await mkdir(srcDir, { recursive: true });
  const src = join(srcDir, "main.swift");
  await writeFile(src, AX_DUMP_SWIFT);
  try {
    await run("xcrun", ["swiftc", "-O", src, "-o", `${bin}.tmp`], { maxBuffer: 16 << 20 });
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT" || /xcrun: error|invalid active developer path/.test(e.stderr ?? "")) {
      throw new UsageError(
        "scan a11y --app compiles a small Swift collector and needs the Xcode Command Line Tools: xcode-select --install",
      );
    }
    throw new Error(`compiling the AX collector failed (${src}):\n${e.stderr ?? e.message}`);
  }
  await rename(`${bin}.tmp`, bin);
  return bin;
}

/** Run the collector on this Mac. Throws a UsageError naming the missing permission or app. */
export async function collectMacosAx(options: MacosAxOptions): Promise<AxDump> {
  if (process.platform !== "darwin") {
    throw new UsageError(
      "scan a11y --app reads macOS Accessibility and runs only on a Mac. Collect there and import the" +
        " dump anywhere: vlmkit scan a11y window.ax.json --frame window.png",
    );
  }
  const bin = await ensureAxDumpBinary();
  try {
    const { stdout } = await run(bin, axDumpArgs(options), { maxBuffer: 256 << 20 });
    return JSON.parse(stdout) as AxDump;
  } catch (error) {
    // execFile puts a non-zero exit status in `code` (a number), and a spawn error's name there.
    const e = error as { stderr?: string; code?: number | string; message: string };
    const message = (e.stderr ?? "").trim();
    if (e.code === 2 || e.code === 3) throw new UsageError(message || `the AX collector exited with ${e.code}`);
    throw new Error(`the AX collector failed: ${message || e.message}`);
  }
}
