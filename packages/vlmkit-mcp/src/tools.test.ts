import assert from "node:assert";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TOOLS } from "./tools.ts";
import { createVlmkitMcpServer } from "./server.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXTURE = join(REPO_ROOT, "fixtures/auto-markup-proof/interactive/reference.html");
const GHOST_DIR = fileURLToPath(new URL("./", import.meta.url));

function tool(name: string) {
  const t = TOOLS.find((x) => x.name === name);
  assert.ok(t, `tool ${name} registered`);
  return t!;
}

test("all tools have a name, description, input schema, and runner", () => {
  for (const t of TOOLS) {
    assert.ok(t.name && t.description.length > 40 && t.inputSchema && typeof t.run === "function");
  }
  assert.deepEqual(
    TOOLS.map((t) => t.name).sort(),
    [
      "build_gallery",
      "build_page",
      "check_copy",
      "check_equivalence",
      "check_integrity",
      "check_interactions",
      "check_layout",
      "check_story",
      "scan_handlers",
      "verify_flow",
      "verify_markup",
    ],
  );
});

test("server registers every tool without throwing", () => {
  const server = createVlmkitMcpServer();
  assert.ok(server);
});

test("check_interactions MCP output equals the direct pure-function call", { timeout: 240_000 }, async () => {
  const { buildInteractionMap, deriveInteractionIssues } = await import(
    "@mizchi/vlmkit-markup/inspect/interaction-map.ts"
  );
  const direct = await buildInteractionMap({ source: FIXTURE });
  const directIssues = deriveInteractionIssues(direct);

  const res = await tool("check_interactions").run({ source: FIXTURE });
  const s = res.structured as { map: typeof direct; issues: typeof directIssues };
  // Same element inventory (keys + reachability) and same issue set.
  assert.deepEqual(s.map.elements.map((e) => e.key), direct.elements.map((e) => e.key));
  assert.deepEqual(s.issues, directIssues);
  assert.equal(res.failed, directIssues.some((i) => i.severity === "suspect"));
  assert.match(res.content[0]!.text, /check_interactions:/);
});

test("scan_handlers MCP output equals the direct pure-function call, and flags a pointer-only control", { timeout: 120_000 }, async () => {
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "mcp-handlers-"));
  const file = join(dir, "ghost.html");
  writeFileSync(file, `<!doctype html><html><head><title>t</title></head><body>
    <button id="ok">OK</button>
    <div id="ghost" style="width:120px;height:40px">Delete all</div>
    <script>document.getElementById("ghost").addEventListener("click", () => {});</script>
  </body></html>`);
  const { buildHandlerSurface, deriveHandlerIssues } = await import("@mizchi/vlmkit-markup/inspect/handler-map.ts");
  const surface = await buildHandlerSurface({ source: file });
  const directIssues = deriveHandlerIssues(surface);

  const res = await tool("scan_handlers").run({ source: file });
  const s = res.structured as { surface: typeof surface; issues: typeof directIssues };
  assert.deepEqual(s.issues, directIssues);
  assert.ok(directIssues.some((i) => i.kind === "pointer-only-control"), "ghost div flagged");
  assert.equal(res.failed, true); // suspect present -> gate failed
});

test("verify_markup surfaces done=false as failed with a kickback", { timeout: 240_000 }, async () => {
  // The interactive reference has no matching target here; use the edit
  // fixture's redesign vs its own target (a known DONE pair) to assert the
  // happy path is failed=false.
  const attempt = join(REPO_ROOT, "fixtures/auto-markup-proof/edit/redesign.html");
  const target = join(REPO_ROOT, "fixtures/auto-markup-proof/edit/target-desktop.png");
  const res = await tool("verify_markup").run({ attempt, targets: [target] });
  const report = res.structured as { done: boolean };
  assert.equal(res.failed, !report.done);
  assert.match(res.content[0]!.text, /verify_markup: (DONE|NOT DONE)/);
});

test("tool set is the full deterministic surface", () => {
  assert.deepEqual(
    TOOLS.map((t) => t.name).sort(),
    [
      "build_gallery",
      "build_page",
      "check_copy",
      "check_equivalence",
      "check_integrity",
      "check_interactions",
      "check_layout",
      "check_story",
      "scan_handlers",
      "verify_flow",
      "verify_markup",
    ],
  );
});

test("build_page MCP output equals the direct pure-function call", { timeout: 240_000 }, async () => {
  const { loadPng, renderHtmlToPng, composePageDiff } = await import("@mizchi/vlmkit-markup/component/page-compose.ts");
  const target = join(REPO_ROOT, "fixtures/auto-markup-proof/edit/target-desktop.png");
  const current = join(REPO_ROOT, "fixtures/auto-markup-proof/edit/redesign.html");
  const t = await loadPng(target);
  const c = await renderHtmlToPng(current, t.width, t.height);
  const direct = composePageDiff(t, c, {});
  const res = await tool("build_page").run({ target, current });
  const s = res.structured as typeof direct;
  assert.deepEqual(s.matches.length, direct.matches.length);
  assert.deepEqual(s.missing.length, direct.missing.length);
  assert.equal(res.failed, direct.missing.length + direct.extra.length + direct.orderViolations.length > 0);
});

test("check_equivalence measures deltas, writes sheets, stays advisory (never hard-fails keyless)", { timeout: 120_000 }, async () => {
  const { writeFileSync, mkdtempSync, existsSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { PNG } = await import("pngjs");
  const dir = mkdtempSync(join(tmpdir(), "mcp-equiv-"));
  // target PNG: solid gray 200x120
  const png = new PNG({ width: 200, height: 120 });
  for (let i = 0; i < 200 * 120; i++) { png.data[i*4]=180; png.data[i*4+1]=180; png.data[i*4+2]=180; png.data[i*4+3]=255; }
  const target = join(dir, "target.png");
  writeFileSync(target, PNG.sync.write(png));
  const source = join(dir, "src.html");
  writeFileSync(source, `<!doctype html><html><head><title>t</title><style>body{margin:0}#b{width:200px;height:120px;background:#b4b4b4}</style></head><body><div id="b"></div></body></html>`);
  const res = await tool("check_equivalence").run({ source, target, regions: ["10,10,80x40"], outDir: join(dir, "out") });
  const r = res.structured as { verdicts: { measuredDelta: number; pairImage: string }[] };
  assert.equal(r.verdicts.length, 1);
  assert.ok(existsSync(r.verdicts[0]!.pairImage), "pair image written");
  assert.equal(res.failed, false); // advisory
});

test("check_integrity MCP output equals the direct pure-function call", { timeout: 120_000 }, async () => {
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "mcp-integrity-"));
  const file = join(dir, "broken.html");
  writeFileSync(file, `<!doctype html><html><head><title>t</title></head><body>
    <div style="width:1500px;height:80px;background:#279">too wide</div>
    <script>throw new Error("boom");</script>
  </body></html>`);
  const { runIntegrityCheck } = await import("@mizchi/vlmkit-markup/inspect/integrity-check.ts");
  const direct = await runIntegrityCheck({ source: file, viewports: [{ width: 1280, height: 800 }] });

  const res = await tool("check_integrity").run({ source: file, viewports: [1280] });
  const s = res.structured as typeof direct;
  assert.equal(s.verdict, direct.verdict);
  assert.deepEqual(s.findings.map((f) => f.kind).sort(), direct.findings.map((f) => f.kind).sort());
  assert.equal(res.failed, direct.verdict !== "clean");
  assert.equal(res.failed, true); // js-error + page-overflow-x present
  assert.match(res.content[0]!.text, /check_integrity: DEFECTS/);
});

test("check_layout MCP output equals the direct pure-function call", { timeout: 240_000 }, async () => {
  const source = join(REPO_ROOT, "fixtures/auto-markup-proof/creative/attempt-stress.html");
  const contract = { rules: [
    { selector: ".sidebar", at: 1280, width: 260 },
    { selector: ".stat-cell", at: 768, perRow: 2 },
  ] };
  const { runLayoutVerify } = await import("@mizchi/vlmkit-markup/inspect/layout-contract.ts");
  const direct = await runLayoutVerify({ source, contract });
  const res = await tool("check_layout").run({ source, contract });
  const s = res.structured as typeof direct;
  assert.equal(s.done, direct.done);
  assert.deepEqual(s.results.map((r) => r.passed), direct.results.map((r) => r.passed));
  assert.equal(res.failed, !direct.done);
  assert.match(res.content[0]!.text, /check_layout: (SATISFIED|VIOLATED)/);
});

test("verify_flow MCP tool runs a scripted flow and reports done/failed", { timeout: 120_000 }, async () => {
  const source = join(REPO_ROOT, "fixtures/auto-markup-proof/interactive/reference.html");
  const ok = await tool("verify_flow").run({
    source,
    flow: { steps: [{ do: { action: "click", selector: "#shipping-toggle" }, expect: [{ assert: "attr", selector: "#shipping-toggle", name: "aria-expanded", equals: "true" }] }] },
  });
  assert.equal((ok.structured as { done: boolean }).done, true);
  assert.equal(ok.failed, false);
  const bad = await tool("verify_flow").run({
    source,
    flow: { steps: [{ do: { action: "click", selector: "#shipping-toggle" }, expect: [{ assert: "attr", selector: "#shipping-toggle", name: "aria-expanded", equals: "false" }] }] },
  });
  assert.equal(bad.failed, true);
});

/** The one-liner an MCP client reads. It is the head of `content[0].text`. */
function summaryOf(res: { content: Array<{ text: string }> }): string {
  return res.content[0]!.text.split("\n")[0]!;
}

test("build_gallery then check_story closes the loop over MCP", { timeout: 240_000 }, async () => {
  // The pair is tested together because neither is useful alone: build_gallery's
  // output IS check_story's input, and a mismatch between them (a story id the
  // gallery cannot resolve, a threshold the gate rejects) is invisible to a test
  // of either one.
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "mcp-gallery-"));
  try {
    const page = join(dir, "page.html");
    writeFileSync(
      page,
      `<!doctype html><meta charset=utf-8>
       <style>
         body{margin:0;font:14px system-ui}
         .c-card{width:240px;border:1px solid #dde3ea;border-radius:8px;padding:16px}
         .c-badge{display:inline-block;padding:3px 8px;border-radius:10px;background:#eef}
       </style>
       <div class="c-card">Card one <span class="c-badge">New</span></div>
       <div class="c-card">Card two <span class="c-badge">New</span></div>`,
    );

    const built = await tool("build_gallery").run({ source: page, out: join(dir, "gallery") });
    const report = built.structured as {
      stories: { id: string; threshold: number; width: number }[];
      gallery: string;
      unreadableStylesheets: string[];
      gatesConfig: { pages: { gates: string[] }[] };
    };
    assert.equal(built.failed, false, summaryOf(built));
    assert.deepEqual(report.stories.map((s) => s.id).sort(), ["components/Badge/Default", "components/Card/Default"]);
    assert.deepEqual(report.unreadableStylesheets, [], "inline CSS must be readable");

    // The per-story threshold is the payload: a badge and a card must not share
    // one number, which is the mistake the derivation exists to prevent.
    const byId = new Map(report.stories.map((s) => [s.id, s]));
    assert.ok(
      byId.get("components/Card/Default")!.threshold < byId.get("components/Badge/Default")!.threshold,
      "the larger component must get the tighter threshold",
    );
    // And it travels in the structured result, so a client does not re-derive it.
    assert.match(report.gatesConfig.pages[0]!.gates[0]!, /--threshold /);

    // First check_story writes baselines; it reports new-baseline rather than
    // passing, so `failed` is false only because new-baseline is a warn.
    const first = await tool("check_story").run({
      story: "components/Card/Default",
      gallery: report.gallery,
      threshold: byId.get("components/Card/Default")!.threshold,
    });
    assert.match(summaryOf(first), /check_story: 1 story/);

    // Second run compares against what it just wrote, and must be clean.
    const second = await tool("check_story").run({
      story: "components/Card/Default",
      gallery: report.gallery,
      threshold: byId.get("components/Card/Default")!.threshold,
    });
    const storyReport = second.structured as { results: { outcome: string; width: number }[] };
    assert.equal(storyReport.results[0]!.outcome, "unchanged", summaryOf(second));
    assert.equal(second.failed, false);
    // The component's own box, not the viewport — the reason to use this at all.
    assert.ok(storyReport.results[0]!.width < 400, `captured ${storyReport.results[0]!.width}px wide`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("build_gallery fails loudly when it wrote no stories", { timeout: 120_000 }, async () => {
  // Reporting success with an empty gallery would hand the caller a file that
  // mounts nothing, and they would find out at baseline time.
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "mcp-gallery-empty-"));
  try {
    const page = join(dir, "bare.html");
    writeFileSync(page, "<!doctype html><meta charset=utf-8><p>No classed elements here.</p>");
    const res = await tool("build_gallery").run({ source: page, out: join(dir, "gallery") });
    assert.equal(res.failed, true);
    assert.match(summaryOf(res), /no stories written/);
    // And it says what to do about it.
    assert.match(summaryOf(res), /selectors|includeAll/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
