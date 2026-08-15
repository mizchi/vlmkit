import assert from "node:assert";
import { test } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import {
  HANDLER_INVOCATION_PATCH_SCRIPT,
  HANDLER_PATCH_SCRIPT,
  buildHandlerSurface,
  deriveHandlerIssues,
  isPointerDragSurface,
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

test("controls present with zero handlers is a finding, not an `ok`", () => {
  // v7's agent-l, on a console whose three buttons were all inert:
  // "`registrations: 0 across 0 element(s)` → status **ok**; zero listeners on a
  // 3-button page is the finding." The gate only ever inventoried elements that
  // already had a handler, so a static document and a page of dead buttons
  // produced identical output.
  const issues = deriveHandlerIssues({
    source: "x.html",
    elements: [],
    globals: {},
    totalRegistrations: 0,
    visibleControls: 3,
  });
  const found = issues.find((i) => i.kind === "no-handlers-found")!;
  assert.ok(found, "3 controls and no handlers must report");
  assert.equal(found.severity, "warn", "a form that posts is a real page");
  // Names all three explanations, because only one is a defect and this gate
  // cannot tell which from here.
  assert.match(found.message, /inert-control/);
  assert.match(found.message, /cannot see/);
  assert.match(found.message, /genuinely needs none/);
});

test("a page with no controls at all reports nothing — there is no denominator", () => {
  const issues = deriveHandlerIssues({
    source: "x.html",
    elements: [],
    globals: {},
    totalRegistrations: 0,
    visibleControls: 0,
  });
  assert.equal(issues.filter((i) => i.kind === "no-handlers-found").length, 0);
});

test("controls that ARE wired do not report", () => {
  const issues = deriveHandlerIssues({
    source: "x.html",
    elements: [entry({ ix: 3 })],
    globals: {},
    totalRegistrations: 1,
    visibleControls: 1,
  });
  assert.equal(issues.filter((i) => i.kind === "no-handlers-found").length, 0);
});

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

// ---------------------------------------------------------------------------
// HTML5 drag and drop
//
// The `addEventListener` patch is type-agnostic, so drag types were always *listed* —
// measured on a fixture: `dragstart, dragend` / `dragover, drop, dragenter, dragleave`
// showed up per element. What was missing is that a plain list cannot tell a working pair
// from a broken one, and two of DnD's failure modes are handlers that CANNOT FIRE:
//
//   - a `dragstart` source that is not draggable — the browser starts no drag;
//   - a `drop` target with no `dragover`, whose default action rejects the drop.
//
// Both were listed identically to the working pair beside them.
//
// There is no `dragmove` event: the continuous ones are `drag` (on the source) and
// `dragover` (on the target), and both are covered here.

test("a dragstart handler on a non-draggable element is a handler that cannot fire", () => {
  const issues = deriveHandlerIssues(surface(
    entry({ path: "div#item", text: "row", types: { dragstart: 1 }, draggable: false }),
  ));
  const found = issues.find((i) => i.kind === "drag-source-not-draggable")!;
  assert.ok(found, "dragstart without draggable must report");
  assert.equal(found.severity, "suspect");
  assert.match(found.message, /can never fire/);
  assert.match(found.message, /draggable="true"/);
});

test("a draggable source is not reported, however it became draggable", () => {
  // `el.draggable` is the effective value, so an <a href> or <img> reads true with no
  // attribute. Deriving it from the attribute alone would have flagged both.
  const issues = deriveHandlerIssues(surface(
    entry({ path: "div#item", types: { dragstart: 1, dragend: 1 }, draggable: true }),
  ));
  assert.equal(issues.filter((i) => i.kind === "drag-source-not-draggable").length, 0);
});

test("draggability that was never collected does not invent a finding", () => {
  // A surface from an older build has no `draggable` field. Reading `undefined` as "not
  // draggable" would report every drag source on data this gate did not measure.
  const issues = deriveHandlerIssues(surface(
    entry({ path: "div#item", types: { dragstart: 1 } }),
  ));
  assert.equal(issues.filter((i) => i.kind === "drag-source-not-draggable").length, 0);
});

test("a drop handler with no dragover anywhere above it can never fire", () => {
  const issues = deriveHandlerIssues(surface(
    entry({ path: "div#zone", text: "drop here", types: { drop: 1 } }),
  ));
  const found = issues.find((i) => i.kind === "drop-without-dragover")!;
  assert.ok(found, "drop with no dragover must report");
  assert.equal(found.severity, "suspect");
  assert.match(found.message, /can never fire/);
  assert.match(found.message, /preventDefault/);
});

test("dragover or dragenter on the element itself clears the drop finding", () => {
  for (const partner of ["dragover", "dragenter"] as const) {
    const issues = deriveHandlerIssues(surface(
      entry({ path: "div#zone", types: { drop: 1, [partner]: 1 } }),
    ));
    assert.equal(
      issues.filter((i) => i.kind === "drop-without-dragover").length, 0,
      `${partner} on the element is enough`,
    );
  }
});

test("dragover on an ancestor clears it too, because the event bubbles", () => {
  // A delegated drop target registers dragover once on the container. Flagging the child
  // would be a false positive on the normal way to write this.
  const issues = deriveHandlerIssues(surface(
    entry({ path: "ul>li", types: { drop: 1 }, ancestorTypes: ["dragover"] }),
  ));
  assert.equal(issues.filter((i) => i.kind === "drop-without-dragover").length, 0);
});

test("drag with no keyboard path is a warn, not a suspect, and does not advise tabindex", () => {
  // Drag has no keyboard equivalent in any browser, so this is real (WCAG 2.1.1, 2.5.7) —
  // but the alternative route is often elsewhere on the page, which this element-local
  // view cannot see. And the fix is NOT the `pointer-only-control` remedy: tabindex and a
  // key handler cannot start a drag, which is why drag is kept out of POINTER_TYPES.
  const issues = deriveHandlerIssues(surface(
    entry({ path: "div#item", types: { dragstart: 1 }, draggable: true }),
  ));
  const found = issues.find((i) => i.kind === "drag-without-keyboard-alternative")!;
  assert.ok(found);
  assert.equal(found.severity, "warn");
  assert.doesNotMatch(found.message, /tabindex \+ Enter|add tabindex/i);
  assert.match(found.message, /non-drag path/);
  // And it is not ALSO reported as a pointer-only control, which would give two findings
  // with contradictory advice for one element.
  assert.equal(issues.filter((i) => i.kind === "pointer-only-control").length, 0);
});

test("a keyboard handler on the element or an ancestor answers the drag a11y finding", () => {
  // Typed, not inferred: the union of these two literals gives `keydown?: undefined`, which
  // is not assignable to `Record<string, number>`. vitest does not typecheck, so this
  // passed and `tsc` was the only thing that saw it.
  const shapes: Array<Pick<HandlerSurfaceEntry, "types" | "ancestorTypes">> = [
    { types: { dragstart: 1, keydown: 1 }, ancestorTypes: [] },
    { types: { dragstart: 1 }, ancestorTypes: ["keydown"] },
  ];
  for (const shape of shapes) {
    const issues = deriveHandlerIssues(surface(entry({ path: "div#item", draggable: true, ...shape })));
    assert.equal(
      issues.filter((i) => i.kind === "drag-without-keyboard-alternative").length, 0,
      JSON.stringify(shape),
    );
  }
});

test("an invisible drag source is not an a11y finding", () => {
  // Same guard the pointer-only check uses: a hidden element operates nothing.
  const issues = deriveHandlerIssues(surface(
    entry({ path: "div#item", types: { dragstart: 1 }, draggable: true, visible: false }),
  ));
  assert.equal(issues.filter((i) => i.kind === "drag-without-keyboard-alternative").length, 0);
});

test("a correct drag pair produces no drag findings at all", () => {
  // The control. A source that is draggable with a keyboard alternative, and a target with
  // both halves of the drop contract, must be silent — otherwise the rules are noise.
  const issues = deriveHandlerIssues(surface(
    entry({ path: "div#item", types: { dragstart: 1, dragend: 1, keydown: 1 }, draggable: true }),
    entry({ path: "div#zone", types: { dragover: 1, drop: 1 } }),
  ));
  assert.deepEqual(issues.filter((i) => i.kind.startsWith("drag") || i.kind.startsWith("drop")), []);
});

test("E2E: drag handlers are collected through both routes, and only the broken pairs report",
  { timeout: 120_000 }, async () => {
  // Driven from the committed fixture rather than an inline string, so the HTML a reader
  // opens to learn what this gate checks is the same HTML the assertions below pin. The
  // fixture's own comment states the expectation per element.
  //
  // The `on*` sweep is the half that was missing: `COMMON_ON_PROPS` had no drag entries, so
  // `el.ondragover = fn` and `<div ondragstart="...">` were invisible. Measured before the
  // fix on the same shape — the element assigning `ondragover` as a property did not appear
  // in the surface at all.
  const s = await buildHandlerSurface({ source: join(REPO_ROOT, "fixtures/handlers/drag-and-drop.html") });
  // `describe()` joins ancestors with `>`, so match on the id segment rather than the whole
  // path — and anchored, because `div#ok` is a substring of nothing here but `div#zone` is a
  // prefix of `div#zone-no-dragover`.
  const byId = (id: string) => s.elements.find((e) => e.path.endsWith(`#${id}`));

  // Route 2, the DOM sweep, both spellings.
  assert.ok(byId("prop-target")?.types.dragover, "ondragover assigned as a property must be collected");
  assert.ok(byId("attr-source")?.types.dragstart, "an ondragstart attribute must be collected");
  // Route 1 keeps working, including the continuous `drag` event.
  assert.ok(byId("ok")?.types.drag, "`drag` is the continuous source event — there is no dragmove");

  // Effective draggability, read off the DOM property so defaults come out right.
  assert.equal(byId("ok")?.draggable, true);
  assert.equal(byId("not-draggable")?.draggable, false);
  assert.equal(byId("native-source")?.draggable, true, "an <a href> is draggable with no attribute");

  const issues = deriveHandlerIssues(s);
  const kindsFor = (id: string) =>
    issues.filter((i) => i.element.split(" ")[0]!.endsWith(`#${id}`)).map((i) => i.kind);

  // The two handlers that cannot fire.
  assert.deepEqual(kindsFor("not-draggable").filter((k) => k === "drag-source-not-draggable"),
    ["drag-source-not-draggable"]);
  assert.deepEqual(kindsFor("zone-no-dragover").filter((k) => k === "drop-without-dragover"),
    ["drop-without-dragover"]);

  // And everything correct stays silent, which is what makes those two readable.
  for (const id of ["ok", "zone", "native-source", "attr-source", "prop-target", "delegated-item"]) {
    assert.deepEqual(
      kindsFor(id).filter((k) => k === "drag-source-not-draggable" || k === "drop-without-dragover"),
      [], `${id} should have no unfireable-handler finding`,
    );
  }
  // The a11y half: #ok and #attr-source carry keyboard handlers, the other two sources do not.
  assert.equal(kindsFor("ok").includes("drag-without-keyboard-alternative"), false);
  assert.equal(kindsFor("attr-source").includes("drag-without-keyboard-alternative"), false);
  assert.ok(kindsFor("not-draggable").includes("drag-without-keyboard-alternative"));
});

// ---------------------------------------------------------------------------
// Probed drag behaviour
//
// Two questions the DOM cannot answer, both measured by dispatching:
//
//   - did `dragover` call preventDefault()? A handler that forgets is invisible to the
//     static check — one IS registered — and the browser still rejects the drop, so the
//     wired `drop` never runs. This is the common version of the bug.
//   - did `dragstart` put anything in the DataTransfer? A target reading getData() gets ""
//     otherwise, and Firefox/Safari will not start a drag at all without data.
//
// `dispatchEvent` returns false when a listener cancelled, which is exactly question one.

function probed(path: string, over: Partial<{ dragoverUnprevented: boolean; transferredTypes: string[] }>) {
  return { path, ran: [], ...over };
}

test("a dragover that never calls preventDefault is reported, though a handler exists", () => {
  const s = surface(entry({ path: "div#zone", text: "zone", types: { dragover: 1, drop: 1 } }));
  s.dragProbe = [probed("div#zone", { dragoverUnprevented: true })];
  const issues = deriveHandlerIssues(s);
  const found = issues.find((i) => i.kind === "dragover-not-prevented")!;
  assert.ok(found, "an unprevented dragover must report");
  assert.equal(found.severity, "suspect");
  assert.match(found.message, /preventDefault/);
  // And the static check stays quiet, because a dragover handler IS registered — which is
  // precisely why the probe is needed.
  assert.equal(issues.filter((i) => i.kind === "drop-without-dragover").length, 0);
});

test("a dragover that does cancel is not reported", () => {
  const s = surface(entry({ path: "div#zone", types: { dragover: 1, drop: 1 } }));
  s.dragProbe = [probed("div#zone", { dragoverUnprevented: false })];
  assert.equal(deriveHandlerIssues(s).filter((i) => i.kind === "dragover-not-prevented").length, 0);
});

test("an empty DataTransfer after dragstart is a warn, not a suspect", () => {
  // Warn because a page may deliberately carry its payload in its own JS state, which works
  // in Chromium. It is still a cross-browser defect, and the message says which browsers.
  const s = surface(entry({ path: "div#item", text: "row", types: { dragstart: 1 }, draggable: true }));
  s.dragProbe = [probed("div#item", { transferredTypes: [] })];
  const found = deriveHandlerIssues(s).find((i) => i.kind === "dragstart-transfers-nothing")!;
  assert.ok(found);
  assert.equal(found.severity, "warn");
  assert.match(found.message, /Firefox and Safari/);
});

test("any transferred type at all clears it, not just text/plain", () => {
  // A page transferring application/json is doing it right, and asking for text/plain would
  // have called that "nothing transferred".
  const s = surface(entry({ path: "div#item", types: { dragstart: 1 }, draggable: true }));
  s.dragProbe = [probed("div#item", { transferredTypes: ["application/json"] })];
  assert.equal(deriveHandlerIssues(s).filter((i) => i.kind === "dragstart-transfers-nothing").length, 0);
});

test("no probe means no probe findings, rather than findings from absent data", () => {
  // The same discipline as `draggable`: a surface built without `probeDrag` has no
  // `dragProbe`, and "not measured" must not become "measured and bad".
  const s = surface(entry({ path: "div#zone", types: { dragover: 1, drop: 1, dragstart: 1 }, draggable: true }));
  assert.equal(s.dragProbe, undefined);
  const kinds = deriveHandlerIssues(s).map((i) => i.kind);
  assert.equal(kinds.includes("dragover-not-prevented"), false);
  assert.equal(kinds.includes("dragstart-transfers-nothing"), false);
});

test("a probe row for a different element does not leak onto this one", () => {
  // Joined by `path`, so a mismatched row must be ignored rather than applied to whoever
  // comes first.
  const s = surface(entry({ path: "div#zone", types: { dragover: 1, drop: 1 } }));
  s.dragProbe = [probed("div#somewhere-else", { dragoverUnprevented: true })];
  assert.equal(deriveHandlerIssues(s).filter((i) => i.kind === "dragover-not-prevented").length, 0);
});

test("E2E: the probe catches what the static read cannot", { timeout: 120_000 }, async () => {
  // `#zone-forgot-prevent` registers dragover and never cancels: the static check passes it
  // and the probe does not. That element is the reason the probe exists.
  const source = join(REPO_ROOT, "fixtures/handlers/drag-and-drop.html");
  const s = await buildHandlerSurface({ source, probeDrag: true });
  assert.ok(s.dragProbe && s.dragProbe.length > 0, "probeDrag must produce rows");

  // The probe joins its rows to the surface by comparing derived paths, so both derivations
  // must split the class list the same way. They did not: one reached the browser as
  // `split(/s+/)` — a template literal ate the backslash in `\s` — and split on the letter
  // `s`. The fixture's container is `class="rows"` for this assertion: with the class `row`
  // (no `s`) both spellings agreed and every finding below stayed green either way.
  assert.ok(
    s.elements.some((e) => e.path.startsWith("div.rows>")),
    "the surface must derive `div.rows>`, not `div.row>` — the class list splits on whitespace",
  );
  assert.ok(
    s.dragProbe.some((row) => row.path.startsWith("div.rows>")),
    "and the probe must derive the same path, or none of its rows join to an entry",
  );

  const issues = deriveHandlerIssues(s);
  const kindsFor = (id: string) =>
    issues.filter((i) => i.element.split(" ")[0]!.endsWith(`#${id}`)).map((i) => i.kind);

  assert.ok(kindsFor("zone-forgot-prevent").includes("dragover-not-prevented"));
  // The two targets that do cancel stay silent.
  assert.equal(kindsFor("zone").includes("dragover-not-prevented"), false);
  assert.equal(kindsFor("prop-target").includes("dragover-not-prevented"), false);
  // #ok is the only source that fills the DataTransfer.
  assert.equal(kindsFor("ok").includes("dragstart-transfers-nothing"), false);
  assert.ok(kindsFor("not-draggable").includes("dragstart-transfers-nothing"));

  // And without the probe, neither finding exists — the default stays a read-only inventory.
  const noProbe = deriveHandlerIssues(await buildHandlerSurface({ source }));
  assert.deepEqual(
    noProbe.filter((i) => i.kind === "dragover-not-prevented" || i.kind === "dragstart-transfers-nothing"),
    [],
  );
});

// ---------------------------------------------------------------------------
// Pointer-driven drag — the other drag, found by dogfooding a real SVG editor
//
// https://moonlight.mizchi.workers.dev (mirrored locally, since Chromium has no outbound
// network in this sandbox — verified against example.com with three launch configs) is a
// canvas editor whose drawing surface registers pointerdown/pointermove/pointerup and no
// `dragstart` at all. The gate reported it as a `pointer-only-control` and advised "give it
// a role + tabindex + key handling" — a true finding with the wrong remedy, because tabindex
// and a key handler no more drag a canvas than they start an HTML5 drag.

test("down + move on one element is a pointer drag; either alone is not", () => {
  assert.equal(isPointerDragSurface(["pointerdown", "pointermove", "pointerup"]), true);
  assert.equal(isPointerDragSurface(["mousedown", "mousemove"]), true, "the mouse spelling counts");
  assert.equal(isPointerDragSurface(["touchstart", "touchmove"]), true, "and the touch spelling");
  // `move` is what separates a drag from a click, so down alone is a button written the hard
  // way — which `pointer-only-control` describes correctly and must keep describing.
  assert.equal(isPointerDragSurface(["pointerdown", "pointerup", "click"]), false);
  // Move alone is hover tracking.
  assert.equal(isPointerDragSurface(["pointermove"]), false);
  assert.equal(isPointerDragSurface(["click"]), false);
});

test("a pointer-drag surface gets the drag finding, with drag advice, not the click advice", () => {
  const issues = deriveHandlerIssues(surface(entry({
    path: "div#canvas", text: "canvas",
    types: { pointerdown: 1, pointermove: 1, pointerup: 1 },
  })));
  const drag = issues.find((i) => i.kind === "drag-without-keyboard-alternative")!;
  assert.ok(drag, "a pointer drag with no keyboard path must report");
  assert.match(drag.message, /pointer drag/);
  // The advice has to be drag advice. Naming tabindex here is the defect this fixes.
  assert.match(drag.message, /arrow-key nudging|numeric position/);
  assert.match(drag.message, /cannot perform a drag/);
  // And it must not ALSO come out as a pointer-only control, whose remedy contradicts it.
  assert.equal(issues.filter((i) => i.kind === "pointer-only-control").length, 0);
});

test("a click-only role-less div is still a pointer-only control", () => {
  // The control for the change above: the two accordion headers on that same editor
  // ("Canvas Settings", "Elements (11)") are click-only and correctly kept their finding.
  const issues = deriveHandlerIssues(surface(entry({
    path: "div#acc", text: "Canvas Settings", types: { click: 1 },
  })));
  assert.equal(issues.filter((i) => i.kind === "pointer-only-control").length, 1);
  assert.equal(issues.filter((i) => i.kind === "drag-without-keyboard-alternative").length, 0);
});

test("a pointer drag with a keyboard path reports nothing", () => {
  const issues = deriveHandlerIssues(surface(entry({
    path: "div#canvas", types: { pointerdown: 1, pointermove: 1, keydown: 1 },
  })));
  assert.deepEqual(issues.filter((i) => i.kind.startsWith("drag") || i.kind === "pointer-only-control"), []);
});

test("E2E: the accessible name identifies an icon-only control", { timeout: 120_000 }, async () => {
  // On the real editor, eight rows read `div>div>div>button ""` — one per toolbar icon, with
  // no id and no class, so `describe()` could not tell them apart either. Both of this gate's
  // identity signals were blank at once, and a finding is only actionable if the reader knows
  // which element it is about. The buttons' aria-labels say "Zoom Out", "Zoom In", …
  const dir = mkdtempSync(join(tmpdir(), "handlers-name-"));
  const file = join(dir, "icons.html");
  writeFileSync(file, `<!doctype html><html><head><title>t</title></head><body>
    <button aria-label="Zoom Out" style="width:30px;height:30px"><svg width="10" height="10"></svg></button>
    <button title="Fit to Canvas" style="width:30px;height:30px"><svg width="10" height="10"></svg></button>
    <button style="width:30px;height:30px"><img src="data:," alt="Import SVG"></button>
    <button style="width:30px;height:30px">Text wins</button>
    <script>
      for (const b of document.querySelectorAll("button")) b.addEventListener("click", () => {});
    </script>
  </body></html>`);
  const s = await buildHandlerSurface({ source: file });
  const names = s.elements.filter((e) => e.path.endsWith("button")).map((e) => e.text).sort();
  assert.deepEqual(names, ["Fit to Canvas", "Import SVG", "Text wins", "Zoom Out"]);
});

test("E2E: the pointer-drag gesture separates a working drag from a dead one, canvas included",
  { timeout: 180_000 }, async () => {
  // A real gesture — mouse.down / move / up — not a synthetic event: unlike HTML5 drag, this
  // one IS drivable, so the probe measures the same input a user produces.
  //
  // Pixels rather than the DOM, and `#canvas-works` is the reason: its DOM never changes at
  // all while it draws, so a DOM comparison would call every canvas editor dead.
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/pointer-drag.html"),
    probeDrag: true,
  });
  assert.ok(s.pointerDragProbe, "probeDrag must produce pointer-drag rows on this page");
  const row = (id: string) => s.pointerDragProbe!.find((r) => r.path.endsWith(`#${id}`));

  for (const id of ["works", "feedback-only", "dead", "canvas-works"]) {
    assert.ok(row(id), `${id} should have been driven`);
    assert.equal(row(id)!.error, undefined, `${id}: ${row(id)!.error}`);
  }
  // A drag that moves something, while held and after release.
  assert.ok(row("works")!.feedbackRatio > 0.005, `works feedback ${row("works")!.feedbackRatio}`);
  assert.ok(row("works")!.committedRatio > 0.005, `works committed ${row("works")!.committedRatio}`);
  // Engages, then reverts: feedback without a commit is a distinguishable state.
  assert.ok(row("feedback-only")!.feedbackRatio > 0.005);
  assert.equal(row("feedback-only")!.committedRatio, 0, "it put the dot back");
  // Wired and inert.
  assert.equal(row("dead")!.feedbackRatio, 0);
  assert.equal(row("dead")!.committedRatio, 0);
  // The canvas: pixels move, the DOM does not.
  assert.ok(row("canvas-works")!.feedbackRatio > 0.005, "a canvas drag must register as feedback");

  // Evidence, not a verdict: the inert pad gets NO finding, because 0% is ambiguous on a real
  // page — dead handlers, a bad start point and offscreen feedback all look like this.
  const issues = deriveHandlerIssues(s);
  const kinds = new Set(issues.map((i) => i.kind));
  assert.equal(kinds.has("pointer-drag-no-feedback" as never), false, "no such rule, on purpose");

  // What the probe DOES settle: those types were exercised, so the gate stops calling them
  // uncovered.
  const unprobed = issues.find((i) => i.kind === "unprobed-handler-types");
  if (unprobed) {
    for (const t of ["pointerdown", "pointermove", "pointerup"]) {
      assert.doesNotMatch(unprobed.message, new RegExp(`\\b${t}\\b`), `${t} was probed this run`);
    }
  }
});

test("without the probe, the pointer types are still reported as uncovered", () => {
  // The other half of the contract above: the warn is correct when nothing drove them, and
  // "not measured" must not read as "measured and fine".
  const s = surface(entry({ path: "div#canvas", types: { pointerdown: 1, pointermove: 1 } }));
  assert.equal(s.pointerDragProbe, undefined);
  const unprobed = deriveHandlerIssues(s).find((i) => i.kind === "unprobed-handler-types")!;
  assert.ok(unprobed, "with no probe, the types are uncovered and must say so");
  assert.match(unprobed.message, /pointerdown/);
  assert.match(unprobed.message, /pointermove/);
});

test("E2E: a gesture that invokes nothing is the one graded outcome", { timeout: 180_000 }, async () => {
  // `#swallowed` and `#dead` are indistinguishable in pixels — both 0.00%/0.00% — and are
  // different defects. Counting invocations of the page's OWN listeners separates them:
  // `#dead`'s handlers run the full trio and do nothing, `#swallowed`'s never run at all
  // because a transparent sibling takes every event. Only the second has one explanation, so
  // only the second is a finding.
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/pointer-drag.html"),
    probeDrag: true,
  });
  const row = (id: string) => s.pointerDragProbe!.find((r) => r.path.endsWith(`#${id}`))!;

  assert.equal(row("swallowed").handlerCalls, 0, "the veil takes every event");
  assert.ok(row("dead").handlerCalls! > 0, `#dead's handlers do run: ${row("dead").handlerCalls}`);
  assert.ok(row("works").handlerCalls! > 0);
  // Same pixels, so the pixel numbers cannot be what distinguishes them.
  assert.equal(row("swallowed").feedbackRatio, 0);
  assert.equal(row("dead").feedbackRatio, 0);

  const kindsFor = (id: string) => deriveHandlerIssues(s)
    .filter((i) => i.element.split(" ")[0]!.endsWith(`#${id}`)).map((i) => i.kind);
  assert.ok(kindsFor("swallowed").includes("pointer-drag-intercepted"));
  for (const id of ["dead", "works", "feedback-only", "canvas-works"]) {
    assert.equal(kindsFor(id).includes("pointer-drag-intercepted"), false,
      `${id} is reachable and must not be reported as intercepted`);
  }
});

test("no invocation count means no intercepted finding", () => {
  // The counting patch is only installed for probe runs, so `handlerCalls` is undefined
  // otherwise — and "not measured" must not become "measured and zero".
  const s = surface(entry({ path: "div#c", types: { pointerdown: 1, pointermove: 1 } }));
  s.pointerDragProbe = [{ path: "div#c", feedbackRatio: 0, committedRatio: 0 }];
  assert.equal(
    deriveHandlerIssues(s).filter((i) => i.kind === "pointer-drag-intercepted").length, 0,
    "undefined handlerCalls is not zero",
  );
  s.pointerDragProbe = [{ path: "div#c", feedbackRatio: 0, committedRatio: 0, handlerCalls: 0 }];
  assert.equal(deriveHandlerIssues(s).filter((i) => i.kind === "pointer-drag-intercepted").length, 1);
  // And a gesture that could not be performed says nothing either way.
  s.pointerDragProbe = [{ path: "div#c", feedbackRatio: 0, committedRatio: 0, handlerCalls: 0, error: "no usable box" }];
  assert.equal(deriveHandlerIssues(s).filter((i) => i.kind === "pointer-drag-intercepted").length, 0);
});

test("E2E: counting invocations does not change how the page's listeners behave", { timeout: 180_000 }, async () => {
  // The risk this guards. A wrapper is a different function object, so
  // `removeEventListener(type, fn)` stops matching and every add-then-remove leaks a live
  // listener — the tool would alter the page it measures. Run with and without the patch and
  // diff the page's own log.
  const dir = mkdtempSync(join(tmpdir(), "handlers-fidelity-"));
  const file = join(dir, "fidelity.html");
  writeFileSync(file, `<!doctype html><html><head><title>t</title></head><body>
    <div id="t" style="width:60px;height:20px">t</div>
    <script>
      window.log = [];
      const el = document.getElementById('t'), obj = { handleEvent(e) { window.log.push('obj:' + (this === obj)); } };
      const removed = () => window.log.push('REMOVED-FIRED');
      el.addEventListener('click', removed);
      el.removeEventListener('click', removed);
      el.addEventListener('click', () => window.log.push('once'), { once: true });
      el.addEventListener('click', obj);
      el.addEventListener('click', function () { window.log.push('this=' + (this === el)); });
      const both = () => window.log.push('both');
      el.addEventListener('click', both, true);
      el.addEventListener('click', both, false);
      el.removeEventListener('click', both, true);
      el.addEventListener('click', () => { throw new Error('boom'); });
      el.addEventListener('click', () => window.log.push('after-throw'));
    </script>
  </body></html>`);

  const logs: string[][] = [];
  for (const probeDrag of [false, true]) {
    const b = await launchBrowser();
    try {
      const page = await b.newPage();
      // The same install order `buildHandlerSurface` uses, and the order is load-bearing:
      // reversing it makes the recorder below capture the wrapper's source instead.
      if (probeDrag) await page.addInitScript(HANDLER_INVOCATION_PATCH_SCRIPT);
      await page.addInitScript(HANDLER_PATCH_SCRIPT);
      page.on("pageerror", () => {});
      await page.goto(pathToFileURL(file).href);
      await page.locator("#t").click();
      await page.locator("#t").click();
      logs.push(await page.evaluate(() => (window as unknown as { log: string[] }).log));
      if (probeDrag) {
        const samples = await page.evaluate(() =>
          (window as unknown as { __vlmkitHandlers: { src: string }[] }).__vlmkitHandlers.map((h) => h.src));
        assert.ok(
          samples.some((src) => src.includes("window.log.push")),
          `the recorder captured wrappers instead of the page's listeners: ${JSON.stringify(samples.slice(0, 3))}`,
        );
      }
    } finally {
      await b.close();
    }
  }
  const [unpatched, patched] = logs;
  assert.deepEqual(patched, unpatched, "the patch changed what the page's listeners did");
  // And the fixture has to actually exercise the traps, or the equality above is vacuous.
  assert.equal(unpatched!.filter((l) => l === "once").length, 1, "once fired twice or not at all");
  assert.equal(unpatched!.includes("REMOVED-FIRED"), false, "a removed listener fired");
  assert.ok(unpatched!.includes("obj:true"), "handleEvent's `this` should be the listener object");
  assert.ok(unpatched!.includes("this=true"), "a function listener's `this` should be the element");
  assert.equal(unpatched!.filter((l) => l === "both").length, 2, "one phase removed, one left, two clicks");
  assert.ok(unpatched!.includes("after-throw"), "a throwing listener must not stop the rest");
});

// ---------------------------------------------------------------------------
// The real HTML5 drag — driven, not dispatched
//
// The note this replaced said CDP could not drive an HTML5 drag, and that was wrong. Measured
// on the fixture with a capture recorder on `document`, `mouse.down`/`move`/`up` produces
// `dragstart, drag, dragenter, dragover, drop, dragend` — the genuine sequence, DataTransfer
// and all. That matters because dispatching a `dragstart` runs the handler whatever the
// element's state, so the synthetic probe reports a source no user can pick up as working.

function realRow(over: Partial<import("./handler-map.ts").RealDragProbe> & { path: string }) {
  return { dragstartFired: false, targetsTried: [], gestures: 1, ...over };
}

test("a source the browser refuses to pick up is graded; an unmeasured one is not", () => {
  const s = surface(entry({ path: "div#src", types: { dragstart: 1 }, draggable: true }));
  s.realDragProbe = [realRow({ path: "div#src" })];
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "drag-source-inert").length;
  assert.equal(kinds(), 1, "no dragstart from a real gesture is the finding");

  // Zero gestures means the budget ran out before this source. Reporting "started no drag" for
  // a drag that was never performed is the false-defect mirror of a false green — and the
  // first version of the loop did it: `#not-draggable` spent the whole budget retrying every
  // target, and the two good sources after it were both reported inert.
  s.realDragProbe = [realRow({ path: "div#src", gestures: 0, capped: true })];
  assert.equal(kinds(), 0, "a source that received no gesture must not be graded");

  // A gesture that could not be performed measured nothing either.
  s.realDragProbe = [realRow({ path: "div#src", error: "no usable box" })];
  assert.equal(kinds(), 0);

  // And a working source is silent.
  s.realDragProbe = [realRow({ path: "div#src", dragstartFired: true, droppedOn: "div#zone" })];
  assert.equal(kinds(), 0);
});

test("`draggable=false` keeps the specific finding instead of both", () => {
  // Both statements are true of this element, but `drag-source-not-draggable` names the cause
  // and the one-line fix, so the probed rule stands down rather than doubling the report.
  const s = surface(entry({ path: "div#src", types: { dragstart: 1 }, draggable: false }));
  s.realDragProbe = [realRow({ path: "div#src" })];
  const kinds = deriveHandlerIssues(s).map((i) => i.kind);
  assert.equal(kinds.includes("drag-source-not-draggable"), true);
  assert.equal(kinds.includes("drag-source-inert"), false);
});

test("the types a gesture exercised come from what the recorder saw, not from the outcome", () => {
  const s = surface(entry({ path: "div#src", types: { dragstart: 1, dragend: 1, dragleave: 1 } }));
  // A gesture that entered a target and dropped there need never have LEFT it, so `dragleave`
  // stays unprobed even though the drop landed. Inferring the list from the outcome — the
  // first version of this — claimed coverage the run did not have.
  s.realDragProbe = [realRow({
    path: "div#src",
    dragstartFired: true,
    droppedOn: "div#zone",
    observedTypes: ["dragstart", "dragend"],
  })];
  const unprobed = deriveHandlerIssues(s).find((i) => i.kind === "unprobed-handler-types");
  assert.ok(unprobed, "dragleave was never driven, so it must still be disclosed");
  assert.match(unprobed.message, /dragleave/);
  assert.equal(/dragstart|dragend/.test(unprobed.message), false, "those two were exercised");

  // An errored row exercised nothing, whatever it happens to carry.
  s.realDragProbe = [realRow({ path: "div#src", error: "no usable box", observedTypes: ["dragstart"] })];
  assert.match(deriveHandlerIssues(s).find((i) => i.kind === "unprobed-handler-types")!.message, /dragstart/);
});

test("E2E: driving the drag separates three kinds of source", { timeout: 180_000 }, async () => {
  // This is also the guard for the per-gesture selection reset in `probeRealDrags`, and the
  // only test that catches its removal: a press-and-move on an undraggable element selects
  // text, selected text is draggable, and the debris from the inert sources ahead of
  // `#native-source` in document order stops its genuine drag. Ablating the reset fails on
  // "native-source must start a real drag" — not on the inert sources, which keep reporting.
  const source = join(REPO_ROOT, "fixtures/handlers/drag-and-drop.html");
  const s = await buildHandlerSurface({ source, probeDrag: true });
  assert.ok(s.realDragProbe && s.realDragProbe.length > 0, "probeDrag must drive the sources");
  const row = (id: string) => s.realDragProbe!.find((r) => r.path.endsWith(`#${id}`));
  const issues = deriveHandlerIssues(s);
  const kindsFor = (id: string) =>
    issues.filter((i) => i.element.split(" ")[0]!.endsWith(`#${id}`)).map((i) => i.kind);

  // 1. Sources the browser picks up: the drag starts and the drop lands on the correct target.
  for (const id of ["ok", "native-source", "attr-source"]) {
    assert.equal(row(id)?.dragstartFired, true, `${id} must start a real drag`);
    assert.ok(row(id)?.droppedOn?.endsWith("#zone"), `${id} must drop on #zone, got ${row(id)?.droppedOn}`);
    assert.equal(kindsFor(id).includes("drag-source-inert"), false);
  }

  // 2. The two that only a real gesture can catch. Both have `draggable === true` and a
  // dragstart handler, so the static read and the synthetic dispatch both pass them.
  for (const id of ["user-drag-none", "veiled-source"]) {
    assert.equal(row(id)?.dragstartFired, false, `${id} must start no drag`);
    assert.ok(row(id)!.gestures > 0, "and it must have been driven, or the finding is unearned");
    assert.ok(kindsFor(id).includes("drag-source-inert"), `${id} must report drag-source-inert`);
    assert.equal(
      s.elements.find((e) => e.path.endsWith(`#${id}`))?.draggable, true,
      "the DOM says draggable — that is what makes this invisible statically",
    );
  }

  // 3. `draggable=false` keeps the statically-visible finding and does not double up.
  assert.ok(kindsFor("not-draggable").includes("drag-source-not-draggable"));
  assert.equal(kindsFor("not-draggable").includes("drag-source-inert"), false);

  // The gesture drove the whole vocabulary, so the "not covered by the interaction probes"
  // warn has nothing left to disclose about drag on this page.
  assert.deepEqual(
    (row("ok")?.observedTypes ?? []).slice().sort(),
    ["drag", "dragend", "dragenter", "dragleave", "dragover", "dragstart", "drop"],
  );
  const unprobed = issues.find((i) => i.kind === "unprobed-handler-types");
  assert.equal(unprobed, undefined, `nothing should remain unprobed: ${unprobed?.message ?? ""}`);

  // Without the flag there is no row at all — absent means not measured.
  const noProbe = await buildHandlerSurface({ source });
  assert.equal(noProbe.realDragProbe, undefined);
  assert.equal(deriveHandlerIssues(noProbe).some((i) => i.kind === "drag-source-inert"), false);
});

test("E2E: an inert source is retried, and the source after it is still measured", { timeout: 180_000 }, async () => {
  // What this pins is the retry and the separation: a source that starts nothing gets a second
  // gesture from a different point, and only it reports.
  //
  // It does NOT pin the per-gesture selection reset, though that was the reason it was written.
  // Removing the reset leaves this page green — checked, twice, with two different setups — and
  // the guard for the reset is the fixture E2E above, which fails with "native-source must
  // start a real drag". That is also the symptom worth recording: leftover selection debris
  // does not make a broken source look fine, it stops a WORKING source from dragging. A
  // press-and-move on an undraggable element selects text, and selected text is draggable, so
  // the debris from probing a broken source lands on whatever is probed next.
  const dir = mkdtempSync(join(tmpdir(), "handlers-selection-"));
  const file = join(dir, "selection.html");
  writeFileSync(file, `<!doctype html><html><head><title>t</title>
    <style>.nodrag { -webkit-user-drag: none; } div { width: 220px; }</style></head><body>
    <div class="nodrag" id="dead-src" draggable="true">a source the browser will not pick up</div>
    <div id="good-src" draggable="true">a source it will</div>
    <div id="zone" style="width:120px;height:60px;background:#eee">zone</div>
    <script>
      for (const id of ['dead-src', 'good-src']) {
        document.getElementById(id).addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', id);
        });
      }
      document.getElementById('zone').addEventListener('dragover', (e) => e.preventDefault());
      document.getElementById('zone').addEventListener('drop', (e) => e.preventDefault());
    </script>
  </body></html>`);

  const s = await buildHandlerSurface({ source: file, probeDrag: true });
  const row = (id: string) => s.realDragProbe?.find((r) => r.path.endsWith(`#${id}`));
  assert.equal(row("dead-src")?.dragstartFired, false, "-webkit-user-drag: none must start nothing");
  assert.equal(row("dead-src")?.gestures, 2, "and it must have been retried from a second point");
  // The assertion the reset exists for: probed second, after two gestures' worth of debris.
  assert.equal(row("good-src")?.dragstartFired, true, "the next source must still drag");
  assert.ok(row("good-src")?.droppedOn?.endsWith("#zone"), "and still land its drop");
  const kinds = deriveHandlerIssues(s).filter((i) => i.kind === "drag-source-inert").map((i) => i.element);
  assert.equal(kinds.length, 1, `only the inert one reports: ${kinds.join(", ")}`);
  assert.match(kinds[0]!, /#dead-src/);
});
