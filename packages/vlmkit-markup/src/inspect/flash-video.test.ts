/**
 * `check flash` on a recording, decoded with the user's own ffmpeg: known answers by
 * construction (a strobe's rate, a still picture), and the same report whether the recording is
 * judged directly or through `scan video` and its `frames.json`.
 *
 * Needs ffmpeg and ffprobe on PATH (vlmkit ships no decoder); CI installs them.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { scanVideo } from "@mizchi/vlmkit-core/video-decode.ts";
import { runFlashCheck, type FlashReport } from "./flash-check.ts";

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
    const direct = await runFlashCheck({
      source: file,
      video: { selection: { kind: "span", fromMs: 200, toMs: 1400 } },
    });
    const scanned = await scanVideo({
      file,
      out: join(dir, "same"),
      selection: { kind: "span", fromMs: 200, toMs: 1400 },
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

  test("page-only flags are refused for a recording, recording flags for a page", async () => {
    await assert.rejects(
      runFlashCheck({ source: join(dir, "fast.mp4"), windowMs: 3000 }),
      /judged over its own frames/,
    );
    await assert.rejects(runFlashCheck({ source: "page.html", video: { displayWidth: 100 } }), /are for a recording/);
  });
});
