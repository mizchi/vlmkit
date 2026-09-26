import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "vitest";
import { encodePng } from "@mizchi/vlmkit-core/png-utils.ts";
import { parseA11yTree } from "@mizchi/vlmkit-judge/a11y-tree.ts";
import { runCheckA11yTree } from "./check-a11y-tree.ts";
import { flutterWebNodes, type FlutterWebRawNode } from "./flutter-web.ts";
import { runScanA11y } from "./scan-a11y.ts";
import { importUiautomatorDump } from "./uiautomator.ts";

const ROOT = resolve(import.meta.dirname!, "../../../..");
const FIXTURE = join(ROOT, "fixtures/a11y-tree/flutter-like.html");
const tmp = () => mkdtempSync(join(tmpdir(), "vlmkit-a11y-"));

describe("scan a11y → check a11y tree on a Flutter-shaped page", () => {
  it("switches the semantics tree on, and the judges find each planted defect and nothing else", async () => {
    const dir = tmp();
    const out = join(dir, "a11y.json");
    const scan = await runScanA11y({ source: FIXTURE, out });
    assert.equal(scan.platform, "flutter-web");
    assert.ok(scan.counts.named > 10, JSON.stringify(scan.counts));
    const tree = parseA11yTree(readFileSync(out, "utf8"));
    assert.equal(tree.frame, "a11y.png");
    assert.deepEqual(tree.viewport, { width: 375, height: 812 });
    const byName = new Map(tree.nodes.map((n) => [n.name, n]));
    assert.equal(byName.get("Settings")!.role, "heading");
    assert.equal(byName.get("Seed hint")!.role, "text");
    assert.deepEqual(byName.get("Start")!.actions, ["tap"]);
    assert.deepEqual(byName.get("Next")!.states, { disabled: true });
    assert.ok(tree.nodes.some((n) => n.role === "textfield" && !n.name));
    assert.ok(tree.nodes.some((n) => (n.actions ?? []).includes("scroll")));

    const report = await runCheckA11yTree({ source: out });
    assert.deepEqual(report.unlabelled.map((f) => f.role), ["textfield"]);
    assert.equal(report.unreachable.length, 1);
    assert.equal(report.unreachable[0]!.first.name, "log 3");
    assert.equal(report.unreachable[0]!.count, 4);
    assert.deepEqual(report.contrast!.failures.map((f) => f.name), ["Seed hint"]);
    assert.ok(report.contrast!.failures[0]!.ratio < 2.5, String(report.contrast!.failures[0]!.ratio));
    assert.ok(report.contrast!.skipped.some((s) => s.name === "Next" && s.reason === "disabled"));
    assert.deepEqual(report.touch.failures.map((f) => f.text), ["Info"]);
    assert.deepEqual(report.touch.wcagExempt.map((f) => f.text), ["Help"]); // alone: 2.5.8's spacing exception
    assert.deepEqual(report.touch.enclosed.map((e) => e.name), ["Place here"]);
  }, 60000);

  it("--click taps by exact name and names what is tappable when it misses", async () => {
    const dir = tmp();
    await assert.rejects(
      runScanA11y({ source: FIXTURE, out: join(dir, "a.json"), clicks: ["Sart"] }),
      /no tappable node has that exact name.*"Start".*"Info"/,
    );
  }, 60000);

  it("a tree that never builds is written, and says it holds nothing", async () => {
    const dir = tmp();
    const scan = await runScanA11y({ source: `file://${FIXTURE}?semantics=off`, out: join(dir, "a.json"), timeout: 3000 });
    assert.deepEqual(scan.counts, { nodes: 0, named: 0, interactive: 0 });
  }, 60000);

  it("refuses a page that is not Flutter, pointing at the DOM gates", async () => {
    await assert.rejects(
      runScanA11y({ source: join(ROOT, "fixtures/composition/composed.html"), out: join(tmp(), "a.json"), timeout: 3000 }),
      /not a Flutter web app.*check a11y touch/,
    );
  }, 60000);
});

describe("flutterWebNodes", () => {
  const raw = (over: Partial<FlutterWebRawNode>): FlutterWebRawNode => ({
    path: "n1", tag: "flt-semantics", role: null, ariaLabel: null, text: "", value: null,
    rect: { left: 0, top: 0, width: 10, height: 10 }, headingLevel: null, tappable: false, scrolls: false,
    disabled: false, checked: null, selected: null, expanded: null, hidden: false, focused: false, ...over,
  });

  it("maps Flutter's DOM onto the contract's roles", () => {
    const nodes = flutterWebNodes([
      raw({ tag: "h2", text: "OFCP" }),
      raw({ role: "button", text: "Standard", tappable: true, selected: true }),
      raw({ role: "alertdialog" }),
      raw({ ariaLabel: "Alert" }),
      raw({}),
      raw({ tag: "input", ariaLabel: "Seed (integer)", disabled: true }),
      raw({ tag: "input", value: "42" }),
      raw({ role: "img", ariaLabel: "logo" }),
      raw({ tappable: true, scrolls: true }),
    ]);
    assert.deepEqual(nodes.map((n) => [n.role, n.name ?? null]), [
      ["heading", "OFCP"], ["button", "Standard"], ["dialog", null], ["text", "Alert"], ["group", null],
      ["textfield", "Seed (integer)"], ["textfield", null], ["image", "logo"], ["group", null],
    ]);
    assert.deepEqual(nodes[1]!.states, { selected: true });
    assert.deepEqual(nodes[5]!.actions, undefined); // a disabled field cannot take text
    assert.deepEqual([nodes[6]!.value, nodes[6]!.actions], ["42", ["setText"]]);
    assert.deepEqual(nodes[8]!.actions, ["tap", "scroll"]);
  });
});

describe("importUiautomatorDump", () => {
  const DUMP = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" class="android.widget.FrameLayout" content-desc="" clickable="false" enabled="true" scrollable="false" bounds="[0,0][1080,2400]">
    <node index="0" text="Sign in" class="android.widget.TextView" content-desc="" clickable="false" enabled="true" bounds="[42,100][400,160]" />
    <node index="1" text="me@example.com" class="android.widget.EditText" content-desc="" hint="Email" clickable="true" focusable="true" enabled="true" bounds="[42,200][1038,340]" />
    <node index="2" text="" class="android.widget.ImageButton" content-desc="" clickable="true" enabled="true" bounds="[980,40][1060,120]" />
    <node index="3" text="Go &amp; see" class="android.widget.Button" content-desc="" clickable="true" enabled="false" bounds="[42,400][300,540]" />
    <node index="4" text="" class="androidx.recyclerview.widget.RecyclerView" scrollable="true" clickable="false" enabled="true" bounds="[0,600][1080,2400]">
      <node index="0" text="Row" class="android.widget.TextView" clickable="false" enabled="true" bounds="[0,2300][1080,2500]" />
    </node>
    <node index="5" text="Footer" class="android.widget.TextView" clickable="false" enabled="true" bounds="[0,2380][1080,2600]" />
  </node>
</hierarchy>`;

  it("reads bounds as dp at the given density, names from description or text, and a field's text as its value", () => {
    const tree = importUiautomatorDump(DUMP, { density: 480, frame: "frame.png" });
    assert.equal(tree.scale, 3);
    assert.deepEqual(tree.viewport, { width: 360, height: 800 }); // the root's bounds, not the footer's
    const [root, title, field, icon, go, list, row, footer] = tree.nodes;
    assert.deepEqual([root!.path, title!.path, row!.path], ["FrameLayout[0]", "FrameLayout[0]>TextView[0]", "FrameLayout[0]>RecyclerView[4]>TextView[0]"]);
    assert.deepEqual([title!.role, title!.name], ["text", "Sign in"]);
    assert.deepEqual([field!.role, field!.name, field!.value], ["textfield", "Email", "me@example.com"]);
    assert.deepEqual(field!.rect, { left: 14, top: 66.7, width: 332, height: 46.7 });
    assert.deepEqual([icon!.role, icon!.name, icon!.actions], ["button", undefined, ["tap"]]);
    assert.deepEqual([go!.name, go!.states], ["Go & see", { disabled: true }]);
    assert.deepEqual([list!.role, list!.actions], ["scrollview", ["scroll"]]);
    assert.equal(footer!.name, "Footer");
  });

  it("needs a density and a hierarchy, and says where to get them", () => {
    assert.throws(() => importUiautomatorDump(DUMP, { density: 0 }), /adb shell wm density/);
    assert.throws(() => importUiautomatorDump("<html/>", { density: 160 }), /not a uiautomator dump/);
  });

  it("through scan a11y and check a11y tree: the icon button is unlabelled, the footer unreachable, the row is not", async () => {
    const dir = tmp();
    const xml = join(dir, "ui.xml");
    writeFileSync(xml, DUMP);
    const frame = join(dir, "frame.png");
    const data = new Uint8Array(1080 * 2400 * 4).fill(255);
    await encodePng(frame, { width: 1080, height: 2400, data });
    await assert.rejects(runScanA11y({ source: xml, out: join(dir, "a.json") }), /needs --density.*adb shell wm density/);
    const scan = await runScanA11y({ source: xml, out: join(dir, "a.json"), density: 480, frame });
    assert.equal(scan.platform, "android");
    const report = await runCheckA11yTree({ source: join(dir, "a.json") });
    assert.equal(report.frame, frame);
    assert.deepEqual(report.unlabelled.map((f) => f.path), ["FrameLayout[0]>ImageButton[2]"]);
    assert.deepEqual(report.unreachable.map((f) => f.first.name), ["Footer"]);
    assert.deepEqual(report.touch.failures, []); // 80px at 3x is 26.7dp: over the 24dp floor
  });
});
