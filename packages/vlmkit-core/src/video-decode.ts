/**
 * Decode a recording into a `vlmkit-frames/1` sequence with the user's own ffmpeg and ffprobe.
 *
 * vlmkit ships, depends on and downloads no decoder: the ffmpeg builds on npm are GPL and pull an
 * 80 MB binary, and Playwright's private one decodes VP8 and MJPEG only. The binary is the user's
 * (`--ffmpeg`, `VLMKIT_FFMPEG`, else `ffmpeg` on PATH; ffprobe beside it), spawned as a separate
 * process with arguments, never a shell. Another decoder can write numbered PNGs and a timestamp
 * per line instead, which `importFrames` reads.
 *
 * What is measured rather than trusted (`video-frames.ts` holds the arithmetic):
 * - The frame table comes from ffprobe's decoded frames (`best_effort_timestamp`, which ffmpeg
 *   itself gives a decoded frame as its pts), and every frame ffmpeg writes is checked against it
 *   through `showinfo`: same count, same timestamp. Frames are chosen by their index in that
 *   table (`select`), never by `-ss`, which takes the frame after a time where a player shows the
 *   one before it.
 * - Colour goes through a conversion the stream states, or BT.601 limited when it states none
 *   (said so in the manifest), never the decoder's default.
 * - Every frame is the same size, or the recording is refused.
 */
import { spawn } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  openSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import { hostname } from "node:os";
import { copyFile, mkdir, mkdtemp, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, posix, resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import { WINDOW_MS } from "@mizchi/vlmkit-judge/flash.ts";
import {
  FRAMES_FORMAT,
  frameFileName,
  type FrameEntry,
  type FramesManifest,
  type FramesVideo,
  type VideoSelection,
} from "@mizchi/vlmkit-judge/frames.ts";
import { browserDelayMs, gifCompositingProblem, imageTiming } from "./image-timing.ts";
import {
  chooseFrames,
  colorPlan,
  displayGeometry,
  filterChain,
  imageTimeline,
  LOSSLESS_CODECS,
  parseFrameTable,
  parseShowinfoLine,
  pickVideoStream,
  recordingEndMs,
  rotationFilters,
  videoTimeline,
  type ProbedFrame,
  type SelectionRequest,
  type ShowinfoFrame,
  type VideoStream,
} from "./video-frames.ts";

/** Frame files are named `NNNN-…`: past 9999 a glob no longer sorts them in order. */
export const MAX_SCAN_FRAMES = 9999;
/** Refused above this unless asked for: a minute at 60fps, already gigabytes of PNG at 1080p. */
export const DEFAULT_MAX_FRAMES = 3600;

/** File extensions `check flash` reads as a recording rather than a page. */
export const VIDEO_EXTENSIONS: ReadonlySet<string> = new Set([
  ".mp4",
  ".m4v",
  ".mov",
  ".qt",
  ".webm",
  ".mkv",
  ".avi",
  ".ogv",
  ".ts",
  ".mts",
  ".m2ts",
  ".mpg",
  ".mpeg",
  ".flv",
  ".wmv",
  ".3gp",
  ".y4m",
  ".gif",
  ".apng",
]);

/** The path without a page's query or hash, when the path as written is not a file. */
const fileOf = (path: string): string => (existsSync(path) ? path : path.replace(/[?#].*$/, ""));

/**
 * Whether `check flash` reads a source as a recording: a local file with a video extension (a
 * page's query or hash is not its extension: `player.html?clip=a.gif` is a page), or a `.png`
 * that is an animated PNG — the APNG spec's own extension, which a page sweep would only report
 * as an unmeasured animated image.
 */
export function isVideoFile(path: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return false;
  const file = fileOf(path);
  const ext = extname(file).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return true;
  if (ext !== ".png" || !existsSync(file)) return false;
  try {
    return (apngDeclaredFrames(file) ?? 0) > 1;
  } catch {
    return false;
  }
}

/**
 * An APNG's `acTL` num_frames, read by walking chunk headers (each body seeked over, not read):
 * the spec puts `acTL` before the first `IDAT`, so a frame of any size before the second `fcTL`
 * does not hide it. Null for a still PNG or anything that is not a PNG.
 */
const apngDeclaredFramesSafe = (file: string): number | null => {
  try {
    return apngDeclaredFrames(file);
  } catch {
    return null;
  }
};

export function apngDeclaredFrames(file: string): number | null {
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(8);
    const read = (at: number, length: number) => readSync(fd, head, 0, length, at) === length;
    if (!read(0, 8) || head.readUInt32BE(0) !== 0x89504e47 || head.readUInt32BE(4) !== 0x0d0a1a0a) return null;
    let at = 8;
    for (let chunks = 0; chunks < 100_000 && read(at, 8); chunks++) {
      const length = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      if (type === "acTL") return length >= 8 && read(at + 8, 4) ? head.readUInt32BE(0) : null;
      if (type === "IDAT" || type === "IEND") return null;
      at += 12 + length;
    }
    return null;
  } finally {
    closeSync(fd);
  }
}

export interface DecoderPaths {
  /** The user's ffmpeg; default `VLMKIT_FFMPEG`, else `ffmpeg` on PATH. */
  ffmpeg?: string;
  /** Default `VLMKIT_FFPROBE`, else the ffprobe beside `ffmpeg` when that is a path, else `ffprobe` on PATH. */
  ffprobe?: string;
  env?: Record<string, string | undefined>;
}

export interface Decoder {
  ffmpeg: string;
  ffprobe: string;
  /** `ffmpeg 6.1.1-3ubuntu5`: what the frames say decoded them. */
  name: string;
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string[];
}

/** ffmpeg colours its log when told to (`AV_LOG_FORCE_COLOR`); the escapes split a showinfo line. */
const ANSI = /\x1b\[[0-9;]*m/g;

/**
 * The decoders still running, killed if vlmkit is: an orphaned ffmpeg kept writing gigabytes. The
 * listeners are there only while one runs: a listener takes away a signal's default action, and a
 * judge that holds the event loop for a minute then ignored Ctrl-C for that minute (measured).
 */
const children = new Set<ReturnType<typeof spawn>>();
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
const onSignal = (signal: NodeJS.Signals) => {
  for (const child of children) child.kill("SIGKILL");
  children.clear();
  for (const s of SIGNALS) process.removeListener(s, onSignal);
  process.kill(process.pid, signal);
};
function track(child: ReturnType<typeof spawn>): void {
  if (children.size === 0) for (const s of SIGNALS) process.on(s, onSignal);
  children.add(child);
}
function untrack(child: ReturnType<typeof spawn>): void {
  if (!children.delete(child)) return;
  if (children.size === 0) for (const s of SIGNALS) process.removeListener(s, onSignal);
}

/** Run a binary with arguments (no shell); stderr is handed over line by line as it comes. */
function run(bin: string, args: readonly string[], onLine?: (line: string) => void): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AV_LOG_FORCE_NOCOLOR: "1" },
    });
    track(child);
    const out: Buffer[] = [];
    const tail: string[] = [];
    let partial = "";
    const line = (raw: string) => {
      const text = raw.replace(ANSI, "");
      onLine?.(text);
      tail.push(text);
      if (tail.length > 40) tail.shift();
    };
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      const lines = (partial + chunk).split(/\r?\n/);
      partial = lines.pop() ?? "";
      for (const l of lines) line(l);
    });
    child.on("error", (error) => {
      untrack(child);
      reject(error);
    });
    child.on("close", (code) => {
      untrack(child);
      if (partial) line(partial);
      resolvePromise({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: tail });
    });
  });
}

const NO_DECODER =
  "vlmkit ships no video decoder: scan video and check flash on a recording run your own ffmpeg and ffprobe, 5.1 or later. " +
  "Install them (apt install ffmpeg, brew install ffmpeg, https://ffmpeg.org/download.html) or point at them " +
  "with --ffmpeg /path/to/ffmpeg (ffprobe is looked for beside it) or VLMKIT_FFMPEG / VLMKIT_FFPROBE. " +
  "Any other decoder works too: write the frames as numbered PNGs and one timestamp per line, then " +
  "vlmkit scan video <dir> --pts <file>";

function spawnFailure(error: unknown, bin: string, role: string): never {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") throw new UsageError(`${role} not found ("${bin}"). ${NO_DECODER}`);
  if (code === "EACCES") throw new UsageError(`${role} "${bin}" is not executable. ${NO_DECODER}`);
  // Node refuses to spawn a .bat / .cmd without a shell, and this never uses one.
  if (code === "EINVAL")
    throw new UsageError(
      `${role} "${bin}" cannot be run without a shell (a .bat or .cmd shim?): point at the .exe. ${NO_DECODER}`,
    );
  throw error;
}

const isPath = (bin: string) => bin.includes("/") || bin.includes("\\");

/**
 * A bare name resolved on PATH, never in the working directory: Windows' own search tries the
 * current directory first, so an `ffmpeg.exe` dropped beside a folder of recordings would run. Only
 * absolute entries are searched (`.`, `./`, `bin` are the working directory), and only what a spawn
 * without a shell can run: on POSIX an executable file (a non-executable one is skipped, as execvp
 * skips it), on Windows the `.com` / `.exe` libuv runs (not an extensionless npm shim, not a
 * `.bat`), with a quoted entry unquoted. The path returned is absolute, so nothing searches again.
 */
export function onPath(
  name: string,
  env: Record<string, string | undefined>,
  platform = process.platform,
): string | null {
  const win = platform === "win32";
  const sep = win ? ";" : ":";
  const exts = win ? (/\.[^.\\/]+$/.test(name) ? [""] : [".com", ".exe"]) : [""];
  const absolute = win ? win32.isAbsolute : posix.isAbsolute;
  for (const raw of (env.PATH ?? env.Path ?? "").split(sep)) {
    const dir = win ? raw.replace(/^"(.*)"$/, "$1") : raw;
    if (!dir || !absolute(dir)) continue;
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      try {
        if (!statSync(candidate).isFile()) continue;
        if (!win) accessSync(candidate, fsConstants.X_OK);
        return candidate;
      } catch {
        // not here, or not runnable
      }
    }
  }
  return null;
}

/** The ffprobe that goes with an ffmpeg given as a path: beside it as given, then beside what a symlink points to. */
function siblingProbe(ffmpeg: string): string | null {
  if (!isPath(ffmpeg)) return null;
  const candidates = [ffmpeg];
  try {
    candidates.push(realpathSync(ffmpeg));
  } catch {
    // a path that does not exist yet fails at spawn, with the remedy
  }
  for (const bin of candidates) {
    const name = basename(bin);
    if (!/ffmpeg/i.test(name)) continue;
    const probe = join(
      dirname(bin),
      name.replace(/ffmpeg/i, (m) => (m === "FFMPEG" ? "FFPROBE" : "ffprobe")),
    );
    for (const p of [probe, `${probe}.exe`]) if (existsSync(p)) return p;
  }
  return null;
}

/** The oldest ffmpeg whose options this uses (`-fps_mode` is 5.1's). */
const MIN_VERSION = [5, 1] as const;

/** Find the user's ffmpeg and ffprobe and ask ffmpeg its version. Throws a UsageError naming the remedy. */
export async function findDecoder(paths: DecoderPaths = {}): Promise<Decoder> {
  const env = paths.env ?? process.env;
  // An empty variable is unset (`VLMKIT_FFMPEG= vlmkit …`), not a binary named "".
  const given = (v: string | undefined) => (v === undefined || v === "" ? undefined : v);
  const resolveBin = (bin: string, role: string) => {
    if (isPath(bin)) return bin;
    const found = onPath(bin, env);
    if (!found) throw new UsageError(`${role} not found on PATH ("${bin}"). ${NO_DECODER}`);
    return found;
  };
  const ffmpeg = resolveBin(given(paths.ffmpeg) ?? given(env.VLMKIT_FFMPEG) ?? "ffmpeg", "ffmpeg");
  const version = await run(ffmpeg, ["-hide_banner", "-version"]).catch((e) => spawnFailure(e, ffmpeg, "ffmpeg"));
  const named = version.stdout.match(/^ffmpeg version (\S+)/m);
  if (version.code !== 0 || !named) {
    throw new UsageError(`"${ffmpeg}" did not answer -version as ffmpeg does. ${NO_DECODER}`);
  }
  // `6.1.1-3ubuntu5`, `n6.1`, `5.1.4`; a git build (`N-112345-g…`) has no number and is taken as new.
  const numeric = named[1]!.match(/^n?(\d+)\.(\d+)/);
  if (numeric) {
    const [major, minor] = [Number(numeric[1]), Number(numeric[2])];
    if (major < MIN_VERSION[0] || (major === MIN_VERSION[0] && minor < MIN_VERSION[1])) {
      throw new UsageError(
        `ffmpeg ${named[1]} is too old: scan video needs ${MIN_VERSION.join(".")} or later (-fps_mode passthrough, which keeps every frame, is 5.1's). ${NO_DECODER}`,
      );
    }
  }
  // Looked for once ffmpeg has answered, so a missing ffmpeg is named as ffmpeg.
  const ffprobe = resolveBin(
    given(paths.ffprobe) ?? given(env.VLMKIT_FFPROBE) ?? siblingProbe(ffmpeg) ?? "ffprobe",
    "ffprobe",
  );
  const probe = await run(ffprobe, ["-hide_banner", "-version"]).catch((e) => spawnFailure(e, ffprobe, "ffprobe"));
  if (probe.code !== 0 || !/^ffprobe version /m.test(probe.stdout)) {
    throw new UsageError(`"${ffprobe}" did not answer -version as ffprobe does. ${NO_DECODER}`);
  }
  return { ffmpeg, ffprobe, name: `ffmpeg ${named[1]}` };
}

/** The decoder's own words for why it failed: its last lines that are not progress noise. */
const reason = (stderr: readonly string[]): string =>
  stderr
    .map((l) => l.replace(/^(\[[^\]]* @ [^\]]*\] )?\[(info|warning|error|fatal|panic|verbose)\] /, "$1"))
    .filter((l) => l.trim() && !/showinfo|^\s*(frame=|Stream mapping|Press \[q\])/.test(l))
    .slice(-4)
    .join(" | ")
    .trim() || "no message";

/** `file:` keeps a path with a colon (`a:b.mp4`) or a leading `-` from being read as a protocol or an option. */
const asInput = (absolute: string) => `file:${absolute}`;

export interface ScanVideoOptions extends DecoderPaths {
  /** The recording. */
  file: string;
  /** Where frames and `frames.json` go; default `<recording>.frames/` beside it (`rec.mp4.frames/`). */
  out?: string;
  selection?: SelectionRequest;
  /** The width the video plays at, in CSS px; default its own width (one frame pixel per CSS px). */
  displayWidth?: number;
  maxFrames?: number;
  /** A video stream's index in the file; default the one marked default, else the largest, never cover art. */
  stream?: number;
  /** The YUV matrix to convert with, over the stream's tag or the BT.601 default (`COLOR_MATRICES`). */
  colorMatrix?: string;
  /** The range to convert with, over the stream's tag or the limited default. */
  colorRange?: "tv" | "pc";
  /** What transparent pixels are composited over (default white, a browser's default page). */
  background?: "white" | "black";
}

export interface ScanVideoResult {
  manifestPath: string;
  manifest: FramesManifest;
  stream: VideoStream;
  /** Frames the recording decodes to. */
  streamFrames: number;
  timingMs: { probe: number; decode: number };
}

/** `rec.mp4.frames/` beside the recording: the extension stays, so `clip.mp4` and `clip.webm` do not share one. */
export const defaultFramesDir = (file: string): string => `${resolve(file)}.frames`;

/** What a previous scan wrote, so a re-run replaces it and leaves anything else in the directory. */
const OWN_FRAME = /^\d{4,}-t\d+\.png$/;
const WORK_DIR = /^\.scan-video-/;

/**
 * Before writing into `dir`: refuse a directory that holds another tool's sequence (its
 * `frames.json` and frames would be replaced), and remove the work directories an interrupted
 * run left behind.
 */
async function prepareOut(dir: string): Promise<void> {
  const manifest = join(dir, "frames.json");
  if (existsSync(manifest)) {
    let tool: unknown;
    try {
      tool = (JSON.parse(readFileSync(manifest, "utf8")) as { source?: { tool?: unknown } }).source?.tool;
    } catch {
      tool = undefined;
    }
    if (tool !== "scan video") {
      throw new UsageError(
        `${dir} holds another sequence (${typeof tool === "string" ? tool : "a frames.json scan video did not write"}): give scan video a directory of its own with --out`,
      );
    }
  }
  for (const name of await readdir(dir)) {
    if (WORK_DIR.test(name)) await rm(join(dir, name), { recursive: true, force: true });
  }
}

/** Once the new frames are decoded and checked: the previous scan's frames and manifest, never the recording. */
async function clearPrevious(dir: string, keep: string): Promise<void> {
  const kept = realpathSync(keep);
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    if (!(OWN_FRAME.test(name) || name === "frames.json")) continue;
    if (realpathSync(path) !== kept) await unlink(path);
  }
}

const LOCK = ".scan-video.lock";
/** A lock or temporary directory whose owner cannot be seen is taken as abandoned only this old. */
export const STALE_UNKNOWN_MS = 24 * 3600 * 1000;

/** Whether pid is a process this one can see. */
export const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * Which pids `alive` can judge: this host and PID namespace. A pid from a container sharing the
 * directory, or from `unshare`, reads as dead here (measured: a sandboxed run removed a live
 * one's frames), so an owner of another identity is never taken as gone by its pid.
 */
export function processIdentity(): string {
  let ns = "";
  try {
    ns = readlinkSync("/proc/self/ns/pid");
  } catch {
    // not Linux
  }
  let h = 0x811c9dc5;
  for (const c of `${hostname()}|${ns}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** The output directories this process is scanning into now: a second scan here is refused, not let in. */
const heldLocks = new Set<string>();

/**
 * Make `outDir` this scan's: a directory (refused when the path is a file), not another tool's
 * sequence, not the place a frame's name would land on the recording itself (renamed over it,
 * measured: an APNG named `0000-t000000.png` scanned into its own directory became frame 0), and
 * not another live scan's — a lock file names the scan writing there, and one whose process is
 * gone is taken over, with the work directories it left.
 */
async function claimOut(outDir: string, file: string, shown: string): Promise<{ release(): Promise<void> }> {
  try {
    if (existsSync(outDir) && !statSync(outDir).isDirectory())
      throw new UsageError(`--out ${outDir} is a file, not a directory`);
    await mkdir(outDir, { recursive: true });
  } catch (error) {
    if (error instanceof UsageError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOTDIR" || code === "EACCES") {
      throw new UsageError(`cannot make the frames directory ${outDir} (${code}): give --out a directory`);
    }
    throw error;
  }
  // The recording as given and as it resolves (a symlink elsewhere to a frame-named file in outDir).
  const out = realpathSync(outDir);
  for (const path of [file, realpathSync(file)]) {
    const name = basename(path);
    if (
      realpathSync(dirname(path)) === out &&
      (OWN_FRAME.test(name) || name === "frames.json" || name === LOCK || WORK_DIR.test(name))
    ) {
      throw new UsageError(
        `${shown} is ${path === file ? "" : `a link to ${path}, `}named like a file scan video writes or clears in ${outDir} (${name}): it would be replaced. Rename it, or give --out another directory`,
      );
    }
  }
  const lockPath = join(out, LOCK);
  if (heldLocks.has(lockPath)) {
    throw new UsageError(
      `another scan in this process is writing into ${outDir}: wait for it, or give --out another directory`,
    );
  }
  const id = processIdentity();
  for (let attempt = 0; ; attempt++) {
    try {
      await writeFile(lockPath, `${JSON.stringify({ pid: process.pid, id })}\n`, { flag: "wx" });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt > 0) throw error;
      let owner: { pid?: unknown; id?: unknown } = {};
      try {
        owner = JSON.parse(readFileSync(lockPath, "utf8")) as typeof owner;
      } catch {
        // unreadable: judged by its age below
      }
      const pid = typeof owner.pid === "number" ? owner.pid : Number.NaN;
      const ours = owner.id === id;
      const old = Date.now() - statSync(lockPath).mtimeMs > STALE_UNKNOWN_MS;
      if (ours ? pid !== process.pid && alive(pid) : !old) {
        throw new UsageError(
          ours
            ? `another scan (pid ${pid}) is writing into ${outDir}: wait for it, or give --out another directory`
            : `a scan from another host or container may be writing into ${outDir} (${lockPath}): wait for it, or remove that file if none runs`,
        );
      }
      await rm(lockPath, { force: true });
    }
  }
  heldLocks.add(lockPath);
  const release = async () => {
    heldLocks.delete(lockPath);
    await rm(lockPath, { force: true });
  };
  try {
    await prepareOut(outDir);
  } catch (error) {
    await release();
    throw error;
  }
  return { release };
}

/** The `select` expression for the decoded frames kept (sorted): runs of consecutive indices become `between`. */
function selectExpression(decoded: readonly number[], total: number): string | null {
  if (decoded.length === total) return null;
  const runs: [number, number][] = [];
  for (const d of decoded) {
    const last = runs[runs.length - 1];
    if (last && d === last[1] + 1) last[1] = d;
    else runs.push([d, d]);
  }
  const terms = runs.map(([a, b]) => (a === b ? `eq(n,${a})` : `between(n,${a},${b})`));
  return `select='${terms.join("+")}'`;
}

const label = (instants: readonly number[] | undefined, atMs: number): string | undefined => {
  if (!instants) return undefined;
  const fmt = (t: number) => `${Number(t.toFixed(3))}ms`;
  return instants.length === 1 && Math.abs(instants[0]! - atMs) < 1e-6
    ? undefined
    : `at ${instants.map(fmt).join(", ")}`;
};

/**
 * The lines ffmpeg logged at error level or worse (`-loglevel level+info` tags each line), from the
 * input's side — the demuxer and the decoder — not the PNG writer's: it exits 0 on a truncated
 * file. By level, not by wording: Matroska says `File ended prematurely` and HEVC `The cu_qp_delta
 * 80 is outside the valid range`, which no keyword list held, and a title with "corrupt" in it is
 * metadata at info level.
 */
export function decodeErrors(lines: readonly string[]): string[] {
  const out = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^(?:\[([^\]]*?) @ (?:0x)?[0-9a-fA-F]+\] )?\[(warning|error|fatal|panic)\] (.*)$/);
    if (!m) continue;
    const context = m[1] ?? "";
    if (/^(png|image2|out#|Parsed_|auto_scale|swscaler|graph )/.test(context) || /showinfo/.test(context)) continue;
    // A demuxer that drops a whole packet says so only as a warning (`Packet corrupt`, `corrupt
    // input packet`): the frame is gone and nothing at error level says it.
    if (m[2] === "warning" && !CORRUPT_PACKET.test(m[3]!)) continue;
    out.add(`${context ? `${context}: ` : ""}${m[3]!.trim()}`);
  }
  return [...out];
}

/** A lost or damaged packet: frames may be missing between the ones decoded. */
export const CORRUPT_PACKET = /packet corrupt|corrupt (input )?packet|corrupt decoded frame/i;

/**
 * Decode `file` with the user's ffmpeg into `out` (`NNNN-t<ms>.png` + `frames.json`). Refuses
 * (UsageError) a file with no video stream, an HDR one, one that decodes to frames of more than one
 * size, more frames than `maxFrames`, and anything the decoder itself cannot read — never a
 * sequence of black frames standing for a picture that was not decoded.
 */
export async function scanVideo(options: ScanVideoOptions): Promise<ScanVideoResult> {
  const file = resolve(options.file);
  const shown = options.file;
  if (!existsSync(file)) throw new UsageError(`no such recording: ${shown}`);
  if ((await stat(file)).isDirectory()) {
    throw new UsageError(`${shown} is a directory: to read frames another decoder wrote, give --pts or --fps`);
  }
  // Where the frames go is checked before anything is decoded: a file there is a typo, not a decode.
  const outDir = resolve(options.out ?? defaultFramesDir(file));
  for (let dir = outDir; ; dir = dirname(dir)) {
    if (existsSync(dir)) {
      if (!statSync(dir).isDirectory()) {
        throw new UsageError(`the frames directory ${outDir} cannot be made: ${dir} is a file. Give --out a directory`);
      }
      break;
    }
    if (dirname(dir) === dir) break;
  }
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
  if (!(Number.isSafeInteger(maxFrames) && maxFrames >= 1 && maxFrames <= MAX_SCAN_FRAMES)) {
    throw new UsageError(`--max-frames is 1 to ${MAX_SCAN_FRAMES} (frame files are numbered in four digits)`);
  }
  const decoder = await findDecoder(options);
  const t0 = performance.now();
  // An APNG is read as one: ffmpeg's probe gives up on it once ~2 KB of metadata comes before the
  // first frame, and its PNG reader decodes one still (measured: a 3 KB XMP chunk made a 5 Hz
  // strobe a single frame that passed).
  const demuxer = (apngDeclaredFramesSafe(file) ?? 0) > 1 ? ["-f", "apng"] : [];
  const probed = await run(decoder.ffprobe, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    ...demuxer,
    asInput(file),
  ]).catch((e) => spawnFailure(e, decoder.ffprobe, "ffprobe"));
  if (probed.code !== 0) {
    throw new UsageError(`${decoder.ffprobe} cannot read ${shown} as a video container: ${reason(probed.stderr)}`);
  }
  const stream = pickVideoStream(probed.stdout, shown, options.stream);
  const plan = colorPlan(stream, shown, {
    ...(options.colorMatrix !== undefined ? { matrix: options.colorMatrix } : {}),
    ...(options.colorRange !== undefined ? { range: options.colorRange } : {}),
  });
  const table = await run(decoder.ffprobe, [
    "-v",
    "error",
    "-select_streams",
    String(stream.index),
    "-show_entries",
    "frame=best_effort_timestamp,pts,duration,key_frame,interlaced_frame,top_field_first,width,height",
    "-of",
    "json",
    ...demuxer,
    asInput(file),
  ]).catch((e) => spawnFailure(e, decoder.ffprobe, "ffprobe"));
  if (table.code !== 0) {
    throw new UsageError(
      `${decoder.ffprobe} cannot decode ${shown} (${stream.codec}): ${reason(table.stderr)}. ` +
        `Decode it with a build that can, or convert it first: ffmpeg -i ${shown} -c:v ffv1 lossless.mkv`,
    );
  }
  const probedFrames = parseFrameTable(table.stdout, shown);
  // Refused before decoding, from the table: the decode runs one filter graph (`-reinit_filter 0`,
  // so `select` counts decoded frames through a change), and that graph scales a larger frame to the
  // first one's size without a word (measured: 96x64 frames came out 64x48).
  const sized = probedFrames.find((f) => f.width !== undefined);
  const resized =
    sized && probedFrames.find((f) => f.width !== undefined && (f.width !== sized.width || f.height !== sized.height));
  if (sized && resized) {
    throw new UsageError(
      `${shown} changes size mid-stream (${sized.width}x${sized.height}, then ${resized.width}x${resized.height} at decoded frame ${resized.index}): ` +
        "a frame sequence has one size. Scale it to one first: ffmpeg -i in -vf scale=W:H out.mkv",
    );
  }
  const notes = [...plan.notes];
  // A GIF's aspect byte and a PNG's pHYs reach ffprobe as a sample aspect ratio, which no browser
  // applies: an image is laid out at its pixel size (measured: naturalWidth unchanged).
  const sampleAspect = stream.codec === "gif" || stream.codec === "apng" ? undefined : stream.sampleAspect;
  // A GIF / APNG plays as a browser plays it (its own delays, clamped, looped); a video as stamped.
  const image = stream.codec === "gif" || stream.codec === "apng" ? imageTiming(readFileSync(file)) : null;
  const asked: SelectionRequest = options.selection ?? { kind: "all" };
  // A looping image is unrolled as far as the selection reaches, so an instant past one pass is
  // the frame the loop is on then; a span with no end, a pass and a second past its start.
  const passMs = image ? image.storedMs.map(browserDelayMs).reduce((a, b) => a + b, 0) : 0;
  const until =
    asked.kind === "span"
      ? (asked.toMs ?? asked.fromMs + passMs + WINDOW_MS)
      : asked.kind === "at"
        ? Math.max(...asked.atMs)
        : undefined;
  // Composited as a browser composites it, or another decoder writes the frames: ImageMagick's
  // coalesce clears a disposed frame to transparent, as a browser does, and flattens it on the page.
  // The timestamps are each frame's start with the browser's clamp, then the pass's end, so the
  // import repeats the loop as a browser does (`--loop`).
  const importRecipe = image
    ? `Write every image composited as a browser shows it and import them: magick ${shown} -coalesce -background white -alpha remove frames/%06d.png; ` +
      `magick identify -format "%T\\n" ${shown} | awk '{printf "%.3f\\n", t/1000; d=$1*10; t+=(d<=10?100:d)} END {printf "%.3f\\n", t/1000}' > frames/pts.txt; ` +
      `vlmkit scan video frames --pts frames/pts.txt --lossless --every-frame --loop ${image.plays === null ? "forever" : image.plays}`
    : "";
  const compositing = image ? gifCompositingProblem(image) : null;
  if (compositing) throw new UsageError(`${shown}: ${compositing}. ${importRecipe}`);
  const imageLine = image ? imageTimeline(probedFrames, image, until) : null;
  if (image && !imageLine) {
    // ffmpeg's GIF demuxer folds an image with no graphic control extension into the one before,
    // and decodes only the first: a browser shows every one of them (measured: a two-image GIF
    // with no GCE strobes at 5 Hz in Chromium and decoded to one frame). Fewer frames than the
    // browser shows can only miss a flash, so there is nothing sound to judge.
    throw new UsageError(
      image.format === "apng"
        ? `${shown}: its acTL declares ${image.declaredFrames} frame(s), it holds ${image.storedMs.length} fcTL and ffmpeg decoded ${probedFrames.length}: which a browser plays is not known. Re-save it with one tool (e.g. apngasm) and scan that`
        : `${shown}: ffmpeg decoded ${probedFrames.length} of the ${image.storedMs.length} images a browser shows (a GIF image with no graphic control extension is merged into the one before). ${importRecipe}`,
    );
  }
  if (image?.declaredFrames !== undefined && image.declaredFrames < probedFrames.length) {
    notes.push(
      `its acTL declares ${image.declaredFrames} of the ${probedFrames.length} frames it holds: a browser plays the ${image.declaredFrames} declared, and so does this`,
    );
  }
  const fieldPlan = image ? null : fieldSplit(probedFrames, stream);
  if (fieldPlan?.note) notes.push(fieldPlan.note);
  const split = fieldPlan?.split;
  const timeline = imageLine ?? videoTimeline(probedFrames, stream.timeBase, shown, split ? { split } : {});
  // An interlaced frame is split before it is turned, so the chain turns it, not ffmpeg's autorotate.
  const rotate = timeline.fields ? rotationFilters(stream) : [];
  if (rotate === null) {
    throw new UsageError(
      `${shown} is interlaced and turned by ${stream.rotation}°, not a quarter turn: its fields cannot be split before it is turned. ` +
        `Scan it unturned (ffmpeg -display_rotation 0 -i ${shown} -c copy unturned.mkv) or deinterlace it first`,
    );
  }
  if (stream.rotation !== undefined && stream.rotation % 90 !== 0) {
    notes.push(`rotated by ${stream.rotation}°, not a quarter turn: ffmpeg turns it with black corners`);
  }
  if (probedFrames.length === 1 && !image) {
    notes.push(`stream #${stream.index} decodes to one frame: a still or a cover track (--stream picks another)`);
  }
  const background = options.background ?? "white";
  if (stream.alpha) {
    notes.push(
      `transparent pixels composited over ${background} (--background): the page behind them is not known, and dropping alpha shows whatever colour sits under them`,
    );
  }
  const rows = timeline.rows;
  // A span with no end, or one past the end, is recorded as far as the recording goes.
  // Where the stream says it ends: a last frame held to then is on screen until then (an MP4 with
  // B-frames gives the hold to a frame in decode order, so the frames alone end early) — when the
  // file decoded cleanly. A file cut short keeps its header's duration and says so as an error
  // (`File ended prematurely`): its lost part is not a held frame, and judged as one it passed.
  const statedEnd =
    !image && stream.durationMs !== undefined && (stream.startMs ?? 0) >= 0
      ? (stream.startMs ?? 0) + stream.durationMs
      : undefined;
  const framesEnd = recordingEndMs(rows, timeline.endMs);
  const tableErrors = table.stderr.some((l) => l.trim() !== "");
  const gapBefore = rows.length > 1 ? rows[rows.length - 1]!.atMs - rows[rows.length - 2]!.atMs : 0;
  const endsShort = statedEnd !== undefined && framesEnd < statedEnd - Math.max(500, 2 * gapBefore);
  const endMs = image ? until! : tableErrors ? framesEnd : Math.max(framesEnd, statedEnd ?? 0);
  const spanEnd = (toMs: number | undefined, fromMs: number) =>
    Math.max(fromMs, Math.min(toMs ?? Number.POSITIVE_INFINITY, endMs));
  const request: SelectionRequest =
    asked.kind === "span" && image && asked.toMs === undefined ? { ...asked, toMs: until! } : asked;
  const chosen = chooseFrames(rows, request, image ? timeline.endMs : endMs);
  const selection: VideoSelection =
    asked.kind === "span"
      ? {
          kind: "span",
          fromMs: asked.fromMs,
          toMs: spanEnd(asked.toMs, asked.fromMs),
          ...(asked.leadInMs !== undefined ? { leadInMs: asked.leadInMs } : {}),
        }
      : asked;
  if (chosen.length > maxFrames) {
    throw new UsageError(
      `${shown}: ${chosen.length} frames to write, over --max-frames ${maxFrames}. ` +
        "Choose a span (--from / --to), instants (--at), or raise --max-frames (up to 9999).",
    );
  }
  // The decoded frames the chosen ones are: each decoded once, however many times it is shown.
  const decodedOf = (f: { decoded?: number; index: number }) => f.decoded ?? f.index;
  const needed = [...new Set(chosen.map(decodedOf))].sort((a, b) => a - b);
  const isSplit = (d: number) => timeline.fields === true && split?.(probedFrames[d]!) === true;
  // One graph per kind of frame, in one decode: interlaced frames split into fields, the rest whole.
  const graphs = [
    { name: "fields", split: true, decoded: needed.filter(isSplit) },
    { name: "frames", split: false, decoded: needed.filter((d) => !isSplit(d)) },
  ].filter((g) => g.decoded.length > 0);
  const probeMs = performance.now() - t0;

  const lock = await claimOut(outDir, file, shown);
  let work = "";
  const t1 = performance.now();
  try {
    work = await mkdtemp(join(outDir, ".scan-video-"));
    const outputs: string[] = [];
    for (const g of graphs) {
      await mkdir(join(work, g.name));
      outputs.push(
        "-map",
        `0:${stream.index}`,
        "-an",
        "-sn",
        "-dn",
        "-fps_mode",
        "passthrough",
        "-vf",
        filterChain({
          select: selectExpression(g.decoded, probedFrames.length),
          fields: g.split,
          ...(g.split && fieldPlan?.order ? { fieldOrder: fieldPlan.order } : {}),
          ...(!g.split && fieldPlan?.lineDouble ? { lineDouble: true } : {}),
          ...(rotate.length > 0 ? { rotate } : {}),
          color: plan,
          ...(stream.alpha ? { alpha: { background } } : {}),
          sampleAspect: sampleAspect !== undefined,
          name: g.name,
        }),
        "-c:v",
        "png",
        // Unfiltered rows read 3-7x faster than sub/up/paeth; level 1 writes twice as fast as 6.
        "-pred",
        "none",
        "-compression_level",
        "1",
        "-start_number",
        "0",
        "-f",
        "image2",
        join(work, g.name, "%06d.png").replace(/%(?!06d\.png$)/g, "%%"),
      );
    }
    const written = new Map<string, ShowinfoFrame[]>(graphs.map((g) => [g.name, []]));
    const showTimeBase = new Map<string, { num: number; den: number }>();
    const stderrAll: string[] = [];
    const decoded = await run(
      decoder.ffmpeg,
      [
        "-hide_banner",
        "-nostdin",
        "-nostats",
        // Each line carries its level, so the decoder's errors are told from its metadata.
        "-loglevel",
        "level+info",
        // For every scaler ffmpeg inserts itself (an RGB source's conversion), the same rounding.
        "-sws_flags",
        "accurate_rnd+full_chroma_int",
        "-copyts",
        // libvpx decodes a WebM's alpha; ffmpeg's own VP8/VP9 decoders drop it.
        ...(stream.alpha === "libvpx" || stream.alpha === "libvpx-vp9" ? ["-c:v", stream.alpha] : []),
        // One filter graph for the whole stream: rebuilt on a size or format change, `select`'s n
        // restarted at 0 and picked other frames (measured).
        "-reinit_filter",
        "0",
        ...(rotate.length > 0 ? ["-autorotate", "0"] : []),
        ...demuxer,
        "-i",
        asInput(file),
        ...outputs,
      ],
      (line) => {
        stderrAll.push(line);
        const parsed = parseShowinfoLine(line);
        if (!parsed) return;
        const name = ("timeBase" in parsed ? parsed.instance : parsed.frame.instance) ?? graphs[0]!.name;
        if ("timeBase" in parsed) {
          if (!showTimeBase.has(name)) showTimeBase.set(name, parsed.timeBase);
        } else written.get(name)?.push(parsed.frame);
      },
    ).catch((e) => spawnFailure(e, decoder.ffmpeg, "ffmpeg"));
    if (decoded.code !== 0) {
      const why = reason(decoded.stderr);
      throw new UsageError(
        /Unknown decoder|Decoder .* not found/i.test(why) && stream.alpha?.startsWith("libvpx")
          ? `${shown}: its alpha decodes only with libvpx, which this ffmpeg lacks (${why}); use an ffmpeg built with libvpx`
          : `${decoder.ffmpeg} cannot decode ${shown} (${stream.codec}): ${why}`,
      );
    }
    for (const g of graphs) {
      checkWritten(
        written.get(g.name)!,
        showTimeBase.get(g.name) ?? null,
        g.decoded.map((d) => probedFrames[d]!),
        g.split ? 2 : 1,
        stream,
        shown,
      );
    }
    const all = graphs.flatMap((g) => written.get(g.name)!);
    const size = { width: all[0]!.width, height: all[0]!.height };
    const odd = all.find((f) => f.width !== size.width || f.height !== size.height);
    if (odd) {
      throw new UsageError(
        `${shown} changes size mid-stream (${size.width}x${size.height}, then ${odd.width}x${odd.height}): ` +
          "a frame sequence has one size. Scale it to one first: ffmpeg -i in -vf scale=W:H out.mkv",
      );
    }
    const geometry = displayGeometry(size, options.displayWidth);
    await clearPrevious(outDir, file);
    // Each decoded file (a frame, or one of its fields) moves to its last use and is copied before.
    const position = new Map(graphs.flatMap((g) => g.decoded.map((d, k) => [d, k] as const)));
    const workFile = (f: { decoded?: number; index: number; field?: 0 | 1 }) => {
      const d = decodedOf(f);
      const fields = isSplit(d);
      const at = position.get(d)! * (fields ? 2 : 1) + (f.field ?? 0);
      return join(work, fields ? "fields" : "frames", `${String(at).padStart(6, "0")}.png`);
    };
    const lastUse = new Map<string, number>();
    chosen.forEach((f, n) => lastUse.set(workFile(f), n));
    // A field picture's parity: the first field's parity is field 0, as a split frame's first field is.
    const firstParity = probedFrames[0]!.topFieldFirst === true;
    const fieldOfPicture = (f: { decoded?: number; index: number }): 0 | 1 | undefined =>
      fieldPlan?.lineDouble
        ? (probedFrames[decodedOf(f)]!.topFieldFirst === true) === firstParity
          ? 0
          : 1
        : undefined;
    const frames: FrameEntry[] = [];
    for (const [n, f] of chosen.entries()) {
      const name = frameFileName(n, f.atMs);
      const from = workFile(f);
      if (lastUse.get(from) === n) await rename(from, join(outDir, name));
      else await copyFile(from, join(outDir, name));
      const l = label(f.instants, f.atMs);
      frames.push({
        n,
        file: name,
        atMs: f.atMs,
        stable: true,
        index: f.index,
        key: f.key,
        ...(f.field !== undefined
          ? { field: f.field }
          : fieldOfPicture(f) !== undefined
            ? { field: fieldOfPicture(f)! }
            : {}),
        ...(l ? { label: l } : {}),
      });
    }
    const errors = [...new Set([...table.stderr.map((l) => l.trim()).filter(Boolean), ...decodeErrors(stderrAll)])];
    // Frames that end well before the stream's stated end, with the decoder reporting errors: cut
    // short, so what is missing is not judged (decoded cleanly, the last frame is held to the end).
    const cutShort = endsShort && errors.length > 0;
    const damaged = cutShort || errors.some((l) => CORRUPT_PACKET.test(l));
    if (cutShort) {
      notes.push(
        `the stream says it runs to ${Number((statedEnd! / 1000).toFixed(3))}s, its frames end at ${Number((framesEnd / 1000).toFixed(3))}s and the decoder reported errors: the file is cut short`,
      );
    } else if (endsShort && !image) {
      notes.push(
        `its last frame is held to the stream's stated end, ${Number((statedEnd! / 1000).toFixed(3))}s (the frames alone end at ${Number((framesEnd / 1000).toFixed(3))}s)`,
      );
    }
    const video: FramesVideo = {
      file: shown,
      decoder: decoder.name,
      codec: stream.codec,
      lossless: LOSSLESS_CODECS.has(stream.codec),
      streamFrames: rows.length,
      selection,
      color: plan.color,
      pixelFormat: stream.pixelFormat,
      ...(timeline.hidden ? { hidden: timeline.hidden } : {}),
      ...(timeline.timing ? { timing: timeline.timing } : {}),
      ...(timeline.loop ? { loop: timeline.loop } : {}),
      ...(timeline.fields || fieldPlan?.lineDouble ? { fields: true } : {}),
      ...(stream.alpha ? { background } : {}),
      ...(stream.rotation ? { rotation: stream.rotation } : {}),
      ...(sampleAspect ? { sampleAspect } : {}),
      ...(stream.fieldOrder ? { fieldOrder: stream.fieldOrder } : {}),
      ...(notes.length ? { notes } : {}),
      ...(errors.length ? { decodeErrors: errors.slice(0, 20) } : {}),
      ...(damaged ? { damaged: true } : {}),
      stream: stream.index,
    };
    const manifest: FramesManifest = {
      format: FRAMES_FORMAT,
      source: {
        tool: "scan video",
        url: pathToFileURL(file).href,
        ...geometry,
        browser: decoder.name,
        clock: "stream",
        video,
      },
      frames,
    };
    const manifestPath = join(outDir, "frames.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return {
      manifestPath,
      manifest,
      stream,
      streamFrames: rows.length,
      timingMs: { probe: Math.round(probeMs), decode: Math.round(performance.now() - t1) },
    };
  } finally {
    if (work) await rm(work, { recursive: true, force: true });
    await lock.release();
  }
}

/** Codecs whose decoder flags each frame interlaced or progressive (0 is said, not left unsaid). */
const FRAME_FLAGGED_CODECS = new Set([
  "h264",
  "hevc",
  "mpeg2video",
  "mpeg1video",
  "mpeg4",
  "vc1",
  "wmv3",
  "dvvideo",
  "prores",
  "dnxhd",
  // FFV1 v3 codes each frame's structure (ps): frames read progressive under a tt tag are said
  // progressive. v1 frames follow the container, so they read flagged and are split frame by frame.
  "ffv1",
]);

/**
 * Which decoded frames are two fields. The frames' own flag decides, per frame: a stream can start
 * progressive and turn interlaced (a broadcast capture: 50 woven frames read as one still comb),
 * and a container's field-order tag can sit over frames coded progressive (split, every 1px row
 * of detail strobed at field rate). Only a codec whose frames carry no flag at all is split by the
 * stream's tag.
 */
function fieldSplit(
  frames: readonly ProbedFrame[],
  stream: VideoStream,
): { split?: (f: ProbedFrame) => boolean; order?: "tff" | "bff"; lineDouble?: boolean; note?: string } {
  const flagged = frames.filter((f) => f.interlaced).length;
  // HEVC field pictures: ffmpeg's decoder hands each field over as its own half-height frame and
  // flags only those interlaced (a frame's pic_struct is not flagged). Split, each one instant
  // became two pseudo-fields and every area was halved (a 30,000 px² box passed at 15,200); each is
  // line-doubled instead — per frame, so a splice where two top fields meet changes nothing.
  if (stream.codec === "hevc" && flagged === frames.length) {
    return {
      lineDouble: true,
      note: "HEVC field pictures: each decoded frame is one field, line-doubled to the picture's height, at the field rate",
    };
  }
  const order = stream.fieldOrder ? ` (${stream.fieldOrder})` : "";
  const how =
    "split into its two fields, line-doubled, at twice the frame rate (woven, a field-rate flicker is a still comb)";
  if (flagged === frames.length) return { split: () => true, note: `interlaced${order}: each frame ${how}` };
  if (flagged > 0) {
    return {
      split: (f) => f.interlaced === true,
      note: `${flagged} of ${frames.length} frames flagged interlaced: each ${how}; the progressive ones are one frame each`,
    };
  }
  if (!stream.fieldOrder) return {};
  if (FRAME_FLAGGED_CODECS.has(stream.codec)) {
    return {
      note: `the stream is tagged ${stream.fieldOrder}, but ${stream.codec} decodes every frame as progressive: not split`,
    };
  }
  // Read as ffmpeg's raw decoder reads the tag: tt and tb top field first, bb and bt bottom.
  return {
    split: () => true,
    order: stream.fieldOrder === "bb" || stream.fieldOrder === "bt" ? "bff" : "tff",
    note: `interlaced${order} by the stream's tag (${stream.codec} frames carry no flag of their own): each frame ${how}, ${stream.fieldOrder === "bb" || stream.fieldOrder === "bt" ? "bottom" : "top"} field first as tagged`,
  };
}

/**
 * The frames ffmpeg wrote are the ones the table chose: as many, and each at its timestamp. With
 * `-copyts` showinfo's pts is the decoder's own `best_effort_timestamp`, so a selection one frame
 * off is caught even on a constant rate, where the spacing alone would agree. An interlaced frame
 * is written as its two fields: the first at the frame's time, the second after it.
 */
function checkWritten(
  written: readonly ShowinfoFrame[],
  timeBase: { num: number; den: number } | null,
  expected: readonly ProbedFrame[],
  perFrame: number,
  stream: VideoStream,
  shown: string,
): void {
  if (written.length !== expected.length * perFrame) {
    throw new Error(
      `${shown}: ffmpeg wrote ${written.length} ${perFrame === 2 ? "fields" : "frames"} where ffprobe's table chose ${expected.length * perFrame}; the two decoders disagree about the stream`,
    );
  }
  if (!timeBase) throw new Error(`${shown}: ffmpeg's showinfo printed no time base, so its frames cannot be checked`);
  const tb = stream.timeBase;
  // Half the coarser tick: the two sides may count in different time bases.
  const tolerance = Math.max(tb.num / tb.den, timeBase.num / timeBase.den) / 2 + 1e-9;
  for (const [k, want] of expected.entries()) {
    const f = written[k * perFrame]!;
    const got = (f.pts * timeBase.num) / timeBase.den;
    const at = (want.ticks * tb.num) / tb.den;
    if (Math.abs(got - at) > tolerance) {
      throw new Error(
        `${shown}: frame ${k} ffmpeg wrote is at ${got.toFixed(6)}s where ffprobe's table has decoded frame ${want.index} at ${at.toFixed(6)}s; the two decoders disagree`,
      );
    }
  }
}

export interface ImportFramesOptions {
  /** A directory of PNGs another decoder wrote, one per frame, named so they sort in order. */
  dir: string;
  /** One timestamp in seconds per line, in the frames' order (ffprobe's `best_effort_timestamp_time`). */
  pts?: string;
  /** A constant rate instead of a timestamp file. */
  fps?: number;
  displayWidth?: number;
  /** The frames are what was recorded, exactly (a lossless codec, or a renderer's own output). */
  lossless?: boolean;
  /**
   * The directory holds every frame the recording shows (the recipe's `-fps_mode passthrough`
   * writes them all). Without it nothing says another tool did not thin them (`-vf fps=5`), so the
   * sequence is not claimed complete and a pass on it is not backed.
   */
  everyFrame?: boolean;
  /**
   * The frames are one pass of an animation that loops (a GIF / APNG another tool composited):
   * how many times it plays, `null` forever. The timestamp file then ends with one more line, the
   * pass's end, and the pass is repeated as a browser repeats it — to one pass and a second more
   * for a loop that never ends. One pass alone holds none of the windows across the seam.
   */
  loop?: number | null;
}

/** A PNG's size from its IHDR, without decoding it. */
function pngSize(path: string): { width: number; height: number } {
  const head = readFileSync(path).subarray(0, 24);
  if (head.length < 24 || head.toString("latin1", 1, 4) !== "PNG" || head.toString("latin1", 12, 16) !== "IHDR") {
    throw new UsageError(`${path} is not a PNG`);
  }
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

/** Timestamps from a sidecar: one number of seconds per line; ffprobe's csv may end each with a comma. */
export function parsePtsFile(text: string, file: string): number[] {
  const out: number[] = [];
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim().replace(/,+$/, "").trim();
    if (!line) continue;
    if (!/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(line) || !Number.isFinite(Number(line))) {
      throw new UsageError(
        `${file}:${i + 1}: "${raw.trim()}" is not a timestamp in seconds` +
          (/N\/A/i.test(line)
            ? " (ffprobe prints N/A for pts_time on some streams; ask for best_effort_timestamp_time)"
            : ""),
      );
    }
    out.push(Number(line));
  }
  return out;
}

/** Turn a directory of decoded frames plus their timestamps into a `vlmkit-frames/1` sequence (`frames.json` in that directory). */
export async function importFrames(
  options: ImportFramesOptions,
): Promise<{ manifestPath: string; manifest: FramesManifest }> {
  const dir = resolve(options.dir);
  if ((options.pts === undefined) === (options.fps === undefined)) {
    throw new UsageError(
      "frames another decoder wrote need their times: give --pts <file> or --fps <rate>, one of them",
    );
  }
  // An import writes frames.json beside the frames: never over a sequence it did not write, which
  // a later decode into the directory would then take for its own and clear.
  const existing = join(dir, "frames.json");
  if (existsSync(existing)) {
    let source: { tool?: unknown; video?: { decoder?: unknown } } | undefined;
    try {
      source = (JSON.parse(readFileSync(existing, "utf8")) as { source?: typeof source }).source;
    } catch {
      source = undefined;
    }
    if (source?.tool !== "scan video" || source.video?.decoder !== "import") {
      const what =
        typeof source?.tool !== "string"
          ? "a frames.json scan video did not write"
          : source.tool === "scan video"
            ? "a recording scan video decoded"
            : source.tool;
      throw new UsageError(
        `${options.dir} already holds a sequence (${what}); importing would replace its frames.json. Import a directory of the decoder's own frames`,
      );
    }
  }
  const names = (await readdir(dir))
    .filter((n) => /\.png$/i.test(n))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (names.length === 0) throw new UsageError(`${options.dir} holds no PNG frames`);
  if (names.length > MAX_SCAN_FRAMES) {
    throw new UsageError(`${options.dir}: ${names.length} frames, over ${MAX_SCAN_FRAMES}; import a shorter span`);
  }
  let seconds: number[];
  if (options.pts !== undefined) {
    const ptsPath = isAbsolute(options.pts) ? options.pts : resolve(options.pts);
    if (!existsSync(ptsPath)) throw new UsageError(`no such timestamp file: ${options.pts}`);
    seconds = parsePtsFile(readFileSync(ptsPath, "utf8"), options.pts);
    const want = names.length + (options.loop !== undefined ? 1 : 0);
    if (seconds.length !== want) {
      throw new UsageError(
        `${options.pts} holds ${seconds.length} timestamps for ${names.length} PNGs in ${options.dir}: one per frame, in order` +
          (options.loop !== undefined ? ", then the end of the pass (--loop)" : ""),
      );
    }
  } else {
    const fps = options.fps!;
    if (!(Number.isFinite(fps) && fps > 0)) throw new UsageError(`--fps is frames a second, above 0 (got ${fps})`);
    seconds = names.map((_, i) => i / fps);
    if (options.loop !== undefined) seconds.push(names.length / fps);
  }
  // A loop's pass ends at its last line; the frames are the lines before it.
  const passEnd = options.loop !== undefined ? seconds.pop()! : undefined;
  if (passEnd !== undefined && !(passEnd > seconds[seconds.length - 1]!)) {
    throw new UsageError(`the pass's end (${passEnd}s, the timestamp file's last line) must come after its last frame`);
  }
  // The rule scanVideo keeps: a frame whose time the next one shares is never on screen (only the
  // later is); a time that goes back is refused. The recipe's passthrough writes such frames too.
  const shown: number[] = [];
  let hidden = 0;
  for (let i = 0; i < seconds.length; i++) {
    const next = seconds[i + 1];
    if (next !== undefined && next < seconds[i]!) {
      throw new UsageError(
        `frame ${i + 1} (${names[i + 1]}) is shown before frame ${i}: timestamps ${seconds[i]}, ${next}`,
      );
    }
    if (next !== undefined && next === seconds[i]) hidden++;
    else shown.push(i);
  }
  const size = pngSize(join(dir, names[0]!));
  for (const name of names) {
    const s = pngSize(join(dir, name));
    if (s.width !== size.width || s.height !== size.height) {
      throw new UsageError(
        `${name} is ${s.width}x${s.height}, ${names[0]} is ${size.width}x${size.height}: a frame sequence has one size`,
      );
    }
  }
  // The stream's own timeline, as scanVideo keeps it (moved to 0 only when it would start before).
  const origin = Math.min(0, seconds[shown[0]!]! * 1000);
  const once = shown.map((i) => {
    const atMs = seconds[i]! * 1000 - origin;
    if (!Number.isFinite(atMs)) throw new UsageError(`${names[i]}'s timestamp ${seconds[i]}s is out of range`);
    return { file: names[i]!, atMs };
  });
  // A loop repeated as imageTimeline repeats a GIF: its plays, or one pass and a second more.
  let loop: FramesVideo["loop"] | undefined;
  let played = once;
  if (passEnd !== undefined) {
    const passMs = passEnd * 1000 - origin - once[0]!.atMs;
    const plays = options.loop ?? null;
    if (plays !== null && !(Number.isSafeInteger(plays) && plays >= 1)) {
      throw new UsageError(`--loop is how many times the animation plays, 1 or more, or forever (got ${plays})`);
    }
    const passes = plays ?? Math.ceil((passMs + WINDOW_MS) / passMs) + 1;
    if (passes * once.length > MAX_SCAN_FRAMES) {
      throw new UsageError(
        `${options.dir}: ${passes} passes of ${once.length} frames is over ${MAX_SCAN_FRAMES} frames`,
      );
    }
    played = [];
    for (let p = 0; p < passes; p++) {
      for (const f of once) played.push({ file: f.file, atMs: f.atMs + p * passMs });
    }
    loop = { plays, passFrames: once.length, passMs, passes };
  }
  const frames: FrameEntry[] = played.map((f, n) => ({ n, file: f.file, atMs: f.atMs, stable: true, index: n }));
  const manifest: FramesManifest = {
    format: FRAMES_FORMAT,
    source: {
      tool: "scan video",
      url: pathToFileURL(dir).href,
      ...displayGeometry(size, options.displayWidth),
      clock: "stream",
      video: {
        file: options.dir,
        decoder: "import",
        codec: "unknown",
        lossless: options.lossless ?? false,
        ...(options.everyFrame ? { streamFrames: frames.length } : {}),
        selection: { kind: "all" },
        ...(hidden ? { hidden } : {}),
        ...(loop ? { loop } : {}),
      },
    },
    frames,
  };
  const manifestPath = join(dir, "frames.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, manifest };
}
