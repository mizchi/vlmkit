/**
 * `snapshot storyboard --lossy` against known answers: the planted events of
 * `fixtures/storyboard/planted-ui.html`, captured lossless on the held clock, encoded with real
 * codecs, decoded by `scan video`, and segmented through the noise band. Each must give the
 * lossless capture's events — the same kinds, beginning within a few frames, ending no earlier
 * and not much later (a codec blurs a change in over several frames) — and a still page none.
 *
 * Needs ffmpeg and ffprobe on PATH with libx264, libvpx and libsvtav1 (Ubuntu's ffmpeg has all
 * three); CI installs it. The bench that chose the band ran 18 fixtures through 14 encodings:
 * docs/reports/2026-10-16-storyboard-noise-floor-v1.md.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { captureTimelineFrames } from "@mizchi/vlmkit-animation-eval/frames-capture.ts";
import { scanVideo } from "@mizchi/vlmkit-core/video-decode.ts";
import { parseFramesManifest, parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
import {
  buildStoryboard,
  LOSSY_NOISE,
  type Box,
  type Storyboard,
  type StoryEvent,
} from "@mizchi/vlmkit-judge/storyboard.ts";
import { framesOnDisk, writeStoryboard } from "./storyboard-cli.ts";

const PAGE = resolve(import.meta.dirname, "../../../fixtures/storyboard/planted-ui.html");

/** Encoders the band was measured on, each as the arguments that write it. */
const CODECS: Record<string, string[]> = {
  "x264-crf23": ["-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p"],
  // A keyframe every 10 frames: each re-quantizes the whole still picture.
  "x264-crf28-key10": ["-c:v", "libx264", "-crf", "28", "-g", "10", "-pix_fmt", "yuv420p"],
  // Playwright's recordVideo settings.
  "vp8-playwright": [
    "-c:v",
    "libvpx",
    "-qmin",
    "0",
    "-qmax",
    "50",
    "-crf",
    "8",
    "-deadline",
    "realtime",
    "-speed",
    "8",
    "-b:v",
    "1M",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
  ],
  "vp9-crf50-key30": ["-c:v", "libvpx-vp9", "-crf", "50", "-b:v", "0", "-g", "30", "-pix_fmt", "yuv420p"],
  "av1-crf50": ["-c:v", "libsvtav1", "-crf", "50", "-preset", "8", "-pix_fmt", "yuv420p"],
};

// The digit at frame 33, off every keyframe of the 10-frame GOP; a test below puts it on one.
const KINDS = ["static", "glitch&at=30", "caret", "digit&at=33", "cursor", "scroll", "toast", "slide"] as const;

let browser: Browser;
let dir: string;

beforeAll(async () => {
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "these tests encode and decode with ffmpeg and ffprobe on PATH (vlmkit ships no decoder): apt install ffmpeg",
    );
  }
  browser = await chromium.launch();
  dir = mkdtempSync(join(tmpdir(), "vlmkit-storyboard-lossy-"));
});

afterAll(async () => {
  await browser?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** The planted page captured lossless, every 60fps frame of its first second: its frames.json. */
async function capture(query: string): Promise<string> {
  const out = join(dir, `L-${query.replace(/\W+/g, "-")}`);
  const context = await browser.newContext({ viewport: { width: 640, height: 400 } });
  try {
    const p = await context.newPage();
    await captureTimelineFrames(p, `${pathToFileURL(PAGE).href}?kind=${query}`, {
      dir: out,
      tool: "test",
      instants: parseInstants("0..1s/1f", "--at"),
    });
  } finally {
    await context.close();
  }
  return join(out, "frames.json");
}

/** Those frames encoded at 60fps with `codec`, then decoded by scan video: its frames.json. */
async function throughCodec(manifest: string, codec: string): Promise<string> {
  const src = resolve(manifest, "..");
  const video = join(dir, `${src.split("/").pop()}-${codec}.mkv`);
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    "60",
    "-pattern_type",
    "glob",
    "-i",
    join(src, "[0-9]*.png"),
    ...CODECS[codec]!,
    video,
  ]);
  const out = `${video}.frames`;
  await scanVideo({ file: video, out });
  return join(out, "frames.json");
}

function segment(manifest: string, lossy: boolean, ignore: Box[] = []): Storyboard {
  const m = parseFramesManifest(readFileSync(manifest, "utf8"));
  const paths = m.frames.map((f) => resolve(manifest, "..", f.file));
  return buildStoryboard(m.frames, framesOnDisk(paths), { ignore, ...(lossy ? { noise: LOSSY_NOISE } : {}) });
}

const returns = (e: StoryEvent) => e.kind === "glitch" || e.kind === "transient";
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The lossy storyboard tells the lossless one's story: event for event, within the codec's slack. */
function sameStory(truth: Storyboard, got: Storyboard, label: string) {
  assert.equal(
    got.events.length,
    truth.events.length,
    `${label}: ${JSON.stringify(got.events.map((e) => [e.kind, e.first.n]))}`,
  );
  truth.events.forEach((t, i) => {
    const e = got.events[i]!;
    const at = `${label} ${t.id}`;
    assert.equal(returns(e), returns(t), `${at}: ${e.kind} for ${t.kind}`);
    assert.ok(Math.abs(e.first.n - t.first.n) <= 3, `${at}: began at ${e.first.n}, planted at ${t.first.n}`);
    const end = (x: StoryEvent) => x.back?.n ?? x.settled?.n;
    const te = end(t)!;
    const ee = end(e);
    assert.ok(ee !== undefined && ee >= te - 1 && ee <= te + 12, `${at}: ended at ${ee}, planted at ${te}`);
    assert.ok(overlap(e.box, t.box), `${at}: box ${JSON.stringify(e.box)} misses ${JSON.stringify(t.box)}`);
  });
}

describe("snapshot storyboard --lossy: planted events through codecs", () => {
  for (const kind of KINDS) {
    test(`${kind}: the lossless story, on every codec`, { timeout: 120_000 }, async () => {
      const lossless = await capture(kind);
      const truth = segment(lossless, false);
      if (kind === "static") assert.deepEqual(truth.events, []);
      else assert.ok(truth.events.length > 0, "the fixture plants something");
      for (const codec of Object.keys(CODECS)) {
        sameStory(truth, segment(await throughCodec(lossless, codec), true), `${kind} ${codec}`);
      }
    });
  }

  test(
    "a fade below the floor is not seen: the limit the band sets, said rather than hidden",
    { timeout: 60_000 },
    async () => {
      const lossless = await capture("fade");
      assert.deepEqual(
        segment(lossless, false).events.map((e) => e.kind),
        ["drift"],
        "lossless, the 6% fade accumulates past the floor of 8",
      );
      const lossy = segment(await throughCodec(lossless, "x264-crf23"), true);
      assert.deepEqual(lossy.events, [], "15 levels is below the band's floor of 32");
    },
  );

  test(
    "a digit changing on a keyframe is a change: a re-encoding's noise is spread, a glyph's is not",
    { timeout: 60_000 },
    async () => {
      const lossless = await capture("digit&at=30");
      const truth = segment(lossless, false);
      // x264 crf 23, one keyframe: frame 30 is an ordinary frame.
      sameStory(truth, segment(await throughCodec(lossless, "x264-crf23"), true), "digit crf23");
      // crf 28 with keyframes every 10 frames: frame 30 is a keyframe, and the digit's change is
      // within the keyframe band, but it moves past the band only where the glyph is.
      const harsh = segment(await throughCodec(lossless, "x264-crf28-key10"), true);
      sameStory(truth, harsh, "digit crf28-key10");
      assert.ok(!(harsh.reread ?? []).some((r) => r.n === 30), JSON.stringify(harsh.reread));
    },
  );

  test(
    "the CLI path: a lossy recording refused without --lossy, the band in story.json and SUMMARY.md",
    { timeout: 60_000 },
    async () => {
      const lossy = await throughCodec(await capture("glitch&at=30"), "x264-crf28-key10");
      await assert.rejects(writeStoryboard(lossy), /decoded from h264, a lossy codec: .*Pass --lossy/);
      const w = await writeStoryboard(lossy, { lossy: true });
      assert.equal(w.story.rules.channelFloor, 32, "the band's floor is the floor");
      assert.deepEqual(w.story.rules.noise, { radius: 1, still: 24, holdMean: 3, keyframe: { block: 24, pixel: 96 } });
      assert.deepEqual(
        w.story.events.map((e) => [e.kind, e.first.n]),
        [["glitch", 30]],
      );
      assert.ok((w.story.reread ?? []).length > 0, "keyframes 10, 20, … read again");
      const summary = readFileSync(w.files.summary, "utf8");
      assert.match(summary, /Compared as the mean of each pixel's 3x3 neighbourhood, through a noise band/);
      assert.match(summary, /Read again at [\d.]+ ms \(n \d+, S0, a keyframe\)/);
      const json = JSON.parse(readFileSync(w.files.story, "utf8"));
      assert.deepEqual(json.reread, JSON.parse(JSON.stringify(w.story.reread)));
    },
  );
});
