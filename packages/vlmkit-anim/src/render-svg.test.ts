import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { compileScene } from "./compile/index.ts";
import { pathLength, renderFrameSvg, sampleTimes, wrapCaption } from "./render-svg.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { ease, sampleKeyframes, timelineDuration } from "./timeline.ts";
import { TIMELINE_FORMAT, type Timeline } from "./types.ts";

describe("easing", () => {
  it("named curves hit their endpoints and are monotonic", () => {
    for (const name of ["linear", "ease", "ease-in", "ease-out", "ease-in-out"] as const) {
      assert.equal(ease(name, 0), 0);
      assert.equal(ease(name, 1), 1);
      let prev = 0;
      for (let i = 1; i <= 20; i++) {
        const v = ease(name, i / 20);
        assert.ok(v >= prev - 1e-9, `${name} not monotonic at ${i / 20}`);
        prev = v;
      }
    }
    assert.ok(Math.abs(ease("ease-in-out", 0.5) - 0.5) < 1e-6);
    assert.ok(ease("ease-in", 0.5) < 0.5 && ease("ease-out", 0.5) > 0.5);
    assert.equal(ease("step-end", 0.99), 0);
    assert.equal(ease("step-start", 0.01), 1);
    assert.ok(Math.abs(ease("cubic-bezier(0.42, 0, 0.58, 1)", 0.3) - ease("ease-in-out", 0.3)) < 1e-6);
  });
});

describe("sampleKeyframes", () => {
  it("holds outside the span, interpolates vectors and colours, steps text", () => {
    const pos = [{ t: 100, value: [0, 0] as [number, number] }, { t: 300, value: [100, 50] as [number, number], easing: "linear" as const }];
    assert.deepEqual(sampleKeyframes("pos", pos, 0), [0, 0]);
    assert.deepEqual(sampleKeyframes("pos", pos, 200), [50, 25]);
    assert.deepEqual(sampleKeyframes("pos", pos, 999), [100, 50]);
    const fill = [{ t: 0, value: "#000000" }, { t: 100, value: "#ffffff", easing: "linear" as const }];
    assert.equal(sampleKeyframes("fill", fill, 50), "#808080");
    const text = [{ t: 0, value: "a" }, { t: 100, value: "b" }];
    assert.equal(sampleKeyframes("text", text, 99), "a");
    assert.equal(sampleKeyframes("text", text, 100), "b");
  });
});

describe("renderFrameSvg", () => {
  const tl: Timeline = {
    format: TIMELINE_FORMAT,
    canvas: { width: 200, height: 100 },
    nodes: [
      { id: "g", shape: "group", pos: [10, 10] },
      { id: "box", shape: "rect", parent: "g", size: [20, 10], fill: "#ff0000", text: "hi" },
      { id: "line", shape: "arrow", points: [[0, 50], [100, 50]], dash: 0.5 },
      { id: "t", shape: "text", text: "a\nb", pos: [150, 50] },
    ],
    tracks: [{ target: "g", prop: "pos", keyframes: [{ t: 0, value: [10, 10] }, { t: 1000, value: [110, 10], easing: "linear" }] }],
    steps: [{ t: 0, caption: "start" }, { t: 500, caption: "half" }, { t: 900, label: "end" }],
  };

  it("an uncaptioned step keeps the previous caption showing", () => {
    assert.match(renderFrameSvg(tl, 950), /data-caption="true"><tspan[^>]*>half</);
  });

  it("nests children in their group's <g> and applies the sampled transform", () => {
    const svg = renderFrameSvg(tl, 500);
    assert.match(svg, /<g id="g" data-shape="group" transform="translate\(60 10\)">.*<g id="box"/s);
    assert.match(svg, /<tspan x="0" y="0">hi<\/tspan>/);
    assert.match(svg, /data-caption="true"><tspan[^>]*>half</);
    assert.match(svg, /marker-end="url\(#arrow-333\)"/);
    assert.match(svg, /stroke-dasharray="100" stroke-dashoffset="50"/);
    assert.match(svg, /<tspan x="0" y="-8.4">a<\/tspan><tspan x="0" y="8.4">b<\/tspan>/);
  });

  it("escapes text and is byte-stable across calls", () => {
    const t2: Timeline = { ...tl, nodes: [{ id: "x", shape: "text", text: "<b> & \"q\"" }] };
    assert.match(renderFrameSvg(t2, 0), /&lt;b&gt; &amp; &quot;q&quot;/);
    assert.equal(renderFrameSvg(tl, 333), renderFrameSvg(tl, 333));
  });

  it("sampleTimes includes every step and both ends, sorted and unique", () => {
    const ts = sampleTimes(tl, 3);
    assert.deepEqual(ts, [0, 500, 900, 1000]);
    const sort = compileScene(EXAMPLES.sort);
    const all = sampleTimes(sort, 0);
    assert.equal(all.length, sort.steps!.length);
    assert.ok(all.includes(Math.round(timelineDuration(sort))) || all[all.length - 1] <= timelineDuration(sort));
  });

  it("pathLength flattens curves close to the analytic value", () => {
    assert.equal(pathLength("M 0 0 L 30 40"), 50);
    assert.equal(pathLength("M 0 0 h 10 v 10 Z"), 10 + 10 + Math.hypot(10, 10));
    // Quarter circle of radius 100 via a cubic approximation: length ≈ 157.08.
    const q = pathLength("M 100 0 C 100 55.2 55.2 100 0 100");
    assert.ok(Math.abs(q - 157.08) < 1, String(q));
  });
});

describe("captions wider than the canvas wrap instead of clipping (v11: eb's decision caption, the vector-clock fixture)", () => {
  it("wrapCaption: a short caption is one line, a long one breaks at spaces, the last line takes the rest", () => {
    assert.deepEqual(wrapCaption("short", 200, 14, 3), ["short"]);
    const long = "A and C never exchanged a message: concurrent, and B lies between them so a group would enclose it";
    const lines = wrapCaption(long, 300, 14, 3);
    assert.ok(lines.length >= 2 && lines.length <= 3, lines.join(" | "));
    assert.equal(lines.join(" "), long, "no word is lost or duplicated");
    for (const l of lines.slice(0, -1)) assert.ok(l.length * 14 * 0.55 <= 300, `line too wide: ${l}`);
  });

  it("renderFrameSvg emits one tspan per wrapped line, the last on the baseline the single-line caption used", () => {
    const tl: Timeline = {
      format: TIMELINE_FORMAT,
      canvas: { width: 240, height: 120 },
      nodes: [{ id: "a", shape: "rect", pos: [50, 50], size: [20, 20] }],
      tracks: [],
      steps: [{ t: 0, caption: "this caption is far too long for a canvas two hundred and forty pixels wide" }],
    };
    const svg = renderFrameSvg(tl, 0);
    const spans = svg.match(/<tspan x="120" y="[\d.]+">/g) ?? [];
    assert.ok(spans.length >= 2, svg);
    assert.match(svg, /<tspan x="120" y="106">[^<]*<\/tspan><\/text>/, "the last line sits at height - 14");
  });
});
