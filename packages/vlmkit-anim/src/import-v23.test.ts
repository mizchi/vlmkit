/**
 * v23: mermaid in, Markdown out. `importMermaid` reads the common subset of flowchart / graph, sequenceDiagram and
 * stateDiagram-v2 into scenes that compile, and says what it dropped; `renderFence` / `remarkVlmAnim` turn a
 * ```vlm-anim fence into the runtime or the still SVG, with an error box instead of a build failure.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { checkAnimation } from "./check.ts";
import { compileScene } from "./compile/index.ts";
import { formatImport, importMermaid, mermaidSource } from "./import/mermaid.ts";
import { layoutReport } from "./layout.ts";
import remarkVlmAnim, { parseFenceMeta, renderFence } from "./remark.ts";
import type { DiagramScene, FlowchartScene, Scene, SequenceScene, StateMachineScene } from "./types.ts";
import { formatDiagnostics, hasErrors, validateScene } from "./validate.ts";

const mmd = (name: string): string => readFileSync(join(import.meta.dirname, "..", "fixtures", "mermaid", `${name}.mmd`), "utf8");
const clean = (scene: Scene) => {
  const d = validateScene(scene);
  assert.ok(!hasErrors(d), formatDiagnostics(d));
  const tl = compileScene(scene);
  assert.deepEqual(checkAnimation(tl, scene).filter((x) => x.severity === "error"), []);
  return tl;
};

describe("import mermaid: sequenceDiagram", () => {
  const r = importMermaid(mmd("checkout"));
  const s = r.scene as SequenceScene;

  it("participants with labels and kinds, messages with their kinds, loop / alt frames, a note, the title", () => {
    assert.equal(s.kind, "sequence");
    assert.equal(s.title, "Place order");
    assert.deepEqual(s.participants[0], { id: "customer", label: "Customer", kind: "actor" });
    assert.deepEqual(s.participants[1], { id: "shop", label: "Shop" });
    assert.equal(r.counts.messages, 8);
    assert.equal(r.counts.frames, 2);
    const loop = s.messages.find((m) => typeof m === "object" && "loop" in m) as { loop: string; items: unknown[] };
    assert.equal(loop.loop, "until paid, max 2");
    const alt = loop.items[1] as { alt: { when: string; items: unknown[] }[] };
    assert.deepEqual(alt.alt.map((b) => b.when), ["declined", "approved"]);
    assert.deepEqual(alt.alt[0].items[0], { from: "payment", to: "shop", label: "declined", kind: "return" });
    assert.ok(s.messages.some((m) => typeof m === "object" && "note" in m && (m as { at?: string }).at === "shop"));
    assert.deepEqual(s.messages[s.messages.length - 2], { from: "shop", to: "mail", label: "send confirmation", kind: "async" });
    assert.deepEqual(r.dropped, []);
    const tl = clean(s);
    assert.deepEqual(tl.meta?.messages, ["customer->shop:place order", "shop->stock:reserve(items)", "stock->shop:reserved", "shop->payment:charge(card)", "payment->shop:declined", "payment->shop:receipt", "shop->mail:send confirmation", "shop->customer:order #4711"]);
  });

  it("frames the IR does not have are named: opt becomes a labelled loop frame, par is flattened", () => {
    const r2 = importMermaid("sequenceDiagram\n  A->>B: hi\n  opt maybe\n    B-->>A: ok\n  end\n  par both\n    A->>C: x\n  and\n    A->>D: y\n  end");
    const s2 = r2.scene as SequenceScene;
    assert.ok(s2.messages.some((m) => typeof m === "object" && "loop" in m && (m as { loop: string }).loop === "opt: maybe"));
    assert.equal(r2.counts.messages, 4);
    assert.ok(r2.dropped.some((d) => /opt drawn as a loop frame/.test(d)));
    assert.ok(r2.dropped.some((d) => /par flattened/.test(d)));
    assert.equal(s2.messages.length, 4, "the par's two messages sit in the top level");
  });
});

describe("import mermaid: stateDiagram-v2", () => {
  const r = importMermaid(mmd("order-state"));
  const s = r.scene as StateMachineScene;

  it("states (labelled, final), the initial state, transitions with their events, and no trace yet", () => {
    assert.equal(s.kind, "state-machine");
    assert.equal(s.initial, "Cart");
    assert.deepEqual(s.states.find((x) => typeof x === "object" && x.id === "Checkout"), { id: "Checkout", label: "Payment pending" });
    assert.deepEqual(s.states.find((x) => typeof x === "object" && x.id === "Shipped"), { id: "Shipped", final: true });
    assert.deepEqual(s.transitions, [
      { from: "Cart", to: "Checkout", on: "checkout" },
      { from: "Checkout", to: "Paid", on: "pay" },
      { from: "Checkout", to: "Cart", on: "back" },
      { from: "Paid", to: "Shipped", on: "ship" },
    ]);
    assert.deepEqual(s.trace, []);
    assert.ok(r.dropped.some((d) => /no trace/.test(d)));
    clean(s);
    assert.match(formatImport(r), /stateDiagram → state-machine: 4 states · 4 transitions/);
  });
});

describe("import mermaid: flowchart / graph", () => {
  it("a graph with subgraphs and no decision is a diagram with groups; <br/> in a label is a line break", () => {
    const r = importMermaid(mmd("pipeline"));
    const s = r.scene as DiagramScene;
    assert.equal(s.kind, "diagram");
    assert.equal(s.layout, "tb");
    assert.ok(s.nodes.some((n) => n.id === "GIT" && n.label === "Git Diff\n(code change)"));
    const groups = s.groups ?? [];
    assert.ok(groups.length >= 7, `${groups.length} groups`);
    const intent = groups.find((g) => g.id === "Track_Intent")!;
    assert.equal(intent.label, "Track 1: Diff Intent");
    assert.equal(intent.parent, "Parallel", "a nested subgraph keeps its parent");
    assert.deepEqual(intent.nodes, ["PARSE_DIFF", "DEP_GRAPH", "AFFECTED", "INTENT"], "GIT was declared in Input first and stays there");
    assert.ok(s.edges!.some((e) => e.from === "GIT" && e.to === "PARSE_DIFF"));
    assert.ok(r.dropped.some((d) => /5 style/.test(d)));
    assert.equal(r.counts.nodes, 22);
    const tl = clean(s);
    // A diagram without a canvas is sized to fit (the default 640×360 laid these 22 nodes off the page), by the
    // widest layer's own boxes — not the widest label times the widest layer, which quadrupled it.
    assert.ok(tl.canvas.width > 640 && tl.canvas.width < 2000 && tl.canvas.height > 360, `${tl.canvas.width}×${tl.canvas.height}`);
    // …and the three tracks under one "Parallel" subgraph each get their own slots (pa, pb: one shared band
    // spread their members evenly and the middle track's widest box crossed both neighbours), the a11y arrow
    // into the merge box goes round that widest box instead of through it.
    assert.equal(layoutReport(tl).totals.framesWithIssues, 0, layoutReport(tl).frames.flatMap((f) => f.issues.map((x) => `${x.kind} ${x.nodes.join(" × ")}`)).join("\n"));
    assert.deepEqual(r.notes, ["1 label(s) over 300px wide (VIS_SEM) — the canvas grows to fit the widest; a <br/> or a shorter label keeps the picture legible"]);
    assert.ok(r.dropped.some((d) => /1 direction line\(s\) inside a subgraph/.test(d)), r.dropped.join("\n"));
  });

  it("a flowchart with a decision diamond is a flowchart: shapes map, edge labels are the answers, `&` fans out", () => {
    const r = importMermaid('flowchart LR\n  s([Start]) --> q{n > 0?}\n  q -->|yes| a[/read/]\n  q -- no --> e((End))\n  a --> b & c\n  b & c --> e\n  style q fill:#fff\n  click a "https://x"');
    const s = r.scene as FlowchartScene;
    assert.equal(s.kind, "flowchart");
    assert.equal(s.layout, "lr");
    assert.deepEqual(s.nodes[0], { id: "s", label: "Start", shape: "terminal" });
    assert.deepEqual(s.nodes[1], { id: "q", label: "n > 0?", shape: "decision" });
    assert.deepEqual(s.nodes[2], { id: "a", label: "read", shape: "io" });
    assert.deepEqual(s.edges[1], { from: "q", to: "a", label: "yes" });
    assert.deepEqual(s.edges[2], { from: "q", to: "e", label: "no" });
    assert.equal(s.edges.length, 7);
    assert.ok(r.dropped.some((d) => /1 style/.test(d)) && r.dropped.some((d) => /1 click/.test(d)));
    clean(s);
  });

  it("--as modules turns the same graph into a module map with the subgraphs as containers", () => {
    const r = importMermaid(mmd("project-structure"), { as: "modules" });
    assert.equal(r.scene.kind, "modules");
    const m = r.scene as { groups?: { id: string; modules: string[] }[]; modules: unknown[] };
    assert.ok(m.groups!.some((g) => g.id === "packages" && g.modules.includes("core")));
    assert.ok(m.modules.length >= 30);
  });

  it("the source is found in a Markdown page's first mermaid fence, and a non-diagram is refused", () => {
    const page = "# Doc\n\ntext\n\n```mermaid\nflowchart TB\n  a --> b\n```\n\nmore\n";
    assert.equal(mermaidSource(page), "flowchart TB\n  a --> b\n");
    assert.equal(mermaidSource("just prose"), undefined);
    assert.throws(() => importMermaid("pie\n  \"a\": 1"), /not a mermaid diagram this reads/);
  });
});

describe("remark: a ```vlm-anim fence", () => {
  const scene = JSON.stringify({ format: "vlmkit-anim/scene@1", kind: "sort", values: [3, 1, 2], algorithm: "bubble" });

  it("renders the runtime once and one <vlm-anim> per fence; `still` renders the figure; an error is a box", () => {
    const first = renderFence(scene, {});
    assert.ok(first.ok && first.runtimeIncluded);
    assert.match(first.html, /^<script>[\s\S]*customElements\.define\("vlm-anim"[\s\S]*<\/script>\n<div class="vlm-anim" data-kind="sort"/);
    assert.match(first.html, /<vlm-anim autoplay><script type="application\/json">\{"format":"vlmkit-anim\/timeline@1"/);
    const second = renderFence(scene, { includeRuntime: false, loop: true, controls: false });
    assert.ok(!second.runtimeIncluded);
    assert.match(second.html, /^<div class="vlm-anim"[^>]*><vlm-anim autoplay loop nocontrols>/);
    const still = renderFence(scene, { still: true });
    assert.match(still.html, /^<figure class="vlm-anim vlm-anim-still" data-kind="sort"><svg/);
    assert.ok(!/<script/.test(still.html));
    const bad = renderFence('{"format": "vlmkit-anim/scene@1", "kind": "sort"}', {});
    assert.ok(!bad.ok);
    assert.match(bad.html, /^<pre class="vlm-anim vlm-anim-error">vlm-anim: the scene did not compile/);
    assert.match(renderFence("not json", {}).html, /not JSON/);
  });

  it("the plugin replaces code nodes in place, runtime on the first only; other fences are untouched", () => {
    const tree = {
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "hi" }] },
        { type: "code", lang: "vlm-anim", value: scene },
        { type: "code", lang: "js", value: "1" },
        { type: "blockquote", children: [{ type: "code", lang: "vlm-anim", meta: "still", value: scene }] },
        { type: "code", lang: "vlm-anim", value: scene },
      ],
    };
    remarkVlmAnim()(tree);
    const kinds = tree.children.map((c) => c.type);
    assert.deepEqual(kinds, ["paragraph", "html", "code", "blockquote", "html"]);
    assert.match((tree.children[1] as { value: string }).value, /^<script>/);
    assert.ok(!/^<script>/.test((tree.children[4] as { value: string }).value), "the runtime is inlined once");
    const inner = (tree.children[3] as { children: { type: string; value: string }[] }).children[0];
    assert.equal(inner.type, "html");
    assert.match(inner.value, /^<figure/);
    assert.deepEqual(parseFenceMeta("still autoplay=false nocontrols"), { still: true, autoplay: false, controls: false });
  });
});
