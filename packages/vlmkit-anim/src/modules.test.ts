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
      deps: [["a", "zz"], { from: "b", to: "a", style: "dotted" }, ["a"]],
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

describe("modules: v13 — the writers' friction", () => {
  const base = { format: SCENE_FORMAT, kind: "modules" } as const;
  const nodeOf = (tl: ReturnType<typeof compileScene>, id: string) => tl.nodes.find((n) => n.id === id)!;

  it("two modules with the same dependencies share a layer, whatever depends on them (fa)", () => {
    // `root` reaches `x` in one hop and `y` in two; under a root walk they landed on different layers.
    const s: ModulesScene = { ...base, modules: ["root", "mid", "x", "y", "core"], deps: [["root", "x"], ["root", "mid"], ["mid", "y"], ["x", "core"], ["y", "core"]] };
    const tl = compileScene(s);
    assert.equal(nodeOf(tl, "x").pos![1], nodeOf(tl, "y").pos![1], "x and y both depend on core alone: one layer");
    assert.ok(nodeOf(tl, "core").pos![1] > nodeOf(tl, "x").pos![1], "core, the leaf, is at the bottom");
    assert.ok(nodeOf(tl, "root").pos![1] < nodeOf(tl, "mid").pos![1], "root above mid");
  });

  it("a group that owns its layers is a full-width row; groups sharing a layer get bands (fd)", () => {
    const s: ModulesScene = {
      ...base,
      modules: ["web", "gateway", "checkout", "inventory", "payments", "orders", "db", "queue"],
      deps: [["web", "gateway"], ["gateway", "checkout"], ["checkout", "inventory"], ["checkout", "payments"], ["checkout", "orders"], ["inventory", "db"], ["orders", "db"], ["orders", "queue"], ["payments", "queue"]],
      groups: [
        { id: "frontend", modules: ["web", "gateway"] },
        { id: "domain", modules: ["checkout", "inventory", "payments", "orders"] },
        { id: "platform", modules: ["db", "queue"] },
      ],
    };
    const tl = compileScene(s);
    const fe = nodeOf(tl, "frontend");
    const dom = nodeOf(tl, "domain");
    const pf = nodeOf(tl, "platform");
    // Stacked: each container below the previous, none beside another.
    assert.ok(fe.pos![1] + fe.size![1] / 2 <= dom.pos![1] - dom.size![1] / 2 + 1, "frontend above domain");
    assert.ok(dom.pos![1] + dom.size![1] / 2 <= pf.pos![1] - pf.size![1] / 2 + 1, "domain above platform");
    assert.ok(Math.abs(fe.pos![0] - dom.pos![0]) < tl.canvas.width / 4, "rows are centred on the same axis, not staggered into bands");
    assert.equal(layoutReport(tl).totals.crossed, 0);
  });

  it("a forbidden dependency is drawn dashed in the bad colour, labelled ✗ by default, and ignored by layers and cycles (fb, fe)", () => {
    const s: ModulesScene = {
      ...base,
      modules: ["app", "domain", "port", "postgres"],
      deps: [["app", "domain"], ["app", "port"], ["postgres", "port"], { from: "domain", to: "postgres", style: "forbidden" }],
    };
    assert.deepEqual(moduleCycles(s), []);
    assert.equal(moduleLayers(s).get("domain"), 0, "domain depends on nothing real: a leaf, whatever the forbidden edge says");
    const tl = compileScene(s);
    const edge = nodeOf(tl, "edge-3");
    assert.equal(edge.dashed, true);
    assert.notEqual(edge.stroke, nodeOf(tl, "edge-0").stroke, "not the ordinary edge colour");
    assert.equal(nodeOf(tl, "edge-3-label").text, "✗");
    assert.ok(nodeOf(tl, "domain").pos![1] >= nodeOf(tl, "postgres").pos![1] - 1, "domain is not pushed above postgres by an edge that must not exist");
    const diags = checkAnimation(tl, s);
    assert.deepEqual(diags.filter((d) => d.severity === "error"), [], formatDiagnostics(diags));
    assert.ok(!diags.some((d) => /cycle/.test(d.message)));
    const dashed: ModulesScene = { ...base, modules: ["a", "b"], deps: [{ from: "a", to: "b", style: "dashed", label: "optional peer" }] };
    assert.equal(nodeOf(compileScene(dashed), "edge-0").dashed, true);
    assert.equal(nodeOf(compileScene(dashed), "edge-0-label").halo, true, "an edge label sits on lines: haloed");
  });

  it("highlight takes an edge \"a->b\": the stroke lights up and the validator accepts it (fc, fd)", () => {
    const s: ModulesScene = {
      ...base,
      modules: ["a", "b", "c"],
      deps: [["a", "b"], { from: "b", to: "c", label: "async" }],
      sequence: [{ highlight: ["b->c"], caption: "the asynchronous hop" }, { unhighlight: "b->c" }],
    };
    assert.deepEqual(validateScene(s).filter((d) => d.severity === "error"), [], formatDiagnostics(validateScene(s)));
    const tl = compileScene(s);
    const t = tl.steps!.find((st) => st.caption === "the asynchronous hop")!.t;
    const frame = sampleFrame(tl, t + 1);
    assert.notEqual(frame.get("edge-1")!.stroke, frame.get("edge-0")!.stroke, "the highlighted edge differs from the plain one");
    assert.equal(sampleFrame(tl, timelineDuration(tl)).get("edge-1")!.stroke, frame.get("edge-0")!.stroke, "unhighlight restores it");
  });

  it("an edge that would run behind a box that is not one of its ends bends around it; a flow follows the bend", () => {
    // `top` depends on `bottom` two layers down, with `mid` directly in between.
    const s: ModulesScene = { ...base, modules: ["top", "mid", "bottom"], deps: [["top", "mid"], ["mid", "bottom"], ["top", "bottom"]], sequence: [{ flow: "top->bottom" }] };
    const tl = compileScene(s);
    const long = nodeOf(tl, "edge-2");
    assert.equal(long.shape, "path", "bent: a path through a waypoint");
    assert.ok(long.head, "still an arrow");
    assert.equal(layoutReport(tl).totals.crossed, 0);
    const token = tl.tracks.filter((tr) => tr.target === "token" && tr.prop === "pos");
    assert.ok(token.some((tr) => tr.keyframes.length >= 3), "the token visits the waypoint");
  });

  it("relate takes a tone: bad is the bad colour and dashed; its label is haloed", () => {
    const s: ModulesScene = { ...base, modules: ["a", "b"], deps: [], sequence: [{ relate: { from: "a", to: "b", label: "never", tone: "bad" } }] };
    const tl = compileScene(s);
    const line = tl.nodes.find((n) => /^relate-main-\d+$/.test(n.id))!;
    assert.equal(line.dashed, true);
    assert.equal(line.stroke, nodeOf(compileScene({ ...s, sequence: [] }), "a").stroke === line.stroke ? "no" : line.stroke);
    assert.equal(tl.nodes.find((n) => /^relate-main-\d+-label$/.test(n.id))!.halo, true);
  });
});
