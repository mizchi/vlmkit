import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { encodePng } from "@mizchi/vlmkit-core/png-utils.ts";
import { parseA11yTree } from "@mizchi/vlmkit-judge/a11y-tree.ts";
import { runCheckA11yTree } from "./check-a11y-tree.ts";
import { axDumpArgs, collectMacosAx } from "./macos-ax-collector.ts";
import { AX_DUMP_SWIFT } from "./macos-ax-dump.swift.ts";
import { AX_DUMP_FORMAT, axRole, importAxDump, type AxDump, type AxElement } from "./macos-ax.ts";
import { runScanA11y } from "./scan-a11y.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "vlmkit-ax-"));

/** A 480x360pt window at (100, 200) on screen, shaped like an AppKit settings pane. */
const WIN = { x: 100, y: 200, width: 480, height: 360 };
const at = (x: number, y: number, width: number, height: number) => ({ x: WIN.x + x, y: WIN.y + y, width, height });

function settingsWindow(): AxDump {
  const children: AxElement[] = [
    { role: "AXStaticText", value: "Settings", frame: at(20, 20, 120, 24) },
    { role: "AXButton", title: "Start", frame: at(20, 60, 90, 28), enabled: true, actions: ["AXPress"] },
    // An image-only button nobody labelled: VoiceOver says just "button".
    { role: "AXButton", frame: at(120, 60, 28, 28), enabled: true, actions: ["AXPress"] },
    { role: "AXButton", description: "Info", frame: at(150, 66, 14, 14), enabled: true, actions: ["AXPress"] },
    // As small, but alone: WCAG 2.5.8's spacing exception holds.
    { role: "AXButton", description: "Help", frame: at(400, 20, 14, 14), enabled: true, actions: ["AXPress"] },
    { role: "AXButton", title: "Next", frame: at(20, 100, 90, 28), enabled: false, actions: ["AXPress"] },
    { role: "AXCheckBox", title: "Remember me", value: 1, frame: at(20, 140, 140, 28), actions: ["AXPress"] },
    { role: "AXCheckBox", subrole: "AXSwitch", description: "Sync", value: 0, frame: at(200, 140, 40, 28) },
    // Labelled only by a separate label view, linked through AXTitleUIElement.
    { role: "AXTextField", titleElement: "Name", value: "Ada", frame: at(20, 180, 200, 28), focusable: true },
    {
      role: "AXTextField",
      subrole: "AXSecureTextField",
      placeholder: "Password",
      value: "••••",
      frame: at(240, 180, 200, 28),
    },
    { role: "AXTextField", frame: at(20, 220, 200, 28), focusable: true },
    {
      role: "AXScrollArea",
      frame: at(20, 260, 440, 80),
      children: [
        { role: "AXGroup", children: [{ role: "AXStaticText", value: "Row 40", frame: at(30, 600, 100, 20) }] },
      ],
    },
    // Laid out past the window's bottom edge with nothing to scroll it into view.
    { role: "AXStaticText", value: "Hidden log", frame: at(20, 420, 100, 20) },
    // As macOS 15 reported an overlay scroller: its parts are AXButtons, two of them 0x0.
    {
      role: "AXScrollBar",
      frame: at(466, 260, 14, 80),
      actions: ["AXIncrement", "AXDecrement"],
      children: [
        { role: "AXValueIndicator", frame: at(467, 263, 12, 20) },
        { role: "AXButton", subrole: "AXIncrementArrow", frame: at(467, 261, 0, 0), actions: ["AXPress"] },
        { role: "AXButton", subrole: "AXDecrementArrow", frame: at(467, 261, 0, 0), actions: ["AXPress"] },
        { role: "AXButton", subrole: "AXIncrementPage", frame: at(467, 283, 12, 56), actions: ["AXPress"] },
        { role: "AXButton", subrole: "AXDecrementPage", frame: at(467, 261, 12, 2), actions: ["AXPress"] },
      ],
    },
    // The title-bar buttons: no title, no description, named only by their role description.
    {
      role: "AXButton",
      subrole: "AXCloseButton",
      roleDescription: "close button",
      frame: at(6, 6, 16, 16),
      actions: ["AXPress"],
    },
    // Reported, but with no size: on screen nowhere.
    { role: "AXButton", frame: at(300, 20, 0, 0), actions: ["AXPress"] },
  ];
  return {
    format: AX_DUMP_FORMAT,
    app: { name: "Fixture", bundleId: "dev.vlmkit.fixture", pid: 4242 },
    window: { title: "Settings", frame: WIN },
    root: { role: "AXWindow", subrole: "AXStandardWindow", title: "Settings", frame: WIN, children },
  };
}

describe("importAxDump", () => {
  const tree = importAxDump(settingsWindow());
  const byPath = new Map(tree.nodes.map((n) => [n.path, n]));
  const named = (name: string) => tree.nodes.find((n) => n.name === name)!;

  it("keeps points and makes every rect relative to the window's top-left corner", () => {
    assert.equal(tree.platform, "macos");
    assert.deepEqual(tree.viewport, { width: 480, height: 360 });
    assert.equal(tree.scale, undefined); // the judge takes it from the frame's width
    assert.deepEqual(byPath.get("window[0]")!.rect, { left: 0, top: 0, width: 480, height: 360 });
    assert.deepEqual(named("Info").rect, { left: 150, top: 66, width: 14, height: 14 });
  });

  it("indexes paths per role among siblings, like the Android importer", () => {
    assert.ok(byPath.has("window[0]>button[0]"));
    assert.ok(byPath.has("window[0]>button[4]"));
    assert.ok(byPath.has("window[0]>statictext[1]"));
    assert.equal(new Set(tree.nodes.map((n) => n.path)).size, tree.nodes.length);
  });

  it("names a node as VoiceOver does: title, description, linked label; text by its value", () => {
    assert.equal(byPath.get("window[0]>statictext[0]")!.name, "Settings");
    assert.equal(byPath.get("window[0]")!.name, "Settings"); // the window's own AXTitle
    assert.equal(named("Start").role, "button");
    assert.equal(named("Name").role, "textfield");
    assert.equal(named("Name").value, "Ada");
    // A secure field never leaks its content; its placeholder names it when nothing else does.
    assert.equal(named("Password").value, undefined);
    assert.ok(tree.nodes.some((n) => n.role === "button" && !n.name));
    assert.ok(tree.nodes.some((n) => n.role === "textfield" && !n.name));
  });

  it("maps states and actions", () => {
    assert.deepEqual(named("Start").actions, ["tap"]);
    assert.deepEqual(named("Next").states, { disabled: true });
    assert.deepEqual(named("Remember me").states, { checked: true });
    assert.equal(named("Sync").role, "switch");
    assert.deepEqual(named("Sync").states, { checked: false });
    assert.deepEqual(named("Name").actions, ["focus", "setText"]);
    assert.equal(byPath.get("window[0]>scrollarea[0]")!.role, "scrollview");
    // No mapping: the role keeps its own name and is judged by its actions.
    assert.deepEqual(byPath.get("window[0]>scrollbar[0]")!.actions, ["increment", "decrement"]);
  });

  it("names title-bar buttons by their role description, as VoiceOver does", () => {
    assert.equal(byPath.get("window[0]>button[5]")!.name, "close button");
  });

  it("marks a name that is announced but not drawn, so contrast does not read an icon as text", () => {
    assert.equal(byPath.get("window[0]>button[5]")!.nameDrawn, false); // role description
    assert.equal(named("Info").nameDrawn, false); // AXDescription on an icon button
    assert.equal(named("Name").nameDrawn, false); // a separate label view's text
    assert.equal(named("Start").nameDrawn, undefined); // its title is on the button
    assert.equal(named("Settings").nameDrawn, undefined); // static text
    assert.equal(named("Password").nameDrawn, undefined); // the placeholder is drawn in the field
  });

  it("drops scroll-bar parts and empty frames: neither is a control a user can hit", () => {
    assert.deepEqual(
      tree.nodes.filter((n) => n.path.startsWith("window[0]>scrollbar[0]>")).map((n) => n.role),
      ["valueindicator"],
    );
    assert.ok(!byPath.has("window[0]>button[6]"));
  });

  it("drops elements with no frame but keeps their children, under the full path", () => {
    assert.ok(!byPath.has("window[0]>scrollarea[0]>group[0]"));
    assert.ok(byPath.has("window[0]>scrollarea[0]>group[0]>statictext[0]"));
  });

  it("maps subroles before roles", () => {
    assert.equal(axRole({ role: "AXRadioButton", subrole: "AXTabButton" }), "tab");
    assert.equal(axRole({ role: "AXWindow", subrole: "AXDialog" }), "dialog");
    assert.equal(axRole({ role: "AXWindow", subrole: "AXStandardWindow" }), "window");
    assert.equal(axRole({ role: "AXValueIndicator" }), "valueindicator");
  });

  it("refuses what is not a dump, by name", () => {
    assert.throws(() => importAxDump({ format: "vlmkit-a11y/1" }), /not a macOS AX dump/);
    assert.throws(
      () => importAxDump({ format: AX_DUMP_FORMAT, window: {}, root: { role: "AXWindow" } }),
      /window\.frame/,
    );
    assert.throws(() => importAxDump("{"), /not a macOS AX dump/);
  });
});

describe("scan a11y <dump.ax.json> → check a11y tree", () => {
  it("imports a saved dump with its frame and judges the planted defects", async () => {
    const dir = tmp();
    // A plain white 2x capture: every text node reads as blank, so contrast finds nothing here.
    const width = WIN.width * 2;
    const height = WIN.height * 2;
    await encodePng(join(dir, "window.png"), { width, height, data: new Uint8Array(width * height * 4).fill(255) });
    writeFileSync(join(dir, "window.ax.json"), JSON.stringify({ ...settingsWindow(), frame: "window.png" }));
    const out = join(dir, "out", "a11y.json");
    const scan = await runScanA11y({ source: join(dir, "window.ax.json"), out });
    assert.equal(scan.platform, "macos");
    assert.equal(scan.frame, join(dir, "window.png"));
    const tree = parseA11yTree(readFileSync(out, "utf8"));
    assert.equal(tree.frame, "../window.png");

    const report = await runCheckA11yTree({ source: out });
    assert.deepEqual(report.unlabelled.map((f) => f.role).sort(), ["button", "textfield"]);
    assert.deepEqual(
      report.unreachable.map((u) => u.first.name),
      ["Hidden log"],
    );
    assert.deepEqual(
      report.touch.failures.map((f) => f.text),
      ["Info"],
    );
    assert.deepEqual(
      report.touch.wcagExempt.map((f) => f.text),
      ["Help", "close button"],
    );
  });

  it("says why there is no frame when the collector could not capture one", async () => {
    const dir = tmp();
    const reason = "Screen Recording is not allowed for this terminal";
    writeFileSync(join(dir, "w.ax.json"), JSON.stringify({ ...settingsWindow(), frameError: reason }));
    const scan = await runScanA11y({ source: join(dir, "w.ax.json"), out: join(dir, "a11y.json") });
    assert.equal(scan.frame, null);
    assert.equal(scan.frameError, reason);
  });
});

describe("the macOS collector", () => {
  it("passes the CLI's options to the Swift binary as its flags", () => {
    assert.deepEqual(
      axDumpArgs({
        app: "TextEdit",
        window: "Untitled",
        clicks: ["New", "OK"],
        framePath: "/t/f.png",
        maxNodes: 900,
        waitSeconds: 2,
        prompt: true,
      }),
      [
        "--app",
        "TextEdit",
        "--window",
        "Untitled",
        "--click",
        "New",
        "--click",
        "OK",
        "--frame",
        "/t/f.png",
        "--max-nodes",
        "900",
        "--wait",
        "2",
        "--prompt",
      ],
    );
    // Every flag it passes is one the Swift source parses.
    for (const flag of ["--app", "--window", "--click", "--frame", "--max-nodes", "--wait", "--prompt"]) {
      assert.ok(AX_DUMP_SWIFT.includes(`case "${flag}"`), flag);
    }
    assert.ok(AX_DUMP_SWIFT.includes(`"format": "${AX_DUMP_FORMAT}"`));
  });

  it("refuses off a Mac and says how to collect there", { skip: process.platform === "darwin" }, async () => {
    await assert.rejects(collectMacosAx({ app: "TextEdit" }), /runs only on a Mac.*scan a11y window\.ax\.json/s);
  });
});
