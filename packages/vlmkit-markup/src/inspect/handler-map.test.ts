import assert from "node:assert";
import { test } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHandlerSurface,
  deriveHandlerIssues,
  type HandlerSurface,
  type HandlerSurfaceEntry,
} from "./handler-map.ts";

function entry(overrides: Partial<HandlerSurfaceEntry>): HandlerSurfaceEntry {
  return {
    ix: null,
    path: "div.x",
    text: "Buy",
    types: { click: 1 },
    samples: [],
    visible: true,
    containsInteractive: false,
    insideInteractive: false,
    ...overrides,
  };
}

function surface(...elements: HandlerSurfaceEntry[]): HandlerSurface {
  return { source: "x.html", elements, globals: {}, totalRegistrations: elements.length };
}

test("pointer-only control: role-less clickable div is a suspect", () => {
  const issues = deriveHandlerIssues(surface(entry({})));
  assert.ok(issues.some((i) => i.kind === "pointer-only-control" && i.severity === "suspect"));
});

test("exemptions: discovered controls, delegation containers, control interiors, keyboard twins, hidden elements", () => {
  const cases: [string, Partial<HandlerSurfaceEntry>][] = [
    ["discovered", { ix: 3 }],
    ["delegation", { containsInteractive: true }],
    ["interior", { insideInteractive: true }],
    ["keyboard twin", { types: { click: 1, keydown: 1 } }],
    ["hidden", { visible: false }],
  ];
  for (const [label, o] of cases) {
    const issues = deriveHandlerIssues(surface(entry(o)));
    assert.ok(!issues.some((i) => i.kind === "pointer-only-control"), label);
  }
});

test("unprobed handler types are surfaced, never silently dropped", () => {
  const issues = deriveHandlerIssues(surface(entry({ ix: 1, types: { wheel: 1, dragstart: 1, click: 1 } })));
  const warn = issues.find((i) => i.kind === "unprobed-handler-types");
  assert.ok(warn);
  assert.match(warn!.message, /dragstart/);
  assert.match(warn!.message, /wheel/);
  assert.doesNotMatch(warn!.message, /\bclick\b/);
});

// ---------------------------------------------------------------------------
// E2E

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const WIDGETS = join(REPO_ROOT, "fixtures/auto-markup-proof/interactive/reference-widgets.html");

test("E2E: widgets fixture surface is clean and fully attributed", { timeout: 120_000 }, async () => {
  const s = await buildHandlerSurface({ source: WIDGETS });
  assert.equal(s.totalRegistrations, 10); // listbox keydown + 8 cell keydowns + add-btn click
  const listbox = s.elements.find((e) => e.path.includes("guide-listbox"))!;
  assert.ok(listbox.types["keydown"]);
  assert.ok(listbox.ix !== null); // cross-referenced with the interaction map
  const cell = s.elements.find((e) => e.text === "W1")!;
  assert.equal(cell.insideInteractive, true); // grid interior, exempt
  assert.deepEqual(deriveHandlerIssues(s).filter((i) => i.severity === "suspect"), []);
});

test("E2E: a pointer-only div is caught; a delegation wrapper and inline onclick are handled", { timeout: 120_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "handlers-"));
  const file = join(dir, "page.html");
  writeFileSync(file, `<!doctype html><html><head><title>t</title></head><body>
    <div id="wrap">
      <button id="real">Real button</button>
    </div>
    <div id="ghost" style="width:120px;height:40px;background:#eee">Buy now</div>
    <p id="inline" onclick="void 0" style="width:80px;height:20px">inline</p>
    <script>
      document.getElementById("wrap").addEventListener("click", () => {});
      document.getElementById("ghost").addEventListener("click", () => { location.hash = "cart"; });
    </script>
  </body></html>`);
  const s = await buildHandlerSurface({ source: file });
  const issues = deriveHandlerIssues(s);
  const pointerOnly = issues.filter((i) => i.kind === "pointer-only-control");
  // ghost (addEventListener) and inline (onclick attribute) both flagged;
  // wrap is a delegation container around a real button — exempt.
  assert.equal(pointerOnly.length, 2);
  assert.ok(pointerOnly.some((i) => i.element.includes("#ghost")));
  assert.ok(pointerOnly.some((i) => i.element.includes("#inline")));
  assert.ok(!pointerOnly.some((i) => i.element.includes("#wrap")));
});
