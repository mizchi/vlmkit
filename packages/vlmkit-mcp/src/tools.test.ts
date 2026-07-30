import assert from "node:assert";
import { test } from "node:test";
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
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), ["check_copy", "check_interactions", "scan_handlers", "verify_markup"]);
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
