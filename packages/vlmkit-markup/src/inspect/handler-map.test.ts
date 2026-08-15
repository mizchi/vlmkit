import assert from "node:assert";
import { test } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
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
