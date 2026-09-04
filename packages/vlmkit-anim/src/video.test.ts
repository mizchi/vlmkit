/**
 * The video schedule and the GIF encoder without a browser; the whole
 * pipeline (rasterise → GIF) through Playwright, and the ffmpeg fallback.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, it } from "vitest";
import { compileScene } from "./compile/index.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { timelineDuration } from "./timeline.ts";
import { encodeGif, ffmpegAvailable, scheduleFrames, videoFormat, writeVideo } from "./video.ts";

const dir = mkdtempSync(join(tmpdir(), "vlm-anim-video-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("scheduleFrames", () => {
  const tl = compileScene(EXAMPLES.sort);

  it("holds on every step and at the end, merges identical frames, keeps the total length", () => {
    const frames = scheduleFrames(tl, { fps: 20, hold: 600 });
    const steps = new Set((tl.steps ?? []).map((s) => Math.round(s.t)));
    const dur = timelineDuration(tl);
    const total = frames.reduce((s, f) => s + f.delayMs, 0);
    // Sampled length plus one hold per distinct step time plus the final hold, to within one frame.
    assert.ok(Math.abs(total - (dur + 600 * (steps.size + 1))) <= 60, `total ${total} for dur ${dur} and ${steps.size} steps`);
    for (const s of steps) {
      const f = frames.find((x) => Math.abs(x.t - s) < 1e-6);
      assert.ok(f && f.delayMs >= 600, `step at ${s} is held (${f?.delayMs}ms)`);
    }
    assert.ok(frames[frames.length - 1].delayMs >= 600, "final frame is held");
    // Frames are unique in sequence: a hold is one frame, not thirty.
    for (let i = 1; i < frames.length; i++) assert.notEqual(frames[i].svg, frames[i - 1].svg);
    assert.ok(frames.length < (total / 50) * 0.9, `${frames.length} frames for ${total}ms: identical frames were merged`);
  });

  it("is deterministic and hold: 0 is plain sampling", () => {
    assert.equal(JSON.stringify(scheduleFrames(tl, { fps: 10 })), JSON.stringify(scheduleFrames(tl, { fps: 10 })));
    const plain = scheduleFrames(tl, { fps: 10, hold: 0 });
    const total = plain.reduce((s, f) => s + f.delayMs, 0);
    assert.ok(total <= timelineDuration(tl) + 200, `total ${total}`);
  });
});

describe("encodeGif", () => {
  it("writes a looping GIF89a with one image per frame and the delays in hundredths", () => {
    const w = 8;
    const h = 4;
    const solid = (r: number, g: number, b: number): Uint8Array => {
      const px = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) px.set([r, g, b, 255], i * 4);
      return px;
    };
    const bytes = encodeGif([
      { width: w, height: h, rgba: solid(255, 0, 0), delayMs: 500 },
      { width: w, height: h, rgba: solid(0, 0, 255), delayMs: 50 },
    ]);
    assert.equal(Buffer.from(bytes.subarray(0, 6)).toString("latin1"), "GIF89a");
    const buf = Buffer.from(bytes);
    assert.ok(buf.includes(Buffer.from("NETSCAPE2.0", "latin1")), "loop extension present");
    // Graphic Control Extensions: 0x21 0xF9 0x04 <flags> <delay lo> <delay hi>
    const delays: number[] = [];
    for (let i = 0; i + 5 < buf.length; i++) if (buf[i] === 0x21 && buf[i + 1] === 0xf9 && buf[i + 2] === 0x04) delays.push(buf[i + 4] | (buf[i + 5] << 8));
    assert.deepEqual(delays, [50, 5]);
    const images = [...buf].filter((b, i) => b === 0x2c && i > 13).length;
    assert.ok(images >= 2, "two image descriptors");
    const once = Buffer.from(encodeGif([{ width: w, height: h, rgba: solid(0, 0, 0), delayMs: 100 }], { loop: false }));
    assert.ok(!once.includes(Buffer.from("NETSCAPE2.0", "latin1")), "no loop extension when loop: false");
  });

  it("names the accepted extensions", () => {
    assert.equal(videoFormat("x/demo.GIF"), "gif");
    assert.equal(videoFormat("demo.mp4"), "mp4");
    assert.throws(() => videoFormat("demo.mov"), /\.gif, \.mp4 or \.webm/);
  });
});

describe("writeVideo (browser)", () => {
  it("renders a GIF at the requested width with one frame per scheduled frame", async () => {
    const tl = compileScene(EXAMPLES.vector);
    const out = join(dir, "vector.gif");
    const r = await writeVideo(tl, out, { fps: 10, hold: 200, width: 200 });
    assert.equal(r.format, "gif");
    assert.equal(r.width, 200);
    assert.equal(r.height, Math.round((200 / tl.canvas.width) * tl.canvas.height));
    assert.equal(r.frames, scheduleFrames(tl, { fps: 10, hold: 200 }).length);
    const buf = readFileSync(out);
    assert.equal(buf.subarray(0, 6).toString("latin1"), "GIF89a");
    assert.ok(buf.length > 1000 && buf.length === r.bytes);
  });

  it("mp4 runs ffmpeg when present, otherwise leaves the frames and the command", async () => {
    const tl = compileScene(EXAMPLES.vector);
    const out = join(dir, "vector.mp4");
    const r = await writeVideo(tl, out, { fps: 10, hold: 0 });
    if (ffmpegAvailable()) {
      assert.ok(existsSync(out) && r.bytes! > 0);
      assert.equal(r.pending, undefined);
      const head = readFileSync(out).subarray(4, 8).toString("latin1");
      assert.equal(head, "ftyp");
    } else {
      assert.ok(r.pending, "pending command reported");
      assert.ok(existsSync(r.pending!.framesDir));
      assert.ok(readdirSync(r.pending!.framesDir).includes("frames.ffconcat"));
      assert.match(r.pending!.command, /^ffmpeg .*libx264/);
      const list = readFileSync(join(r.pending!.framesDir, "frames.ffconcat"), "utf-8");
      assert.match(list, /^ffconcat version 1\.0\nfile frame-00000\.png\nduration 0\.\d{3}\n/);
    }
  });
});
