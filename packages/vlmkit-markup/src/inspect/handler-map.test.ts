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
    ancestorTypes: [],
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

// ---------------------------------------------------------------------------
// Surface contract compare

test("surface contract: lost categories warn, delegation and type-detail differences do not", async () => {
  const { compareHandlerSurfaces } = await import("./handler-map.ts");
  const ref: HandlerSurface = surface(
    entry({ text: "Add to cart", types: { click: 1, keydown: 1 } }),
    entry({ text: "Sort", types: { mousedown: 1 } }),
    entry({ text: "Filter", types: {}, ancestorTypes: ["click"] }), // via delegation
  );
  // attempt: Add loses keyboard; Sort uses click instead of mousedown (fine);
  // Filter wires click directly instead of delegating (fine).
  const att: HandlerSurface = surface(
    entry({ text: "Add to cart", types: { click: 1 } }),
    entry({ text: "Sort", types: { click: 2 } }),
    entry({ text: "Filter", types: { click: 1 } }),
  );
  const mismatches = compareHandlerSurfaces(ref, att);
  assert.equal(mismatches.length, 1);
  assert.match(mismatches[0]!.message, /"Add to cart"/);
  assert.match(mismatches[0]!.message, /keyboard/);
});

test("surface contract: lost global category warns; identical surfaces are clean", async () => {
  const { compareHandlerSurfaces } = await import("./handler-map.ts");
  const ref: HandlerSurface = { source: "r", elements: [], globals: { "document:keydown": 1 }, totalRegistrations: 1 };
  const att: HandlerSurface = { source: "a", elements: [], globals: {}, totalRegistrations: 0 };
  const m = compareHandlerSurfaces(ref, att);
  assert.equal(m.length, 1);
  assert.match(m[0]!.message, /global keyboard/);
  assert.deepEqual(compareHandlerSurfaces(ref, { ...att, globals: { "window:keyup": 1 } }), []);
});

test("surface contract: container delegation across structure covers per-cell reference wiring", async () => {
  const { compareHandlerSurfaces } = await import("./handler-map.ts");
  const ref: HandlerSurface = surface(
    entry({ text: "W1", types: { keydown: 1 } }),
    entry({ text: "W2", types: { keydown: 1 } }),
  );
  const att: HandlerSurface = surface(
    entry({ text: "W1 W2 W3 W4", types: { keydown: 1 } }), // one container handler
  );
  assert.deepEqual(compareHandlerSurfaces(ref, att), []);
});
