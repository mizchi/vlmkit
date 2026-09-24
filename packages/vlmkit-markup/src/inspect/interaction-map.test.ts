import assert from "node:assert";
import { test } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  activationKeyForRole,
  ariaDelta,
  buildInteractionMap,
  compareInteractionMaps,
  deriveInteractionIssues,
  type AriaSnapshot,
  type InteractionElement,
  type InteractionMapResult,
} from "./interaction-map.ts";

// ---------------------------------------------------------------------------
// Pure helpers

test("activationKeyForRole canonical keys", () => {
  assert.equal(activationKeyForRole("button"), "Enter");
  assert.equal(activationKeyForRole("switch"), " ");
  assert.equal(activationKeyForRole("tab"), "ArrowRight");
  assert.equal(activationKeyForRole("link"), null);
  assert.equal(activationKeyForRole("textbox"), null);
});

function snap(overrides: Partial<AriaSnapshot> = {}): AriaSnapshot {
  return {
    expanded: null,
    selected: null,
    checked: null,
    pressed: null,
    open: null,
    controls: null,
    activeDescText: null,
    selectedWithin: null,
    liveText: "",
    layoutSignature: "10:800:1200",
    ...overrides,
  };
}

test("ariaDelta reports only changed attributes", () => {
  const delta = ariaDelta(
    snap({ expanded: "false", checked: "true" }),
    snap({ expanded: "true", checked: "true" }),
  );
  assert.deepEqual(delta, { expanded: ["false", "true"] });
});

function element(overrides: Partial<InteractionElement>): InteractionElement {
  return {
    index: 0,
    key: "button|Save",
    role: "button",
    name: "Save",
    path: "main>button",
    hasAriaExpanded: false,
    hasPopup: false,
    tabReachable: true,
    focusIndicator: true,
    ...overrides,
  };
}

function mapOf(...elements: InteractionElement[]): InteractionMapResult {
  return { source: "x.html", elements, capped: 0 };
}

test("dead disclosure: aria-expanded that never changes is a suspect", () => {
  const issues = deriveInteractionIssues(mapOf(element({
    hasAriaExpanded: true,
    activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null },
  })));
  assert.ok(issues.some((i) => i.kind === "dead-disclosure" && i.severity === "suspect"));
});

test("live disclosure raises no dead-disclosure issue", () => {
  const issues = deriveInteractionIssues(mapOf(element({
    hasAriaExpanded: true,
    activation: { key: "Enter", ariaDelta: { expanded: ["false", "true"] }, controlsBecameVisible: true, layoutChanged: true, focusMovedTo: null },
  })));
  assert.ok(!issues.some((i) => i.kind === "dead-disclosure"));
});

test("a control whose markup declares a no-op is not called inert for doing nothing", () => {
  // The dashboard demo's pager: Previous is aria-disabled on page 1 and "Page 1" is
  // aria-current, and both were reported as dead controls on every run (2026-09-23).
  const silent = { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null };
  const issues = deriveInteractionIssues(mapOf(
    element({ index: 0, key: "button|Previous", name: "Previous", declaresNoOp: true, activation: silent }),
    element({ index: 1, key: "button|Page 1", name: "Page 1", declaresNoOp: true, activation: silent }),
    element({ index: 2, key: "button|Save", name: "Save", activation: silent }),
  ));
  assert.deepEqual(issues.filter((i) => i.kind === "inert-control").map((i) => i.element), ['button "Save" (main>button)']);
});

test("broken aria-controls id is a suspect", () => {
  const issues = deriveInteractionIssues(mapOf(element({
    activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: true, focusMovedTo: null, brokenControlsId: "nope" },
  })));
  assert.ok(issues.some((i) => i.kind === "broken-aria-controls"));
});

test("missing focus indicator warns; roving composite members are not 'unreachable'", () => {
  const issues = deriveInteractionIssues(mapOf(
    element({ key: "button|A", name: "A", focusIndicator: false }),
    element({ key: "tab|T1", role: "tab", name: "T1", tabReachable: true, focusIndicator: true }),
    element({ key: "tab|T2", role: "tab", name: "T2", tabReachable: false, focusIndicator: null }),
    element({ key: "button|B", name: "B", tabReachable: false, focusIndicator: null }),
  ));
  assert.ok(issues.some((i) => i.kind === "no-focus-indicator" && i.element.includes('"A"')));
  const unreachable = issues.filter((i) => i.kind === "not-tab-reachable");
  assert.equal(unreachable.length, 1);
  assert.ok(unreachable[0]!.element.includes('"B"'));
});

test("inert control warns only for activation keys with no observable response", () => {
  const issues = deriveInteractionIssues(mapOf(element({
    activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null },
  })));
  assert.ok(issues.some((i) => i.kind === "inert-control"));
  const roving = deriveInteractionIssues(mapOf(element({
    role: "tab",
    key: "tab|T",
    activation: { key: "ArrowRight", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null },
  })));
  assert.ok(!roving.some((i) => i.kind === "inert-control"));
});

test("compare: missing element, lost focus indicator, and diverged ARIA transition", () => {
  const ref = mapOf(
    element({ key: "button|Ship", name: "Ship", activation: { key: "Enter", ariaDelta: { expanded: ["false", "true"] }, controlsBecameVisible: true, layoutChanged: true, focusMovedTo: null } }),
    element({ key: "switch|Mkt", role: "switch", name: "Mkt", activation: { key: "Space", ariaDelta: { checked: ["false", "true"] }, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null } }),
    element({ key: "link|Privacy", role: "link", name: "Privacy" }),
  );
  const att = mapOf(
    element({ key: "button|Ship", name: "Ship", focusIndicator: false, activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: false, layoutChanged: false, focusMovedTo: null } }),
    element({ key: "switch|Mkt", role: "switch", name: "Mkt", activation: { key: "Space", ariaDelta: { checked: ["false", "true"] }, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null } }),
  );
  const cmp = compareInteractionMaps(ref, att);
  assert.equal(cmp.missing.length, 1);
  assert.equal(cmp.missing[0]!.key, "link|Privacy");
  assert.ok(cmp.mismatches.some((m) => m.severity === "suspect" && m.message.includes("focus indicator")));
  assert.ok(cmp.mismatches.some((m) => m.severity === "suspect" && m.message.includes("ARIA transition")));
  assert.equal(cmp.extra.length, 0);
});

test("compare: identical maps satisfy the contract", () => {
  const ref = mapOf(element({}));
  const cmp = compareInteractionMaps(ref, mapOf(element({})));
  assert.equal(cmp.missing.length + cmp.extra.length + cmp.mismatches.length, 0);
});

// ---------------------------------------------------------------------------
// E2E on the interactive fixture (Playwright)

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const FIXTURE = join(REPO_ROOT, "fixtures/auto-markup-proof/interactive/reference.html");

test("E2E: the reference fixture maps cleanly with the expected transitions", { timeout: 240_000 }, async () => {
  const map = await buildInteractionMap({ source: FIXTURE });
  const byKey = new Map(map.elements.map((e) => [e.key, e]));

  const disclosure = byKey.get("button|Shipping options")!;
  assert.deepEqual(disclosure.activation!.ariaDelta, { expanded: ["false", "true"] });
  assert.equal(disclosure.activation!.controlsBecameVisible, true);
  assert.equal(disclosure.focusIndicator, true);

  const sw = byKey.get("switch|Marketing emails")!;
  assert.deepEqual(sw.activation!.ariaDelta, { checked: ["false", "true"] });

  const tab = byKey.get("tab|Email")!;
  assert.equal(tab.activation!.ariaDelta["selected"]![1], "false"); // roving moved selection away

  const issues = deriveInteractionIssues(map);
  assert.deepEqual(issues.filter((i) => i.severity === "suspect"), []);
  assert.deepEqual(issues.filter((i) => i.kind === "not-tab-reachable"), []);
});

test("E2E: a de-wired disclosure and a killed focus ring are detected against the reference", { timeout: 240_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "interactions-"));
  const src = readFileSync(FIXTURE, "utf8");
  const broken = src
    .replace('toggle.addEventListener("click", () => {', 'void (() => {') // disclosure wired to nothing
    // Deleting the rule is NOT enough — the UA default ring takes over
    // (and the probe correctly still sees an indicator). Killing the
    // indicator requires an explicit outline: none.
    .replace(
      ":focus-visible { outline: 3px solid #4338ca; outline-offset: 2px; }",
      ":focus-visible { outline: none !important; }",
    );
  assert.notEqual(broken, src);
  const attemptPath = join(dir, "attempt.html");
  writeFileSync(attemptPath, broken);

  const [refMap, attMap] = [await buildInteractionMap({ source: FIXTURE }), await buildInteractionMap({ source: attemptPath })];
  const issues = deriveInteractionIssues(attMap);
  assert.ok(issues.some((i) => i.kind === "dead-disclosure"), "dead disclosure detected standalone");

  const cmp = compareInteractionMaps(refMap, attMap);
  assert.ok(
    cmp.mismatches.some((m) => m.severity === "suspect" && m.key === "button|Shipping options" && m.message.includes("ARIA transition")),
    "ARIA transition divergence detected vs reference",
  );
  assert.ok(
    cmp.mismatches.some((m) => m.message.includes("focus indicator")),
    "lost focus indicator detected vs reference",
  );
});

// ---------------------------------------------------------------------------
// Popup patterns (dialog / menu): pure derivations

test("popup issues: no focus move, trap leak, no focus return, dead arrows", () => {
  const issues = deriveInteractionIssues(mapOf(
    element({ key: "button|Menu", name: "Menu", hasPopup: true, activation: { key: "Enter", ariaDelta: { expanded: ["false", "true"] }, controlsBecameVisible: true, layoutChanged: true, focusMovedTo: null, popupRole: "menu", focusMovedIntoPopup: false, escapeCloses: true, focusReturnsToOpener: false } }),
    element({ key: "button|Del", name: "Del", hasPopup: true, activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: true, focusMovedTo: null, popupRole: "dialog", focusMovedIntoPopup: true, focusTrapped: false, escapeCloses: true, focusReturnsToOpener: true } }),
    element({ key: "button|Opts", name: "Opts", hasPopup: true, activation: { key: "Enter", ariaDelta: { expanded: ["false", "true"] }, controlsBecameVisible: true, layoutChanged: true, focusMovedTo: null, popupRole: "menu", focusMovedIntoPopup: true, popupArrowCycles: false, escapeCloses: true, focusReturnsToOpener: true } }),
  ));
  assert.ok(issues.some((i) => i.kind === "popup-no-focus-move" && i.element.includes('"Menu"')));
  assert.ok(issues.some((i) => i.kind === "focus-not-returned" && i.element.includes('"Menu"')));
  assert.ok(issues.some((i) => i.kind === "focus-escapes-trap" && i.severity === "suspect" && i.element.includes('"Del"')));
  assert.ok(issues.some((i) => i.kind === "popup-arrows-dead" && i.element.includes('"Opts"')));
});

test("compare: popup-pattern regressions are suspects", () => {
  const refEl = element({ key: "button|Del", name: "Del", hasPopup: true, activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: true, focusMovedTo: null, popupRole: "dialog", focusMovedIntoPopup: true, focusTrapped: true, escapeCloses: true, focusReturnsToOpener: true, popupArrowCycles: true } });
  const attEl = element({ key: "button|Del", name: "Del", hasPopup: true, activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: true, focusMovedTo: null, popupRole: "dialog", focusMovedIntoPopup: false, focusTrapped: false, escapeCloses: true, focusReturnsToOpener: false, popupArrowCycles: false } });
  const cmp = compareInteractionMaps(mapOf(refEl), mapOf(attEl));
  const suspects = cmp.mismatches.filter((m) => m.severity === "suspect");
  assert.ok(suspects.some((m) => m.message.includes("moves focus into the popup")));
  assert.ok(suspects.some((m) => m.message.includes("traps Tab focus")));
  assert.ok(suspects.some((m) => m.message.includes("returns focus to the trigger")));
  assert.ok(suspects.some((m) => m.message.includes("arrow keys navigate")));
});

// ---------------------------------------------------------------------------
// Popup patterns: E2E on the heavy fixture + mutations

const HEAVY = join(REPO_ROOT, "fixtures/auto-markup-proof/interactive/reference-heavy.html");

test("E2E: heavy fixture — menu and modal dialog map cleanly", { timeout: 240_000 }, async () => {
  const map = await buildInteractionMap({ source: HEAVY });
  const byKey = new Map(map.elements.map((e) => [e.key, e]));
  const menu = byKey.get("button|Account actions")!;
  assert.equal(menu.activation!.popupRole, "menu");
  assert.equal(menu.activation!.focusMovedIntoPopup, true);
  assert.equal(menu.activation!.popupArrowCycles, true);
  assert.equal(menu.activation!.escapeCloses, true);
  assert.equal(menu.activation!.focusReturnsToOpener, true);
  const dialog = byKey.get("button|Delete account…")!;
  assert.equal(dialog.activation!.popupRole, "dialog");
  assert.equal(dialog.activation!.focusMovedIntoPopup, true);
  assert.equal(dialog.activation!.focusTrapped, true);
  assert.equal(dialog.activation!.focusReturnsToOpener, true);
  assert.deepEqual(deriveInteractionIssues(map).filter((i) => i.severity === "suspect"), []);
});

test("E2E: popup mutations are detected standalone and against the reference", { timeout: 480_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "interactions-heavy-"));
  const src = readFileSync(HEAVY, "utf8");
  const refMap = await buildInteractionMap({ source: HEAVY });

  // A: menu opens without moving focus into it
  const a = join(dir, "a.html");
  writeFileSync(a, src.replace("menu.hidden = false;\n    items[0].focus();", "menu.hidden = false;"));
  const mapA = await buildInteractionMap({ source: a });
  assert.ok(deriveInteractionIssues(mapA).some((i) => i.kind === "popup-no-focus-move"), "A standalone");
  assert.ok(compareInteractionMaps(refMap, mapA).mismatches.some((m) => m.message.includes("moves focus into the popup")), "A contract");

  // B: non-modal dialog (show instead of showModal) leaks Tab focus
  const b = join(dir, "b.html");
  writeFileSync(b, src.replace("dialog.showModal()", "dialog.show()"));
  const mapB = await buildInteractionMap({ source: b });
  assert.ok(deriveInteractionIssues(mapB).some((i) => i.kind === "focus-escapes-trap" && i.severity === "suspect"), "B standalone");

  // C: Escape closes the menu without returning focus
  const c = join(dir, "c.html");
  writeFileSync(c, src.replace('if (e.key === "Escape") { e.preventDefault(); closeMenu(true); }', 'if (e.key === "Escape") { e.preventDefault(); closeMenu(false); }'));
  const mapC = await buildInteractionMap({ source: c });
  assert.ok(deriveInteractionIssues(mapC).some((i) => i.kind === "focus-not-returned"), "C standalone");
  assert.ok(compareInteractionMaps(refMap, mapC).mismatches.some((m) => m.severity === "suspect" && m.message.includes("returns focus")), "C contract");

  // D: menu arrows dead
  const d = join(dir, "d.html");
  writeFileSync(d, src.replace('if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }', ""));
  const mapD = await buildInteractionMap({ source: d });
  assert.ok(deriveInteractionIssues(mapD).some((i) => i.kind === "popup-arrows-dead"), "D standalone");
  assert.ok(compareInteractionMaps(refMap, mapD).mismatches.some((m) => m.severity === "suspect" && m.message.includes("arrow keys")), "D contract");
});

// ---------------------------------------------------------------------------
// v3: listbox (activedescendant), grid nav, live-region announce

test("ariaDelta covers activedescendant text and composite selection", () => {
  const delta = ariaDelta(
    snap({ activeDescText: "High passes", selectedWithin: "High passes" }),
    snap({ activeDescText: "Kii Peninsula", selectedWithin: "Kii Peninsula" }),
  );
  assert.deepEqual(delta, {
    activedescendant: ["High passes", "Kii Peninsula"],
    selection: ["High passes", "Kii Peninsula"],
  });
});

test("composite-arrows-dead warns for a grid with no response; announce regression is a contract suspect", () => {
  const deadGrid = element({
    key: "grid|Weeks", role: "grid", name: "Weeks",
    activation: { key: "ArrowRight", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null },
  });
  assert.ok(deriveInteractionIssues(mapOf(deadGrid)).some((i) => i.kind === "composite-arrows-dead"));

  const liveGrid = element({
    key: "grid|Weeks", role: "grid", name: "Weeks",
    activation: { key: "ArrowRight", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: false, focusMovedTo: null, focusMovedWithin: true },
  });
  assert.ok(!deriveInteractionIssues(mapOf(liveGrid)).some((i) => i.kind === "composite-arrows-dead"));
  const cmpGrid = compareInteractionMaps(mapOf(liveGrid), mapOf(deadGrid));
  assert.ok(cmpGrid.mismatches.some((m) => m.severity === "suspect" && m.message.includes("composite")));

  const announcer = element({
    key: "button|Add", name: "Add",
    activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: true, focusMovedTo: null, liveRegionChanged: true },
  });
  const silent = element({
    key: "button|Add", name: "Add",
    activation: { key: "Enter", ariaDelta: {}, controlsBecameVisible: null, layoutChanged: true, focusMovedTo: null },
  });
  const cmp = compareInteractionMaps(mapOf(announcer), mapOf(silent));
  assert.ok(cmp.mismatches.some((m) => m.severity === "suspect" && m.message.includes("live region")));
});

const WIDGETS = join(REPO_ROOT, "fixtures/auto-markup-proof/interactive/reference-widgets.html");

test("E2E: widgets fixture — listbox activedescendant, grid roving, live announce", { timeout: 240_000 }, async () => {
  const map = await buildInteractionMap({ source: WIDGETS });
  const byKey = new Map(map.elements.map((e) => [e.key, e]));
  const listbox = byKey.get("listbox|Choose a guide")!;
  assert.equal(listbox.activation!.ariaDelta["activedescendant"]![1], "Kii Peninsula by rail");
  assert.equal(listbox.activation!.ariaDelta["selection"]![1], "Kii Peninsula by rail");
  const grid = byKey.get("grid|Delivery week")!;
  assert.equal(grid.tabReachable, true); // via its roving cell
  assert.equal(grid.activation!.focusMovedWithin, true);
  const btn = byKey.get("button|Add to cart")!;
  assert.equal(btn.activation!.liveRegionChanged, true);
  assert.deepEqual(deriveInteractionIssues(map).filter((i) => i.severity === "suspect"), []);
  // option children are captured through the container, not itemized
  assert.ok(![...byKey.keys()].some((k) => k.startsWith("option|")));
});

test("E2E: widget mutations detected — silent announce, dead listbox arrows, dead grid", { timeout: 480_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "widgets-"));
  const src = readFileSync(WIDGETS, "utf8");
  const refMap = await buildInteractionMap({ source: WIDGETS });

  // A: add-to-cart stops announcing
  const a = join(dir, "a.html");
  writeFileSync(a, src.replace('document.getElementById("cart-status").textContent =', "void ("));
  const mapA = await buildInteractionMap({ source: a });
  assert.ok(compareInteractionMaps(refMap, mapA).mismatches.some((m) => m.message.includes("live region")), "A contract");

  // B: listbox arrows dead
  const b = join(dir, "b.html");
  writeFileSync(b, src.replace('if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(cur + 1, options.length - 1)); }', ""));
  const mapB = await buildInteractionMap({ source: b });
  const lb = mapB.elements.find((e) => e.role === "listbox")!;
  assert.deepEqual(lb.activation!.ariaDelta, {});
  assert.ok(deriveInteractionIssues(mapB).some((i) => i.kind === "composite-arrows-dead"), "B standalone");
  assert.ok(compareInteractionMaps(refMap, mapB).mismatches.some((m) => m.severity === "suspect" && m.message.includes("ARIA transition")), "B contract");

  // C: grid arrows dead
  const c = join(dir, "c.html");
  writeFileSync(c, src.replace('if (e.key === "ArrowRight") { e.preventDefault(); moveCell(i, i + 1); }', ""));
  const mapC = await buildInteractionMap({ source: c });
  assert.ok(deriveInteractionIssues(mapC).some((i) => i.kind === "composite-arrows-dead"), "C standalone");
  assert.ok(compareInteractionMaps(refMap, mapC).mismatches.some((m) => m.severity === "suspect" && m.message.includes("composite")), "C contract");
});

test("E2E: a focus indicator drawn on a DESCENDANT (APG span.focus pattern) is not a false 'no-indicator'", { timeout: 120_000 }, async () => {
  // Regression for the W3C APG external-dogfood false positive: the APG
  // tabs example sets outline:none on the button and draws the ring on
  // an inner <span class="focus"> via :focus. The element's own style is
  // unchanged; the indicator lives on a child.
  const dir = mkdtempSync(join(tmpdir(), "focusring-"));
  const file = join(dir, "page.html");
  writeFileSync(file, `<!doctype html><html><head><title>t</title><style>
    button { outline: none; border: 1px solid #ccc; }
    button .ring { outline: 2px solid transparent; }
    button:focus .ring { outline-color: #4338ca; }
  </style></head><body>
    <button id="b"><span class="ring">Tab one</span></button>
  </body></html>`);
  const map = await buildInteractionMap({ source: file });
  const btn = map.elements.find((e) => e.key.startsWith("button|"))!;
  assert.equal(btn.tabReachable, true);
  assert.equal(btn.focusIndicator, true); // descendant ring counts
  assert.ok(!deriveInteractionIssues(map).some((i) => i.kind === "no-focus-indicator"));
});

/**
 * Four false readings from one round of demo sites (2026-09-23), on one page: controls named by
 * their `value` or not at all although each has a `<label>` (checkout, shop); a native checkbox
 * whose only effect is its own tick reported dead (checkout); a pager that swaps its rows and
 * announces the new range reported dead because its layout did not change (dashboard); and a
 * button that renames itself on activation read as focus moving (docs).
 */
test("E2E: labels name controls, and a tick, an announcement or a rename is not a dead control", { timeout: 240_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "interactions-names-"));
  const page = join(dir, "page.html");
  writeFileSync(page, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>names</title></head><body>
    <label><input type="radio" name="plan" value="2p3m" checked> 2 people</label>
    <label><input type="radio" name="plan" value="4p3m"> 4 people</label>
    <label for="email">Email</label> <input id="email" type="email">
    <label for="day">Delivery day</label> <select id="day"><option>Select a day</option><option>Monday</option></select>
    <label for="qty">Quantity</label> <input id="qty" type="number" value="1" min="1" max="10">
    <label><input type="checkbox" id="terms"> I agree to the terms</label>
    <button id="next" onclick="document.getElementById('status').textContent = 'Page 2 of 2'">Next</button>
    <p id="status" aria-live="polite">Page 1 of 2</p>
    <button id="copy" onclick="this.textContent = 'Copied'">Copy</button>
  </body></html>`);
  const map = await buildInteractionMap({ source: page });
  const named = map.elements.map((e) => `${e.role}|${e.name}`);
  for (const key of ["radio|2 people", "radio|4 people", "textbox|Email", "combobox|Delivery day", "spinbutton|Quantity", "checkbox|I agree to the terms"]) {
    assert.ok(named.includes(key), `${key} in ${JSON.stringify(named)}`);
  }
  const byName = new Map(map.elements.map((e) => [e.name, e]));
  assert.deepEqual(byName.get("I agree to the terms")!.activation!.ariaDelta, { checked: ["false", "true"] });
  assert.equal(byName.get("Copy")!.activation!.focusMovedWithin, undefined, "renaming itself is not focus moving");
  assert.equal(byName.get("Next")!.activation!.liveRegionChanged, true);
  const inert = deriveInteractionIssues(map).filter((i) => i.kind === "inert-control").map((i) => i.message);
  assert.deepEqual(inert, [], "the tick, the announcement and the rename are all responses");
});
