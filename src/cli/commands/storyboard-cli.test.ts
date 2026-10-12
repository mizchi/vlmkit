import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cp, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { captureTimelineFrames } from "@mizchi/vlmkit-animation-eval/frames-capture.ts";
import { FRAMES_FORMAT, frameFileName, frameTimeMs, parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
import type { Box, StoryEvent } from "@mizchi/vlmkit-judge/storyboard.ts";
import { boxOnSheet } from "@mizchi/vlmkit-core/filmstrip.ts";
import { framesOnDisk, parseArgs, writeStoryboard, type StoryboardWritten } from "./storyboard-cli.ts";

/** The position of the manifest frame at `atMs`. */
const manifestFrame = (w: StoryboardWritten, atMs: number) => w.manifest.frames.findIndex((f) => f.atMs === atMs);

describe("snapshot storyboard args", () => {
  test("a manifest, boxes to ignore and a cap", () => {
    assert.deepEqual(
      parseArgs(["f/frames.json", "--ignore", "1,2,3,4", "--ignore", "0,0,10,10", "--max-events", "3"]),
      {
        manifest: "f/frames.json",
        ignore: [
          { x: 1, y: 2, width: 3, height: 4 },
          { x: 0, y: 0, width: 10, height: 10 },
        ],
        maxEvents: 3,
        json: false,
      },
    );
  });

  test("refuses what it cannot read, naming the flag", () => {
    assert.throws(() => parseArgs([]), /no frames\.json given/);
    assert.throws(() => parseArgs(["a.json", "b.json"]), /one frames\.json at a time/);
    for (const bad of ["1,2,3", "1,2,0,4", "-1,0,2,2", "a,b,c,d", "1.5,0,2,2", ",,4,4", "0x10,0,4,4", "1e1,0,4,4"]) {
      assert.throws(() => parseArgs(["f.json", "--ignore", bad]), /--ignore expects/, bad);
    }
    for (const bad of ["0", "1e1", "0x10", "", "2.5"]) {
      assert.throws(() => parseArgs(["f.json", "--max-events", bad]), /--max-events/, bad);
    }
    assert.throws(() => parseArgs(["f.json", "--frobnicate"]), /unknown option/);
  });
});

/** A W x H white PNG with a black box, written to `path`. */
async function writeFrame(path: string, width: number, height: number, box?: Box) {
  const png = new PNG({ width, height });
  png.data.fill(255);
  if (box) {
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) png.data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
    }
  }
  await writeFile(path, PNG.sync.write(png));
}

/** A hand-written sequence: frames `boxes[i]` at 60fps, and its manifest. */
async function writeSequence(dir: string, boxes: (Box | undefined)[], size = { width: 32, height: 24 }) {
  const frames = [];
  for (const [n, box] of boxes.entries()) {
    const file = frameFileName(n, frameTimeMs(n));
    await writeFrame(join(dir, file), size.width, size.height, box);
    frames.push({ n, file, atMs: frameTimeMs(n), stable: true });
  }
  const source = { tool: "test", url: "file:///x.html", viewport: size, deviceScaleFactor: 1, clock: "held" };
  await writeFile(join(dir, "frames.json"), JSON.stringify({ format: FRAMES_FORMAT, source, frames }, null, 2));
  return join(dir, "frames.json");
}

describe("writeStoryboard", () => {
  test("frames of two sizes are refused, naming the frame", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-storyboard-size-"));
    const manifest = await writeSequence(dir, [undefined, undefined]);
    await writeFrame(join(dir, frameFileName(1, frameTimeMs(1))), 16, 16);
    await assert.rejects(writeStoryboard(manifest), /frame 1 \(0001-t000017\.png\) is 16x16, frame 0 is 32x24/);
  });

  test("the same frames in two places write the same bytes, and a re-run replaces only its own files", async () => {
    const boxes: (Box | undefined)[] = Array.from({ length: 30 }, () => undefined);
    boxes[5] = { x: 2, y: 2, width: 4, height: 4 };
    for (let n = 12; n < 30; n++) boxes[n] = { x: 10, y: 8, width: 6, height: 5 };
    const a = await mkdtemp(join(tmpdir(), "vlmkit-storyboard-a-"));
    await writeSequence(a, boxes);
    const b = await mkdtemp(join(tmpdir(), "vlmkit-storyboard-b-"));
    await cp(a, b, { recursive: true });
    const wa = await writeStoryboard(join(a, "frames.json"));
    const wb = await writeStoryboard(join(b, "frames.json"));
    assert.deepEqual(
      wa.story.events.map((e) => [e.kind, e.first.n]),
      [
        ["glitch", 5],
        ["change", 12],
      ],
    );
    for (const name of ["story.json", "SUMMARY.md", "sheet.png", "narrate/BRIEF.md"]) {
      assert.deepEqual(await readFile(join(wa.outDir, name)), await readFile(join(wb.outDir, name)), name);
    }
    const narrate = await readdir(join(wa.outDir, "narrate"));
    assert.deepEqual(narrate.filter((f) => f.endsWith(".png")).sort(), [
      "E1-1-before-crop.png",
      "E1-1-before.png",
      "E1-2-first+peak+last-crop.png",
      "E1-2-first+peak+last.png",
      "E1-3-back-crop.png",
      "E1-3-back.png",
      "E2-1-before-crop.png",
      "E2-1-before.png",
      "E2-2-first+peak+settled-crop.png",
      "E2-2-first+peak+settled.png",
    ]);
    // A re-run with fewer events: the old E2 pictures go, a file of the user's stays.
    await writeFile(join(wa.outDir, "narrate", "NARRATION.md"), "E1: mine\n");
    await writeStoryboard(join(a, "frames.json"), { maxEvents: 1 });
    const after = await readdir(join(wa.outDir, "narrate"));
    assert.ok(!after.some((f) => f.startsWith("E2-")), after.join(", "));
    assert.ok(after.includes("NARRATION.md"));
    const json = JSON.parse(await readFile(join(wa.outDir, "story.json"), "utf8"));
    assert.equal(json.manifest, "../frames.json");
    assert.equal(json.events[1].keyframes.at(-1).file, frameFileName(12, frameTimeMs(12)));
  });

  test("the frame cache holds eight at the least, and evicts the least recently used", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-storyboard-cache-"));
    await writeSequence(
      dir,
      Array.from({ length: 12 }, () => undefined),
    );
    const paths = Array.from({ length: 12 }, (_, n) => join(dir, frameFileName(n, frameTimeMs(n))));
    const px = framesOnDisk(paths, 0);
    for (let i = 0; i < 12; i++) px.pixels(i);
    for (let i = 4; i < 12; i++) px.pixels(i);
    assert.equal(px.decoded(), 12, "the last eight are still cached at the minimum capacity");
    px.pixels(4); // the oldest, used again: now the newest
    px.pixels(0); // evicted, so decoded again; this evicts 5, not 4
    assert.equal(px.decoded(), 13);
    px.pixels(4);
    assert.equal(px.decoded(), 13, "4 was used recently and stays");
    px.pixels(5);
    assert.equal(px.decoded(), 14, "5 was the least recently used");
  });

  test("a frame that is not a PNG is named, not a pngjs stack", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-storyboard-corrupt-"));
    const manifest = await writeSequence(dir, [undefined, undefined, undefined]);
    const file = join(dir, frameFileName(2, frameTimeMs(2)));
    await writeFile(file, (await readFile(file)).subarray(0, 60));
    await assert.rejects(
      writeStoryboard(manifest),
      (e: Error) => e.name === "UsageError" && /frame 2 \(.*\) is not a readable PNG/.test(e.message),
    );
  });

  test("the sheet shows each keyframe, the box outlined around it and never over it; the brief's files are the frames", async () => {
    const boxes: (Box | undefined)[] = Array.from({ length: 30 }, () => undefined);
    boxes[5] = { x: 0, y: 0, width: 32, height: 1 }; // a one-pixel bar along the top edge
    for (let n = 12; n < 30; n++) boxes[n] = { x: 10, y: 8, width: 6, height: 5 };
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-storyboard-sheet-"));
    const manifest = await writeSequence(dir, boxes);
    const w = await writeStoryboard(manifest);
    assert.equal(w.sheet.layout.scale, 1, "small frames: the sheet is at full size, so cells are the frames' pixels");
    const sheet = PNG.sync.read(await readFile(w.files.sheet));
    const at = (x: number, y: number) => [
      ...sheet.data.subarray((y * sheet.width + x) * 4, (y * sheet.width + x) * 4 + 3),
    ];
    const frameAt = (n: number) => PNG.sync.read(readFileSync(join(dir, frameFileName(n, frameTimeMs(n)))));
    const rgb = (png: PNG, x: number, y: number) => [
      ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3),
    ];
    const MAGENTA = [255, 0, 255];
    const frameSize = { width: 32, height: 24 };
    let outlined = 0;
    w.sheet.cells.forEach((cell, i) => {
      if (!cell?.box) return;
      outlined++;
      const b = boxOnSheet(w.sheet.layout, i, frameSize, cell.box);
      const p = w.sheet.layout.positions[i]!;
      const frame = frameAt(cell.n);
      for (let y = b.y; y < b.y + b.height; y++) {
        for (let x = b.x; x < b.x + b.width; x++)
          assert.deepEqual(at(x, y), rgb(frame, x - p.x, y - p.y), `cell ${i} ${x},${y}`);
      }
      // A cell away from the box shows its frame too: the keyframe, not some other frame.
      assert.deepEqual(at(p.x + 31, p.y + 23), rgb(frame, 31, 23), `cell ${i} corner`);
      assert.deepEqual(at(b.x - 1, b.y), MAGENTA, `cell ${i} left`);
      assert.deepEqual(at(b.x + b.width, b.y), MAGENTA, `cell ${i} right`);
      assert.deepEqual(at(b.x, b.y - 1), MAGENTA, `cell ${i} top (the edge bar's is in the gap)`);
      assert.deepEqual(at(b.x, b.y + b.height), MAGENTA, `cell ${i} bottom`);
    });
    assert.equal(outlined, 5, "the glitch's three keyframes and the change's two");
    for (const [id, images] of w.images) {
      const event = w.story.events.find((e) => e.id === id)!;
      for (const img of images) {
        const n = manifestFrame(w, img.atMs);
        assert.deepEqual(
          await readFile(join(w.outDir, "narrate", img.file)),
          await readFile(join(dir, frameFileName(n, frameTimeMs(n)))),
          img.file,
        );
        const c = img.crop!;
        const crop = PNG.sync.read(await readFile(join(w.outDir, "narrate", c.file)));
        assert.deepEqual([crop.width, crop.height], [c.box.width * c.zoom, c.box.height * c.zoom], c.file);
        assert.ok(
          c.box.x <= event.box.x && c.box.x + c.box.width >= event.box.x + event.box.width,
          "the crop holds the box",
        );
        const frame = frameAt(n);
        for (const [x, y] of [
          [0, 0],
          [c.box.width - 1, c.box.height - 1],
          [event.box.x - c.box.x, event.box.y - c.box.y],
        ] as const) {
          assert.deepEqual(
            rgb(crop, x * c.zoom, y * c.zoom),
            rgb(frame, c.box.x + x, c.box.y + y),
            `${c.file} ${x},${y}`,
          );
        }
      }
    }
  });
});

/**
 * The self-check the storyboard ships on: planted events on a real page, captured on the held
 * clock, each found exactly where it was planted. `fixtures/storyboard/planted.html` times each
 * event by the rAF timestamp or a timer, so the frames that show it are known before the capture.
 */
describe("snapshot storyboard: planted events on the held clock", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });
  const page = resolve(import.meta.dirname, "../../../fixtures/storyboard/planted.html");

  async function storyOf(query: string, options: { ignore?: Box[]; at?: string } = {}) {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-storyboard-planted-"));
    const context = await browser.newContext({ viewport: { width: 320, height: 200 } });
    try {
      const p = await context.newPage();
      await captureTimelineFrames(p, `${pathToFileURL(page).href}?${query}`, {
        dir,
        tool: "test",
        instants: parseInstants(options.at ?? "0..1s/1f", "--at"),
      });
    } finally {
      await context.close();
    }
    return writeStoryboard(join(dir, "frames.json"), { ...(options.ignore ? { ignore: options.ignore } : {}) });
  }
  const brief = (e: StoryEvent) => ({
    kind: e.kind,
    first: e.first.n,
    ...(e.back ? { back: e.back.n } : {}),
    ...(e.settled ? { settled: e.settled.n } : {}),
  });

  test("a still page: no event", async () => {
    const { story } = await storyOf("kind=static");
    assert.deepEqual(story.events, []);
    assert.equal(story.frames.count, 61);
    assert.equal(story.frames.sampling.everyFrame, true);
    assert.deepEqual(story.frames.unstable, []);
  });

  test("one frame: a glitch on frame 30, over the box's exact pixels", async () => {
    const { story } = await storyOf("kind=glitch&at=30");
    assert.deepEqual(story.events.map(brief), [{ kind: "glitch", first: 30, back: 31 }]);
    assert.deepEqual(story.events[0]!.box, { x: 40, y: 40, width: 60, height: 30 });
  });

  for (const [k, on, off, start] of [
    [3, 2, 1, 20],
    [5, 1, 3, 10],
    [2, 3, 2, 15],
    [4, 1, 1, 8],
  ] as const) {
    test(`${k} blinks of ${on} frame(s), ${off} apart: ${k} events, none for the gaps`, async () => {
      const { story } = await storyOf(`kind=blinks&k=${k}&on=${on}&off=${off}&start=${start}`);
      assert.deepEqual(
        story.events.map(brief),
        Array.from({ length: k }, (_, b) => ({
          kind: on === 1 ? "glitch" : "transient",
          first: start + b * (on + off),
          back: start + b * (on + off) + on,
        })),
      );
    });
  }

  test("a toast shown by timers from 300 to 700 ms: one transient, frames 18-41", async () => {
    const { story } = await storyOf("kind=toast");
    assert.deepEqual(story.events.map(brief), [{ kind: "transient", first: 18, back: 42 }]);
    assert.equal(
      story.events[0]!.peak.n,
      18,
      "a toast covers the same pixels on every frame: the earliest is the peak",
    );
    assert.deepEqual(story.events[0]!.box, { x: 198, y: 160, width: 110, height: 28 });
  });

  test("a panel easing in over frames 12-30: one change, settled where the easing ends", async () => {
    const { story } = await storyOf("kind=slide");
    assert.deepEqual(story.events.map(brief), [{ kind: "change", first: 13, settled: 30 }]);
    assert.deepEqual(story.events[0]!.box, { x: 0, y: 0, width: 120, height: 200 });
    assert.deepEqual(
      story.states.map((s) => s.id),
      ["S0", "S1"],
    );
  });

  test("a 6% fade over 45 frames: a drift, moving below the floor before it shows", async () => {
    const { story } = await storyOf("kind=fade");
    assert.equal(story.events.length, 1, JSON.stringify(story.events.map(brief)));
    const e = story.events[0]!;
    // Opacity 0.06 * p of black is drawn in 8-bit alpha: still 0 at frame 11, 9 (over the floor)
    // first at frame 35, and 15 for good from frame 53, two frames before p reaches 1.
    assert.deepEqual(
      [e.kind, e.movedAfter?.n, e.before.n, e.first.n, e.settled?.n, e.maxStepDelta],
      ["drift", 11, 34, 35, 53, 1],
    );
    assert.deepEqual(e.box, { x: 160, y: 90, width: 100, height: 50 });
  });

  test("a spinner turning every frame never settles, and ignoring its box leaves nothing", async () => {
    const moving = await storyOf("kind=spinner");
    assert.deepEqual(
      moving.story.events.map((e) => [e.kind, e.before.n, e.first.n, e.last?.n, e.endedInMotion]),
      [["change", 0, 1, 60, true]],
    );
    const box = moving.story.events[0]!.box;
    const ignored = await storyOf("kind=spinner", { ignore: [box] });
    assert.deepEqual(ignored.story.events, []);
  });

  test("sampled every 100 ms, the glitch between samples is not there, and the summary says why", async () => {
    const { story, files } = await storyOf("kind=glitch&at=31", { at: "0..1s/100ms" });
    assert.deepEqual(story.events, []);
    assert.match(await readFile(files.summary, "utf8"), /Frames up to 100 ms apart: something shorter than a gap/);
  });
});
