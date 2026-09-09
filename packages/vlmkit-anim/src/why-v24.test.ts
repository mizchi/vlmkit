/**
 * v24: the compiler's account of the picture. `Timeline.meta.why` names what set each canvas axis (the pair of
 * boxes and the room between them), which containers are rows and which bands (and each band's share), what put
 * every box on its layer, and which box a bent edge went round; `vlmkit-anim why` prints it and `check` quotes the
 * canvas entry in its width warning. Bands are sized by their fullest layer's boxes, not their count.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { checkAnimation } from "./check.ts";
import { compileScene } from "./compile/index.ts";
import { routeAround } from "./compile/route.ts";
import { formatWhy, type WhyEntry } from "./compile/why.ts";
import { importMermaid } from "./import/mermaid.ts";
import { layoutReport } from "./layout.ts";
import type { Scene } from "./types.ts";

const fixture = (name: string): Scene => JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", `${name}.json`), "utf8")) as Scene;
const mmd = (name: string): string => readFileSync(join(import.meta.dirname, "..", "fixtures", "mermaid", `${name}.mmd`), "utf8");
const whyOf = (scene: Scene): WhyEntry[] => ((compileScene(scene).meta as { why?: WhyEntry[] }).why ?? []);
const line = (why: WhyEntry[], re: RegExp): WhyEntry | undefined => why.find((w) => re.test(w.says));

describe("why: the imported pipeline", () => {
  const scene = importMermaid(mmd("pipeline")).scene;
  const tl = compileScene(scene);
  const why = (tl.meta as { why?: WhyEntry[] }).why ?? [];

  it("names the pair of boxes that set each axis, with the room they needed and how far apart the layout put them", () => {
    const width = why.find((w) => w.kind === "canvas" && w.about === "width")!;
    assert.match(width.says, /^width \d+: .*\(\d+px, in Track_\w+\) .*(need \d+px between their centres .* and the layout put them \d+% of the width apart|sits \d+% of the width from the edge and needs \d+px of room there), so \d+px \+ \d+px of margins$/);
    assert.ok(width.ids!.length >= 1 && width.across === true);
    assert.equal(width.n, tl.canvas.width);
    const height = why.find((w) => w.kind === "canvas" && w.about === "height")!;
    assert.match(height.says, /^height \d+: VIS_SEM \(70px, in Track_Visual\) and CROSS \(53px, in Merge\) need \d+px between their centres \(both boxes' halves, a gap, and their containers' paddings\) and the layout put them \d+% of the height apart, so \d+px \+ \d+px of margins$/);
    assert.deepEqual(height.ids, ["VIS_SEM", "CROSS"]);
    assert.equal(height.across, false);
    assert.ok(!/module map's room/.test(width.says + height.says), "a diagram is sized to its boxes, not to a module map's floor");
  });

  it("says which containers are rows and which are bands, a band's share and its fullest layer in pixels", () => {
    assert.match(line(why, /^Input:/)!.says, /^Input: a row of the picture — layer 1 holds nothing else$/);
    assert.match(line(why, /^Parallel:/)!.says, /^Parallel: a row of the picture — layers 2–5 hold nothing else$/);
    const visual = line(why, /^Track_Visual:/)!;
    assert.equal(visual.kind, "band");
    assert.match(visual.says, /^Track_Visual: a band across \d+% inside Parallel — shares layers with Track_Intent, Track_A11y; its fullest layer is VIS_SEM \(435px of boxes\)$/);
    assert.deepEqual(visual.ids, ["VIS_SEM"]);
    // Sized by content: the track with the 435px box gets the widest band, not the one with two boxes.
    const share = (id: string) => line(why, new RegExp(`^${id}:`))!.n!;
    assert.ok(share("Track_Visual") > share("Track_Intent") && share("Track_Intent") > share("Track_A11y"), `${share("Track_Visual")} / ${share("Track_Intent")} / ${share("Track_A11y")}`);
  });

  it("says what put each box on its layer, and which box each bent edge went round", () => {
    assert.equal(line(why, /^GIT:/)!.says, "GIT: layer 1 of 10 — nothing drawn points into it");
    assert.equal(line(why, /^CROSS:/)!.says, "CROSS: layer 6 of 10 — one past VIS_SEM (VIS_SEM → CROSS)");
    const detour = why.find((w) => w.kind === "route" && /A11Y_SEM → CROSS/.test(w.says))!;
    assert.match(detour.says, /bends past the bottom-right corner of VIS_SEM — the straight line ran \d+px through its box$/);
    assert.deepEqual(detour.ids, ["VIS_SEM"]);
  });

  it("with bands sized by content the pipeline is narrower than by count, and still clean", () => {
    assert.ok(tl.canvas.width < 2000 && tl.canvas.height < 2000, `${tl.canvas.width}×${tl.canvas.height} (1751 wide by count)`);
    assert.equal(layoutReport(tl).totals.framesWithIssues, 0);
    assert.deepEqual(checkAnimation(tl, scene).filter((x) => x.severity === "error"), []);
  });

  it("`--about` keeps what names one id; the text is grouped canvas → rows → bands → layers → detours", () => {
    const text = formatWhy(why, [], "VIS_SEM");
    assert.match(text, /^canvas — what set each axis\n  height \d+: VIS_SEM/);
    assert.ok(text.includes("bands — containers side by side, and their share\n  Track_Visual:"));
    assert.ok(text.includes("layers — what put each box where it is along the flow\n  VIS_SEM: layer 5 of 10"));
    assert.ok(text.includes("detours — edges bent round a box\n  edge-12 (A11Y_SEM → CROSS)"));
    assert.ok(!text.includes("GIT:"), "GIT does not name VIS_SEM");
    assert.equal(formatWhy(why, [], "nobody"), "nothing recorded about nobody");
  });
});

describe("why: a wide graph, a nested map, a scene with no decisions", () => {
  it("the 32-node project structure: the cli band's one layer of nine boxes is named as its fullest, and check quotes the pair that set the width", () => {
    const scene = importMermaid(mmd("project-structure")).scene;
    const tl = compileScene(scene);
    const why = (tl.meta as { why?: WhyEntry[] }).why ?? [];
    const cli = line(why, /^cli: a band/)!;
    assert.match(cli.says, /its fullest layer is diff, snapshot, check, inspect, markup_cli, api_cli, migration, labs, workflow \(\d+px of boxes\)$/);
    assert.ok(tl.canvas.width > 2000 && tl.canvas.width < 9000, `${tl.canvas.width} (13277 by count)`);
    const canvas = checkAnimation(tl, scene).find((d) => d.path === "canvas")!;
    assert.match(canvas.message, /labels stop being legible — .* need \d+px between their centres .* put them \d+% of the width apart/);
    assert.match(canvas.hint!, /`vlmkit-anim why` has every layer, band and detour$/);
  });

  it("a nested map: rows inside a parent, a band's share of the picture, a module map's own room", () => {
    const why = whyOf(fixture("modules-nested"));
    // A module map keeps the room it had before the pairwise estimate: wider than its boxes ask, and said so.
    assert.match(line(why, /^width/)!.says, /^width \d+: a module map's room for its arcs and labels — the boxes needed \d+px \+ \d+px of margins \(/);
    const named = whyOf({ ...fixture("modules-nested"), canvas: { width: 900, height: 600 } } as Scene);
    assert.match(line(named, /^canvas/)!.says, /^canvas 900×600: as the scene names it/);
    assert.equal(line(why, /^clients:/)!.says, "clients: a row of the picture — layer 1 holds nothing else");
    assert.equal(line(why, /^services:/)!.says, "services: a row inside backend — layer 3 holds nothing else of backend");
    assert.match(line(why, /^backend:/)!.says, /^backend: a band across \d+% of the picture — shares layers with infra; its fullest layer is orders, billing \(\d+px of boxes\)$/);
    assert.match(line(why, /^backend's own nodes:/)!.says, /^backend's own nodes: the whole width inside backend — nothing shares their layers; the fullest layer is gateway/);
    // A module map layers from its leaves: the sentence says what the box depends on.
    assert.equal(line(why, /^web:/)!.says, "web: layer 1 of 4 — one before gateway, which it depends on (web → gateway)");
    assert.equal(line(why, /^domain:/)!.says, "domain: layer 4 of 4 — it depends on nothing drawn");
  });

  it("a sort has nothing to explain, and says so", () => {
    assert.equal(formatWhy(whyOf(fixture("sort-bubble"))), "nothing recorded: this kind lays out by its own rule (a sort's bars, a matrix's cells), and there was no decision to explain");
  });

  it("routeAround records each detour when handed a sink", () => {
    const why: WhyEntry[] = [];
    routeAround([0, 0], [300, 0], [{ id: "x", box: { x: 130, y: -10, w: 40, h: 20 } }], new Set(), why, "edge-0 (a → b)");
    assert.equal(why.length, 1);
    assert.match(why[0].says, /^edge-0 \(a → b\): bends (above|below) x — the straight line ran 40px through its box$/);
    assert.deepEqual(why[0].ids, ["x"]);
  });
});
