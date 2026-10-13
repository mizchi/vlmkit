#!/usr/bin/env node
/**
 * `vlmkit scan video <recording>` — decode a recording into a `vlmkit-frames/1` sequence with the
 * user's own ffmpeg and ffprobe: one PNG per decoded frame and a `frames.json` that gives each its
 * presentation time (the stream clock). `check flash`, `snapshot strip --manifest` and
 * `snapshot storyboard` read it like any other sequence.
 *
 * `vlmkit scan video <dir> --pts <file> | --fps <rate>` reads frames another decoder wrote instead.
 *
 * An artifact command, not a gate: it writes frames and passes no verdict. The decoding is
 * `@mizchi/vlmkit-core/video-decode.ts`.
 */
import { existsSync, statSync } from "node:fs";
import { relative } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  DEFAULT_MAX_FRAMES,
  importFrames,
  MAX_SCAN_FRAMES,
  scanVideo,
  type ScanVideoResult,
} from "@mizchi/vlmkit-core/video-decode.ts";
import { COLOR_MATRICES, type SelectionRequest } from "@mizchi/vlmkit-core/video-frames.ts";
import { formatInstant, parseInstants, type FramesManifest } from "@mizchi/vlmkit-judge/frames.ts";

function usage(): string {
  return [
    "Usage:",
    "  vlmkit scan video <recording> [--out dir] [--from t] [--to t] [--at list] [--display-width px]",
    "                    [--max-frames n] [--stream index] [--color-matrix m] [--color-range r] [--background c]",
    "                    [--ffmpeg path] [--ffprobe path] [--json]",
    "  vlmkit scan video <frames-dir> (--pts file | --fps rate) [--every-frame] [--lossless] [--loop plays|forever]",
    "                    [--display-width px] [--json]",
    "",
    "Decodes a recording (mp4, webm, mov, mkv, gif, …) into numbered PNGs and a frames.json",
    "(vlmkit-frames/1) giving each frame its presentation time, with YOUR ffmpeg and ffprobe:",
    "vlmkit ships no decoder. Then: vlmkit check flash <dir>/frames.json, snapshot strip --manifest,",
    "snapshot storyboard (lossless recordings, or --lossy).",
    "",
    "Options:",
    "  --out <dir>            Where to write (default: <recording>.frames/ beside it, e.g. rec.mp4.frames/)",
    "  --from <t>, --to <t>   Only the frames on screen during that span (1.5s, 1500, 00:01.500); no",
    "                         --to is to the end (a looping GIF / APNG: a pass and a second past --from)",
    "  --at <list>            Only the frame on screen at each instant (0,250,1s or 0..2s/100ms)",
    "  --display-width <px>   The width the video plays at, in CSS px: check flash measures its field",
    "                         and area limit in CSS px (default: one frame pixel per CSS px)",
    `  --max-frames <n>       Refuse more than n frames (default ${DEFAULT_MAX_FRAMES}, at most ${MAX_SCAN_FRAMES})`,
    "  --stream <index>       Which video stream, by its index in the file (default the one marked",
    "                         default, else the largest; never cover art)",
    "  --color-matrix <m>     The YUV matrix to convert with: bt601, bt709, bt2020, … (default the",
    "                         stream's tag, else bt601 — what ffmpeg, Chromium's VP9 and recorders assume)",
    "  --color-range <r>      tv (limited) or pc (full); default the stream's tag, else tv",
    "  --background <c>       white or black: what transparent pixels are composited over (default white)",
    "  --ffmpeg <path>        Your ffmpeg (default VLMKIT_FFMPEG, else ffmpeg on PATH)",
    "  --ffprobe <path>       Your ffprobe (default VLMKIT_FFPROBE, else beside --ffmpeg, else on PATH)",
    "  --pts <file>           With a directory: one timestamp in seconds per frame, in order",
    "  --fps <rate>           With a directory: a constant frame rate instead of --pts",
    "  --lossless             With a directory: the frames are exactly what was recorded",
    "  --every-frame          With a directory: it holds every frame the recording shows (the recipe's",
    "                         passthrough writes them all); without it a pass on them is not backed",
    "  --loop <n|forever>     With a directory: the frames are one pass of a looping GIF / APNG, played",
    "                         n times or forever; --pts then ends with one more line, the pass's end",
    "  --json                 Print frames.json to stdout",
    "",
    "Another decoder works too, for progressive video that does not loop — write every frame and its",
    "time, then import them. Both halves name one stream <i>, the one scan video judges (its index is",
    "source.video.stream: vlmkit scan video rec.mp4 --at 0 --json); v:0 can be a one-frame cover track:",
    "  ffmpeg -i rec.mp4 -map 0:<i> -fps_mode passthrough frames/%06d.png",
    "  ffprobe -v error -select_streams <i> -show_entries frame=best_effort_timestamp_time -of csv=p=0 rec.mp4 > frames/pts.txt",
    "  vlmkit scan video frames --pts frames/pts.txt --every-frame",
    "Plain ffmpeg writes interlaced frames woven and a GIF / APNG as one pass, and --every-frame would",
    "then vouch for frames that miss a field-rate or looped flash: scan those directly (an animation",
    "composited by another tool: --loop).",
    "",
    "Examples:",
    "  vlmkit scan video rec.mp4 && vlmkit check flash rec.mp4.frames/frames.json",
    "  vlmkit scan video rec.mp4 --from 10s --to 20s --display-width 1280",
    "  vlmkit scan video rec.webm --at 0..3s/250ms --out keyframes && vlmkit snapshot strip --manifest keyframes/frames.json",
  ].join("\n");
}

export interface ScanVideoArgs {
  source: string;
  colorMatrix?: string;
  colorRange?: "tv" | "pc";
  background?: "white" | "black";
  out?: string;
  selection: SelectionRequest;
  displayWidth?: number;
  maxFrames?: number;
  stream?: number;
  ffmpeg?: string;
  ffprobe?: string;
  pts?: string;
  fps?: number;
  lossless: boolean;
  everyFrame: boolean;
  /** Imported frames are one pass of a loop: plays, null forever. */
  loop?: number | null;
  json: boolean;
}

const whole = (raw: string | undefined, flag: string, min: number): number => {
  if (raw === undefined || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min) {
    throw new UsageError(`${flag} expects a whole number >= ${min}, got "${raw ?? ""}"`);
  }
  return Number(raw);
};

const value = (argv: string[], i: number, flag: string, what: string): string => {
  const raw = argv[i];
  if (raw === undefined || raw.startsWith("-")) throw new UsageError(`${flag} expects ${what}`);
  return raw;
};

/** One instant, in the frames' time grammar. */
function oneTime(raw: string, flag: string): number {
  const parsed = parseInstants(raw, flag);
  if (parsed.length !== 1) throw new UsageError(`${flag} takes one time, e.g. ${flag} 1.5s`);
  return parsed[0]!;
}

export function parseArgs(argv: string[]): ScanVideoArgs {
  let source: string | undefined;
  const out: Partial<ScanVideoArgs> = {};
  let from: number | undefined;
  let to: number | undefined;
  let at: number[] | undefined;
  let lossless = false;
  let everyFrame = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
      case "--output":
        out.out = value(argv, ++i, arg, "a directory");
        break;
      case "--from":
        from = oneTime(value(argv, ++i, arg, "a time"), arg);
        break;
      case "--to":
        to = oneTime(value(argv, ++i, arg, "a time"), arg);
        break;
      case "--at":
        at = parseInstants(value(argv, ++i, arg, "a list of instants"), arg, { max: MAX_SCAN_FRAMES });
        break;
      case "--display-width":
        out.displayWidth = whole(argv[++i], arg, 1);
        break;
      case "--max-frames":
        out.maxFrames = whole(argv[++i], arg, 1);
        if (out.maxFrames > MAX_SCAN_FRAMES) {
          throw new UsageError(`--max-frames is at most ${MAX_SCAN_FRAMES}: frame files are numbered in four digits`);
        }
        break;
      case "--stream":
        out.stream = whole(argv[++i], arg, 0);
        break;
      case "--color-matrix":
        out.colorMatrix = value(argv, ++i, arg, `one of ${COLOR_MATRICES.join(", ")}`);
        if (!COLOR_MATRICES.includes(out.colorMatrix)) {
          throw new UsageError(`--color-matrix is one of ${COLOR_MATRICES.join(", ")} (got ${out.colorMatrix})`);
        }
        break;
      case "--color-range": {
        const range = value(argv, ++i, arg, "tv or pc");
        if (range !== "tv" && range !== "pc")
          throw new UsageError(`--color-range is tv (limited) or pc (full), got ${range}`);
        out.colorRange = range;
        break;
      }
      case "--background": {
        const bg = value(argv, ++i, arg, "white or black");
        if (bg !== "white" && bg !== "black") throw new UsageError(`--background is white or black, got ${bg}`);
        out.background = bg;
        break;
      }
      case "--ffmpeg":
        out.ffmpeg = value(argv, ++i, arg, "the path to your ffmpeg");
        break;
      case "--ffprobe":
        out.ffprobe = value(argv, ++i, arg, "the path to your ffprobe");
        break;
      case "--pts":
        out.pts = value(argv, ++i, arg, "a timestamp file");
        break;
      case "--fps": {
        const raw = argv[++i];
        const fps = Number(raw);
        if (raw === undefined || !/^\d+(\.\d+)?(\/\d+(\.\d+)?)?$/.test(raw)) {
          throw new UsageError(`--fps expects frames a second (30, 29.97, 30000/1001), got "${raw ?? ""}"`);
        }
        const [num, den] = raw.split("/").map(Number);
        out.fps = den !== undefined ? num! / den : fps;
        if (!(out.fps > 0) || !Number.isFinite(out.fps)) throw new UsageError(`--fps must be above 0, got "${raw}"`);
        break;
      }
      case "--lossless":
        lossless = true;
        break;
      case "--every-frame":
        everyFrame = true;
        break;
      case "--loop": {
        const raw = value(argv, ++i, arg, "how many times the animation plays, or forever");
        out.loop = raw === "forever" ? null : whole(raw, arg, 1);
        break;
      }
      case "--json":
        json = true;
        break;
      case "-h":
      case "--help":
        console.log(usage());
        process.exit(0);
      // falls through — unreachable, `process.exit` above
      default:
        if (arg.startsWith("-")) throw new UsageError(`unknown option ${arg}`);
        if (source !== undefined) throw new UsageError(`one recording at a time, got ${source} and ${arg}`);
        source = arg;
    }
  }
  if (source === undefined) throw new UsageError(`no recording given.\n\n${usage()}`);
  if (at !== undefined && (from !== undefined || to !== undefined)) {
    throw new UsageError("--at picks instants and --from / --to a span: give one or the other");
  }
  if (from !== undefined && to !== undefined && to < from) throw new UsageError("--to is before --from");
  // No --to is to the end: a video's last frame, a looping image's first pass and a second past --from.
  const selection: SelectionRequest =
    at !== undefined
      ? { kind: "at", atMs: at }
      : from !== undefined || to !== undefined
        ? { kind: "span", fromMs: from ?? 0, ...(to !== undefined ? { toMs: to } : {}) }
        : { kind: "all" };
  const isDir = existsSync(source) && statSync(source).isDirectory();
  const imported = out.pts !== undefined || out.fps !== undefined;
  if (imported && !isDir) {
    throw new UsageError("--pts and --fps go with a directory of frames another decoder wrote, not a recording");
  }
  if (isDir && !imported) {
    throw new UsageError(`${source} is a directory: frames another decoder wrote need --pts <file> or --fps <rate>`);
  }
  if (isDir) {
    for (const [given, flag] of [
      [selection.kind !== "all", "--from / --to / --at"],
      [out.out !== undefined, "--out"],
      [out.maxFrames !== undefined, "--max-frames"],
      [out.stream !== undefined, "--stream"],
      [out.ffmpeg !== undefined || out.ffprobe !== undefined, "--ffmpeg / --ffprobe"],
      [out.colorMatrix !== undefined || out.colorRange !== undefined, "--color-matrix / --color-range"],
      [out.background !== undefined, "--background"],
    ] as const) {
      if (given)
        throw new UsageError(
          `${flag} is for decoding a recording; a directory's frames.json is written beside its frames`,
        );
    }
  } else if (lossless || everyFrame || out.loop !== undefined) {
    throw new UsageError(
      `${lossless ? "--lossless" : everyFrame ? "--every-frame" : "--loop"} is for imported frames: a decoded recording's codec and frame table say that`,
    );
  }
  return { source, ...out, selection, lossless, everyFrame, json };
}

const rel = (p: string) => {
  const r = relative(process.cwd(), p);
  return r === "" ? "." : r.startsWith("..") ? p : r;
};

function rate(manifest: FramesManifest): string {
  const f = manifest.frames;
  if (f.length < 2) return "1 frame";
  const span = f[f.length - 1]!.atMs - f[0]!.atMs;
  const contiguous = f.every((x, i) => i === 0 || x.index === f[i - 1]!.index! + 1);
  return contiguous && span > 0 ? `${(((f.length - 1) * 1000) / span).toFixed(2)} fps` : `${f.length} frames`;
}

function describeSelection(manifest: FramesManifest, streamFrames: number | undefined): string {
  const s = manifest.source.video!.selection;
  const n = manifest.frames.length;
  if (s.kind === "all") return `every frame of the recording`;
  if (s.kind === "span") return `of ${streamFrames ?? "?"}: those on screen during the span`;
  return `the frame on screen at each of ${s.atMs.length} instants`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let manifestPath: string;
  let manifest: FramesManifest;
  let result: ScanVideoResult | null = null;
  if (args.pts !== undefined || args.fps !== undefined) {
    ({ manifestPath, manifest } = await importFrames({
      dir: args.source,
      ...(args.pts !== undefined ? { pts: args.pts } : {}),
      ...(args.fps !== undefined ? { fps: args.fps } : {}),
      ...(args.displayWidth !== undefined ? { displayWidth: args.displayWidth } : {}),
      lossless: args.lossless,
      everyFrame: args.everyFrame,
      ...(args.loop !== undefined ? { loop: args.loop } : {}),
    }));
  } else {
    result = await scanVideo({
      file: args.source,
      selection: args.selection,
      ...(args.out !== undefined ? { out: args.out } : {}),
      ...(args.displayWidth !== undefined ? { displayWidth: args.displayWidth } : {}),
      ...(args.maxFrames !== undefined ? { maxFrames: args.maxFrames } : {}),
      ...(args.stream !== undefined ? { stream: args.stream } : {}),
      ...(args.ffmpeg !== undefined ? { ffmpeg: args.ffmpeg } : {}),
      ...(args.ffprobe !== undefined ? { ffprobe: args.ffprobe } : {}),
      ...(args.colorMatrix !== undefined ? { colorMatrix: args.colorMatrix } : {}),
      ...(args.colorRange !== undefined ? { colorRange: args.colorRange } : {}),
      ...(args.background !== undefined ? { background: args.background } : {}),
    });
    ({ manifestPath, manifest } = result);
  }
  if (args.json) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  const v = manifest.source.video!;
  const f = manifest.frames;
  const first = f[0]!;
  const last = f[f.length - 1]!;
  const { viewport, deviceScaleFactor } = manifest.source;
  console.log();
  console.log(`${BOLD}${CYAN}Scan video${RESET}`);
  console.log(
    `  ${DIM}${v.file} · ${v.codec}${v.decoder === "import" ? "" : v.lossless ? " (lossless)" : " (lossy)"} · ${rate(manifest)} · ${formatInstant(first.atMs)}–${formatInstant(last.atMs)} ms · ${v.decoder}${RESET}`,
  );
  console.log(
    `  ${f.length} frame${f.length === 1 ? "" : "s"}, ${describeSelection(manifest, v.streamFrames)}, shown at ${viewport.width}x${viewport.height} CSS px${deviceScaleFactor === 1 ? "" : ` (${Number(deviceScaleFactor.toFixed(4))} frame px per CSS px)`}`,
  );
  if (v.color) {
    const c = v.color;
    const assumed =
      c.assumed.length > 0
        ? ` ${YELLOW}(${c.assumed.join(" and ")} not tagged: assumed; --color-matrix / --color-range override)${RESET}`
        : "";
    console.log(
      `  ${DIM}color: ${c.matrix === "rgb" ? "stored as RGB" : `${c.matrix} matrix, ${c.range === "tv" ? "limited" : "full"} range`}${RESET}${assumed}`,
    );
  }
  for (const note of v.notes ?? []) console.log(`  ${YELLOW}${note}${RESET}`);
  if (v.decodeErrors?.length) {
    console.log(
      `  ${YELLOW}the decoder reported ${v.decodeErrors.length} error line${v.decodeErrors.length === 1 ? "" : "s"} (a damaged or truncated file decodes what it holds): ${v.decodeErrors.slice(0, 3).join(" | ")}${RESET}`,
    );
  }
  if (v.timing === "browser" && v.loop) {
    const plays = v.loop.plays === null ? "forever" : `${v.loop.plays} time${v.loop.plays === 1 ? "" : "s"}`;
    console.log(
      `  ${DIM}timed as a browser plays it (a frame of 10ms or less is held 100ms); plays ${plays}: ${v.loop.passes} pass${v.loop.passes === 1 ? "" : "es"} of ${formatInstant(v.loop.passMs)} ms written${RESET}`,
    );
  }
  if (v.hidden) {
    console.log(
      `  ${DIM}${v.hidden} decoded frame${v.hidden === 1 ? "" : "s"} never on screen (sharing a timestamp with the next): not written${RESET}`,
    );
  }
  if (v.rotation) console.log(`  ${DIM}turned ${v.rotation}° upright, as the stream's display matrix says${RESET}`);
  if (v.sampleAspect) console.log(`  ${DIM}pixels ${v.sampleAspect}, resampled to square${RESET}`);
  console.log(`  ${GREEN}${rel(manifestPath)}${RESET}`);
  console.log(
    `  ${DIM}next: vlmkit check flash ${rel(manifestPath)} · vlmkit snapshot strip --manifest ${rel(manifestPath)}${RESET}`,
  );
  if (!v.lossless) {
    console.log(
      `  ${DIM}${v.decoder === "import" ? "not marked lossless (--lossless)" : `${v.codec} is lossy`}: snapshot storyboard compares pixels exactly and needs --lossy to read it${RESET}`,
    );
  }
  console.log();
}

if (isCliEntry(import.meta.url, "scan-video-cli")) {
  const { handleCliError } = await import("@mizchi/vlmkit-core/cli-error.ts");
  main().catch(handleCliError);
}

export { usage };
