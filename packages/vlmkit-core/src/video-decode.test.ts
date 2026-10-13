/**
 * `scanVideo` / `importFrames` against the user's own ffmpeg, on recordings whose answer is known
 * by construction: frame N of every synthetic stream is a flat grey of luma 16 + 7N, so each frame
 * written can be told apart by its pixels and checked against the index the manifest gives it.
 *
 * These need ffmpeg and ffprobe on PATH, as a user would (vlmkit ships no decoder). CI installs
 * them (`unit-tests.yml`); without them the suite says so rather than skipping.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import { parseFramesManifest } from "@mizchi/vlmkit-judge/frames.ts";
import { decodePngPixels } from "./png-decode.ts";
import { findDecoder, importFrames, isVideoFile, parsePtsFile, scanVideo } from "./video-decode.ts";

let dir: string;

beforeAll(() => {
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-hide_banner", "-version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "these tests decode with ffmpeg and ffprobe on PATH, as a user's would (vlmkit ships no decoder): apt install ffmpeg / brew install ffmpeg",
    );
  }
  dir = mkdtempSync(join(tmpdir(), "vlmkit-video-test-"));
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const ffmpeg = (...args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

/** A stream whose frame N is a flat grey of luma 16 + 7N (so N up to 31 stays in range). */
function numbered(
  name: string,
  opts: { frames?: number; rate?: number; codec?: string[]; extra?: string[] } = {},
): string {
  const frames = opts.frames ?? 30;
  const rate = opts.rate ?? 30;
  const path = join(dir, name);
  ffmpeg(
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=64x48:r=${rate}:d=${frames / rate},format=yuv420p,geq=lum='16+7*N':cb=128:cr=128`,
    ...(opts.codec ?? ["-c:v", "libx264", "-g", "10", "-bf", "2"]),
    ...(opts.extra ?? []),
    path,
  );
  return path;
}

/** Which frame a decoded PNG shows: its centre grey, back through limited range. */
function frameNumber(png: string): number {
  const px = decodePngPixels(readFileSync(png));
  const i = ((px.height >> 1) * px.width + (px.width >> 1)) * px.channels;
  return Math.round(px.data[i]! / ((7 * 255) / 219));
}

test("isVideoFile: by extension, never a URL", () => {
  assert.equal(isVideoFile("rec.MP4"), true);
  assert.equal(isVideoFile("a/b/c.webm"), true);
  assert.equal(isVideoFile("anim.gif"), true);
  assert.equal(isVideoFile("page.html"), false);
  assert.equal(isVideoFile("frames.json"), false);
  assert.equal(isVideoFile("https://example.com/rec.mp4"), false);
});

test("parsePtsFile: seconds per line, ffprobe's trailing commas, N/A named", () => {
  assert.deepEqual(parsePtsFile("0.000000,\n0.033333\n\n0.066667,\n", "pts.txt"), [0, 0.033333, 0.066667]);
  assert.throws(
    () => parsePtsFile("0\nN/A\n", "pts.txt"),
    (e: unknown) =>
      e instanceof UsageError && /pts\.txt:2/.test((e as Error).message) && /best_effort/.test((e as Error).message),
  );
});

describe("scanVideo with the user's ffmpeg", () => {
  test("every frame of an H.264 stream with B-frames, in presentation order, each at its pts", async () => {
    const file = numbered("bframes.mp4");
    const r = await scanVideo({ file, out: join(dir, "bframes") });
    const m = parseFramesManifest(readFileSync(r.manifestPath, "utf8"));
    assert.equal(m.source.clock, "stream");
    assert.equal(m.frames.length, 30);
    assert.equal(r.streamFrames, 30);
    m.frames.forEach((f, k) => {
      assert.equal(f.index, k);
      assert.ok(Math.abs(f.atMs - (k * 1000) / 30) < 1e-6, `frame ${k} at ${f.atMs}`);
      assert.equal(frameNumber(join(r.manifestPath, "..", f.file)), k, `${f.file} shows frame ${k}`);
    });
    assert.deepEqual(
      m.frames.filter((f) => f.key).map((f) => f.index),
      [0, 10, 20],
      "keyframes every 10 (-g 10)",
    );
    assert.equal(m.source.video?.codec, "h264");
    assert.equal(m.source.video?.lossless, false);
    assert.deepEqual(m.source.viewport, { width: 64, height: 48 });
    assert.equal(m.source.deviceScaleFactor, 1);
    // Untagged: BT.601, limited range, both said to be assumed.
    assert.deepEqual(m.source.video?.color, { matrix: "bt601", range: "tv", assumed: ["matrix", "range"] });
  });

  test("a span keeps the frames on screen during it; instants keep the frame showing at each", async () => {
    const file = numbered("select.mp4");
    const span = await scanVideo({ file, out: join(dir, "span"), selection: { kind: "span", fromMs: 50, toMs: 250 } });
    // 50ms is inside frame 1 (33.3–66.7ms), 250ms inside frame 7 (233.3–266.7ms).
    assert.deepEqual(
      span.manifest.frames.map((f) => f.index),
      [1, 2, 3, 4, 5, 6, 7],
    );
    for (const f of span.manifest.frames) assert.equal(frameNumber(join(dir, "span", f.file)), f.index);
    const at = await scanVideo({
      file,
      out: join(dir, "at"),
      selection: { kind: "at", atMs: [0, 10, 100, 999, 5000] },
    });
    assert.deepEqual(
      at.manifest.frames.map((f) => [f.index, f.label]),
      [
        [0, "at 0ms, 10ms"],
        [3, undefined],
        [29, "at 999ms, 5000ms"],
      ],
    );
    for (const f of at.manifest.frames) assert.equal(frameNumber(join(dir, "at", f.file)), f.index);
  });

  test("a recording that starts late keeps its own spacing, from 0", async () => {
    const src = numbered("late-src.mp4", { frames: 12 });
    const file = join(dir, "late.mp4");
    ffmpeg("-itsoffset", "1.25", "-i", src, "-c", "copy", file);
    const r = await scanVideo({ file, out: join(dir, "late"), selection: { kind: "span", fromMs: 100, toMs: 200 } });
    assert.deepEqual(
      r.manifest.frames.map((f) => f.index),
      [3, 4, 5, 6],
    );
    for (const f of r.manifest.frames) assert.equal(frameNumber(join(dir, "late", f.file)), f.index);
  });

  test("variable frame durations are read from the stream, not a rate", async () => {
    // Frames 0..5 begin at 0, 100, 120, 420, 460, 500 ms (shown 100, 20, 300, 40, 40, … ms).
    const at = [0, 0.1, 0.12, 0.42, 0.46, 0.5];
    const expr = at.slice(0, -1).reduceRight((rest, t, n) => `if(eq(N,${n}),${t},${rest})`, String(at[at.length - 1]));
    const file = numbered("vfr.mkv", {
      frames: 6,
      codec: ["-c:v", "ffv1"],
      extra: ["-vf", `settb=1/1000,setpts='(${expr})/TB'`, "-fps_mode", "passthrough", "-enc_time_base", "1/1000"],
    });
    const r = await scanVideo({ file, out: join(dir, "vfr") });
    assert.deepEqual(
      r.manifest.frames.map((f) => Math.round(f.atMs)),
      [0, 100, 120, 420, 460, 500],
    );
    for (const f of r.manifest.frames) assert.equal(frameNumber(join(dir, "vfr", f.file)), f.index);
    assert.equal(r.manifest.source.video?.lossless, true, "ffv1 is lossless");
  });

  test("tags decide the colour conversion: BT.709 red comes back red", async () => {
    const file = join(dir, "red709.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=1280x720:d=0.2:r=10",
      "-vf",
      "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
      "-c:v",
      "libx264",
      "-crf",
      "10",
      "-colorspace",
      "bt709",
      "-color_range",
      "tv",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      file,
    );
    const r = await scanVideo({ file, out: join(dir, "red709") });
    assert.deepEqual(r.manifest.source.video?.color, {
      matrix: "bt709",
      range: "tv",
      transfer: "bt709",
      primaries: "bt709",
      assumed: [],
    });
    const bytes = readFileSync(join(dir, "red709", r.manifest.frames[0]!.file));
    // No colour chunk: a browser that colour-manages cICP / cHRM / gAMA showed grey 808080 as
    // 8c8c8c, so a strip of these frames would not show their bytes.
    for (const chunk of ["cICP", "cHRM", "gAMA", "iCCP", "sRGB"]) {
      assert.equal(bytes.includes(Buffer.from(chunk, "latin1")), false, `${chunk} in a frame`);
    }
    const px = decodePngPixels(bytes);
    const i = (360 * 1280 + 640) * px.channels;
    const [rr, gg, bb] = [px.data[i]!, px.data[i + 1]!, px.data[i + 2]!];
    assert.ok(rr >= 250 && gg <= 5 && bb <= 5, `decoded ${rr},${gg},${bb}`);
  });

  test("--display-width says how big the frames are shown", async () => {
    const file = numbered("display.mp4", { frames: 3 });
    const r = await scanVideo({ file, out: join(dir, "display"), displayWidth: 32 });
    assert.deepEqual(r.manifest.source.viewport, { width: 32, height: 24 });
    assert.equal(r.manifest.source.deviceScaleFactor, 2);
  });

  test("refuses what it cannot turn into frames, naming why", async () => {
    const refuses = async (p: Promise<unknown>, pattern: RegExp) =>
      assert.rejects(p, (e: unknown) => e instanceof UsageError && pattern.test((e as Error).message));
    const audio = join(dir, "audio.m4a");
    ffmpeg("-f", "lavfi", "-i", "anullsrc=d=0.2", "-c:a", "aac", audio);
    await refuses(scanVideo({ file: audio, out: join(dir, "x1") }), /no video stream.*audio aac/);
    const junk = join(dir, "junk.mp4");
    writeFileSync(junk, "not a video at all");
    await refuses(scanVideo({ file: junk, out: join(dir, "x2") }), /cannot read/);
    await refuses(scanVideo({ file: join(dir, "missing.mp4") }), /no such recording/);
    const hdr = join(dir, "hdr.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=gray:s=64x48:d=0.1",
      "-c:v",
      "libx264",
      "-color_trc",
      "smpte2084",
      "-color_primaries",
      "bt2020",
      "-colorspace",
      "bt2020nc",
      hdr,
    );
    await refuses(scanVideo({ file: hdr, out: join(dir, "x3") }), /HDR \(transfer smpte2084\)/);
    const long = numbered("long.mp4", { frames: 30 });
    await refuses(
      scanVideo({ file: long, out: join(dir, "x4"), maxFrames: 10 }),
      /30 frames to write, over --max-frames 10/,
    );
    await refuses(scanVideo({ file: long, out: join(dir, "x5"), stream: 3 }), /no video stream #3/);
  });

  test("a missing decoder is a UsageError that names the remedy, ffprobe looked for beside ffmpeg", async () => {
    await assert.rejects(
      findDecoder({ ffmpeg: join(dir, "nope", "ffmpeg"), env: {} }),
      (e: unknown) =>
        e instanceof UsageError &&
        /ffmpeg not found/.test((e as Error).message) &&
        /ships no video decoder/.test((e as Error).message),
    );
    // An ffmpeg given as a path brings the ffprobe beside it; with none there, PATH's.
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    const real = execFileSync("sh", ["-c", "command -v ffmpeg"]).toString().trim();
    copyFileSync(real, join(bin, "ffmpeg"));
    chmodSync(join(bin, "ffmpeg"), 0o755);
    const found = await findDecoder({ ffmpeg: join(bin, "ffmpeg"), env: {} });
    assert.equal(found.ffprobe, "ffprobe");
    assert.match(found.name, /^ffmpeg \S+/);
    await assert.rejects(
      findDecoder({ ffprobe: join(dir, "nope", "ffprobe"), env: {} }),
      (e: unknown) => e instanceof UsageError && /ffprobe not found/.test((e as Error).message),
    );
  });

  test("a re-run replaces its own frames and leaves other files", async () => {
    const out = join(dir, "rerun");
    const file = numbered("rerun.mp4", { frames: 6 });
    await scanVideo({ file, out });
    writeFileSync(join(out, "notes.txt"), "mine");
    const r = await scanVideo({ file, out, selection: { kind: "at", atMs: [0] } });
    const names = execFileSync("ls", [out]).toString().trim().split("\n");
    assert.deepEqual(names.sort(), ["0000-t000000.png", "frames.json", "notes.txt"]);
    assert.equal(r.manifest.frames.length, 1);
  });
});

describe("importFrames: frames another decoder wrote", () => {
  test("numbered PNGs plus ffprobe's best_effort_timestamp_time, as the documented recipe writes them", async () => {
    const file = numbered("import.mp4", { frames: 9 });
    const frames = join(dir, "imported");
    mkdirSync(frames, { recursive: true });
    ffmpeg("-i", file, "-fps_mode", "passthrough", join(frames, "%06d.png"));
    const pts = execFileSync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=best_effort_timestamp_time",
      "-of",
      "csv=p=0",
      file,
    ]).toString();
    writeFileSync(join(frames, "pts.txt"), pts);
    const r = await importFrames({ dir: frames, pts: join(frames, "pts.txt") });
    const m = parseFramesManifest(readFileSync(r.manifestPath, "utf8"));
    assert.equal(m.frames.length, 9);
    m.frames.forEach((f, k) => {
      assert.equal(frameNumber(join(frames, f.file)), k);
      assert.ok(Math.abs(f.atMs - (k * 1000) / 30) < 0.01, `frame ${k} at ${f.atMs}`);
    });
    assert.equal(m.source.video?.decoder, "import");
    assert.equal(m.source.video?.lossless, false, "not claimed without --lossless");
    const fps = await importFrames({ dir: frames, fps: 10, lossless: true });
    assert.equal(fps.manifest.frames[3]!.atMs, 300);
    assert.equal(fps.manifest.source.video?.lossless, true);
    writeFileSync(join(frames, "short.txt"), "0\n0.1\n");
    await assert.rejects(
      importFrames({ dir: frames, pts: join(frames, "short.txt") }),
      (e: unknown) => e instanceof UsageError && /2 timestamps for 9 PNGs/.test((e as Error).message),
    );
  });
});

describe("scanVideo: an animated GIF / APNG plays as a browser plays it", () => {
  /**
   * A two-frame black / white animation at `fps`. `loop` as ffmpeg's GIF muxer takes it (0
   * forever, -1 once); its APNG muxer calls the same thing `-plays` (0 forever).
   */
  function blink(name: string, fps: number, loop: number): string {
    const path = join(dir, name);
    const d = 1 / fps;
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=32x32:r=${fps}:d=${d}[a];color=c=white:s=32x32:r=${fps}:d=${d}[b];[a][b]concat=n=2:v=1`,
      ...(name.endsWith(".apng") ? ["-plays", String(loop)] : ["-loop", String(loop)]),
      path,
    );
    return path;
  }

  test("a GIF that loops forever is written for one pass and a second more, each frame at its delay", async () => {
    const r = await scanVideo({ file: blink("loop.gif", 10, 0), out: join(dir, "loop-gif") });
    const v = r.manifest.source.video!;
    assert.equal(v.timing, "browser");
    assert.deepEqual(v.loop, { plays: null, passFrames: 2, passMs: 200, passes: 6 });
    assert.deepEqual(
      r.manifest.frames.map((f) => f.atMs),
      [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100],
    );
    // Every pass shows the same two pictures (the palette keeps white as 252).
    const light = r.manifest.frames.map(
      (f) => decodePngPixels(readFileSync(join(dir, "loop-gif", f.file))).data[0]! > 128,
    );
    assert.deepEqual(light, [false, true, false, true, false, true, false, true, false, true, false, true]);
  });

  test("a frame of 10ms or less is held 100ms, as Chromium holds it; a GIF that plays once is one pass", async () => {
    const r = await scanVideo({ file: blink("fast.gif", 100, -1), out: join(dir, "fast-gif") });
    assert.deepEqual(r.manifest.source.video?.loop, { plays: 1, passFrames: 2, passMs: 200, passes: 1 });
    assert.deepEqual(
      r.manifest.frames.map((f) => f.atMs),
      [0, 100],
      "ffmpeg's own timing would put the second frame at 10ms",
    );
  });

  test("an APNG loops and is clamped the same way", async () => {
    const r = await scanVideo({ file: blink("loop.apng", 100, 0), out: join(dir, "loop-apng") });
    assert.equal(r.manifest.source.video?.codec, "apng");
    assert.deepEqual(r.manifest.source.video?.loop, { plays: null, passFrames: 2, passMs: 200, passes: 6 });
    assert.equal(r.manifest.frames[1]!.atMs, 100);
  });
});
