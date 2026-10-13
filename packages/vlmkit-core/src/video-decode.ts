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
 * - Colour goes through a conversion the stream states (or the convention its size implies, said
 *   so in the manifest), not the decoder's default.
 * - Every frame is the same size, or the recording is refused.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import {
  FRAMES_FORMAT,
  frameFileName,
  type FrameEntry,
  type FramesManifest,
  type FramesVideo,
  type VideoSelection,
} from "@mizchi/vlmkit-judge/frames.ts";
import { imageTiming } from "./image-timing.ts";
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
  videoTimeline,
  type ProbedFrame,
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

export const isVideoFile = (path: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:\/\//i.test(path) && VIDEO_EXTENSIONS.has(extname(path).toLowerCase());

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

/** Run a binary with arguments (no shell); stderr is handed over line by line as it comes. */
function run(bin: string, args: readonly string[], onLine?: (line: string) => void): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const tail: string[] = [];
    let partial = "";
    const line = (text: string) => {
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
    child.on("error", reject);
    child.on("close", (code) => {
      if (partial) line(partial);
      resolvePromise({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: tail });
    });
  });
}

const NO_DECODER =
  "vlmkit ships no video decoder: scan video and check flash on a recording run your own ffmpeg and ffprobe. " +
  "Install them (apt install ffmpeg, brew install ffmpeg, https://ffmpeg.org/download.html) or point at them " +
  "with --ffmpeg /path/to/ffmpeg (ffprobe is looked for beside it) or VLMKIT_FFMPEG / VLMKIT_FFPROBE. " +
  "Any other decoder works too: write the frames as numbered PNGs and one timestamp per line, then " +
  "vlmkit scan video <dir> --pts <file>";

function spawnFailure(error: unknown, bin: string, role: string): never {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") throw new UsageError(`${role} not found ("${bin}"). ${NO_DECODER}`);
  if (code === "EACCES") throw new UsageError(`${role} "${bin}" is not executable. ${NO_DECODER}`);
  throw error;
}

/** The ffprobe that goes with an ffmpeg given as a path: the same directory, the same suffix. */
function siblingProbe(ffmpeg: string): string | null {
  if (!ffmpeg.includes("/") && !ffmpeg.includes("\\")) return null;
  const name = basename(ffmpeg);
  if (!/ffmpeg/i.test(name)) return null;
  const probe = join(
    dirname(ffmpeg),
    name.replace(/ffmpeg/i, (m) => (m === "FFMPEG" ? "FFPROBE" : "ffprobe")),
  );
  return existsSync(probe) ? probe : null;
}

/** Find the user's ffmpeg and ffprobe and ask ffmpeg its version. Throws a UsageError naming the remedy. */
export async function findDecoder(paths: DecoderPaths = {}): Promise<Decoder> {
  const env = paths.env ?? process.env;
  const ffmpeg = paths.ffmpeg ?? env.VLMKIT_FFMPEG ?? "ffmpeg";
  const ffprobe = paths.ffprobe ?? env.VLMKIT_FFPROBE ?? siblingProbe(ffmpeg) ?? "ffprobe";
  const version = await run(ffmpeg, ["-hide_banner", "-version"]).catch((e) => spawnFailure(e, ffmpeg, "ffmpeg"));
  const named = version.stdout.match(/^ffmpeg version (\S+)/m);
  if (version.code !== 0 || !named) {
    throw new UsageError(`"${ffmpeg}" did not answer -version as ffmpeg does. ${NO_DECODER}`);
  }
  const probe = await run(ffprobe, ["-hide_banner", "-version"]).catch((e) => spawnFailure(e, ffprobe, "ffprobe"));
  if (probe.code !== 0 || !/^ffprobe version /m.test(probe.stdout)) {
    throw new UsageError(`"${ffprobe}" did not answer -version as ffprobe does. ${NO_DECODER}`);
  }
  return { ffmpeg, ffprobe, name: `ffmpeg ${named[1]}` };
}

/** The decoder's own words for why it failed: its last lines that are not progress noise. */
const reason = (stderr: readonly string[]): string =>
  stderr
    .filter((l) => l.trim() && !/showinfo|^\s*(frame=|Stream mapping|Press \[q\])/.test(l))
    .slice(-4)
    .join(" | ")
    .trim() || "no message";

/** `file:` keeps a path with a colon (`a:b.mp4`) or a leading `-` from being read as a protocol or an option. */
const asInput = (absolute: string) => `file:${absolute}`;

export interface ScanVideoOptions extends DecoderPaths {
  /** The recording. */
  file: string;
  /** Where frames and `frames.json` go; default `<name>.frames/` beside the recording. */
  out?: string;
  selection?: VideoSelection;
  /** The width the video plays at, in CSS px; default its own width (one frame pixel per CSS px). */
  displayWidth?: number;
  maxFrames?: number;
  /** A video stream's index in the file; default the first that is not cover art. */
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

export const defaultFramesDir = (file: string): string => {
  const abs = resolve(file);
  return join(dirname(abs), `${basename(abs, extname(abs))}.frames`);
};

/** What a previous scan wrote, so a re-run replaces it and leaves anything else in the directory. */
const OWN_FRAME = /^\d{4,}-t\d+\.png$/;

async function clearPrevious(dir: string): Promise<void> {
  for (const name of await readdir(dir)) {
    if (OWN_FRAME.test(name) || name === "frames.json") await unlink(join(dir, name));
  }
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

/** Lines of the decoder's stderr that say a frame was lost or damaged (it exits 0 on a truncated file). */
const DECODE_ERROR =
  /partial file|decoding error|error while decoding|invalid nal unit|corrupt|concealing|missing reference|invalid data found|truncat|end of file/i;

const decodeErrors = (lines: readonly string[]): string[] => [
  ...new Set(lines.filter((l) => DECODE_ERROR.test(l) && !l.includes("showinfo")).map((l) => l.trim())),
];

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
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
  if (!(Number.isSafeInteger(maxFrames) && maxFrames >= 1 && maxFrames <= MAX_SCAN_FRAMES)) {
    throw new UsageError(`--max-frames is 1 to ${MAX_SCAN_FRAMES} (frame files are numbered in four digits)`);
  }
  const decoder = await findDecoder(options);
  const t0 = performance.now();
  const probed = await run(decoder.ffprobe, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
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
    "frame=best_effort_timestamp,pts,key_frame,interlaced_frame",
    "-of",
    "json",
    asInput(file),
  ]).catch((e) => spawnFailure(e, decoder.ffprobe, "ffprobe"));
  if (table.code !== 0) {
    throw new UsageError(
      `${decoder.ffprobe} cannot decode ${shown} (${stream.codec}): ${reason(table.stderr)}. ` +
        `Decode it with a build that can, or convert it first: ffmpeg -i ${shown} -c:v ffv1 lossless.mkv`,
    );
  }
  const probedFrames = parseFrameTable(table.stdout, shown);
  const notes = [...plan.notes];
  // Interlaced by the stream's word or the frames' own (a stream can say "tb" over frames that are tff).
  const interlaced = stream.fieldOrder !== undefined || probedFrames.slice(0, 30).some((f) => f.interlaced);
  // A GIF / APNG plays as a browser plays it (its own delays, clamped, looped); a video as stamped.
  const image = stream.codec === "gif" || stream.codec === "apng" ? imageTiming(readFileSync(file)) : null;
  const imageLine = image ? imageTimeline(probedFrames, image) : null;
  if (image && !imageLine) {
    notes.push(
      `the file's own frame delays (${image.storedMs.length} frames) do not match the ${probedFrames.length} frames decoded: the decoder's timing is used, not the browser's, and the animation is not looped`,
    );
  }
  const timeline = imageLine ?? videoTimeline(probedFrames, stream.timeBase, shown, { fields: interlaced });
  if (timeline.fields) {
    notes.push(
      `interlaced${stream.fieldOrder ? ` (${stream.fieldOrder})` : ""}: each frame split into its two fields, line-doubled, at twice the frame rate (woven, a field-rate flicker is a still comb)`,
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
  const asked = options.selection ?? { kind: "all" };
  const chosen = chooseFrames(rows, asked);
  // An open-ended span is recorded as far as the recording goes.
  const selection: VideoSelection =
    asked.kind === "span" && asked.toMs > rows[rows.length - 1]!.atMs
      ? { ...asked, toMs: rows[rows.length - 1]!.atMs }
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
  const perFrame = timeline.fields ? 2 : 1;
  const probeMs = performance.now() - t0;

  const outDir = resolve(options.out ?? defaultFramesDir(file));
  await mkdir(outDir, { recursive: true });
  await clearPrevious(outDir);
  const work = await mkdtemp(join(outDir, ".scan-video-"));
  const t1 = performance.now();
  try {
    const chain = filterChain({
      select: selectExpression(needed, probedFrames.length),
      fields: timeline.fields === true,
      color: plan,
      ...(stream.alpha ? { alpha: { background } } : {}),
      sampleAspect: stream.sampleAspect !== undefined,
    });
    const written: ShowinfoFrame[] = [];
    let showTimeBase: { num: number; den: number } | null = null;
    const stderrAll: string[] = [];
    const decoded = await run(
      decoder.ffmpeg,
      [
        "-hide_banner",
        "-nostdin",
        "-nostats",
        "-loglevel",
        "info",
        // For every scaler ffmpeg inserts itself (an RGB source's conversion), the same rounding.
        "-sws_flags",
        "accurate_rnd+full_chroma_int",
        "-copyts",
        // libvpx decodes a WebM's alpha; ffmpeg's own VP8/VP9 decoders drop it.
        ...(stream.alpha === "libvpx" || stream.alpha === "libvpx-vp9" ? ["-c:v", stream.alpha] : []),
        "-i",
        asInput(file),
        "-map",
        `0:${stream.index}`,
        "-an",
        "-sn",
        "-dn",
        "-fps_mode",
        "passthrough",
        "-vf",
        chain,
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
        join(work, "%06d.png").replace(/%(?!06d\.png$)/g, "%%"),
      ],
      (line) => {
        stderrAll.push(line);
        const parsed = parseShowinfoLine(line);
        if (!parsed) return;
        if ("timeBase" in parsed) showTimeBase ??= parsed.timeBase;
        else written.push(parsed.frame);
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
    checkWritten(
      written,
      showTimeBase,
      needed.map((d) => probedFrames[d]!),
      perFrame,
      stream,
      shown,
    );
    const size = { width: written[0]!.width, height: written[0]!.height };
    const odd = written.find((f) => f.width !== size.width || f.height !== size.height);
    if (odd) {
      throw new UsageError(
        `${shown} changes size mid-stream (${size.width}x${size.height}, then ${odd.width}x${odd.height} at frame ${odd.n}): ` +
          "a frame sequence has one size. Scale it to one first: ffmpeg -i in -vf scale=W:H out.mkv",
      );
    }
    // Each decoded file (a frame, or one of its fields) moves to its last use and is copied before.
    const position = new Map(needed.map((d, k) => [d, k]));
    const workFile = (f: { decoded?: number; index: number; field?: 0 | 1 }) =>
      join(work, `${String(position.get(decodedOf(f))! * perFrame + (f.field ?? 0)).padStart(6, "0")}.png`);
    const lastUse = new Map<string, number>();
    chosen.forEach((f, n) => lastUse.set(workFile(f), n));
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
        ...(l ? { label: l } : {}),
      });
    }
    const errors = decodeErrors([...table.stderr, ...stderrAll]);
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
      ...(timeline.fields ? { fields: true } : {}),
      ...(stream.alpha ? { background } : {}),
      ...(stream.rotation ? { rotation: stream.rotation } : {}),
      ...(stream.sampleAspect ? { sampleAspect: stream.sampleAspect } : {}),
      ...(stream.fieldOrder ? { fieldOrder: stream.fieldOrder } : {}),
      ...(notes.length ? { notes } : {}),
      ...(errors.length ? { decodeErrors: errors.slice(0, 20) } : {}),
    };
    const manifest: FramesManifest = {
      format: FRAMES_FORMAT,
      source: {
        tool: "scan video",
        url: pathToFileURL(file).href,
        ...displayGeometry(size, options.displayWidth),
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
    await rm(work, { recursive: true, force: true });
  }
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
    if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(line)) {
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
    if (seconds.length !== names.length) {
      throw new UsageError(
        `${options.pts} holds ${seconds.length} timestamps for ${names.length} PNGs in ${options.dir}: one per frame, in order`,
      );
    }
  } else {
    const fps = options.fps!;
    if (!(Number.isFinite(fps) && fps > 0)) throw new UsageError(`--fps is frames a second, above 0 (got ${fps})`);
    seconds = names.map((_, i) => i / fps);
  }
  for (let i = 1; i < seconds.length; i++) {
    if (!(seconds[i]! > seconds[i - 1]!)) {
      throw new UsageError(
        `frame ${i} (${names[i]}) is not shown after frame ${i - 1}: timestamps ${seconds[i - 1]}, ${seconds[i]}`,
      );
    }
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
  const origin = Math.min(0, seconds[0]! * 1000);
  const frames: FrameEntry[] = names.map((file, n) => ({
    n,
    file,
    atMs: seconds[n]! * 1000 - origin,
    stable: true,
    index: n,
  }));
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
        streamFrames: names.length,
        selection: { kind: "all" },
      },
    },
    frames,
  };
  const manifestPath = join(dir, "frames.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, manifest };
}
