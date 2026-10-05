// Judge the tree collected from fixture-app.swift and hold it to the planted defects:
// each one reported, each intact neighbour silent. Prints the whole report first, so a CI log
// shows what a real AppKit window measures even when an assertion fails.
//
//   node fixtures/a11y-tree/macos/assert.mjs out/a11y.json
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCheckA11yTree } from "@mizchi/vlmkit-markup/a11y-tree/check-a11y-tree.ts";

const treePath = process.argv[2];
const tree = JSON.parse(readFileSync(treePath, "utf8"));
const report = await runCheckA11yTree({ source: treePath });
const names = (rows, key = "name") => rows.map((r) => r[key] ?? "");

console.log(`tree: ${tree.nodes.length} node(s), viewport ${tree.viewport.width}x${tree.viewport.height}, frame ${tree.frame ?? "none"}`);
for (const n of tree.nodes) console.log(`  ${n.path}  ${n.role}${n.name ? ` "${n.name}"` : ""}  ${JSON.stringify(n.rect)}${n.actions ? ` ${n.actions.join(",")}` : ""}${n.states ? ` ${JSON.stringify(n.states)}` : ""}`);
console.log("unlabelled:", JSON.stringify(report.unlabelled.map((u) => `${u.role} ${u.path}`)));
console.log("unreachable:", JSON.stringify(report.unreachable.map((u) => `${u.first.name} (+${u.count - 1})`)));
console.log("touch failures:", JSON.stringify(names(report.touch.failures, "text")));
console.log("touch wcag-exempt:", JSON.stringify(names(report.touch.wcagExempt, "text")));
console.log("touch enclosed:", JSON.stringify(names(report.touch.enclosed)));
console.log("contrast failures:", JSON.stringify(report.contrast?.failures.map((f) => `${f.name} ${f.ratio.toFixed(2)}:1`) ?? "not measured"));

const failures = [];
const check = (label, fn) => {
  try {
    fn();
    console.log(`ok    ${label}`);
  } catch (error) {
    failures.push(label);
    console.log(`FAIL  ${label}\n      ${error.message.split("\n").join("\n      ")}`);
  }
};

check("unlabelled-control: the image-only button", () =>
  assert.ok(report.unlabelled.some((u) => u.role === "button")),
);
check("unlabelled-control: the plain text field", () =>
  assert.ok(report.unlabelled.some((u) => u.role === "textfield")),
);
check("named controls are not unlabelled (Start, Settings gear, Search, Remember me)", () => {
  for (const name of ["Start", "Settings gear", "Search", "Remember me"])
    assert.ok(tree.nodes.some((n) => n.name === name), `${name} is in the tree with its name`);
});
check("target-undersized: Info", () => assert.ok(names(report.touch.failures, "text").includes("Info")));
check("target-undersized: Help is spacing-exempt, not a failure", () =>
  assert.ok(!names(report.touch.failures, "text").includes("Help")),
);
check("unreachable-content: Hidden log", () =>
  assert.ok(report.unreachable.some((u) => u.first.name === "Hidden log")),
);
check("unreachable-content: rows inside the scroll view are reachable", () =>
  assert.ok(!report.unreachable.some((u) => /^Row /.test(u.first.name ?? ""))),
);
check("frame captured (Screen Recording allowed on the runner)", () => assert.ok(report.contrast, "no frame"));
if (report.contrast) {
  check("contrast-below-aa: Seed hint", () => assert.ok(names(report.contrast.failures).includes("Seed hint")));
  check("contrast: black text passes (Settings, Row 1)", () => {
    for (const name of ["Settings", "Row 1"]) assert.ok(!names(report.contrast.failures).includes(name), name);
  });
}

console.log(failures.length === 0 ? "\nAll planted defects found, intact neighbours silent." : `\n${failures.length} check(s) failed.`);
process.exit(failures.length === 0 ? 0 : 1);
