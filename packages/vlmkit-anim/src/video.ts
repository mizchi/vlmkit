/**
 * `vlmkit anim video` — the animation as a file that plays where no runtime
 * runs: a README, a slide, a chat message.
 *
 * The schedule is the same arithmetic as `render-svg.ts` — frames are sampled
 * from the timeline at a fixed rate — plus one thing playback in a browser
 * does not need: a **hold** on every step marker, because a viewer of a GIF
 * cannot pause to read the caption. Consecutive identical frames collapse
 * into one frame with a longer delay, so a hold costs one frame, not thirty.
 *
 * GIF is encoded here, with no external binary: the pictures are flat SVG
 * colours and text, which a 256-colour palette reproduces without visible
 * loss, and GIF is the one format that autoplays inline everywhere. MP4 and
 * WebM are delegated to `ffmpeg` when it is on PATH; when it is not, the
 * frames are left on disk with the exact command to run.
 */

import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
// gifenc is a CommonJS bundle without static named exports: Node's ESM loader
// puts everything under `default`, a bundler / vitest exposes the names.
import * as gifencModule from "gifenc";
import type { Gifenc } from "gifenc";
const gifenc: Gifenc = (() => {
  const ns = gifencModule as unknown as Record<string, unknown>;
  const candidates = [ns, ns.default, (ns.default as Record<string, unknown> | undefined)?.default];
  const found = candidates.find((c) => c && typeof (c as Record<string, unknown>).GIFEncoder === "function");
  if (!found) throw new Error("gifenc: GIFEncoder export not found");
  return found as Gifenc;
})();
import { PNG } from "pngjs";
import { renderFrameSvg } from "./render-svg.ts";
import { timelineDuration } from "./timeline.ts";
import type { Timeline } from "./types.ts";

export interface VideoOptions {
  /** Output frames per second. Default 20 (a 50ms GIF delay, exactly representable). */
  fps?: number;
  /** Milliseconds to hold on every step marker and on the final frame. Default 400. */
  hold?: number;
  /** Output width in pixels; height follows the canvas aspect. Default: the canvas width. */
  width?: number;
  /** GIF only: loop forever. Default true. */
  loop?: boolean;
}

export interface ScheduledFrame {
  /** Timeline time this frame samples. */
  t: number;
  /** How long this frame stays on screen. */
  delayMs: number;
  svg: string;
}

/**
 * Sample times at `fps`, pausing `hold` ms at each step marker and at the end,
 * then merge runs of identical frames. Deterministic.
 */
export function scheduleFrames(tl: Timeline, opts: VideoOptions = {}): ScheduledFrame[] {
  const fps = opts.fps ?? 20;
  const hold = opts.hold ?? 400;
  const dt = 1000 / fps;
  const dur = timelineDuration(tl);
  const stepTimes = [...new Set((tl.steps ?? []).map((s) => Math.round(s.t)))].sort((a, b) => a - b);
  const holdFrames = Math.round(hold / dt);

  const times: number[] = [];
  let si = 0;
  let prev = -Infinity;
  for (let t = 0; t <= dur + 1e-9; t += dt) {
    // Every step marker crossed since the previous frame gets its hold, in order.
    while (si < stepTimes.length && stepTimes[si] <= t) {
      const s = stepTimes[si++];
      if (s > prev) for (let k = 0; k < holdFrames; k++) times.push(s);
    }
    times.push(Math.min(t, dur));
    prev = t;
  }
  if (times[times.length - 1] !== dur) times.push(dur);
  for (let k = 0; k < holdFrames; k++) times.push(dur);

  const out: ScheduledFrame[] = [];
  for (const t of times) {
    const svg = renderFrameSvg(tl, t);
    const last = out[out.length - 1];
    if (last && last.svg === svg) last.delayMs += dt;
    else out.push({ t: Math.round(t * 100) / 100, delayMs: dt, svg });
  }
  for (const f of out) f.delayMs = Math.round(f.delayMs);
  return out;
}

export interface RgbaFrame {
  width: number;
  height: number;
  rgba: Uint8Array;
  delayMs: number;
}

/** Indexed-colour GIF from RGBA frames. Palette per frame, 256 colours. */
export function encodeGif(frames: RgbaFrame[], opts: { loop?: boolean } = {}): Uint8Array {
  if (frames.length === 0) throw new Error("encodeGif: no frames");
  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const gif = GIFEncoder();
  frames.forEach((f, i) => {
    const palette = quantize(f.rgba, 256, { format: "rgb444" });
    const index = applyPalette(f.rgba, palette, "rgb444");
    gif.writeFrame(index, f.width, f.height, {
      palette,
      delay: Math.max(20, f.delayMs),
      ...(i === 0 ? { repeat: opts.loop === false ? -1 : 0 } : {}),
    });
  });
  gif.finish();
  return gif.bytes();
}

export function decodePng(buf: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const png = PNG.sync.read(Buffer.from(buf));
  return { width: png.width, height: png.height, rgba: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
}

/** Rasterise every scheduled frame through one Playwright page. `scale` multiplies the canvas size. */
export async function rasteriseFrames(tl: Timeline, frames: ScheduledFrame[], scale: number): Promise<Uint8Array[]> {
  let chromium: typeof import("playwright").chromium;
  try {
    chromium = (await import("playwright")).chromium;
  } catch {
    throw new Error("video output needs playwright installed (pnpm add -D playwright && npx playwright install chromium)");
  }
  const browser = await chromium.launch();
  try {
    const w = Math.ceil(tl.canvas.width);
    const h = Math.ceil(tl.canvas.height);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const out: Uint8Array[] = [];
    for (const f of frames) {
      await page.setContent(`<!doctype html><html><body style="margin:0;background:${tl.canvas.background ?? "#fff"}">${f.svg}</body></html>`);
      out.push(await page.screenshot({ clip: { x: 0, y: 0, width: tl.canvas.width, height: tl.canvas.height }, type: "png" }));
    }
    return out;
  } finally {
    await browser.close();
  }
}

export type VideoFormat = "gif" | "mp4" | "webm";

export function videoFormat(out: string): VideoFormat {
  const ext = out.toLowerCase().split(".").pop();
  if (ext === "gif" || ext === "mp4" || ext === "webm") return ext;
  throw new Error(`video output must end in .gif, .mp4 or .webm, got "${basename(out)}"`);
}

export interface VideoResult {
  out: string;
  format: VideoFormat;
  frames: number;
  durationMs: number;
  width: number;
  height: number;
  bytes?: number;
  /** ffmpeg was not found: the frames are here and this command finishes the job. */
  pending?: { framesDir: string; command: string };
}

export function ffmpegAvailable(): boolean {
  const r = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return !r.error && r.status === 0;
}

function ffmpegArgs(format: Exclude<VideoFormat, "gif">, fps: number, listFile: string, out: string): string[] {
  // Even dimensions for yuv420p; concat demuxer honours per-frame `duration`; -r duplicates frames to a constant rate.
  const common = ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-r", String(fps), "-pix_fmt", "yuv420p"];
  return format === "mp4"
    ? [...common, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", out]
    : [...common, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", out];
}

/** Whole pipeline: schedule → rasterise → encode (GIF here, MP4/WebM through ffmpeg). */
export async function writeVideo(tl: Timeline, out: string, opts: VideoOptions = {}): Promise<VideoResult> {
  const format = videoFormat(out);
  const fps = opts.fps ?? 20;
  const frames = scheduleFrames(tl, { ...opts, fps });
  const scale = opts.width ? opts.width / tl.canvas.width : 1;
  const pngs = await rasteriseFrames(tl, frames, scale);
  const durationMs = frames.reduce((s, f) => s + f.delayMs, 0);
  await mkdir(dirname(resolve(out)), { recursive: true });

  if (format === "gif") {
    const decoded = pngs.map((p, i) => ({ ...decodePng(p), delayMs: frames[i].delayMs }));
    const bytes = encodeGif(decoded, { loop: opts.loop });
    await writeFile(out, bytes);
    return { out, format, frames: frames.length, durationMs, width: decoded[0].width, height: decoded[0].height, bytes: bytes.byteLength };
  }

  const first = decodePng(pngs[0]);
  const available = ffmpegAvailable();
  // Frames go next to the output when ffmpeg is missing (the user runs the command), to a temp dir otherwise.
  const framesDir = available ? await mkdtemp(join(tmpdir(), "vlmkit-anim-video-")) : resolve(out.replace(/\.(mp4|webm)$/i, "") + ".frames");
  await mkdir(framesDir, { recursive: true });
  const list: string[] = ["ffconcat version 1.0"];
  for (const [i, png] of pngs.entries()) {
    const name = `frame-${String(i).padStart(5, "0")}.png`;
    await writeFile(join(framesDir, name), png);
    list.push(`file ${name}`, `duration ${(frames[i].delayMs / 1000).toFixed(3)}`);
  }
  // The concat demuxer ignores the last duration unless the file is listed once more.
  list.push(`file frame-${String(pngs.length - 1).padStart(5, "0")}.png`);
  const listFile = join(framesDir, "frames.ffconcat");
  await writeFile(listFile, list.join("\n") + "\n");
  const args = ffmpegArgs(format, fps, listFile, resolve(out));
  if (!available) {
    return { out, format, frames: frames.length, durationMs, width: first.width, height: first.height, pending: { framesDir, command: ["ffmpeg", ...args.map((a) => (/[\s*()]/.test(a) ? `"${a}"` : a))].join(" ") } };
  }
  const r = spawnSync("ffmpeg", args, { encoding: "utf-8" });
  await rm(framesDir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed (exit ${r.status}):\n${(r.stderr ?? "").split("\n").slice(-12).join("\n")}`);
  const { statSync } = await import("node:fs");
  return { out, format, frames: frames.length, durationMs, width: first.width, height: first.height, bytes: statSync(out).size };
}
