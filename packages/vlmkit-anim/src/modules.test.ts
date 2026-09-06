/**
 * `modules`: a still-figure preset over `diagram` — layers from dependencies, containers that hold
 * exactly their members, a cycle check — and `still` rendering without a caption.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { checkAnimation } from "./check.ts";
import { compileScene, moduleCycles, moduleLayers, normalizeModules } from "./compile/index.ts";
import { layoutReport } from "./layout.ts";
import { renderFrameSvg } from "./render-svg.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { sampleFrame, timelineDuration } from "./timeline.ts";
import { SCENE_FORMAT, type DiagramScene, type ModulesScene } from "./types.ts";
import { formatDiagnostics, validateScene } from "./validate.ts";

const ex = EXAMPLES.modules;

describe("modules: layers and containers", () => {
  it("compiles clean, with no layout issues, and reads as a still (no 'no sequence' warning)", () => {
    const tl = compileScene(ex);
    const diags = checkAnimation(tl, ex);
    assert.deepEqual(diags, [], formatDiagnostics(diags));
    assert.equal(layoutReport(tl).totals.framesWithIssues, 0);
    assert.equal(tl.meta?.kind, "modules");
  });

  it("a module sits below everything it depends on (tb), or right of it (lr)", () => {
    const layers = moduleLayers(ex);
    assert.equal(layers.get("db"), 0, "db depends on nothing drawn: a leaf");
    assert.equal(layers.get("auth"), 1);
    assert.equal(layers.get("api"), 2);
    assert.equal(layers.get("web"), 3);
    const tb = sampleFrame(compileScene(ex), 0);
    assert.ok(tb.get("web")!.pos[1] < tb.get("api")!.pos[1] && tb.get("api")!.pos[1] < tb.get("auth")!.pos[1] && tb.get("auth")!.pos[1] < tb.get("db")!.pos[1]);
    const lr = sampleFrame(compileScene({ ...ex, layout: "lr" }), 0);
    assert.ok(lr.get("web")!.pos[0] < lr.get("api")!.pos[0] && lr.get("api")!.pos[0] < lr.get("db")!.pos[0]);
  });

  it("a container is drawn around exactly its members: every member inside, no bystander inside", () => {
    const tl = compileScene(ex);
    const frame = sampleFrame(tl, 0);
    const inside = (id: string, box: { pos: [number, number]; size?: [number, number] }) => {
      const p = frame.get(id)!.pos;
      const [w, h] = box.size!;
      return Math.abs(p[0] - box.pos[0]) < w / 2 && Math.abs(p[1] - box.pos[1]) < h / 2;
    };
    for (const g of ex.groups!) {
      const box = frame.get(g.id)!;
      for (const m of g.modules) assert.ok(inside(m, box), `${m} is outside its container ${g.id}`);
      for (const other of ex.modules.map((m) => (typeof m === "string" ? m : m.id))) {
        if (!g.modules.includes(other)) assert.ok(!inside(other, box), `${other} is inside ${g.id}, which is not its group`);
      }
    }
    assert.equal(frame.get("core-label")!.text, "core");
  });

  it("highlighting a group lights its outline; the group and 'a->b' are anchors", () => {
    // The fixture is the example plus a sequence that highlights the core group and relates web to db.
    const walked = JSON.parse(readFileSync(new URL("../fixtures/modules-web-service.json", import.meta.url), "utf8")) as ModulesScene;
    const tl = compileScene(walked);
    const end = sampleFrame(tl, timelineDuration(tl));
    const t = tl.steps!.find((s) => s.caption?.startsWith("The core"))!.t;
    assert.equal(sampleFrame(tl, t + 1).get("core")!.stroke, "#f59e0b");
    assert.notEqual(end.get("core")!.stroke, "#f59e0b", "unhighlighted again at the end");
    assert.ok(tl.nodes.some((n) => n.id.startsWith("relate-main-") && n.id.endsWith("-label") && n.text === "never directly"));
  });

  it("a dependency cycle is a warning naming the path; the map still compiles", () => {
    const cyclic: ModulesScene = { format: SCENE_FORMAT, kind: "modules", modules: ["a", "b", "c"], deps: [["a", "b"], ["b", "c"], ["c", "a"]] };
    assert.deepEqual(moduleCycles(cyclic), [["a", "b", "c", "a"]]);
    const tl = compileScene(cyclic);
    const diags = checkAnimation(tl, cyclic);
    assert.ok(diags.some((d) => d.severity === "warn" && /dependency cycle: a → b → c → a/.test(d.message)), formatDiagnostics(diags));
  });

  it("validator: unknown modules in deps and groups, a module in two groups, a non-module id", () => {
    const diags = validateScene({
      format: SCENE_FORMAT,
      kind: "modules",
      modules: ["a", { id: "b" }, { label: "no id" }],
      deps: [["a", "zz"], { from: "b", to: "a", style: "dashed" }, ["a"]],
      groups: [{ id: "g1", modules: ["a", "b"] }, { id: "g2", modules: ["b"] }, { id: "a", modules: ["a"] }],
    });
    const paths = diags.map((d) => d.path);
    assert.ok(paths.includes("modules[2].id"), formatDiagnostics(diags));
    assert.ok(paths.includes("deps[0][1]"));
    assert.ok(paths.includes("deps[1].style"));
    assert.ok(paths.includes("deps[2]"));
    assert.ok(paths.includes("groups[1].modules[0]"));
    assert.ok(paths.includes("groups[2].id"));
    const ok = validateScene(ex);
    assert.deepEqual(ok.filter((d) => d.severity === "error"), [], formatDiagnostics(ok));
  });

  it("normalises to a diagram with groups, sized for the map", () => {
    const d = normalizeModules(ex);
    assert.equal(d.kind, "diagram");
    assert.equal(d.nodes.length, 6);
    assert.equal(d.edges!.length, 6);
    assert.equal(d.groups!.length, 3);
    assert.equal(d.layout, "tb");
    assert.ok((d.canvas!.height ?? 0) >= 4 * 60, "four layers need height");
  });
});

describe("diagram groups and still", () => {
  it("a plain diagram takes groups too; a group id is a show/hide target", () => {
    const scene: DiagramScene = {
      format: SCENE_FORMAT,
      kind: "diagram",
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }],
      groups: [{ id: "left", label: "left", nodes: ["a", "b"] }],
      sequence: [{ hide: "left", caption: "the left side goes" }],
    };
    const tl = compileScene(scene);
    const diags = checkAnimation(tl, scene).filter((d) => d.severity === "error");
    assert.deepEqual(diags, []);
    assert.equal(sampleFrame(tl, timelineDuration(tl)).get("left")!.opacity, 0);
  });

  it("a still is the frame without its caption", () => {
    const tl = compileScene(ex);
    const svg = renderFrameSvg(tl, timelineDuration(tl), { caption: false });
    assert.doesNotMatch(svg, /data-caption/);
    assert.match(svg, /infrastructure/);
  });
});
