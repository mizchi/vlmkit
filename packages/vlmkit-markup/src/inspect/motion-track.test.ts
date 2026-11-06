/**
 * `inspect motion --track` (issue #213): motion no element describes, found by its pixels with no
 * key. fixtures/motion-track/slide.html draws a square on a canvas by requestAnimationFrame, intact
 * or with one mistake; slide-css.html is the intact slide written in CSS, measured by --selector.
 * Each broken page fails by the rule its mistake is, the intact one passes, and the canvas reading
 * agrees with the CSS one.
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { runMotionCli } from "./motion-cli.ts";

const dir = join(import.meta.dirname, "../../../../fixtures/motion-track");
const slide = (kind: string) => `${join(dir, "slide.html")}?kind=${kind}`;

const motion = async (page: string, args: string[], frames?: string) => {
  const lines: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (m: string) => lines.push(String(m));
  console.error = (m: string) => lines.push(String(m));
  try {
    const out = frames ?? (await mkdtemp(join(tmpdir(), "vlmkit-track-")));
    return {
      code: await runMotionCli([page, ...args, "--frames", out, "--no-ledger"]),
      out: lines.join("\n"),
      frames: out,
    };
  } finally {
    console.log = log;
    console.error = error;
  }
};
const T = { timeout: 240_000 };
const SPAN = ["--start", "200", "--end", "800", "--expect-easing", "ease-out", "--expect-direction", "right"];

describe("inspect motion --track: a canvas judged by its pixels", () => {
  it("passes the intact slide, and reads it as its CSS twin is read", T, async () => {
    const canvas = await motion(slide("intact"), ["--track", "800,360,80,80", ...SPAN]);
    assert.equal(canvas.code, 0, canvas.out);
    assert.match(canvas.out, /travels 600px rightwards over the frames measured, follows ease-out exactly/);
    assert.match(canvas.out, /held: --expect-easing ease-out, --expect-direction right/);
    assert.match(canvas.out, /found by its pixels — where it is and how well it matches, not size, turn or opacity/);
    const css = await motion(join(dir, "slide-css.html"), ["--selector", ".square", "--expect-easing", "ease-out"]);
    assert.equal(css.code, 0, css.out);
    assert.match(css.out, /travels 600px rightwards over the frames measured, follows ease-out exactly/);
  });

  it("fails a constant speed by easing-mismatch, and nothing else", T, async () => {
    const r = await motion(slide("linear"), ["--track", "800,360,80,80", ...SPAN]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL easing-mismatch .*follows linear/);
    // Each frame is on the animation frame its drawing shows: shot between frames, the last one
    // was 16ms behind and a linear slide read a 17px jump into rest.
    assert.doesNotMatch(r.out, /FAIL jump/);
  });

  it("fails a jump where the slide is slow", T, async () => {
    const r = await motion(slide("jump"), ["--track", "1000,360,80,80", ...SPAN]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL jump at 633ms: moves 212px between 617ms and 633ms/);
  });

  it("fails the reversed slide by direction-mismatch", T, async () => {
    const r = await motion(slide("left"), ["--track", "200,360,80,80", ...SPAN]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL direction-mismatch .*moves leftwards/);
    assert.doesNotMatch(r.out, /easing-mismatch/);
  });

  it("judges saved frames with no page and no key, the same way", T, async () => {
    const live = await motion(slide("intact"), ["--track", "800,360,80,80", ...SPAN]);
    const saved = await motion(join(live.frames, "frames.json"), ["--track", "800,360,80,80", ...SPAN]);
    assert.equal(saved.code, 0, saved.out);
    assert.match(saved.out, /travels 600px rightwards over the frames measured, follows ease-out exactly/);
  });

  it("says what a canvas page needs, and refuses what cannot hold", T, async () => {
    const noSpan = await motion(slide("intact"), ["--track", "800,360,80,80"]);
    assert.equal(noSpan.code, 2);
    assert.match(noSpan.out, /needs --end <ms>/);
    const bad = await motion(slide("intact"), ["--track", "800,360,80"]);
    assert.equal(bad.code, 2);
    assert.match(bad.out, /--track takes x,y,w,h/);
    const jev = await motion(slide("intact"), ["--track", "800,360,80,80", "--jev"]);
    assert.equal(jev.code, 2);
    assert.match(jev.out, /drop --jev/);
  });
});
