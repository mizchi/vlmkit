import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { encodeApng } from "./apng.ts";
import { encodeGif } from "./gif.ts";
import { browserDelayMs, gifCompositingProblem, imageTiming } from "./image-timing.ts";

/** The two-frame GIF of fixtures/flash/animated-gif.html (black, then white, 100ms each, looping). */
const TWO_FRAMES = Buffer.from(
  "R0lGODlhAgACAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAACBARBEAUAIfkEAAoAAAAsAAAAAAIAAgAAAgQMwzAFADs=",
  "base64",
);

const frame = (level: number) => ({ width: 2, height: 2, data: new Uint8Array(16).fill(level) });

test("imageTiming: a GIF's delays and NETSCAPE loop count", () => {
  const two = imageTiming(TWO_FRAMES)!;
  assert.deepEqual([two.format, two.storedMs, two.plays], ["gif", [100, 100], null]);
  assert.deepEqual(two.gif!.screen, { width: 2, height: 2 });
  // Loop count 3 is played 4 times; no NETSCAPE block at all is once.
  const three = Buffer.from(TWO_FRAMES);
  const at = three.indexOf(Buffer.from("NETSCAPE2.0", "latin1")) + 11 + 2;
  three.writeUInt16LE(3, at);
  assert.equal(imageTiming(three)?.plays, 4);
  const start = TWO_FRAMES.indexOf(Buffer.from([0x21, 0xff]));
  const once = Buffer.concat([TWO_FRAMES.subarray(0, start), TWO_FRAMES.subarray(start + 19)]);
  assert.equal(imageTiming(once)!.plays, 1);
});

test("imageTiming: an APNG's delays and plays; a still PNG and a video are not animations", () => {
  const apng = encodeApng([frame(0), frame(255), frame(0)], { delaysMs: [20, 5, 0], loops: 0 });
  const t = imageTiming(apng);
  assert.equal(t?.format, "apng");
  assert.equal(t?.plays, null);
  assert.equal(t?.storedMs.length, 3);
  assert.equal(t?.declaredFrames, 3);
  assert.ok(Math.abs(t!.storedMs[0]! - 20) < 1 && t!.storedMs[1]! <= 10, `stored ${t?.storedMs}`);
  assert.equal(imageTiming(encodeApng([frame(0), frame(255)], { loops: 2 }))?.plays, 2);
  assert.equal(imageTiming(Buffer.from("not an image")), null);
});

test("browserDelayMs: 10ms or less is held 100ms", () => {
  assert.deepEqual([0, 1, 10, 11, 20, 100].map(browserDelayMs), [100, 100, 100, 11, 20, 100]);
});

test("imageTiming: ANIMEXTS1.0 is a loop block too (Chromium loops it), and APNG delays are whole ms", () => {
  const renamed = Buffer.from(TWO_FRAMES);
  renamed.write("ANIMEXTS1.0", renamed.indexOf(Buffer.from("NETSCAPE2.0", "latin1")), "latin1");
  assert.equal(imageTiming(renamed)?.plays, null);
  // 1/95s is 10.53ms; Chromium holds the integer 10, which it clamps to 100. The first fcTL's
  // delay is rewritten to 1/95 (the sniffer reads no CRC).
  const apng = Buffer.from(encodeApng([frame(0), frame(255)], { delaysMs: [100, 500], loops: 0 }));
  const fctl = apng.indexOf(Buffer.from("fcTL", "latin1")) + 4;
  apng.writeUInt16BE(1, fctl + 20);
  apng.writeUInt16BE(95, fctl + 22);
  const stored = imageTiming(apng)!.storedMs;
  assert.ok(stored[0]! <= 10, `stored ${stored[0]}`);
  assert.equal(browserDelayMs(stored[0]!), 100);
});

test("gifCompositingProblem: where ffmpeg paints the background colour and a browser leaves the page", () => {
  const palette = [
    [0, 0, 0],
    [255, 255, 255],
  ] as const;
  const timing = (frames: Parameters<typeof encodeGif>[0]["frames"], background = 0) =>
    imageTiming(encodeGif({ width: 20, height: 20, palette, background, loop: 0, frames }))!;
  // Disposed to background with no transparent colour, then a frame that paints one pixel.
  const disposed = timing([
    { pixels: 0, disposal: 2 },
    { pixels: 1, x: 0, y: 0, width: 1, height: 1 },
  ]);
  assert.deepEqual(
    disposed.gif!.images.map((i) => [i.x, i.y, i.width, i.height, i.disposal, i.transparent]),
    [
      [0, 0, 20, 20, 2, false],
      [0, 0, 1, 1, 0, false],
    ],
  );
  assert.match(gifCompositingProblem(disposed)!, /image 0 is disposed to background/);
  // The same disposal with a transparent colour (ffmpeg clears to transparent too), or a next frame
  // that paints over all of it opaquely, composites as a browser does.
  assert.equal(gifCompositingProblem(timing([{ pixels: 0, disposal: 2, transparent: 1 }, { pixels: 1 }])), null);
  assert.equal(gifCompositingProblem(timing([{ pixels: 0, disposal: 2 }, { pixels: 1 }])), null);
  assert.match(
    gifCompositingProblem(
      timing([
        { pixels: 0, disposal: 2 },
        { pixels: 1, transparent: 0 },
      ]),
    )!,
    /does not paint over all of it/,
  );
  // A first image that does not cover the logical screen, or reaches past it.
  assert.match(gifCompositingProblem(timing([{ pixels: 1, width: 1, height: 1 }, { pixels: 1 }]))!, /does not cover/);
  assert.match(
    gifCompositingProblem(
      imageTiming(
        encodeGif({ width: 10, height: 10, palette, frames: [{ pixels: 0, width: 20, height: 20 }, { pixels: 1 }] }),
      )!,
    )!,
    /reaches past/,
  );
  assert.equal(gifCompositingProblem(imageTiming(TWO_FRAMES)!), null);
});

test("gifCompositingProblem: only where ffmpeg paints its opaque background, which needs a global table and no transparent colour", () => {
  const palette = [
    [0, 0, 0],
    [255, 255, 255],
  ] as const;
  const at = (
    frames: Parameters<typeof encodeGif>[0]["frames"],
    extra: Partial<Parameters<typeof encodeGif>[0]> = {},
  ) => gifCompositingProblem(imageTiming(encodeGif({ width: 20, height: 20, palette, loop: 0, frames, ...extra }))!);
  // A first image smaller than the screen that has a transparent colour: ffmpeg fills transparent too.
  assert.equal(at([{ pixels: 0, width: 10, height: 10, transparent: 1 }, { pixels: 1 }]), null);
  // Local colour tables only: ffmpeg's background is its transparent colour, as a browser's is.
  assert.equal(
    at(
      [
        { pixels: 0, disposal: 2 },
        { pixels: 1, width: 1, height: 1 },
      ],
      { localTables: true },
    ),
    null,
  );
  assert.equal(at([{ pixels: 1, width: 1, height: 1 }, { pixels: 0 }], { localTables: true }), null);
  // Restore to previous: what ffmpeg restores under an opaque first frame is its background fill.
  assert.match(
    at([
      { pixels: 0, disposal: 3 },
      { pixels: 0, width: 1, height: 1 },
    ])!,
    /restored to the canvas before it/,
  );
  assert.match(
    at([
      { pixels: 0, disposal: 2 },
      { pixels: 0, disposal: 3, delayCs: 2 },
      { pixels: 0, width: 1, height: 1 },
    ])!,
    /image 0 is disposed to background|image 1 is restored/,
  );
  // …and nothing to restore when the first frame is transparent-capable, or the next paints over all of it.
  assert.equal(
    at([
      { pixels: 0, disposal: 3, transparent: 1 },
      { pixels: 0, width: 1, height: 1 },
    ]),
    null,
  );
  assert.equal(at([{ pixels: 0, disposal: 3 }, { pixels: 1 }]), null);
});

test("gifCompositingProblem: a sprite restored to previous over an opaque first frame restores that frame, as a browser does", () => {
  const palette = [
    [0, 0, 0],
    [255, 255, 255],
  ] as const;
  const at = (frames: Parameters<typeof encodeGif>[0]["frames"]) =>
    gifCompositingProblem(imageTiming(encodeGif({ width: 20, height: 20, palette, loop: 0, frames }))!);
  const sprites = [
    { pixels: 1, disposal: 1 },
    { pixels: 0, x: 0, y: 0, width: 15, height: 15, disposal: 3 },
    { pixels: 0, x: 19, y: 19, width: 1, height: 1, disposal: 3 },
    { pixels: 0, x: 0, y: 0, width: 15, height: 15, disposal: 3 },
  ];
  assert.equal(at(sprites), null);
  // An opaque frame disposed to background and painted over, then a frame that covers the screen: the fill is gone.
  assert.equal(at([{ pixels: 0, disposal: 2 }, { pixels: 1, disposal: 1 }, ...sprites.slice(1)]), null);
});
