import assert from "node:assert";
import { test } from "node:test";
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
