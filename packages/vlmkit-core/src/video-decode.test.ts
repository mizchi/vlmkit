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
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import { parseFramesManifest } from "@mizchi/vlmkit-judge/frames.ts";
import { encodeApng } from "./apng.ts";
import { encodeGif } from "./gif.ts";
import { decodePngPixels } from "./png-decode.ts";
import {
  apngDeclaredFrames,
  decodeErrors,
  processIdentity,
  defaultFramesDir,
  findDecoder,
  importFrames,
  isVideoFile,
  onPath,
  parsePtsFile,
  scanVideo,
} from "./video-decode.ts";

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
  assert.equal(isVideoFile("player.html?clip=intro.gif"), false, "a page's query is not its extension");
  assert.equal(isVideoFile("p.html#a.mp4"), false);
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

  test("a recording that starts late is on its own timeline, as a browser's currentTime counts it", async () => {
    // Measured in Chromium: a video that starts 1.25s in shows its first frame until then, and frame
    // k at 1250 + 33.3k ms — so --from / --to / --at name the instants a player shows.
    const src = numbered("late-src.mp4", { frames: 12 });
    const file = join(dir, "late.mp4");
    ffmpeg("-itsoffset", "1.25", "-i", src, "-c", "copy", file);
    const r = await scanVideo({ file, out: join(dir, "late"), selection: { kind: "span", fromMs: 1350, toMs: 1450 } });
    assert.deepEqual(
      r.manifest.frames.map((f) => f.index),
      [3, 4, 5, 6],
    );
    assert.ok(Math.abs(r.manifest.frames[0]!.atMs - 1350) < 1e-6);
    for (const f of r.manifest.frames) assert.equal(frameNumber(join(dir, "late", f.file)), f.index);
    const before = await scanVideo({ file, out: join(dir, "late-at"), selection: { kind: "at", atMs: [0, 1000] } });
    assert.deepEqual(
      before.manifest.frames.map((f) => f.index),
      [0],
      "before its first frame begins, a player shows the first frame",
    );
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
    const env = { PATH: process.env.PATH };
    const found = await findDecoder({ ffmpeg: join(bin, "ffmpeg"), env });
    // Bare names are resolved on PATH (never the working directory) and spawned by path.
    assert.match(found.ffprobe, /[\\/]ffprobe$/);
    assert.match(found.name, /^ffmpeg \S+/);
    await assert.rejects(
      findDecoder({ ffprobe: join(dir, "nope", "ffprobe"), env }),
      (e: unknown) => e instanceof UsageError && /ffprobe not found/.test((e as Error).message),
    );
    await assert.rejects(
      findDecoder({ env: { PATH: join(dir, "nope") } }),
      (e: unknown) => e instanceof UsageError && /ffmpeg not found on PATH/.test((e as Error).message),
    );
    // An empty variable is unset, not a binary named "".
    assert.match((await findDecoder({ env: { ...env, VLMKIT_FFMPEG: "" } })).ffmpeg, /[\\/]ffmpeg$/);
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
  /** The help's recipe exactly: both halves name the stream scan video judges (source.video.stream). */
  const recipe = async (file: string, frames: string): Promise<number> => {
    const probe = await scanVideo({
      file,
      out: join(dir, `${frames.split("/").pop()}-probe`),
      selection: { kind: "at", atMs: [0] },
    });
    const i = probe.manifest.source.video!.stream!;
    mkdirSync(frames, { recursive: true });
    ffmpeg("-i", file, "-map", `0:${i}`, "-fps_mode", "passthrough", join(frames, "%06d.png"));
    const pts = execFileSync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      String(i),
      "-show_entries",
      "frame=best_effort_timestamp_time",
      "-of",
      "csv=p=0",
      file,
    ]).toString();
    writeFileSync(join(frames, "pts.txt"), pts);
    return i;
  };

  test("the help's recipe names the stream scan video judges, also when a one-frame cover track comes first", async () => {
    const cover = join(dir, "recipe-cover.png");
    ffmpeg("-f", "lavfi", "-i", "color=c=red:s=32x32:d=1", "-frames:v", "1", cover);
    const strobeFile = join(dir, "recipe-strobe.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=30:d=1,geq=lum='255*mod(N\\,2)':cb=128:cr=128",
      "-c:v",
      "ffv1",
      strobeFile,
    );
    const both = join(dir, "recipe-both.mkv");
    ffmpeg(
      "-i",
      cover,
      "-i",
      strobeFile,
      "-map",
      "0",
      "-map",
      "1",
      "-c:v:0",
      "mjpeg",
      "-c:v:1",
      "ffv1",
      "-disposition:v:0",
      "attached_pic",
      both,
    );
    const frames = join(dir, "recipe-frames");
    assert.equal(await recipe(both, frames), 1, "the 30-frame stream, not the cover at index 0");
    const r = await importFrames({ dir: frames, pts: join(frames, "pts.txt"), everyFrame: true });
    assert.equal(r.manifest.frames.length, 30);
    assert.deepEqual(r.manifest.source.viewport, { width: 64, height: 48 });
  });

  test("numbered PNGs plus ffprobe's best_effort_timestamp_time, as the documented recipe writes them", async () => {
    const file = numbered("import.mp4", { frames: 9 });
    const frames = join(dir, "imported");
    await recipe(file, frames);
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
    // A pass is 200ms; up to the frame on screen at 1200ms.
    assert.deepEqual(v.loop, { plays: null, passFrames: 2, passMs: 200, passes: 7 });
    assert.deepEqual(
      r.manifest.frames.map((f) => f.atMs),
      [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
    );
    // Every pass shows the same two pictures (the palette keeps white as 252).
    const light = r.manifest.frames.map(
      (f) => decodePngPixels(readFileSync(join(dir, "loop-gif", f.file))).data[0]! > 128,
    );
    assert.deepEqual(light, [false, true, false, true, false, true, false, true, false, true, false, true, false]);
  });

  test("an instant or a span past the written passes is the frame the loop is on then", async () => {
    const file = blink("loop-at.gif", 10, 0);
    const at = await scanVideo({
      file,
      out: join(dir, "loop-at"),
      selection: { kind: "at", atMs: [5050, 5150, 5250] },
    });
    const light = (f: { file: string }) => decodePngPixels(readFileSync(join(dir, "loop-at", f.file))).data[0]! > 128;
    // 5050ms is 50ms into a pass (black), 5150 the second frame (white), 5250 black again.
    assert.deepEqual(
      at.manifest.frames.map((f) => [f.atMs, light(f)]),
      [
        [5000, false],
        [5100, true],
        [5200, false],
      ],
    );
    const span = await scanVideo({
      file,
      out: join(dir, "loop-span"),
      selection: { kind: "span", fromMs: 5000, toMs: 5300 },
    });
    assert.equal(span.manifest.frames.length, 4, "a span of a GIF that never stops is not 'after its last frame'");
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
    assert.deepEqual(r.manifest.source.video?.loop, { plays: null, passFrames: 2, passMs: 200, passes: 7 });
    assert.equal(r.manifest.frames[1]!.atMs, 100);
  });
});

describe("scanVideo: what a stream's properties change", () => {
  test("non-square pixels are resampled square, nearest, so a colour edge stays exact", async () => {
    const file = join(dir, "sar.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=64x48:r=10:d=0.2,format=rgb24,drawbox=x=0:y=0:w=16:h=16:color=red:t=fill,setsar=2/1",
      // RGB, so the only resampling is the square-pixel one (4:2:0 chroma blends a colour edge by itself).
      "-c:v",
      "ffv1",
      "-pix_fmt",
      "bgr0",
      file,
    );
    const r = await scanVideo({ file, out: join(dir, "sar") });
    assert.equal(r.manifest.source.video?.sampleAspect, "2:1");
    const px = decodePngPixels(readFileSync(join(dir, "sar", r.manifest.frames[0]!.file)));
    assert.deepEqual([px.width, px.height], [128, 48]);
    const at = (x: number, y: number) => [...px.data.subarray((y * px.width + x) * 3, (y * px.width + x) * 3 + 3)];
    // The red box is now 32 px wide; its edge is red, then blue, nothing blended between.
    assert.ok(at(31, 5)[0]! > 240 && at(31, 5)[2]! < 15, `31,5 = ${at(31, 5)}`);
    assert.ok(at(32, 5)[0]! < 15 && at(32, 5)[2]! > 240, `32,5 = ${at(32, 5)}`);
  });

  test("transparent pixels are composited, never dropped to show what is under them", async () => {
    // Fully transparent everywhere, the colour under the alpha toggling black / white each frame.
    const file = join(dir, "hidden.mov");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=32x32:r=10:d=1,format=rgba,geq=r='255*mod(N\\,2)':g='255*mod(N\\,2)':b='255*mod(N\\,2)':a=0",
      "-c:v",
      "qtrle",
      file,
    );
    for (const background of ["white", "black"] as const) {
      const r = await scanVideo({ file, out: join(dir, `hidden-${background}`), background });
      assert.equal(r.manifest.source.video?.background, background);
      const levels = new Set(
        r.manifest.frames.map((f) => decodePngPixels(readFileSync(join(dir, `hidden-${background}`, f.file))).data[0]),
      );
      assert.deepEqual([...levels], [background === "white" ? 255 : 0], "every frame is the background");
    }
  });

  test("an interlaced stream is split into its fields: a field-rate strobe is in the sequence", async () => {
    // 50 fields a second alternating black / white, woven into 25 interlaced frames: each frame is a
    // still comb, identical every frame, so judged as frames nothing ever changes.
    const file = join(dir, "fields.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=50:d=1,geq=lum='255*mod(N\\,2)':cb=128:cr=128,tinterlace=mode=interleave_top,setfield=tff",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-flags",
      "+ilme+ildct",
      "-x264opts",
      "tff=1",
      file,
    );
    const r = await scanVideo({ file, out: join(dir, "fields") });
    assert.equal(r.manifest.source.video?.fields, true);
    assert.equal(r.manifest.frames.length, 2 * r.manifest.frames.filter((f) => f.index! % 2 === 0).length);
    const levels = r.manifest.frames
      .slice(0, 6)
      .map((f) => decodePngPixels(readFileSync(join(dir, "fields", f.file))).data[0]! > 128);
    assert.deepEqual(levels, [false, true, false, true, false, true], "fields alternate");
    const gaps = r.manifest.frames.slice(1, 5).map((f, i) => Math.round(f.atMs - r.manifest.frames[i]!.atMs));
    assert.deepEqual(gaps, [20, 20, 20, 20], "at twice the frame rate");
  });

  test("a truncated file decodes what it holds and says the decoder reported errors", async () => {
    // The index (faststart) says 75 frames; the data for half of them is gone. Measured: ffmpeg and
    // ffprobe both decode 36 and exit 0, saying so only on stderr.
    const whole = join(dir, "whole.mp4");
    ffmpeg("-f", "lavfi", "-i", "testsrc2=s=320x240:r=25:d=3", "-c:v", "libx264", "-movflags", "+faststart", whole);
    const bytes = readFileSync(whole);
    const cut = join(dir, "cut.mp4");
    writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length / 2)));
    const r = await scanVideo({ file: cut, out: join(dir, "cut") });
    assert.ok(r.manifest.frames.length > 0 && r.manifest.frames.length < 75, `${r.manifest.frames.length} frames`);
    assert.ok((r.manifest.source.video?.decodeErrors?.length ?? 0) > 0, "the decoder's errors are kept");
    const clean = await scanVideo({ file: whole, out: join(dir, "whole") });
    assert.equal(clean.manifest.source.video?.decodeErrors, undefined, "and a whole file has none");
  });
});

describe("scanVideo: what review found, held", () => {
  test("its output directory: the recording in it is never deleted, a failed re-scan keeps the last good one, another tool's is refused", async () => {
    const out = join(dir, "keep");
    const good = numbered("keep.mp4", { frames: 5 });
    await scanVideo({ file: good, out });
    // A recording that changes size mid-stream (two MPEG-TS joined) is refused: the previous frames stay.
    const a = join(dir, "size-a.ts");
    const b = join(dir, "size-b.ts");
    ffmpeg("-f", "lavfi", "-i", "color=c=black:s=64x48:r=25:d=0.4", "-c:v", "libx264", "-f", "mpegts", a);
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=gray:s=96x64:r=25:d=0.4",
      "-c:v",
      "libx264",
      "-output_ts_offset",
      "0.5",
      "-f",
      "mpegts",
      b,
    );
    const both = join(dir, "size-both.ts");
    writeFileSync(both, Buffer.concat([readFileSync(a), readFileSync(b)]));
    await assert.rejects(
      scanVideo({ file: both, out }),
      /changes size mid-stream \(64x48, then 96x64 at decoded frame 10\)/,
    );
    assert.equal(parseFramesManifest(readFileSync(join(out, "frames.json"), "utf8")).frames.length, 5);
    // A recording named like a frame, inside the directory it is scanned into, survives.
    const inside = join(dir, "inside");
    mkdirSync(inside, { recursive: true });
    const named = join(inside, "0000-t000000.png");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=16x16:r=10:d=0.2[a];color=c=white:s=16x16:r=10:d=0.2[b];[a][b]concat=n=2:v=1",
      "-plays",
      "0",
      "-f",
      "apng",
      named,
    );
    const bytes = readFileSync(named);
    // Its frame 0 would be renamed over it: refused before anything is written, also through a symlink.
    await assert.rejects(scanVideo({ file: named, out: inside }), /named like a file scan video writes/);
    const link = join(dir, "inside-link");
    symlinkSync(inside, link);
    await assert.rejects(scanVideo({ file: named, out: link }), /named like a file scan video writes/);
    // A link elsewhere to that file is the same file; so is a name the work-dir sweep would clear.
    const elsewhere = join(dir, "clip-link.png");
    symlinkSync(named, elsewhere);
    await assert.rejects(
      scanVideo({ file: elsewhere, out: inside }),
      /a link to .*0000-t000000\.png, named like a file/,
    );
    const work = join(inside, ".scan-video-clip.png");
    copyFileSync(named, work);
    await assert.rejects(scanVideo({ file: work, out: inside }), /named like a file scan video writes or clears/);
    rmSync(work);
    rmSync(elsewhere);
    assert.deepEqual(readFileSync(named), bytes, "the recording is byte for byte what it was");
    assert.deepEqual(readdirSync(inside), ["0000-t000000.png"]);
    // Named otherwise, it is scanned into its own directory and left as it was.
    const renamed = join(inside, "anim.png");
    renameSync(named, renamed);
    await scanVideo({ file: renamed, out: inside });
    assert.deepEqual(readFileSync(renamed), bytes);
    const other = join(dir, "other");
    mkdirSync(other, { recursive: true });
    writeFileSync(
      join(other, "frames.json"),
      JSON.stringify({ format: "vlmkit-frames/1", source: { tool: "check flash" }, frames: [] }),
    );
    await assert.rejects(scanVideo({ file: good, out: other }), /holds another sequence \(check flash\)/);
  });

  test("a span of a recording that changes pixel format mid-stream: select counts decoded frames through the change", async () => {
    const a = join(dir, "fmt-a.mkv");
    const b = join(dir, "fmt-b.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=10:d=1,format=yuv420p,geq=lum='16+7*N':cb=128:cr=128",
      "-c:v",
      "libx264",
      a,
    );
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=10:d=1,format=yuv444p,geq=lum='86+7*N':cb=128:cr=128",
      "-c:v",
      "libx264",
      "-output_ts_offset",
      "1",
      b,
    );
    const both = join(dir, "fmt-both.mkv");
    writeFileSync(join(dir, "fmt.ffconcat"), `ffconcat version 1.0\nfile '${a}'\nfile '${b}'\n`);
    ffmpeg("-f", "concat", "-safe", "0", "-i", join(dir, "fmt.ffconcat"), "-c", "copy", both);
    const r = await scanVideo({
      file: both,
      out: join(dir, "fmt"),
      selection: { kind: "span", fromMs: 500, toMs: 1500 },
    });
    assert.deepEqual(
      r.manifest.frames.map((f) => f.index),
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    );
    for (const f of r.manifest.frames) assert.equal(frameNumber(join(dir, "fmt", f.file)), f.index);
  });

  test("an ffmpeg older than 5.1 is refused by name, before it fails on every file", async () => {
    const fake = join(dir, "old-ffmpeg");
    writeFileSync(fake, "#!/bin/sh\necho 'ffmpeg version 4.4.2-0ubuntu0.22.04.1 Copyright (c) 2000-2021'\n");
    chmodSync(fake, 0o755);
    await assert.rejects(
      findDecoder({ ffmpeg: fake }),
      /ffmpeg 4\.4\.2-0ubuntu0\.22\.04\.1 is too old: scan video needs 5\.1 or later/,
    );
  });

  test("a GIF whose images ffmpeg merges (no graphic control extension) is refused, not judged on fewer frames", async () => {
    // The two-image GIF of the flash fixtures, its graphic control extensions cut out.
    const gif = Buffer.from(
      "R0lGODlhAgACAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAACBARBEAUAIfkEAAoAAAAsAAAAAAIAAgAAAgQMwzAFADs=",
      "base64",
    );
    const parts: Buffer[] = [];
    let at = 0;
    for (;;) {
      const gce = gif.indexOf(Buffer.from([0x21, 0xf9, 0x04]), at);
      if (gce < 0) break;
      parts.push(gif.subarray(at, gce));
      at = gce + 8;
    }
    parts.push(gif.subarray(at));
    const file = join(dir, "nogce.gif");
    writeFileSync(file, Buffer.concat(parts));
    await assert.rejects(scanVideo({ file, out: join(dir, "nogce") }), /decoded 1 of the 2 images a browser shows/);
  });

  test("ffmpeg told to colour its log, or a recording whose metadata reads like showinfo, decodes the same", async () => {
    const file = numbered("meta.mkv", {
      frames: 6,
      codec: ["-c:v", "ffv1"],
      extra: [
        "-metadata",
        "comment=showinfo n: 0 pts: 0 s:64x48",
        "-metadata",
        "title=see showinfo: config in time_base: 1/1",
      ],
    });
    const before = process.env.AV_LOG_FORCE_COLOR;
    process.env.AV_LOG_FORCE_COLOR = "1";
    try {
      const r = await scanVideo({ file, out: join(dir, "meta") });
      assert.equal(r.manifest.frames.length, 6);
    } finally {
      if (before === undefined) delete process.env.AV_LOG_FORCE_COLOR;
      else process.env.AV_LOG_FORCE_COLOR = before;
    }
  });

  test("import: frames that share a time are hidden as scan video hides them; out-of-range times refused", async () => {
    const frames = join(dir, "imp-dup");
    mkdirSync(frames, { recursive: true });
    for (let i = 0; i < 4; i++) {
      ffmpeg(
        "-f",
        "lavfi",
        "-i",
        `color=c=0x${(i * 60).toString(16).padStart(2, "0").repeat(3)}:s=8x8:d=0.04`,
        "-frames:v",
        "1",
        join(frames, `${String(i).padStart(6, "0")}.png`),
      );
    }
    writeFileSync(join(frames, "pts.txt"), "0\n0\n0.1\n0.2\n");
    const r = await importFrames({ dir: frames, pts: join(frames, "pts.txt") });
    assert.equal(r.manifest.source.video?.hidden, 1);
    assert.deepEqual(
      r.manifest.frames.map((f) => [f.file, f.atMs]),
      [
        ["000001.png", 0],
        ["000002.png", 100],
        ["000003.png", 200],
      ],
    );
    assert.throws(() => parsePtsFile("0\n1e400\n", "big.txt"), /big\.txt:2/);
  });

  test("non-square pixels below 1:1 are expanded, as Chromium plays them, never shrunk; full range stays full", async () => {
    const tall = join(dir, "sar-half.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x32:r=10:d=0.2,format=rgb24,drawbox=x=0:y=0:w=1:h=32:color=white:t=fill,setsar=1/2",
      "-c:v",
      "ffv1",
      "-pix_fmt",
      "bgr0",
      tall,
    );
    const r = await scanVideo({ file: tall, out: join(dir, "sar-half") });
    const px = decodePngPixels(readFileSync(join(dir, "sar-half", r.manifest.frames[0]!.file)));
    assert.deepEqual([px.width, px.height], [64, 64]);
    assert.equal(px.data[0], 255, "the 1px white column is still white, not averaged away");
    const full = join(dir, "sar-full.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x32:r=10:d=0.3,drawbox=x=32:y=0:w=32:h=32:c=white:t=fill",
      "-vf",
      "scale=out_range=pc:out_color_matrix=bt709,format=yuv420p,setsar=2",
      "-color_range",
      "pc",
      "-colorspace",
      "bt709",
      "-c:v",
      "ffv1",
      full,
    );
    const f = await scanVideo({ file: full, out: join(dir, "sar-full") });
    const fp = decodePngPixels(readFileSync(join(dir, "sar-full", f.manifest.frames[0]!.file)));
    assert.deepEqual([fp.data[0], fp.data[(fp.width - 1) * 3]], [0, 255], "black 0 and white 255, not 16 and 235");
  });

  test("the default output keeps the recording's extension, and bare names are found on PATH, not in the working directory", async () => {
    assert.ok(defaultFramesDir(join(dir, "clip.mp4")).endsWith("clip.mp4.frames"));
    assert.notEqual(defaultFramesDir("clip.mp4"), defaultFramesDir("clip.webm"));
    const bin = join(dir, "pathbin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "ffmpeg.exe"), "");
    assert.equal(onPath("ffmpeg", { PATH: `.;${bin}` }, "win32"), join(bin, "ffmpeg.exe"));
    assert.equal(onPath("ffmpeg", { PATH: "." }, "linux"), null, "the working directory is never searched");
    // Windows: a quoted entry is unquoted; an npm shim (no extension) and a .cmd are not what a
    // spawn without a shell runs, so the search goes on to the .exe.
    const shim = join(dir, "pathshim");
    mkdirSync(shim, { recursive: true });
    writeFileSync(join(shim, "ffmpeg"), "");
    writeFileSync(join(shim, "ffmpeg.cmd"), "");
    assert.equal(onPath("ffmpeg", { Path: `${shim};"${bin}"` }, "win32"), join(bin, "ffmpeg.exe"));
    // POSIX: `./`, `./.` and relative entries are the working directory; a file that is not
    // executable is skipped, as execvp skips it.
    const posix = join(dir, "pathposix");
    const plain = join(dir, "pathplain");
    mkdirSync(posix, { recursive: true });
    mkdirSync(plain, { recursive: true });
    writeFileSync(join(posix, "ffmpeg"), "#!/bin/sh\n");
    chmodSync(join(posix, "ffmpeg"), 0o755);
    writeFileSync(join(plain, "ffmpeg"), "notes\n");
    chmodSync(join(plain, "ffmpeg"), 0o644);
    for (const rel of ["./", "./.", "bin"]) {
      assert.equal(onPath("ffmpeg", { PATH: `${rel}:${posix}` }, "linux"), join(posix, "ffmpeg"), rel);
    }
    assert.equal(onPath("ffmpeg", { PATH: `${plain}:${posix}` }, "linux"), join(posix, "ffmpeg"));
  });
});

/** The CRC a PNG chunk carries: over its type and data. */
function pngCrc(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** A PNG chunk, with its length and CRC. */
function pngChunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(pngCrc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const level = (width: number, height: number, v: number) => ({
  width,
  height,
  data: new Uint8Array(width * height * 4).map((_, i) => (i % 4 === 3 ? 255 : v)),
});

/** The centre pixel's red channel of a written frame. */
const centre = (png: string): number => {
  const px = decodePngPixels(readFileSync(png));
  return px.data[((px.height >> 1) * px.width + (px.width >> 1)) * px.channels]!;
};

describe("scanVideo: what the second review found, held", () => {
  test("decodeErrors: by level, from the input's side — never the metadata, never the PNG writer", () => {
    assert.deepEqual(
      decodeErrors([
        "[info] Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'file:/rec/corrupt-cases/clean.mp4':",
        "[info]     title           : Truncated ending (director's cut)",
        "[matroska,webm @ 0x55d7] [error] File ended prematurely",
        "[hevc @ 0x5575] [error] The cu_qp_delta 80 is outside the valid range [-26, 25].",
        "[hevc @ 0x5575] [warning] Error parsing NAL unit #0.",
        "[png @ 0x1] [error] something about the output",
        "[showinfo@frames @ 0x2] [info] n: 0 pts: 0 s:64x48",
      ]),
      ["matroska,webm: File ended prematurely", "hevc: The cu_qp_delta 80 is outside the valid range [-26, 25]."],
    );
  });

  test("a truncated WebM keeps the demuxer's error; a clean file named and titled like damage has none", async () => {
    const whole = join(dir, "r2-whole.webm");
    ffmpeg("-f", "lavfi", "-i", "testsrc2=s=160x120:r=25:d=2", "-c:v", "libvpx-vp9", "-b:v", "300k", whole);
    const cut = join(dir, "r2-cut.webm");
    const bytes = readFileSync(whole);
    writeFileSync(cut, bytes.subarray(0, bytes.length >> 1));
    const truncated = await scanVideo({ file: cut, out: join(dir, "r2-cut.frames") });
    assert.ok(
      truncated.manifest.source.video!.decodeErrors?.some((l) => /File ended prematurely/.test(l)),
      JSON.stringify(truncated.manifest.source.video!.decodeErrors),
    );
    assert.ok(
      truncated.manifest.source.video!.notes?.some((n) => /says it runs to 2s .* may be cut short/.test(n)),
      JSON.stringify(truncated.manifest.source.video!.notes),
    );
    mkdirSync(join(dir, "corrupt-cases"), { recursive: true });
    const clean = join(dir, "corrupt-cases", "truncated-end-of-file.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "testsrc2=s=64x48:r=25:d=0.4",
      "-c:v",
      "libx264",
      "-metadata",
      "title=Truncated ending (director's cut), corrupt partial file",
      clean,
    );
    const ok = await scanVideo({ file: clean, out: join(dir, "r2-clean.frames") });
    assert.equal(ok.manifest.source.video!.decodeErrors, undefined);
  });

  test("the signal listeners are there only while a decoder runs", async () => {
    const before = SIGNALS.map((s) => process.listenerCount(s));
    await scanVideo({ file: numbered("r2-sig.mp4", { frames: 3 }), out: join(dir, "r2-sig.frames") });
    assert.deepEqual(
      SIGNALS.map((s) => process.listenerCount(s)),
      before,
    );
  });

  test("the output directory: a file there is refused before decoding; another live scan's lock is refused, a dead one's taken over", async () => {
    const rec = numbered("r2-out.mp4", { frames: 3 });
    const file = join(dir, "r2-a-file");
    writeFileSync(file, "x");
    await assert.rejects(
      scanVideo({ file: rec, out: file, ffmpeg: join(dir, "no-such-ffmpeg") }),
      /r2-a-file is a file/,
      "checked before the decoder is even looked for",
    );
    await assert.rejects(scanVideo({ file: rec, out: join(file, "x") }), /is a file/);
    const out = join(dir, "r2-locked");
    mkdirSync(out, { recursive: true });
    const id = processIdentity();
    writeFileSync(join(out, ".scan-video.lock"), JSON.stringify({ pid: process.ppid, id }));
    await assert.rejects(scanVideo({ file: rec, out }), /another scan \(pid \d+\) is writing into/);
    // Another host or PID namespace: its pid cannot be judged from here, so it is never taken as gone.
    writeFileSync(join(out, ".scan-video.lock"), JSON.stringify({ pid: 999999999, id: "00000000" }));
    await assert.rejects(scanVideo({ file: rec, out }), /another host or container may be writing/);
    writeFileSync(join(out, ".scan-video.lock"), JSON.stringify({ pid: 999999999, id }));
    mkdirSync(join(out, ".scan-video-stale"), { recursive: true });
    await scanVideo({ file: rec, out });
    assert.deepEqual(readdirSync(out).sort(), [
      "0000-t000000.png",
      "0001-t000033.png",
      "0002-t000067.png",
      "frames.json",
    ]);
  });

  test("an import never writes over a sequence it did not write", async () => {
    const held = join(dir, "r2-held");
    mkdirSync(held, { recursive: true });
    writeFileSync(join(held, "0000-t000000.png"), encodeApng([level(4, 4, 0)]));
    writeFileSync(
      join(held, "frames.json"),
      JSON.stringify({ format: "vlmkit-frames/1", source: { tool: "check flash" }, frames: [] }),
    );
    await assert.rejects(importFrames({ dir: held, fps: 60 }), /already holds a sequence \(check flash\)/);
    const decoded = join(dir, "r2-decoded");
    await scanVideo({ file: numbered("r2-dec.mp4", { frames: 3 }), out: decoded });
    await assert.rejects(importFrames({ dir: decoded, fps: 30 }), /a recording scan video decoded/);
  });

  test("a GIF ffmpeg composites otherwise than a browser is refused, with how to write it as a browser shows it", async () => {
    const palette = [
      [0, 0, 0],
      [255, 255, 255],
    ] as const;
    const disposed = join(dir, "r2-disposed.gif");
    writeFileSync(
      disposed,
      encodeGif({
        width: 40,
        height: 40,
        palette,
        loop: 0,
        frames: [
          { pixels: 0, disposal: 2 },
          { pixels: 1, width: 1, height: 1 },
        ],
      }),
    );
    await assert.rejects(
      scanVideo({ file: disposed, out: join(dir, "r2-disposed.frames") }),
      /disposed to background with no transparent colour.*magick .* -coalesce -background white -alpha remove/s,
    );
    const first = join(dir, "r2-first.gif");
    writeFileSync(
      first,
      encodeGif({
        width: 40,
        height: 40,
        palette,
        loop: 0,
        frames: [{ pixels: 1, width: 4, height: 4 }, { pixels: 1 }],
      }),
    );
    await assert.rejects(
      scanVideo({ file: first, out: join(dir, "r2-first.frames") }),
      /does not cover the 40x40 logical screen/,
    );
    // Its aspect byte is not applied: a browser lays a GIF out at its pixel size.
    const aspect = join(dir, "r2-aspect.gif");
    writeFileSync(
      aspect,
      encodeGif({ width: 40, height: 30, palette, loop: 0, aspectByte: 113, frames: [{ pixels: 0 }, { pixels: 1 }] }),
    );
    const scanned = await scanVideo({ file: aspect, out: join(dir, "r2-aspect.frames") });
    assert.deepEqual(scanned.manifest.source.viewport, { width: 40, height: 30 });
    assert.equal(scanned.manifest.source.video!.sampleAspect, undefined);
    // A span with no end on a forever loop runs a pass and a second past its start.
    const open = await scanVideo({
      file: aspect,
      out: join(dir, "r2-open.frames"),
      selection: { kind: "span", fromMs: 500 },
    });
    const selection = open.manifest.source.video!.selection;
    assert.equal(selection.kind === "span" && selection.toMs, 500 + 200 + 1000);
    assert.equal(open.manifest.frames[0]!.atMs, 500);
    assert.equal(open.manifest.frames[open.manifest.frames.length - 1]!.atMs, 1700);
  });

  test("an APNG named .png is sniffed by its acTL, however large its first frame or what comes before", async () => {
    // A noisy 800x800 first frame deflates to more than 1 MiB, so the second fcTL is past it.
    let seed = 7;
    const noise = {
      width: 800,
      height: 800,
      data: new Uint8Array(800 * 800 * 4).map((_, i) =>
        i % 4 === 3 ? 255 : (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 24,
      ),
    };
    const big = join(dir, "r2-big.png");
    writeFileSync(big, encodeApng([noise, level(800, 800, 0)], { delaysMs: [100, 100], loops: 0 }));
    assert.ok(readFileSync(big).indexOf(Buffer.from("fcTL", "latin1"), 1 << 20) > 0, "the second fcTL is past 1 MiB");
    assert.ok(isVideoFile(big));
    assert.equal(apngDeclaredFrames(big), 2);
    // A large text chunk before acTL.
    const small = Buffer.from(encodeApng([level(4, 4, 0), level(4, 4, 255)], { loops: 0 }));
    const text = pngChunk("tEXt", new Uint8Array(1_100_000).fill(0x61));
    const withText = join(dir, "r2-text.png");
    writeFileSync(withText, Buffer.concat([small.subarray(0, 33), text, small.subarray(33)]));
    assert.ok(isVideoFile(withText));
    const still = join(dir, "r2-still.png");
    writeFileSync(still, encodeApng([level(4, 4, 0)]));
    assert.equal(isVideoFile(still), false);
    // acTL declaring fewer frames than it holds: a browser plays the declared ones.
    const three = Buffer.from(
      encodeApng([level(8, 8, 0), level(8, 8, 255), level(8, 8, 128)], { delaysMs: [100, 100, 3000], loops: 0 }),
    );
    const actl = three.indexOf(Buffer.from("acTL", "latin1"));
    three.writeUInt32BE(2, actl + 4);
    three.writeUInt32BE(pngCrc(three.subarray(actl, actl + 12)), actl + 12);
    const declared = join(dir, "r2-declared.apng");
    writeFileSync(declared, three);
    const two = await scanVideo({ file: declared, out: join(dir, "r2-declared.frames") });
    assert.equal(two.manifest.source.video!.loop!.passMs, 200);
    assert.ok(two.manifest.frames.every((f) => centre(join(dir, "r2-declared.frames", f.file)) !== 128));
    assert.ok(two.manifest.source.video!.notes?.some((n) => /acTL declares 2 of the 3/.test(n)));
  });

  test("interlaced with non-square pixels: the line-doubling's doubled SAR is undone", async () => {
    const dv = join(dir, "r2-sd-il.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "testsrc2=s=720x480:r=30000/1001:d=0.2,setsar=8/9,setfield=tff",
      "-c:v",
      "libx264",
      "-flags",
      "+ilme+ildct",
      "-x264opts",
      "tff=1",
      dv,
    );
    const r = await scanVideo({ file: dv, out: join(dir, "r2-sd-il.frames") });
    assert.equal(r.manifest.source.video!.fields, true);
    assert.deepEqual(r.manifest.source.viewport, { width: 720, height: 540 });
  });

  test("fields are split frame by frame, by each frame's own flag, not the stream's tag", async () => {
    // 2s progressive grey, then 2s of an interlaced 50-field black/white strobe, in one mkv.
    const a = join(dir, "r2-segA.ts");
    const b = join(dir, "r2-segB.ts");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=gray:s=64x48:r=25:d=1",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-pix_fmt",
      "yuv444p",
      "-bf",
      "0",
      a,
    );
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=50:d=1,geq=lum='16+219*mod(N\\,2)':cb=128:cr=128,tinterlace=mode=interleave_top,setfield=tff",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-pix_fmt",
      "yuv444p",
      "-bf",
      "0",
      "-flags",
      "+ilme+ildct",
      "-x264opts",
      "tff=1",
      "-output_ts_offset",
      "1",
      b,
    );
    const ts = join(dir, "r2-mixed.ts");
    writeFileSync(ts, Buffer.concat([readFileSync(a), readFileSync(b)]));
    const mixed = join(dir, "r2-mixed.mkv");
    ffmpeg("-i", ts, "-c", "copy", mixed);
    const out = join(dir, "r2-mixed.frames");
    const r = await scanVideo({ file: mixed, out });
    const frames = r.manifest.frames;
    // 25 progressive frames, one row each; 25 interlaced ones, two rows each.
    assert.equal(frames.length, 25 + 50);
    assert.ok(r.manifest.source.video!.notes?.some((n) => /25 of 50 frames flagged interlaced/.test(n)));
    const levels = frames.slice(25, 35).map((f) => centre(join(out, f.file)));
    assert.deepEqual(levels, [0, 255, 0, 255, 0, 255, 0, 255, 0, 255], "the strobe is at field rate");
    // A field-order tag over frames coded progressive: 1px stripes stay still, not a field-rate strobe.
    const stripes = join(dir, "r2-stripes-tagged.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=25:d=0.4,geq=lum='16+219*mod(Y\\,2)':cb=128:cr=128",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-pix_fmt",
      "yuv444p",
      "-field_order",
      "tt",
      stripes,
    );
    const tagged = await scanVideo({ file: stripes, out: join(dir, "r2-stripes.frames") });
    assert.equal(tagged.manifest.source.video!.fields, undefined);
    assert.equal(tagged.manifest.frames.length, 10);
    assert.ok(
      tagged.manifest.source.video!.notes?.some((n) =>
        /tagged tt, but h264 decodes every frame as progressive/.test(n),
      ),
    );
  });

  test("interlaced and turned: split first, then turned, so a field-rate strobe survives a quarter turn", async () => {
    const strobe = join(dir, "r2-il-strobe.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=50:d=0.4,geq=lum='16+219*mod(N\\,2)':cb=128:cr=128,tinterlace=mode=interleave_top,setfield=tff",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-pix_fmt",
      "yuv444p",
      "-flags",
      "+ilme+ildct",
      "-x264opts",
      "tff=1",
      strobe,
    );
    const turned = join(dir, "r2-il-strobe-90.mp4");
    ffmpeg("-display_rotation", "90", "-i", strobe, "-c", "copy", turned);
    const out = join(dir, "r2-il-90.frames");
    const r = await scanVideo({ file: turned, out });
    assert.deepEqual(r.manifest.source.viewport, { width: 48, height: 64 });
    const levels = r.manifest.frames.slice(0, 6).map((f) => centre(join(out, f.file)));
    assert.deepEqual(levels, [0, 255, 0, 255, 0, 255]);
  });

  test("a YUV codec's grey frames are limited-range luma, expanded as a player expands them", async () => {
    const mono = join(dir, "r2-mono.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=16x16:r=10:d=0.2,format=gray,geq=lum='if(mod(N\\,2)\\,235\\,16)'",
      "-c:v",
      "libx265",
      "-pix_fmt",
      "gray",
      "-x265-params",
      "lossless=1:log-level=error",
      "-color_range",
      "tv",
      mono,
    );
    const out = join(dir, "r2-mono.frames");
    const r = await scanVideo({ file: mono, out });
    assert.deepEqual(
      r.manifest.frames.map((f) => centre(join(out, f.file))),
      [0, 255],
    );
    assert.equal(r.manifest.source.video!.color!.matrix, "gray");
    const full = await scanVideo({ file: mono, out: join(dir, "r2-mono-pc.frames"), colorRange: "pc" });
    assert.deepEqual(
      full.manifest.frames.map((f) => centre(join(dir, "r2-mono-pc.frames", f.file))),
      [16, 235],
    );
  });
});

const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

describe("scanVideo: what the third look found, held", () => {
  const levelsOf = (out: string, frames: { file: string }[]) => frames.map((f) => centre(join(out, f.file)));

  test("an APNG with metadata before its first frame is read as one (ffmpeg's probe would read one still)", async () => {
    const apng = Buffer.from(encodeApng([level(64, 48, 255), level(64, 48, 0)], { delaysMs: [100, 100], loops: 0 }));
    const actl = apng.indexOf(Buffer.from("acTL", "latin1")) - 4;
    const after = actl + 12 + 8;
    const xmp = pngChunk("iTXt", new Uint8Array(3000).fill(0x20));
    const file = join(dir, "r3-meta.png");
    writeFileSync(file, Buffer.concat([apng.subarray(0, after), xmp, apng.subarray(after)]));
    const r = await scanVideo({ file, out: join(dir, "r3-meta.frames") });
    assert.equal(r.stream.codec, "apng");
    assert.ok(r.manifest.frames.length > 2, `${r.manifest.frames.length} frames`);
    assert.deepEqual(levelsOf(join(dir, "r3-meta.frames"), r.manifest.frames.slice(0, 2)), [255, 0]);
  });

  test("an import of one pass of a loop (--loop) is repeated as a browser repeats it", async () => {
    const frames = join(dir, "r3-loop");
    mkdirSync(frames, { recursive: true });
    writeFileSync(join(frames, "000000.png"), encodeApng([level(8, 8, 0)]));
    writeFileSync(join(frames, "000001.png"), encodeApng([level(8, 8, 255)]));
    // Two frames of 100ms, then the pass's end.
    writeFileSync(join(frames, "pts.txt"), "0.000\n0.100\n0.200\n");
    const r = await importFrames({
      dir: frames,
      pts: join(frames, "pts.txt"),
      lossless: true,
      everyFrame: true,
      loop: null,
    });
    assert.deepEqual(r.manifest.source.video!.loop, { plays: null, passFrames: 2, passMs: 200, passes: 7 });
    assert.equal(r.manifest.frames.length, 14);
    assert.equal(r.manifest.frames[13]!.atMs, 1300);
    assert.equal(r.manifest.source.video!.streamFrames, 14);
    const twice = await importFrames({ dir: frames, pts: join(frames, "pts.txt"), loop: 2 });
    assert.equal(twice.manifest.frames.length, 4);
    writeFileSync(join(frames, "short.txt"), "0\n0.1\n");
    await assert.rejects(
      importFrames({ dir: frames, pts: join(frames, "short.txt"), loop: null }),
      /then the end of the pass/,
    );
  });

  test("fields split by the stream's tag are in the tag's order, not the codec's unflagged bottom-first", async () => {
    // 50 fields at rising luma, woven top field first, stored in a codec that flags nothing.
    const src = join(dir, "r3-ramp.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=50:d=0.4,format=yuv444p,geq=lum='16+10*N':cb=128:cr=128,tinterlace=mode=interleave_top",
      "-c:v",
      "utvideo",
      "-field_order",
      "tt",
      src,
    );
    const out = join(dir, "r3-ramp.frames");
    const r = await scanVideo({ file: src, out });
    assert.equal(r.manifest.source.video!.fields, true);
    const levels = levelsOf(out, r.manifest.frames);
    assert.ok(
      levels.every((v, i) => i === 0 || v > levels[i - 1]!),
      `rising, field by field: ${levels.join(" ")}`,
    );
  });

  test("grey keeps its range into the conversion: full stays full, limited is expanded, an override is applied", async () => {
    const make = (name: string, range: string) => {
      const f = join(dir, name);
      ffmpeg(
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=16x16:r=10:d=0.2,format=gray,geq=lum='if(mod(N\\,2)\\,172\\,150)'",
        "-c:v",
        "libx265",
        "-pix_fmt",
        "gray",
        "-x265-params",
        "lossless=1:log-level=error",
        "-color_range",
        range,
        f,
      );
      return f;
    };
    const pc = make("r3-grey-pc.mp4", "pc");
    const out = join(dir, "r3-grey-pc.frames");
    assert.deepEqual(levelsOf(out, (await scanVideo({ file: pc, out })).manifest.frames), [150, 172]);
    const told = join(dir, "r3-grey-pc-tv.frames");
    assert.deepEqual(
      levelsOf(told, (await scanVideo({ file: pc, out: told, colorRange: "tv" })).manifest.frames),
      [156, 182],
    );
    // A lossless ffv1 copy of a limited grey stream keeps the tag, and is expanded as the original is.
    const tv = make("r3-grey-tv.mp4", "tv");
    const copy = join(dir, "r3-grey-tv.mkv");
    ffmpeg("-i", tv, "-c:v", "ffv1", copy);
    const outCopy = join(dir, "r3-grey-ffv1.frames");
    assert.deepEqual(levelsOf(outCopy, (await scanVideo({ file: copy, out: outCopy })).manifest.frames), [156, 182]);
  });

  test("HEVC field pictures are line-doubled as one field each, never split again", async () => {
    const file = join(dir, "r3-hevc-fields.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=gray:s=64x48:r=25:d=0.4,format=yuv420p,setfield=tff,separatefields",
      "-c:v",
      "libx265",
      "-x265-params",
      "interlace=tff:qp=0:log-level=error",
      file,
    );
    const r = await scanVideo({ file, out: join(dir, "r3-hevc.frames") });
    assert.equal(r.manifest.source.video!.fields, undefined);
    assert.deepEqual(r.manifest.source.viewport, { width: 64, height: 48 });
    assert.equal(r.manifest.frames.length, 20, "one row per field picture, at the field rate");
    assert.ok(r.manifest.source.video!.notes?.some((n) => /HEVC field pictures/.test(n)));
  });

  test("FFV1 v3 frames say progressive under a tt tag: not split", async () => {
    const file = join(dir, "r3-ffv1-tt.mkv");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=25:d=0.4,geq=lum='16+219*mod(Y\\,2)':cb=128:cr=128",
      "-c:v",
      "ffv1",
      "-level",
      "3",
      "-field_order",
      "tt",
      file,
    );
    const r = await scanVideo({ file, out: join(dir, "r3-ffv1-tt.frames") });
    assert.equal(r.manifest.source.video!.fields, undefined);
    assert.equal(r.manifest.frames.length, 10);
  });

  test("a packet the demuxer drops (said only as a warning) marks the recording damaged", async () => {
    const file = join(dir, "r3-blips.ts");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x48:r=25:d=2,format=yuv420p",
      "-vf",
      "geq=lum='if(eq(N\\,26)+eq(N\\,30)+eq(N\\,34)+eq(N\\,38)\\,235\\,16)':cb=128:cr=128",
      "-c:v",
      "mpeg2video",
      "-g",
      "1",
      "-q:v",
      "2",
      file,
    );
    // Drop the transport packets of the video PES that starts 30th, up to the next one.
    const ts = readFileSync(file);
    const keep: Buffer[] = [];
    let starts = -1;
    for (let at = 0; at + 188 <= ts.length; at += 188) {
      const pid = ((ts[at + 1]! & 0x1f) << 8) | ts[at + 2]!;
      if (pid === 0x100 && ts[at + 1]! & 0x40) starts++;
      if (pid === 0x100 && starts === 30) continue;
      keep.push(ts.subarray(at, at + 188));
    }
    const dropped = join(dir, "r3-blips-drop.ts");
    writeFileSync(dropped, Buffer.concat(keep));
    const clean = await scanVideo({ file, out: join(dir, "r3-blips.frames") });
    assert.equal(clean.manifest.source.video!.damaged, undefined);
    const r = await scanVideo({ file: dropped, out: join(dir, "r3-blips-drop.frames") });
    assert.equal(r.manifest.frames.length, clean.manifest.frames.length - 1);
    assert.equal(r.manifest.source.video!.damaged, true, JSON.stringify(r.manifest.source.video!.decodeErrors));
  });

  test("two scans into one directory in one process: the second is refused, the first finishes", async () => {
    const out = join(dir, "r3-same");
    const a = scanVideo({ file: numbered("r3-same-a.mp4", { frames: 20 }), out });
    const b = scanVideo({ file: numbered("r3-same-b.mp4", { frames: 3 }), out });
    const [ra, rb] = await Promise.allSettled([a, b]);
    const outcomes = [ra.status, rb.status].sort();
    assert.deepEqual(outcomes, ["fulfilled", "rejected"]);
    const refused = (ra.status === "rejected" ? ra : rb) as PromiseRejectedResult;
    assert.match(String(refused.reason), /another scan in this process is writing into/);
  });

  test("a GIF that plays a finite number of times keeps its last frame on screen: a span after it is in the recording", async () => {
    const file = join(dir, "r3-once.gif");
    writeFileSync(
      file,
      encodeGif({
        width: 16,
        height: 16,
        palette: [
          [0, 0, 0],
          [255, 255, 255],
        ],
        frames: [{ pixels: 0 }, { pixels: 1 }],
      }),
    );
    const r = await scanVideo({ file, out: join(dir, "r3-once.frames"), selection: { kind: "span", fromMs: 2500 } });
    assert.equal(r.manifest.frames[r.manifest.frames.length - 1]!.atMs, 100);
  });
});
