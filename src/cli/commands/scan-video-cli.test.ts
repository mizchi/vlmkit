/**
 * `vlmkit scan video`: its arguments, and what the frames it writes are good for downstream —
 * `snapshot storyboard` refuses a lossy recording without `--lossy` and finds planted events in a
 * lossless one, frame for frame.
 *
 * The recording tests need ffmpeg and ffprobe on PATH (vlmkit ships no decoder); CI installs them.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { scanVideo } from "@mizchi/vlmkit-core/video-decode.ts";
import { parseArgs } from "./scan-video-cli.ts";
import { writeStoryboard } from "./storyboard-cli.ts";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "vlmkit-scan-video-cli-"));
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("scan video args", () => {
  test("a recording, a span or instants, and how it plays", () => {
    assert.deepEqual(parseArgs(["rec.mp4"]), {
      source: "rec.mp4",
      selection: { kind: "all" },
      lossless: false,
      everyFrame: false,
      json: false,
    });
    assert.deepEqual(parseArgs(["rec.mp4", "--from", "1.5s", "--to", "00:02.250"]).selection, {
      kind: "span",
      fromMs: 1500,
      toMs: 2250,
    });
    assert.deepEqual(parseArgs(["rec.mp4", "--at", "0..1s/250ms"]).selection, {
      kind: "at",
      atMs: [0, 250, 500, 750, 1000],
    });
    const full = parseArgs([
      "rec.mp4",
      "--out",
      "o",
      "--display-width",
      "1280",
      "--max-frames",
      "100",
      "--stream",
      "2",
      "--color-matrix",
      "bt709",
      "--color-range",
      "pc",
      "--ffmpeg",
      "/opt/ff/ffmpeg",
      "--json",
    ]);
    assert.equal(full.displayWidth, 1280);
    assert.equal(full.maxFrames, 100);
    assert.equal(full.stream, 2);
    assert.equal(full.colorMatrix, "bt709");
    assert.equal(full.colorRange, "pc");
    assert.equal(full.ffmpeg, "/opt/ff/ffmpeg");
    assert.equal(full.json, true);
  });

  test("frames another decoder wrote: a directory with --pts or --fps", () => {
    const frames = join(dir, "frames");
    mkdirSync(frames, { recursive: true });
    assert.equal(parseArgs([frames, "--pts", "p.txt"]).pts, "p.txt");
    assert.equal(parseArgs([frames, "--fps", "30000/1001"]).fps, 30000 / 1001);
    assert.equal(parseArgs([frames, "--fps", "25", "--lossless"]).lossless, true);
    assert.throws(() => parseArgs([frames]), /need --pts <file> or --fps <rate>/);
    assert.throws(() => parseArgs(["rec.mp4", "--pts", "p.txt"]), /go with a directory/);
    assert.throws(() => parseArgs([frames, "--fps", "25", "--from", "1s"]), /is for decoding a recording/);
    assert.throws(() => parseArgs(["rec.mp4", "--lossless"]), /--lossless is for imported frames/);
  });

  test("refuses what it cannot read, naming the flag", () => {
    assert.throws(() => parseArgs([]), /no recording given/);
    assert.throws(() => parseArgs(["a.mp4", "b.mp4"]), /one recording at a time/);
    assert.throws(() => parseArgs(["a.mp4", "--at", "0", "--from", "1s"]), /one or the other/);
    assert.throws(() => parseArgs(["a.mp4", "--from", "2s", "--to", "1s"]), /--to is before --from/);
    assert.throws(() => parseArgs(["a.mp4", "--from", "1s,2s"]), /takes one time/);
    assert.throws(() => parseArgs(["a.mp4", "--max-frames", "10000"]), /at most 9999/);
    assert.throws(() => parseArgs(["a.mp4", "--display-width", "0"]), /--display-width expects/);
    assert.throws(() => parseArgs(["a.mp4", "--color-matrix", "rec709"]), /--color-matrix is one of/);
    assert.throws(() => parseArgs(["a.mp4", "--color-range", "full"]), /tv \(limited\) or pc \(full\)/);
    assert.throws(() => parseArgs(["a.mp4", "--fps", "fast"]), /--fps expects/);
    assert.throws(() => parseArgs(["a.mp4", "--frobnicate"]), /unknown option/);
  });
});

/** 30 frames of a white 64x48 picture with a black box at frame `box` positions, encoded with `codec`. */
function planted(name: string, codec: string[]): string {
  const path = join(dir, name);
  // A 16x16 black square on white during frames 10 (one frame: a glitch) and 20..23 (a transient).
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=white:s=64x48:r=30:d=1",
    "-vf",
    "drawbox=x=8:y=8:w=16:h=16:color=black:t=fill:enable='eq(n\\,10)+between(n\\,20\\,23)',format=yuv444p",
    ...codec,
    path,
  ]);
  return path;
}

describe("scan video → snapshot storyboard", () => {
  test("a lossy recording is refused without --lossy, and named as such with it", async () => {
    const file = planted("lossy.mp4", ["-c:v", "libx264", "-crf", "30"]);
    const scanned = await scanVideo({ file, out: join(dir, "lossy") });
    await assert.rejects(
      writeStoryboard(scanned.manifestPath, { out: join(dir, "lossy-story") }),
      /lossy codec.*--lossy/s,
    );
    const written = await writeStoryboard(scanned.manifestPath, { out: join(dir, "lossy-story"), lossy: true });
    const summary = execFileSync("cat", [written.files.summary]).toString();
    assert.match(summary, /Decoded from h264, a lossy codec, compared through the noise band/);
  });

  test("a lossless recording's planted glitch and transient are found on their frames", async () => {
    const file = planted("planted.mkv", ["-c:v", "ffv1"]);
    const scanned = await scanVideo({ file, out: join(dir, "planted") });
    assert.equal(scanned.manifest.source.video?.lossless, true);
    const { story, files } = await writeStoryboard(scanned.manifestPath, { out: join(dir, "planted-story") });
    assert.deepEqual(
      story.events.map((e) => [e.kind, e.first.n, e.last?.n, e.box]),
      [
        ["glitch", 10, 10, { x: 8, y: 8, width: 16, height: 16 }],
        ["transient", 20, 23, { x: 8, y: 8, width: 16, height: 16 }],
      ],
    );
    const summary = execFileSync("cat", [files.summary]).toString();
    assert.match(summary, /Every frame the recording holds from its frame 0 to its frame 29/);
  });
});
