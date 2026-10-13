import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { encodeApng } from "./apng.ts";
import { browserDelayMs, imageTiming } from "./image-timing.ts";

/** The two-frame GIF of fixtures/flash/animated-gif.html (black, then white, 100ms each, looping). */
const TWO_FRAMES = Buffer.from(
  "R0lGODlhAgACAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAACBARBEAUAIfkEAAoAAAAsAAAAAAIAAgAAAgQMwzAFADs=",
  "base64",
);

const frame = (level: number) => ({ width: 2, height: 2, data: new Uint8Array(16).fill(level) });

test("imageTiming: a GIF's delays and NETSCAPE loop count", () => {
  assert.deepEqual(imageTiming(TWO_FRAMES), { format: "gif", storedMs: [100, 100], plays: null });
  // Loop count 3 is played 4 times; no NETSCAPE block at all is once.
  const three = Buffer.from(TWO_FRAMES);
  const at = three.indexOf(Buffer.from("NETSCAPE2.0", "latin1")) + 11 + 2;
  three.writeUInt16LE(3, at);
  assert.equal(imageTiming(three)?.plays, 4);
  const start = TWO_FRAMES.indexOf(Buffer.from([0x21, 0xff]));
  const once = Buffer.concat([TWO_FRAMES.subarray(0, start), TWO_FRAMES.subarray(start + 19)]);
  assert.deepEqual(imageTiming(once), { format: "gif", storedMs: [100, 100], plays: 1 });
});

test("imageTiming: an APNG's delays and plays; a still PNG and a video are not animations", () => {
  const apng = encodeApng([frame(0), frame(255), frame(0)], { delaysMs: [20, 5, 0], loops: 0 });
  const t = imageTiming(apng);
  assert.equal(t?.format, "apng");
  assert.equal(t?.plays, null);
  assert.equal(t?.storedMs.length, 3);
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
