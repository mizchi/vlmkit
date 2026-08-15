import assert from "node:assert";
import { test } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
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
  PROBE_FAMILIES,
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

test("coverage is what this run exercised, per element — not a static list of types", () => {
  const types = { wheel: 1, dragstart: 1, click: 1, keydown: 1, focus: 1 };

  // No probe ran. This is every `scan handlers` run: it opens the page, reads registrations and
  // closes it. The old code exempted click/keydown/focus/blur/keyup/keypress from the warn on
  // EVERY run, so a page whose six handlers were all in that set printed `status: ok` and said
  // nothing about having pressed none of them.
  const inventory = deriveHandlerIssues(surface(entry({ ix: 1, types })));
  const warn = inventory.find((i) => i.kind === "unprobed-handler-types")!;
  assert.ok(warn, "an inventory run exercised nothing and has to say so");
  assert.deepEqual(warn.types, ["click", "dragstart", "focus", "keydown", "wheel"]);
  assert.match(warn.message, /NONE exercised/);
  assert.match(warn.message, /check interactions --handlers/, "and name the gate that does probe");

  // A probe ran and reached this element. It focused it and pressed the key its role activates
  // with, so focus/blur and the keyboard types were exercised — and `click` was NOT, because
  // nothing calls `.click()` and a `div[role=button]` does not synthesize one from Enter.
  const probed = surface(entry({ ix: 1, types, nativeActivation: false }));
  probed.interactionProbe = { focusedIx: [1], activatedIx: [1] };
  const after = deriveHandlerIssues(probed).find((i) => i.kind === "unprobed-handler-types")!;
  assert.match(after.message, /NOT exercised by this run/);
  // Asserted on `types` rather than the sentence: the advice in it contains the words
  // "focus" and "drag", so a message regex passes on the prose and proves nothing.
  assert.deepEqual(after.types, ["click", "dragstart", "wheel"], "click never fired on a role-only element");

  // Same element, native: the browser turns the keypress into a click, measured on
  // <button>, <a href>, input[type=submit|button|reset|checkbox|radio] and <summary>.
  const native = surface(entry({ ix: 1, types, nativeActivation: true }));
  native.interactionProbe = { focusedIx: [1], activatedIx: [1] };
  const nativeWarn = deriveHandlerIssues(native).find((i) => i.kind === "unprobed-handler-types")!;
  assert.deepEqual(nativeWarn.types, ["dragstart", "wheel"]);

  // Reached by the tab walk but never activated — its role has no activation key
  // (`activationKeyForRole` returns null for a link, a textbox, an option, a slider). Focus
  // fired, the keyboard handler did not.
  const focusedOnly = surface(entry({ ix: 1, types, nativeActivation: true }));
  focusedOnly.interactionProbe = { focusedIx: [1], activatedIx: [] };
  const focusedWarn = deriveHandlerIssues(focusedOnly).find((i) => i.kind === "unprobed-handler-types")!;
  assert.deepEqual(focusedWarn.types, ["click", "dragstart", "keydown", "wheel"], "no keypress, no synthesized click");

  // Beyond --max-elements, or never discovered: the probe ran but not here.
  const missed = surface(entry({ ix: null, types, nativeActivation: true }));
  missed.interactionProbe = { focusedIx: [0], activatedIx: [0] };
  const missedWarn = deriveHandlerIssues(missed).find((i) => i.kind === "unprobed-handler-types")!;
  assert.deepEqual(missedWarn.types, ["click", "dragstart", "focus", "keydown", "wheel"]);
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
  // Every drag type was driven, so none of them is disclosed as unexercised. `keydown` still is
  // — #ok carries one as its keyboard alternative and this gate presses nothing — which is the
  // honest report for a run of `scan handlers --probe-drag`.
  const unprobed = issues.find((i) => i.kind === "unprobed-handler-types");
  assert.ok(unprobed, "the keydown handler was not exercised, and that has to be said");
  assert.deepEqual(unprobed.types, ["keydown"], "every drag type was driven; only the keydown was not");

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

test("the report obeys rule settings instead of contradicting the verdict", async () => {
  const { formatHandlerSurface } = await import("./handler-map.ts");
  // `ix` set and a keydown handler present, so `pointer-only-control` and
  // `drag-without-keyboard-alternative` stay out of it: the counts below are then about the
  // one rule under test, and not about whatever else this element would have reported.
  const s = surface(entry({ path: "div#src", ix: 3, types: { dragstart: 1, keydown: 1 }, draggable: true }));
  s.realDragProbe = [realRow({ path: "div#src" })];
  const issues = deriveHandlerIssues(s);
  assert.deepEqual(issues.map((i) => i.kind).sort(), ["drag-source-inert", "unprobed-handler-types"]);
  // The ESC byte has to come off too: `/\[[0-9;]*m/` leaves it behind, invisible in a diff and
  // sitting exactly where the next assertion expects to match. It cost a failing test in the
  // wheel case below, and `explore.test.ts` carries the same note.
  const plain = (t: string) => t.replace(/\u001b\[[0-9;]*m/g, "");

  // Rule-blind, which is how this read before: red status, the finding listed, and the runner
  // printing "1 finding(s) suppressed" underneath it. Measured on the drag fixture with four
  // rules off: `status: 5 suspect issue(s)` and `exit=0` on the same screen.
  assert.match(plain(formatHandlerSurface(s, issues)), /status: 1 suspect issue\(s\), 1 warn/);

  // `off` drops the line and the count with it.
  const off = plain(formatHandlerSurface(s, issues, {
    effective: (id) => (id === "drag-source-inert" ? "off" : "warn"),
  }));
  assert.doesNotMatch(off, /drag-source-inert/);
  assert.match(off, /status: 1 warn\(s\)/);

  // Re-tuned prints at the severity the project chose, and stops being counted as a suspect.
  const info = plain(formatHandlerSurface(s, issues, {
    effective: (id) => (id === "drag-source-inert" ? "info" : "warn"),
  }));
  assert.match(info, /info \[drag-source-inert\]/);
  assert.match(info, /status: 2 warn\(s\)/);
  assert.doesNotMatch(info, /suspect/);
});

// ---------------------------------------------------------------------------
// The drag timeline — what happened in between, not just how it ended

test("the printed route drops `drag`, merges repeats, and says which state it could not read", async () => {
  const { formatDragTimeline } = await import("./handler-map.ts");
  const lines = formatDragTimeline([
    { type: "dragstart", path: "div#card", count: 1 },
    { type: "drag", path: "div#card", count: 1 },
    { type: "dragover", path: "div#bin", count: 1, prevented: false },
    // `drag` fires on the SOURCE between every `dragover` on the target, so without dropping it
    // the two never coalesce and one gesture printed seven lines of alternating noise.
    { type: "drag", path: "div#card", count: 1 },
    { type: "dragover", path: "div#bin", count: 3, prevented: false },
    { type: "dragover", path: "div#quiet", count: 1, prevented: null },
    { type: "drop", path: "div#zone", count: 1, prevented: true, received: [{ type: "text/plain", value: "ok" }] },
    { type: "dragend", path: "div#card", count: 1 },
  ], 8);
  const route = lines.join(" ");
  assert.doesNotMatch(route, /drag@/, "`drag` carries no routing information");
  assert.match(route, /dragover@div#bin x4/, "1 + 3 merged across the interleaved `drag`");
  assert.match(route, /dragover@div#bin x4 \(NOT prevented — the drop is refused here\)/);
  // stopPropagation means the bubble-phase listener never saw the event. Unknown, and saying
  // "not prevented" there would accuse a target that may well have cancelled it — measured: a
  // zone that calls preventDefault AND stopPropagation still receives the drop.
  assert.match(route, /dragover@div#quiet \(propagation stopped — cannot tell\)/);
  assert.match(route, /drop@div#zone \(prevented\) \[got text\/plain="ok"\]/);
});

test("a payload the target really received refutes `dragstart-transfers-nothing`", () => {
  // The synthetic probe dispatches `dragstart` with a DataTransfer this code made, so all it can
  // see is "the handler set nothing" — and for a natively draggable element the BROWSER fills
  // the payload in. Measured on the fixture's `<a href>`: synthetic transfer empty, real drop
  // received `text/plain="file:///…#x"`, the link's own URL. A target calling getData() there
  // reads the URL, not "".
  const s = surface(entry({ path: "a#link", types: { dragstart: 1 }, draggable: true }));
  s.dragProbe = [{ path: "a#link", ran: ["dragstart"], transferredTypes: [] }];
  const warns = () => deriveHandlerIssues(s).filter((i) => i.kind === "dragstart-transfers-nothing").length;
  assert.equal(warns(), 1, "with no real drag there is no evidence, so the warn stands");

  s.realDragProbe = [realRow({
    path: "a#link",
    dragstartFired: true,
    droppedOn: "div#zone",
    timeline: [{ type: "drop", path: "div#zone", count: 1, received: [{ type: "text/plain", value: "file:///x" }] }],
  })];
  assert.equal(warns(), 0, "a payload observed at a drop refutes it");

  // An empty payload at the drop is the case the warn was written for, and it survives.
  s.realDragProbe = [realRow({
    path: "a#link",
    dragstartFired: true,
    droppedOn: "div#zone",
    timeline: [{ type: "drop", path: "div#zone", count: 1, received: [] }],
  })];
  assert.equal(warns(), 1);
});

test("E2E: the route explains a drop that never happened", { timeout: 180_000 }, async () => {
  // The most common drag defect: the target registers `dragover` and forgets `preventDefault`.
  // The aggregate says "no target accepted it"; the route says where it went and why.
  const dir = mkdtempSync(join(tmpdir(), "handlers-route-"));
  const file = join(dir, "forgot.html");
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><title>t</title>
    <style>.item{width:150px;padding:8px;background:#1a6ed8;color:#fff}
           .zone{width:170px;height:70px;background:#eee;margin-top:10px}</style></head><body>
    <div class="item" id="card" draggable="true">card</div>
    <div class="zone" id="bin">no preventDefault</div>
    <script>
      document.getElementById("card").addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", "card-7");
      });
      document.getElementById("bin").addEventListener("dragover", () => {});
      document.getElementById("bin").addEventListener("drop", () => {});
    </script>
  </body></html>`);
  const s = await buildHandlerSurface({ source: file, probeDrag: true });
  const row = s.realDragProbe?.find((r) => r.path.endsWith("#card"));
  assert.ok(row?.dragstartFired, "the drag itself starts");
  assert.equal(row.droppedOn, undefined, "and nothing accepts it");
  const over = row.timeline?.filter((step) => step.type === "dragover" && step.path.endsWith("#bin")) ?? [];
  assert.ok(over.length > 0, "the drag must have crossed the target");
  assert.ok(over.every((step) => step.prevented === false), "measured on the real gesture, after the page's handler ran");
  assert.equal(row.timeline?.some((step) => step.type === "drop"), false, "an uncancelled dragover produces no drop AT ALL");
});

test("E2E: a target that stops propagation is reported as unreadable, not as refusing", { timeout: 180_000 }, async () => {
  // Nested drop zones do this routinely. The bubble-phase listener that reads `defaultPrevented`
  // never sees the event, and the drop still lands — so `false` there would be a false accusation.
  const dir = mkdtempSync(join(tmpdir(), "handlers-quiet-"));
  const file = join(dir, "quiet.html");
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><title>t</title>
    <style>.item{width:150px;padding:8px;background:#1a6ed8;color:#fff}
           .zone{width:170px;height:70px;background:#eee;margin-top:10px}</style></head><body>
    <div class="item" id="card" draggable="true">card</div>
    <div class="zone" id="quiet">prevents and stops</div>
    <script>
      document.getElementById("card").addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", "c");
      });
      const z = document.getElementById("quiet");
      z.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
      z.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); });
    </script>
  </body></html>`);
  const s = await buildHandlerSurface({ source: file, probeDrag: true });
  const row = s.realDragProbe?.find((r) => r.path.endsWith("#card"))!;
  assert.ok(row.droppedOn?.endsWith("#quiet"), "the drop lands — preventDefault was called");
  const over = row.timeline!.filter((step) => step.type === "dragover" && step.path.endsWith("#quiet"));
  assert.ok(over.length > 0);
  assert.ok(over.every((step) => step.prevented === null), "unknown, because the event never bubbled");
  // And the payload is readable at the drop even though propagation stopped after it: the
  // capture-phase read happens first.
  const drop = row.timeline!.find((step) => step.type === "drop");
  assert.deepEqual(drop?.received, [{ type: "text/plain", value: "c" }]);
});

test("E2E: the drop payload is read at the drop, where it is the only place readable",
  { timeout: 180_000 }, async () => {
  // Protected mode: `getData()` returns "" during dragstart/dragenter/dragover and the real
  // value during drop — measured. So the fixture's three working sources show three different
  // answers, and each is a different story about the same wire.
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/drag-and-drop.html"),
    probeDrag: true,
  });
  const received = (id: string) => s.realDragProbe
    ?.find((r) => r.path.endsWith(`#${id}`))
    ?.timeline?.find((step) => step.type === "drop")?.received;

  // The page set it.
  assert.deepEqual(received("ok"), [{ type: "text/plain", value: "ok" }]);
  // The page set nothing and the BROWSER filled in three types for the link — which is the
  // evidence that the payload is not the page's: an `<a href>` contributes `text/plain` and
  // `text/uri-list` (both the URL) plus `text/html` (the serialized element).
  const native = received("native-source") ?? [];
  assert.deepEqual(native.map((r) => r.type), ["text/plain", "text/uri-list", "text/html"]);
  assert.match(native[0]!.value, /^file:.*drag-and-drop\.html#x$/);
  assert.match(native[2]!.value, /^<a /);
  // Nobody set anything: `ondragstart="void 0"` on a plain div.
  assert.deepEqual(received("attr-source"), []);

  // Which is why only the last of the three keeps the warn.
  const transfersNothing = deriveHandlerIssues(s)
    .filter((i) => i.kind === "dragstart-transfers-nothing").map((i) => i.element);
  assert.equal(transfersNothing.some((el) => el.includes("#attr-source")), true);
  assert.equal(transfersNothing.some((el) => el.includes("#native-source")), false,
    "refuted by what the target actually received");
});

// ---------------------------------------------------------------------------
// The drop-target half: a correct target the drag cannot reach

test("a drop target nothing can land on is a finding, and it names what is on top", () => {
  const s = surface(entry({ path: "div#zone", types: { dragover: 1, drop: 1 } }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "drop-target-unreachable");
  assert.deepEqual(kinds(), [], "nothing measured, nothing claimed");

  s.unreachableTargets = [{ path: "div#zone", interceptedBy: "div#veil" }];
  const found = kinds();
  assert.equal(found.length, 1);
  // The actionable half is which element is on top, not the bare fact that something is.
  assert.match(found[0]!.message, /hits div#veil/);
  assert.match(found[0]!.message, /Its own handlers are fine/);

  // A different target's row must not land on this one.
  s.unreachableTargets = [{ path: "div#other", interceptedBy: "div#veil" }];
  assert.deepEqual(kinds(), []);
});

test("E2E: a covered drop target reports, and the identical uncovered one takes the drop",
  { timeout: 180_000 }, async () => {
  // Both zones carry the same correct contract — `dragover` calling preventDefault and a wired
  // `drop` — so a static read cannot separate them and a synthetic dispatch at either runs its
  // handlers as written.
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/drop-target-covered.html"),
    probeDrag: true,
  });
  assert.deepEqual(
    s.unreachableTargets?.map((u) => [u.path.endsWith("#covered"), u.interceptedBy.endsWith("#veil")]),
    [[true, true]],
  );
  const row = s.realDragProbe?.find((r) => r.path.endsWith("#card"))!;
  assert.ok(row.dragstartFired);
  assert.ok(row.droppedOn?.endsWith("#open"), `the reachable one takes the drop, got ${row.droppedOn}`);

  const kindsFor = (id: string) => deriveHandlerIssues(s)
    .filter((i) => i.element.split(" ")[0]!.endsWith(`#${id}`)).map((i) => i.kind);
  assert.deepEqual(kindsFor("covered"), ["drop-target-unreachable"]);
  assert.deepEqual(kindsFor("open"), [], "the control: same contract, nothing on top, nothing to report");
});

test("E2E: a hit test needs no gesture, so the inventory reports it too", { timeout: 180_000 }, async () => {
  // `elementFromPoint` dispatches nothing, so this is a fact about the page's geometry rather
  // than something a probe has to be asked for. A covered drop zone is a defect whether or not
  // the page happens to have a draggable source to prove it with.
  const s = await buildHandlerSurface({ source: join(REPO_ROOT, "fixtures/handlers/drop-target-covered.html") });
  assert.equal(s.realDragProbe, undefined, "no --probe-drag, no gestures");
  assert.equal(s.unreachableTargets?.length, 1);
  assert.ok(deriveHandlerIssues(s).some((i) => i.kind === "drop-target-unreachable"));
});

test("E2E: the two ways a reachable target looks unreachable", { timeout: 180_000 }, async () => {
  // Both controls live on the covered fixture, next to the finding they guard, and both must stay
  // silent. They exist because the first two versions of this check reported them:
  //
  //   #filled-list — the child fills the zone, so every sample point lands on the `<li>`. A hit
  //     INSIDE the target counts, because the event bubbles to it. The gesture-log version asked
  //     "did any event target this path" and reported the fixture's delegated `<ul>` as
  //     unreachable; `hit === target` alone reports this one. A kanban column whose cards fill it
  //     is this exact shape.
  //   #badged — a 40px badge over the centre and nothing else. A single sample point calls this
  //     unreachable; the corners are clear and a drop there works.
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/drop-target-covered.html"),
    probeDrag: true,
  });
  assert.deepEqual(
    (s.unreachableTargets ?? []).map((u) => u.path),
    ["div>div#covered"],
    "only the fully covered zone",
  );
  const flagged = deriveHandlerIssues(s).filter((i) => i.kind === "drop-target-unreachable");
  assert.equal(flagged.length, 1);
  for (const id of ["filled-list", "badged", "open"]) {
    assert.equal(flagged.some((i) => i.element.includes(`#${id}`)), false, `${id} must stay silent`);
  }
  // And the drag fixture's delegated list, whose child does NOT fill it, is silent too.
  const other = await buildHandlerSurface({ source: join(REPO_ROOT, "fixtures/handlers/drag-and-drop.html") });
  assert.deepEqual(other.unreachableTargets ?? [], []);
});

// ---------------------------------------------------------------------------
// The cancel: Escape mid-drag, and whether the page puts things back

test("a cancelled drag that left something behind is a finding; the other three states are not", () => {
  const s = surface(entry({ path: "div#card", types: { dragstart: 1 }, draggable: true }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "drag-cancel-not-reverted").length;

  s.realDragProbe = [realRow({ path: "div#card", dragstartFired: true, cancel: { started: true, cancelled: true, ratio: 0.99 } })];
  assert.equal(kinds(), 1);
  assert.match(deriveHandlerIssues(s).find((i) => i.kind === "drag-cancel-not-reverted")!.message, /undo it in `?dragend/);

  // Escape did not cancel it, so whatever changed may be the drop legitimately doing its job.
  // Not coverable end to end — Escape cancelled every driven drag measured — so it is pinned here.
  s.realDragProbe = [realRow({ path: "div#card", dragstartFired: true, cancel: { started: true, cancelled: false, ratio: 0.99 } })];
  assert.equal(kinds(), 0, "a change after a drag that completed is not this defect");

  // Cancelled and clean.
  s.realDragProbe = [realRow({ path: "div#card", dragstartFired: true, cancel: { started: true, cancelled: true, ratio: 0 } })];
  assert.equal(kinds(), 0);

  // Cancelled, revert not measured — the screenshots failed. Absent is not zero and not one.
  s.realDragProbe = [realRow({ path: "div#card", dragstartFired: true, cancel: { started: true, cancelled: true } })];
  assert.equal(kinds(), 0);

  // No cancel gesture at all (budget spent, or the source cannot drag).
  s.realDragProbe = [realRow({ path: "div#card", dragstartFired: true })];
  assert.equal(kinds(), 0);

  // The cancel gesture found nothing to pick up, because the source removed itself during the
  // earlier ones. The box it used to occupy differs, and that is not this defect.
  s.realDragProbe = [realRow({
    path: "div#card",
    dragstartFired: true,
    cancel: { started: false, cancelled: false, ratio: 0.99 },
  })];
  assert.equal(kinds(), 0, "no drag was started, so nothing was cancelled");
});

test("E2E: Escape strands the optimistic update wired to `drop` instead of `dragend`",
  { timeout: 180_000 }, async () => {
  // Both cards hide themselves on `dragstart` — the "it is leaving the list" every sortable does.
  // One undoes it in `dragend`, which fires whether the drag succeeded or not; the other undoes it
  // in `drop`, which a cancelled drag never reaches.
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/drag-cancel.html"),
    probeDrag: true,
  });
  const row = (id: string) => s.realDragProbe?.find((r) => r.path.endsWith(`#${id}`))!;

  // The browser's own verdict, on both: the drag was cancelled and no drop ran.
  for (const id of ["restores", "strands"]) {
    assert.equal(row(id).cancel?.cancelled, true, `${id}: Escape must cancel the drag`);
  }
  // And the pixels, which is where they differ.
  assert.ok(row("restores").cancel!.ratio! < 0.02, `restores left ${row("restores").cancel!.ratio}`);
  assert.ok(row("strands").cancel!.ratio! > 0.5, `strands left ${row("strands").cancel!.ratio}`);

  const flagged = deriveHandlerIssues(s)
    .filter((i) => i.kind === "drag-cancel-not-reverted").map((i) => i.element);
  assert.equal(flagged.length, 1, flagged.join(", "));
  assert.match(flagged[0]!, /#strands/);
});

// ---------------------------------------------------------------------------
// Mid-flight: the drag ends up fine and something during it was wrong

test("a drag with no dragend is a finding; a drag that never started is not", () => {
  const s = surface(entry({ path: "div#card", types: { dragstart: 1 }, draggable: true }));
  const kinds = () => deriveHandlerIssues(s)
    .filter((i) => i.kind === "drag-source-detached-mid-drag").length;

  s.realDragProbe = [realRow({
    path: "div#card",
    dragstartFired: true,
    timeline: [{ type: "dragstart", path: "div#card", count: 1 }, { type: "drop", path: "div#zone", count: 1 }],
  })];
  assert.equal(kinds(), 1, "the drop landed and dragend never came");

  // With a dragend, nothing to report — the normal case.
  s.realDragProbe = [realRow({
    path: "div#card",
    dragstartFired: true,
    timeline: [{ type: "dragstart", path: "div#card", count: 1 }, { type: "dragend", path: "div#card", count: 1 }],
  })];
  assert.equal(kinds(), 0);

  // A source the browser refused to pick up has no dragend either, and `drag-source-inert` is
  // what describes that. Reporting both would be two findings for one cause.
  s.realDragProbe = [realRow({ path: "div#card", dragstartFired: false, timeline: [] })];
  assert.equal(kinds(), 0);

  // No timeline at all: not measured.
  s.realDragProbe = [realRow({ path: "div#card", dragstartFired: true })];
  assert.equal(kinds(), 0);
});

test("a slow dragover is timed inside the handler, not between the events", () => {
  const slow = surface(entry({ path: "div#zone", types: { dragover: 1, drop: 1 }, dragoverMs: 80 }));
  assert.equal(deriveHandlerIssues(slow).filter((i) => i.kind === "dragover-handler-slow").length, 1);

  // Under the floor, and unmeasured, are both silent — and they are different states: an
  // `ondragover=` property assignment is never wrapped, so it reads as undefined rather than fast.
  for (const dragoverMs of [2, undefined]) {
    const s = surface(entry({ path: "div#zone", types: { dragover: 1 }, dragoverMs }));
    assert.deepEqual(
      deriveHandlerIssues(s).filter((i) => i.kind === "dragover-handler-slow"),
      [],
      `dragoverMs=${dragoverMs}`,
    );
  }
});

test("E2E: the two mid-flight defects, each with its control", { timeout: 180_000 }, async () => {
  // Both halves of this page "work": the drop lands and the data arrives. What is wrong happens
  // only while the drag is in flight.
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/drag-mid-flight.html"),
    probeDrag: true,
  });
  const row = (id: string) => s.realDragProbe?.find((r) => r.path.endsWith(`#${id}`))!;
  const has = (id: string, kind: string) => deriveHandlerIssues(s)
    .some((i) => i.kind === kind && i.element.includes(`#${id}`));

  // A detached source gets no dragend. Its drop still landed, which is what makes it invisible.
  assert.ok(row("vanishes").droppedOn, "the drag itself succeeded");
  assert.equal(row("vanishes").timeline?.some((step) => step.type === "dragend"), false);
  assert.ok(has("vanishes", "drag-source-detached-mid-drag"));
  // The control: same drag, node stays in the document.
  assert.equal(row("plain").timeline?.some((step) => step.type === "dragend"), true);
  assert.equal(has("plain", "drag-source-detached-mid-drag"), false);

  // The handler duration, and the control that caught the first version of this measurement.
  // Deriving it from the interval between dragovers reported 68ms for the fast zone, because the
  // probe's own 60-80ms hover screenshot lands inside that interval.
  const zone = (id: string) => s.elements.find((el) => el.path.endsWith(`#${id}`))!;
  assert.ok(zone("slow-zone").dragoverMs! >= 50, `slow zone measured ${zone("slow-zone").dragoverMs}`);
  assert.ok(zone("fast-zone").dragoverMs! < 20, `fast zone measured ${zone("fast-zone").dragoverMs}`);
  assert.ok(has("slow-zone", "dragover-handler-slow"));
  assert.equal(has("fast-zone", "dragover-handler-slow"), false, "the probe must not measure itself");

  // And the cancel note tells the two apart: the vanished source could not be dragged a second
  // time, which is not the same as Escape failing to cancel.
  assert.equal(row("vanishes").cancel?.started, false);
  assert.equal(row("plain").cancel?.started, true);
});

// ---------------------------------------------------------------------------
// The wheel, and a preventDefault() that cannot happen

test("a passive listener's preventDefault is a finding; the same call that works is not", () => {
  const s = surface(entry({ path: "div#pad", types: { wheel: 1 } }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "passive-listener-cannot-cancel");

  s.cancelAttempts = [{ path: "div#pad", type: "wheel", passive: true, effective: false }];
  assert.equal(kinds().length, 1);
  assert.match(kinds()[0]!.message, /\{ passive: true \}/);
  assert.match(kinds()[0]!.message, /still happens/);

  // The same finding with the other explanation. The rule keys on "the call did nothing", not on
  // the listener being passive: `preventDefault()` on a non-cancelable event fails the same way,
  // and keying on `passive` would have printed the wrong reason for it.
  s.cancelAttempts = [{ path: "div#pad", type: "scroll", passive: false, effective: false }];
  assert.equal(kinds().length, 1);
  assert.match(kinds()[0]!.message, /not cancelable/);
  assert.doesNotMatch(kinds()[0]!.message, /passive/);

  // Registered non-passive: the call worked, nothing to say.
  s.cancelAttempts = [{ path: "div#pad", type: "wheel", passive: false, effective: true }];
  assert.deepEqual(kinds(), []);

  // Passive AND effective is a contradiction the browser will not produce, but if it ever does,
  // "the call worked" wins: the rule is about a cancel that did nothing.
  s.cancelAttempts = [{ path: "div#pad", type: "wheel", passive: true, effective: true }];
  assert.deepEqual(kinds(), []);

  // Another element's record must not land here.
  s.cancelAttempts = [{ path: "div#other", type: "wheel", passive: true, effective: false }];
  assert.deepEqual(kinds(), []);

  // Nothing measured: no probe ran.
  delete s.cancelAttempts;
  assert.deepEqual(kinds(), []);
});

test("E2E: the wheel family separates a consumed wheel from a cancel that did nothing",
  { timeout: 180_000 }, async () => {
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/wheel-and-passive.html"),
    probes: ["wheel"],
  });
  const scrolled = (id: string) => s.wheelProbe?.find((r) => r.path.endsWith(`#${id}`))?.scrolledPx;

  // A 200px wheel is 200px of scroll, not 400: the element's own scrollTop was being counted twice,
  // once on its own and once by the ancestor walk that starts at it.
  assert.equal(scrolled("listens"), 200, "a handler that only reads lets the browser scroll");
  assert.equal(scrolled("jacked"), 0, "preventDefault on a non-passive listener stops it");
  assert.equal(scrolled("implicit"), 0, "a wheel listener with no option is not passive");
  // The defect, and it is visible in the pixels as well as in the record: the panel scrolled
  // although its handler said not to.
  assert.equal(scrolled("cancels"), 200);

  const flagged = deriveHandlerIssues(s)
    .filter((i) => i.kind === "passive-listener-cannot-cancel").map((i) => i.element);
  assert.equal(flagged.length, 2, flagged.join(", "));
  assert.match(flagged.join(" "), /#cancels/);
  // The second explanation, from the same rule: `scroll` is not cancelable. A `scroll` handler is
  // also a wheel-family target, because rolling the wheel over a scrollable panel is how one runs.
  assert.match(flagged.join(" "), /#uncancelable/);

  // Consuming the wheel is what a map does. It is reported and must never be graded.
  const { formatHandlerSurface } = await import("./handler-map.ts");
  const text = formatHandlerSurface(s, deriveHandlerIssues(s)).replace(/\u001b\[[0-9;]*m/g, "");
  assert.match(text, /div#jacked: a 200px wheel moved 0px \(nothing scrolled/);
  assert.equal(deriveHandlerIssues(s).some((i) => i.element.includes("#jacked")), false);

  // And the types stop being listed as never exercised.
  const unprobed = deriveHandlerIssues(s).find((i) => i.kind === "unprobed-handler-types");
  assert.equal(unprobed?.types?.includes("wheel") ?? false, false, "the wheel was driven");
});

test("--probe rejects a family it does not have", async () => {
  const { parseProbeFamilies } = await import("../gates/handlers.gate.ts");
  assert.deepEqual(parseProbeFamilies(["--probe", "wheel"]), ["wheel"]);
  assert.deepEqual(parseProbeFamilies(["--probe", "drag,wheel"]), ["drag", "wheel"]);
  // `all` follows the family list, so this grows with it rather than pinning a stale set.
  assert.deepEqual(parseProbeFamilies(["--probe", "all"]).sort(), [...PROBE_FAMILIES].sort());
  assert.ok(PROBE_FAMILIES.length >= 3, "drag, wheel, hover");
  assert.deepEqual(parseProbeFamilies([]), []);
  // A typo that quietly probes nothing is the failure mode every "absent means not measured" rule
  // in this file exists to avoid, so it is a usage error.
  assert.throws(() => parseProbeFamilies(["--probe", "whee"]), /unknown family. Known: drag, wheel/);
});

// ---------------------------------------------------------------------------
// Hover, and whether focus does the same (WCAG 1.4.13)

function hoverRow(over: Partial<import("./handler-map.ts").HoverProbe> & { path: string }) {
  return { text: "t", revealedOnHover: [], revealedOnFocus: [], focusable: true, ...over };
}

test("revealed on hover and on nothing else is the finding; the three other states are not", () => {
  const s = surface(entry({ path: "span#tip", types: { mouseenter: 1 } }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "hover-only-reveal");

  s.hoverProbe = [hoverRow({ path: "span#tip", revealedOnHover: ["#t1|help"] })];
  assert.equal(kinds().length, 1);
  assert.match(kinds()[0]!.message, /reveals #t1 on hover and nothing on focus/);
  assert.match(kinds()[0]!.message, /:focus \/ :focus-visible/, "the focusable fix");

  // Focus reveals it too — the correct implementation.
  s.hoverProbe = [hoverRow({ path: "span#tip", revealedOnHover: ["#t1|help"], revealedOnFocus: ["#t1|help"] })];
  assert.deepEqual(kinds(), []);

  // A hover handler that reveals nothing. A rule keyed on "has a hover handler and no focus
  // handler" would report this, which is why the rule is keyed on what was measured instead.
  s.hoverProbe = [hoverRow({ path: "span#tip" })];
  assert.deepEqual(kinds(), []);

  // Not driven, and an errored row measured nothing.
  s.hoverProbe = [hoverRow({ path: "span#tip", revealedOnHover: ["#t1|help"], error: "no usable box" })];
  assert.deepEqual(kinds(), []);
  delete s.hoverProbe;
  assert.deepEqual(kinds(), []);

  // An unfocusable trigger gets the other half of the fix.
  s.hoverProbe = [hoverRow({ path: "span#tip", revealedOnHover: ["#t1|help"], focusable: false })];
  assert.match(kinds()[0]!.message, /cannot even be focused/);
  assert.match(kinds()[0]!.message, /tabindex="0"/);
});

test("a hover finding needs no entry in the handler surface", () => {
  // The common form of this defect is a CSS `:hover` rule with no listener anywhere, so the trigger
  // is not in the surface at all. Keeping the rule inside the per-element loop reported the fixture's
  // JS trigger and silently skipped its CSS one, which the probe had measured correctly.
  const s: HandlerSurface = { source: "x.html", elements: [], globals: {}, totalRegistrations: 0 };
  s.hoverProbe = [hoverRow({ path: "span#css", text: "CSS only", revealedOnHover: ["#tip|help"] })];
  const found = deriveHandlerIssues(s).filter((i) => i.kind === "hover-only-reveal");
  assert.equal(found.length, 1);
  assert.match(found[0]!.element, /span#css "CSS only"/);
});

test("E2E: hover triggers come from the stylesheets as well as from the listeners",
  { timeout: 180_000 }, async () => {
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/hover-vs-focus.html"),
    probes: ["hover"],
  });
  const row = (id: string) => s.hoverProbe?.find((r) => r.path.endsWith(`#${id}`));

  // Both routes to a trigger. The CSS pair has no listener of any kind — before the stylesheet walk
  // they were invisible to this gate, and `#cssHoverOnly` is the shape most of these defects take.
  for (const id of ["jsHoverOnly", "jsBoth", "cssHoverOnly", "cssBoth", "noTabindex", "nothing"]) {
    assert.ok(row(id), `${id} must be probed`);
  }
  assert.deepEqual(row("cssHoverOnly")!.revealedOnHover.map((l) => l.split("|")[0]), ["#t1"]);
  assert.deepEqual(row("cssHoverOnly")!.revealedOnFocus, []);
  assert.deepEqual(row("cssBoth")!.revealedOnFocus.map((l) => l.split("|")[0]), ["#t2"]);
  assert.equal(row("noTabindex")!.focusable, false);
  assert.deepEqual(row("nothing")!.revealedOnHover, [], "the null control reveals nothing");

  const flagged = deriveHandlerIssues(s)
    .filter((i) => i.kind === "hover-only-reveal").map((i) => i.element);
  assert.equal(flagged.length, 3, flagged.join(", "));
  for (const id of ["cssHoverOnly", "jsHoverOnly", "noTabindex"]) {
    assert.ok(flagged.some((el) => el.includes(`#${id}`)), `${id} must report`);
  }
  for (const id of ["cssBoth", "jsBoth", "nothing", "asymDelay"]) {
    assert.equal(flagged.some((el) => el.includes(`#${id}`)), false, `${id} must stay silent`);
  }
  // An ordinary tooltip: instant on hover, 400ms on focus. With one 80ms look this read as
  // hover-only — a false positive on a delay that exists so the tip does not flash as the pointer
  // crosses. The probe takes a second look before concluding a phase revealed nothing.
  assert.deepEqual(row("asymDelay")!.revealedOnFocus.map((l) => l.split("|")[0]), ["#t6"]);
});

// ---------------------------------------------------------------------------
// Right-click, and touch

function menuRow(over: Partial<import("./handler-map.ts").MenuProbe> & { path: string }) {
  return { text: "m", handlerCalls: 1, prevented: true, revealed: ["#menu|Cut"], ...over };
}

test("the three right-click outcomes, and the two that are defects", () => {
  const s = surface(entry({ path: "div#box", types: { contextmenu: 1 } }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind.startsWith("contextmenu-")).map((i) => i.kind);

  // The contract: cancelled, and something appeared.
  s.menuProbe = [menuRow({ path: "div#box" })];
  assert.deepEqual(kinds(), []);

  // Forgot the cancel: the browser's own menu opens too.
  s.menuProbe = [menuRow({ path: "div#box", prevented: false, revealed: [] })];
  assert.deepEqual(kinds(), ["contextmenu-not-prevented"]);
  // Even when the page DID show its menu, an uncancelled right-click still opens the browser's.
  s.menuProbe = [menuRow({ path: "div#box", prevented: false })];
  assert.deepEqual(kinds(), ["contextmenu-not-prevented"]);

  // Cancelled and nothing appeared: the user is left with neither menu. Warn, because the
  // replacement may be drawn where this cannot see it.
  s.menuProbe = [menuRow({ path: "div#box", revealed: [] })];
  assert.deepEqual(kinds(), ["contextmenu-replaces-nothing"]);
  assert.equal(deriveHandlerIssues(s).find((i) => i.kind === "contextmenu-replaces-nothing")!.severity, "warn");

  // A right-click that never reached the handler measured nothing about the menu contract.
  s.menuProbe = [menuRow({ path: "div#box", handlerCalls: 0, prevented: false, revealed: [] })];
  assert.deepEqual(kinds(), []);
  s.menuProbe = [menuRow({ path: "div#box", error: "no usable box", prevented: false })];
  assert.deepEqual(kinds(), []);
  delete s.menuProbe;
  assert.deepEqual(kinds(), []);
});

test("a tap that invoked nothing is the graded touch outcome", () => {
  const s = surface(entry({ path: "div#pad", types: { touchstart: 1 } }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "touch-handlers-not-invoked").length;

  s.touchProbe = [{ path: "div#pad", text: "pad", tapCalls: 0 }];
  assert.equal(kinds(), 1);
  s.touchProbe = [{ path: "div#pad", text: "pad", tapCalls: 1 }];
  assert.equal(kinds(), 0);
  // A swipe that moved nothing is NOT graded — 0% has several explanations, the same reason the
  // pointer-drag ratios are reported and not judged.
  s.touchProbe = [{ path: "div#pad", text: "pad", tapCalls: 2, swipeRatio: 0 }];
  assert.equal(kinds(), 0);
  s.touchProbe = [{ path: "div#pad", text: "pad", tapCalls: 0, error: "no usable box" }];
  assert.equal(kinds(), 0);
});

test("E2E: right-click and touch on the fixture", { timeout: 240_000 }, async () => {
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/menu-and-touch.html"),
    probes: ["menu", "touch"],
  });
  const menu = (id: string) => s.menuProbe?.find((r) => r.path.endsWith(`#${id}`))!;
  const touch = (id: string) => s.touchProbe?.find((r) => r.path.endsWith(`#${id}`))!;

  // The right-click reached every handler, and `prevented` is read after the page's own handler —
  // before it, it is false for all three and separates nothing.
  for (const id of ["ctxOk", "ctxNoPrevent", "ctxNothing"]) {
    assert.ok(menu(id).handlerCalls > 0, `${id}: the right-click must reach the handler`);
  }
  assert.equal(menu("ctxOk").prevented, true);
  assert.deepEqual(menu("ctxOk").revealed.map((l) => l.split("|")[0]), ["#menu"]);
  assert.equal(menu("ctxNoPrevent").prevented, false);
  assert.equal(menu("ctxNothing").prevented, true);
  assert.deepEqual(menu("ctxNothing").revealed, []);

  // Touch, in its own page. The working pad's handlers run and its pixels move; the covered one is
  // reachable on paper and invokes nothing.
  assert.ok(touch("swipe").tapCalls > 0);
  assert.ok((touch("swipe").swipeRatio ?? 0) > 0.005, `swipe moved ${touch("swipe").swipeRatio}`);
  assert.ok(touch("tapOnly").tapCalls > 0, "the control is reachable");
  assert.equal(touch("tapCovered").tapCalls, 0);

  const kinds = deriveHandlerIssues(s);
  const flagged = (kind: string) => kinds.filter((i) => i.kind === kind).map((i) => i.element);
  assert.deepEqual(flagged("contextmenu-not-prevented").length, 1);
  assert.match(flagged("contextmenu-not-prevented")[0]!, /#ctxNoPrevent/);
  assert.deepEqual(flagged("contextmenu-replaces-nothing").length, 1);
  assert.match(flagged("contextmenu-replaces-nothing")[0]!, /#ctxNothing/);
  assert.deepEqual(flagged("touch-handlers-not-invoked").length, 1);
  assert.match(flagged("touch-handlers-not-invoked")[0]!, /#tapCovered/);
  // The controls stay silent under all three.
  for (const id of ["ctxOk", "tapOnly", "swipe"]) {
    assert.equal(
      kinds.some((i) => i.element.includes(`#${id}`) && (i.kind.startsWith("contextmenu-") || i.kind === "touch-handlers-not-invoked")),
      false,
      `${id} must stay silent`,
    );
  }
});

// ---------------------------------------------------------------------------
// Text typed in, three ways

function textRow(over: Partial<import("./handler-map.ts").TextInputProbe> & { path: string }) {
  return {
    text: "f",
    plainAscii: "vlmkit7",
    plainCjk: "日本語",
    composed: "日本語",
    observedTypes: ["input"],
    ...over,
  };
}

test("a field that keeps ASCII and drops CJK is the finding; a field that drops both is not", () => {
  const s = surface(entry({ path: "input#f", types: { input: 1 } }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "text-input-rejects-non-ascii");

  // Both samples survive: nothing to report.
  s.textInputProbe = [textRow({ path: "input#f" })];
  assert.deepEqual(kinds(), []);

  // The defect: ASCII kept, CJK gone.
  s.textInputProbe = [textRow({ path: "input#f", plainCjk: "", composed: "" })];
  assert.equal(kinds().length, 1);
  assert.match(kinds()[0]!.message, /kept "vlmkit7" and lost "日本語"/);
  assert.equal(kinds()[0]!.severity, "warn");

  // A digits-only field mangles the ASCII sample too, so the CJK loss is not attributable to the
  // script. This exclusion is the whole reason the ASCII drive exists.
  s.textInputProbe = [textRow({ path: "input#f", plainAscii: "7", plainCjk: "" })];
  assert.deepEqual(kinds(), []);

  // A length rule truncates the ASCII and keeps the CJK: also excluded, and for the same reason.
  s.textInputProbe = [textRow({ path: "input#f", plainAscii: "vlmk" })];
  assert.deepEqual(kinds(), []);

  // Not measured, and an errored row measured nothing.
  s.textInputProbe = [textRow({ path: "input#f", plainCjk: "", error: "not found" })];
  assert.deepEqual(kinds(), []);
  delete s.textInputProbe;
  assert.deepEqual(kinds(), []);
});

test("the input family's coverage claim is what the recorder saw", () => {
  const s = surface(entry({ path: "input#f", types: { input: 1, keydown: 1, compositionstart: 1 } }));
  s.textInputProbe = [textRow({ path: "input#f", observedTypes: ["compositionstart", "input"] })];
  const unprobed = deriveHandlerIssues(s).find((i) => i.kind === "unprobed-handler-types")!;
  // `insertText` sends no key events, so `keydown` is genuinely NOT covered by this family and has
  // to keep saying so — inferring "we typed, therefore keydown ran" would be the overclaim this
  // gate removed everywhere else.
  assert.deepEqual(unprobed.types, ["keydown"]);
});

test("E2E: three drives per field, and the control that makes the finding attributable",
  { timeout: 240_000 }, async () => {
  const s = await buildHandlerSurface({
    source: join(REPO_ROOT, "fixtures/handlers/text-input.html"),
    probes: ["input"],
  });
  const row = (id: string) => s.textInputProbe?.find((r) => r.path.endsWith(`#${id}`))!;

  // Half of these fields have no handler at all, so the targets cannot come from the handler
  // surface. Before they were enumerated in the page, three of the six were unprobed.
  for (const id of ["plain", "stripsNonAscii", "digitsOnly", "maxlen", "area", "changeCounter"]) {
    assert.ok(row(id), `${id} must be probed`);
  }
  assert.equal(row("plain").plainCjk, "日本語");
  assert.equal(row("stripsNonAscii").plainAscii, "vlmkit7");
  assert.equal(row("stripsNonAscii").plainCjk, "", "the filter eats it");
  assert.equal(row("digitsOnly").plainAscii, "7", "and it eats most of the ASCII too");
  assert.equal(row("maxlen").plainAscii, "vlmk");
  assert.equal(row("maxlen").plainCjk, "日本語", "a length rule is not a script rule");

  // A field that cannot take focus reports `not driven` rather than a value it never received.
  // Found on a real page: a textarea inside a closed <details> reported `"vlmkit7" became ""` for a
  // drive that never happened, and only the ASCII control kept that from being a false positive.
  const closed = row("insideClosedDetails");
  assert.ok(closed, "the field inside the closed <details> must appear");
  assert.match(closed.error ?? "", /could not focus/);
  assert.equal(closed.plainAscii, "", "and it must not claim a measurement");
  assert.equal(
    deriveHandlerIssues(s).some((i) => i.element.includes("#insideClosedDetails")),
    false,
    "an undriven field cannot produce a finding",
  );

  // The composition really ran: its types are in the observed list, which is what the coverage
  // claim reads. Nothing is graded from the composed value.
  assert.ok(row("plain").observedTypes.includes("compositionstart"), row("plain").observedTypes.join(","));
  assert.ok(row("plain").observedTypes.includes("compositionend"));
  assert.equal(row("plain").composed, "日本語");
  assert.equal(row("stripsNonAscii").composed, "", "same result composed or not — not IME-specific");

  // Transformed is not dropped. A furigana field that transliterates kana to romaji is ordinary on
  // Japanese sites, and a "does the value still contain it" check reported `lost "日本語" — typing it
  // left "NIHONGO"`, contradicting itself. A drop returns LESS than went in.
  assert.equal(row("translit").plainCjk, "NIHONGO");
  assert.ok(row("translit").plainCjk.length > "日本語".length);

  const flagged = deriveHandlerIssues(s)
    .filter((i) => i.kind === "text-input-rejects-non-ascii").map((i) => i.element);
  assert.equal(flagged.length, 1, flagged.join(", "));
  assert.match(flagged[0]!, /#stripsNonAscii/);
});

test("a field that rewrites text is not a field that drops it", () => {
  const s = surface(entry({ path: "input#f", types: { input: 1 } }));
  const kinds = () => deriveHandlerIssues(s).filter((i) => i.kind === "text-input-rejects-non-ascii").length;
  // Longer: a transliteration. Same length: a substitution. Both are rewrites, not losses.
  for (const plainCjk of ["NIHONGO", "ニホンゴ", "???"]) {
    s.textInputProbe = [textRow({ path: "input#f", plainCjk })];
    assert.equal(kinds(), 0, plainCjk);
  }
  // Shorter than what went in: the field kept less than it was given.
  for (const plainCjk of ["", "日"]) {
    s.textInputProbe = [textRow({ path: "input#f", plainCjk })];
    assert.equal(kinds(), 1, plainCjk);
  }
});

test("check interactions --handlers can emit every rule it declares", async () => {
  // It enabled the `drag` family alone, which made five of the rules it DECLARES unreachable
  // through it: `--rule hover-only-reveal=suspect` had something to bind to and nothing could ever
  // produce it. The mirror image of the undeclared-rule bug the runner catches, and invisible to
  // that check because declaring more than you emit is not an error.
  const { interactionsGate } = await import("../gates/interactions.gate.ts");
  const declared = new Set(interactionsGate.rules.map((r) => r.id));
  for (const id of [
    "hover-only-reveal",
    "contextmenu-not-prevented",
    "contextmenu-replaces-nothing",
    "touch-handlers-not-invoked",
    "text-input-rejects-non-ascii",
    "passive-listener-cannot-cancel",
  ]) {
    assert.ok(declared.has(id), `${id} must be declared`);
  }
  // The source is the only place the family list appears for this gate, so read it there: a gate
  // that declares the rules and drives one family is the state this test exists to reject.
  const source = await readFile(
    fileURLToPath(new URL("../gates/interactions.gate.ts", import.meta.url)),
    "utf8",
  );
  assert.match(source, /probes: \[\.\.\.PROBE_FAMILIES\]/);
  assert.doesNotMatch(source, /buildHandlerSurface\(\{ source, probeDrag: true/);
});

test("a hover finding says when many elements share the probed path", () => {
  // A toolbar of icon-only buttons with no id or class collapses to ONE derived path, so the probe
  // visits the first of them. Measured on a real editor: 17 tooltip triggers, one path, one finding
  // — which without the count reads as though one button were at fault.
  const s: HandlerSurface = {
    source: "x.html",
    elements: Array.from({ length: 17 }, () => entry({ path: "div>button", types: { mouseenter: 1 } })),
    globals: {},
    totalRegistrations: 17,
  };
  s.hoverProbe = [{
    path: "div>button",
    text: "1",
    revealedOnHover: ["#tooltip-1|Rectangle"],
    revealedOnFocus: [],
    focusable: true,
  }];
  const found = deriveHandlerIssues(s).find((i) => i.kind === "hover-only-reveal")!;
  assert.match(found.message, /17 elements on this page derive the same path/);
  assert.match(found.message, /the pattern rather than one control/);

  // One element, no such sentence.
  s.elements = [entry({ path: "div>button", types: { mouseenter: 1 } })];
  assert.doesNotMatch(
    deriveHandlerIssues(s).find((i) => i.kind === "hover-only-reveal")!.message,
    /derive the same path/,
  );
});
