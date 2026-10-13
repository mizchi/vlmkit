/**
 * `check flash` on a recording, decoded with the user's own ffmpeg: known answers by
 * construction (a strobe's rate, a still picture), and the same report whether the recording is
 * judged directly or through `scan video` and its `frames.json`.
 *
 * Needs ffmpeg and ffprobe on PATH (vlmkit ships no decoder); CI installs them.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { scanVideo } from "@mizchi/vlmkit-core/video-decode.ts";
import { chromaSubsampled, runFlashCheck, SPAN_HISTORY_MS, type FlashReport } from "./flash-check.ts";

let dir: string;

beforeAll(() => {
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" });
  } catch {
    throw new Error("these tests decode with ffmpeg and ffprobe on PATH (vlmkit ships no decoder): apt install ffmpeg");
  }
  dir = mkdtempSync(join(tmpdir(), "vlmkit-flash-video-test-"));
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/**
 * A full-frame strobe between two colours, `hz` cycles a second (2 transitions per cycle), `fps`
 * frames a second, `seconds` long, encoded with `codec`.
 */
function strobe(
  name: string,
  opts: { hz: number; fps: number; seconds?: number; on?: string; off?: string; codec?: string[]; size?: string },
): string {
  const path = join(dir, name);
  const seconds = opts.seconds ?? 2;
  const size = opts.size ?? "320x240";
  // Whole frames per half cycle, so every cycle has the same shape.
  const half = Math.round(opts.fps / (2 * opts.hz));
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${opts.off ?? "black"}:s=${size}:r=${opts.fps}:d=${seconds}`,
    "-f",
    "lavfi",
    "-i",
    `color=c=${opts.on ?? "white"}:s=${size}:r=${opts.fps}:d=${seconds}`,
    "-filter_complex",
    `[0][1]blend=all_expr='if(lt(mod(N\\,${2 * half})\\,${half})\\,B\\,A)',format=yuv420p`,
    ...(opts.codec ?? ["-c:v", "libx264", "-crf", "18"]),
    path,
  ]);
  return path;
}

const verdicts = (r: FlashReport) => [r.general.verdict, r.red.verdict];

describe("check flash on a recording", () => {
  test("a 5 Hz full-frame strobe fails; at 1.5 Hz it passes, judged on every recorded frame", async () => {
    const fast = await runFlashCheck({ source: strobe("fast.mp4", { hz: 5, fps: 30 }) });
    assert.equal(fast.source.kind, "video");
    assert.equal(fast.source.clock, "stream");
    assert.equal(fast.general.verdict, "fail");
    assert.equal(fast.general.classification, "flash");
    assert.equal(fast.sampling.complete, true);
    assert.equal(fast.sampling.frames, 60);
    assert.equal(fast.source.video?.codec, "h264");

    const slow = await runFlashCheck({ source: strobe("slow.mp4", { hz: 1.5, fps: 30 }) });
    assert.deepEqual(verdicts(slow), ["pass", "pass"]);
    assert.equal(slow.sampling.complete, true, "every frame of the recording: a pass that means something");
  });

  test("a recording at 6 fps cannot show more than six transitions in a second: a real pass, not unjudgeable", async () => {
    const r = await runFlashCheck({ source: strobe("six.mp4", { hz: 3, fps: 6 }) });
    assert.equal(r.sampling.judgeable, true);
    assert.deepEqual(verdicts(r), ["pass", "pass"]);
  });

  test("a saturated red/black strobe fails the red track", async () => {
    const r = await runFlashCheck({ source: strobe("red.mp4", { hz: 5, fps: 30, on: "red" }) });
    assert.equal(r.red.verdict, "fail");
  });

  test("a still picture passes with nothing flashing", async () => {
    const r = await runFlashCheck({ source: strobe("still.mp4", { hz: 1, fps: 30, on: "black" }) });
    assert.deepEqual(verdicts(r), ["pass", "pass"]);
    assert.equal(r.general.peakTransitions, 0);
  });

  test("the area is in CSS px: --display-width shrinks a small strobe under the limit", async () => {
    // 160x120 = 19,200 px² at one frame pixel per CSS px... at 2x it is 76,800 CSS px².
    const file = strobe("small.mp4", { hz: 5, fps: 30, size: "160x120" });
    const native = await runFlashCheck({ source: file });
    assert.deepEqual(verdicts(native)[0], "pass", "19,200 CSS px², under 21,824");
    const shownLarger = await runFlashCheck({ source: file, video: { displayWidth: 320 } });
    assert.equal(shownLarger.general.verdict, "fail", "played at 320px wide it is 76,800 CSS px²");
    assert.equal(shownLarger.source.cssPerPx, 0.5);
  });

  test("judging the recording is judging scan video's frames.json", async () => {
    const file = strobe("same.mp4", { hz: 5, fps: 25, seconds: 1.6 });
    // A span through check flash is decoded with the seconds before it, so scan video is asked the same.
    const span = { kind: "span" as const, fromMs: 1200, toMs: 1500 };
    const direct = await runFlashCheck({ source: file, video: { selection: span } });
    const scanned = await scanVideo({
      file,
      out: join(dir, "same"),
      selection: { ...span, leadInMs: SPAN_HISTORY_MS },
    });
    const again = await runFlashCheck({ source: scanned.manifestPath });
    const strip = (r: FlashReport) => ({
      ...r,
      source: { ...r.source, kind: undefined, path: undefined, manifest: undefined },
      timingMs: undefined,
      framesManifest: undefined,
    });
    assert.deepEqual(strip(direct), strip(again));
  });

  test("an untagged stream is read as BT.601 unless told otherwise: the matrix decides a green strobe", async () => {
    // #00ff00 / #00d700 at 5 Hz, encoded as BT.709 with no tags (measured: read as BT.601 the green
    // clips and ΔL falls from 0.229 to 0.019, so the same file passes).
    const file = join(dir, "green709.webm");
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x00d700:s=160x160:r=10:d=2",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x00ff00:s=160x160:r=10:d=2",
      "-filter_complex",
      "[0][1]blend=all_expr='if(lt(mod(N\\,2)\\,1)\\,B\\,A)',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
      "-c:v",
      "libvpx-vp9",
      "-lossless",
      "1",
      file,
    ]);
    const assumed = await runFlashCheck({ source: file, video: { displayWidth: 320 } });
    // VP9 always carries its range bit, so only the matrix is assumed.
    assert.deepEqual(assumed.source.video?.color?.assumed, ["matrix"]);
    assert.equal(assumed.general.verdict, "pass");
    const told = await runFlashCheck({ source: file, video: { displayWidth: 320, colorMatrix: "bt709" } });
    assert.equal(told.source.video?.color?.matrix, "bt709");
    assert.deepEqual(told.source.video?.color?.assumed, []);
    assert.equal(told.general.verdict, "fail");
  });

  test("a two-frame GIF that loops forever flashes; played once it does not", async () => {
    // One decoded pass is one transition; a browser loops it at 100ms a frame, five flashes a second.
    const gif = (name: string, loop: number) => {
      const path = join(dir, name);
      execFileSync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=320x240:r=10:d=0.1[a];color=c=white:s=320x240:r=10:d=0.1[b];[a][b]concat=n=2:v=1",
        "-loop",
        String(loop),
        path,
      ]);
      return path;
    };
    const looping = await runFlashCheck({ source: gif("loop.gif", 0) });
    assert.equal(looping.source.video?.timing, "browser");
    assert.equal(looping.general.verdict, "fail");
    const once = await runFlashCheck({ source: gif("once.gif", -1) });
    assert.deepEqual(verdicts(once), ["pass", "pass"]);
  });

  test("an interlaced recording strobing at field rate fails: its fields are judged, not the woven frames", async () => {
    const file = join(dir, "fields.mp4");
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:r=50:d=1.5,geq=lum='255*mod(N\\,2)':cb=128:cr=128,tinterlace=mode=interleave_top,setfield=tff",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-flags",
      "+ilme+ildct",
      "-x264opts",
      "tff=1",
      file,
    ]);
    const r = await runFlashCheck({ source: file });
    assert.equal(r.source.video?.fields, true);
    assert.equal(r.general.verdict, "fail");
  });

  test("a lossy red box just over the limit still fails red, and says it is not decisive", async () => {
    // 148x148 red / black at 5 Hz, crf 35: black decodes as (1,0,0)-ish, red's own chromaticity.
    // Before near-black was black, the red track measured 16,385 CSS px² and passed.
    const file = join(dir, "red148.mp4");
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=640x360:r=30:d=2,format=rgb24,drawbox=x=100:y=100:w=148:h=148:color=red:t=fill:enable='lt(mod(n\\,6)\\,3)'",
      "-c:v",
      "libx264",
      "-crf",
      "35",
      "-g",
      "30",
      "-pix_fmt",
      "yuv420p",
      file,
    ]);
    const r = await runFlashCheck({ source: file });
    assert.equal(r.red.verdict, "fail");
    assert.ok(
      r.lossy?.some((n) => n.startsWith("red:") && /not decisive/.test(n)),
      `lossy notes: ${JSON.stringify(r.lossy)}`,
    );
  });

  test("a span is judged with the second before it: a strobe inside the span fails however short the span", async () => {
    // A 4 flashes/s strobe on screen from 0.5s to 1.5s only, in a 3s recording.
    const file = join(dir, "burst.mkv");
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:r=24:d=3,geq=lum='if(between(N\\,12\\,35)*mod(floor((N-12)/3)+1\\,2)\\,235\\,16)':cb=128:cr=128",
      "-c:v",
      "ffv1",
      file,
    ]);
    assert.equal((await runFlashCheck({ source: file })).general.verdict, "fail");
    // The window ending at --from holds seven of the strobe's eight transitions (0.625s-1.375s),
    // though nothing transitions at 1.55s or 1.6s.
    for (const [fromMs, toMs] of [
      [1000, 3000],
      [1000, 1700],
      [1400, 1400],
      [1550, 3000],
      [1600, 3000],
    ]) {
      const r = await runFlashCheck({ source: file, video: { selection: { kind: "span", fromMs, toMs } } });
      assert.equal(r.general.verdict, "fail", `--from ${fromMs} --to ${toMs}`);
      assert.ok(r.sampling.judgedFromMs !== undefined && r.sampling.judgedFromMs <= fromMs);
    }
    // After the strobe stops, its last window has passed: nothing ends inside a span from 2.6s.
    assert.equal(
      (await runFlashCheck({ source: file, video: { selection: { kind: "span", fromMs: 2600, toMs: 3000 } } })).general
        .verdict,
      "pass",
    );
    // The same span written by scan video without that second is not backed.
    const cut = await scanVideo({
      file,
      out: join(dir, "burst-cut"),
      selection: { kind: "span", fromMs: 2600, toMs: 3000 },
    });
    const partial = await runFlashCheck({ source: cut.manifestPath });
    assert.equal(partial.sampling.complete, false);
    assert.match(partial.sampling.partial ?? "", /no second before them/);
  });

  test("an import is complete only when it says it holds every frame", async () => {
    const file = strobe("thin.mkv", { hz: 7.5, fps: 30, seconds: 3, codec: ["-c:v", "ffv1"] });
    const thin = join(dir, "thin");
    execFileSync("mkdir", ["-p", thin]);
    // Another tool's export at 5 fps: a 15-frame strobe reads as 5 frames a second of nothing.
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      file,
      "-vf",
      "fps=5",
      join(thin, "%06d.png"),
    ]);
    const { importFrames } = await import("@mizchi/vlmkit-core/video-decode.ts");
    const imported = await importFrames({ dir: thin, fps: 5 });
    const r = await runFlashCheck({ source: imported.manifestPath });
    assert.notEqual(r.general.verdict, "pass", "not a pass: nothing vouches that these are all the frames");
    const vouched = await importFrames({ dir: thin, fps: 5, everyFrame: true });
    assert.equal((await runFlashCheck({ source: vouched.manifestPath })).sampling.complete, true);
  });

  test("a frames directory is judged by its frames.json, never as a page", async () => {
    const file = strobe("dir.mp4", { hz: 5, fps: 30 });
    const scanned = await scanVideo({ file });
    const r = await runFlashCheck({ source: join(scanned.manifestPath, "..") });
    assert.equal(r.general.verdict, "fail");
    await assert.rejects(runFlashCheck({ source: dir }), /no frames\.json/);
  });

  test("an animated PNG under its own .png extension is a recording, a still PNG is not", async () => {
    const file = join(dir, "blink.png");
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:r=10:d=0.1[a];color=c=white:s=320x240:r=10:d=0.1[b];[a][b]concat=n=2:v=1",
      "-plays",
      "0",
      "-f",
      "apng",
      file,
    ]);
    const r = await runFlashCheck({ source: file });
    assert.equal(r.source.kind, "video");
    assert.equal(r.general.verdict, "fail");
    const { isVideoFile } = await import("@mizchi/vlmkit-core/video-decode.ts");
    const still = join(dir, "still.png");
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=8x8",
      "-frames:v",
      "1",
      still,
    ]);
    assert.equal(isVideoFile(still), false);
  });

  test("page-only flags are refused for a recording, recording flags for a page", async () => {
    await assert.rejects(
      runFlashCheck({ source: join(dir, "fast.mp4"), windowMs: 3000 }),
      /judged over its own frames/,
    );
    await assert.rejects(runFlashCheck({ source: "page.html", video: { displayWidth: 100 } }), /are for a recording/);
  });

  test("a complete span of a recording under 7 frames a second is a real pass, as the whole recording is", async () => {
    const file = strobe("six.mkv", { hz: 3, fps: 6, seconds: 5, codec: ["-c:v", "ffv1"] });
    assert.deepEqual(verdicts(await runFlashCheck({ source: file })), ["pass", "pass"]);
    const span = await runFlashCheck({
      source: file,
      video: { selection: { kind: "span", fromMs: 2000, toMs: 4000 } },
    });
    assert.equal(span.sampling.complete, true);
    assert.deepEqual(verdicts(span), ["pass", "pass"]);
  });

  test("a span counted from history that misses the recording's start says when one transition decides it", async () => {
    // Six transitions at 4.5s-5.125s of a 7s recording: the window ending at 5.2s holds all six.
    const file = join(dir, "six-transitions.mkv");
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:r=24:d=7,geq=lum='if(between(N\\,108\\,125)*mod(floor((N-108)/3)+1\\,2)\\,235\\,16)':cb=128:cr=128",
      "-c:v",
      "ffv1",
      file,
    ]);
    const r = await runFlashCheck({ source: file, video: { selection: { kind: "span", fromMs: 5200, toMs: 6000 } } });
    assert.equal(r.general.verdict, "pass");
    assert.equal(r.general.peakTransitions, 6);
    assert.match(r.history ?? "", /general: decided by one transition.*3\.000s of history/);
    assert.equal(SPAN_HISTORY_MS, 3000);
    // From the start, the history is the whole recording's: nothing to say.
    const early = await runFlashCheck({
      source: file,
      video: { selection: { kind: "span", fromMs: 2000, toMs: 6000 } },
    });
    assert.equal(early.history, undefined);
  });

  test("a frames directory refuses what only a page sweep reads, as its frames.json does", async () => {
    const scanned = await scanVideo({ file: strobe("dir-flags.mp4", { hz: 1, fps: 30 }) });
    const frames = join(scanned.manifestPath, "..");
    await assert.rejects(runFlashCheck({ source: frames, windowMs: 5000 }), /judged as it was captured/);
    await assert.rejects(runFlashCheck({ source: frames, framesDir: join(dir, "x") }), /judged as it was captured/);
    await assert.rejects(
      runFlashCheck({ source: scanned.manifestPath, video: { displayWidth: 100 } }),
      /judged as it was decoded/,
    );
  });

  test("chroma subsampling is read from the pixel format's layout, not a 4:2:0 prefix", () => {
    for (const f of [
      "yuv420p",
      "yuvj420p",
      "yuv422p10le",
      "yuv411p",
      "yuv440p",
      "yuva420p",
      "nv12",
      "nv21",
      "p010le",
      "yuyv422",
      "uyvy422",
    ]) {
      assert.equal(chromaSubsampled(f), true, f);
    }
    for (const f of ["yuv444p", "yuv444p10le", "gbrp", "rgb24", "bgra", "gray", "pal8", "nv24"]) {
      assert.equal(chromaSubsampled(f), false, f);
    }
  });

  test("an interrupted run's temporary frames are removed by the next one", async () => {
    const stale = join(tmpdir(), "vlmkit-flash-video-999999999-left");
    mkdirSync(join(stale, ".scan-video-x"), { recursive: true });
    await runFlashCheck({ source: strobe("sweep.mp4", { hz: 1, fps: 30, seconds: 1 }) });
    assert.equal(existsSync(stale), false);
  });
});
