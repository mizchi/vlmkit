import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeCopy, parseCopyManifest, normalizeWhitespace, runCopyCheck } from "./copy-check.ts";

test("normalizeWhitespace collapses runs and trims", () => {
  assert.equal(normalizeWhitespace("  Ship\n  dashboards\tin  minutes "), "Ship dashboards in minutes");
});

test("parseCopyManifest strips list markers, headings, and blank lines", () => {
  const lines = parseCopyManifest([
    "# Hero",
    "- Ship dashboards in minutes",
    "* Start free",
    "3. Third item",
    "",
    "Plain line",
  ].join("\n"));
  assert.deepEqual(lines, ["Hero", "Ship dashboards in minutes", "Start free", "Third item", "Plain line"]);
});

test("placeholder text is a suspect even without a manifest", () => {
  const report = analyzeCopy({ source: "x.html", pageText: "Welcome!\nLorem ipsum dolor sit amet." });
  assert.ok(report.placeholders.includes("lorem ipsum"));
  assert.ok(report.issues.every((i) => i.severity === "suspect"));
  assert.equal(report.manifestLines, 0);
});

test("manifest lines present in the page pass; missing ones are suspects", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "Pulse.\nShip   dashboards\nin minutes\nStart free",
    manifestLines: ["Ship dashboards in minutes", "Start free", "Changelog"],
  });
  assert.deepEqual(report.missingLines, ["Changelog"]);
  assert.equal(report.issues.filter((i) => i.kind === "copy-missing").length, 1);
});

test("manifest comparison is case-sensitive", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "start free",
    manifestLines: ["Start free"],
  });
  assert.deepEqual(report.missingLines, ["Start free"]);
});

test("clean page with satisfied manifest reports no issues", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "Ship dashboards in minutes. Start free.",
    manifestLines: ["Ship dashboards in minutes"],
  });
  assert.deepEqual(report.issues, []);
});

test("manifest line found only in a revealed state passes with provenance", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "FAQ",
    manifestLines: ["Refunds are processed within 5 days", "Changelog"],
    stateSweep: {
      states: [
        { kind: "details", label: 'details "Refund policy"', text: "FAQ\nRefunds are  processed\nwithin 5 days" },
      ],
      droppedActions: 0,
    },
  });
  assert.deepEqual(report.revealedLines, [
    { line: "Refunds are processed within 5 days", state: 'details "Refund policy"' },
  ]);
  assert.deepEqual(report.missingLines, ["Changelog"]);
  assert.equal(report.statesExplored, 1);
  const missing = report.issues.filter((i) => i.kind === "copy-missing");
  assert.equal(missing.length, 1);
  assert.match(missing[0]!.message, /1 revealed disclosure state/);
});

test("placeholder hidden inside a revealed state is still a suspect", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "Welcome!",
    stateSweep: {
      states: [{ kind: "tab", label: 'tab "Details"', text: "Lorem ipsum body copy" }],
      droppedActions: 0,
    },
  });
  assert.ok(report.placeholders.includes("lorem ipsum"));
  assert.match(report.issues[0]!.message, /revealed by tab "Details"/);
});

test("disclosure-state sweep reveals details / tab / aria-expanded copy (E2E)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "copy-states-"));
  try {
    const html = `<!doctype html><body>
      <h1>Pulse</h1>
      <details><summary>Refund policy</summary><p>Refunds are processed within 5 days.</p></details>
      <div role="tablist">
        <button role="tab" aria-selected="true" data-panel="p1">Overview</button>
        <button role="tab" aria-selected="false" data-panel="p2">Pricing</button>
      </div>
      <section id="p1">Overview panel</section>
      <section id="p2" hidden>Teams start at $12 per seat</section>
      <button aria-expanded="false" id="more">More info</button>
      <div id="extra" hidden>Available in 14 regions</div>
      <script>
        for (const tab of document.querySelectorAll("[role=tab]")) {
          tab.addEventListener("click", () => {
            for (const t of document.querySelectorAll("[role=tab]")) t.setAttribute("aria-selected", String(t === tab));
            document.getElementById("p1").hidden = tab.dataset.panel !== "p1";
            document.getElementById("p2").hidden = tab.dataset.panel !== "p2";
          });
        }
        document.getElementById("more").addEventListener("click", (e) => {
          e.target.setAttribute("aria-expanded", "true");
          document.getElementById("extra").hidden = false;
        });
      </script></body>`;
    const page = join(dir, "page.html");
    const manifest = join(dir, "copy.md");
    await writeFile(page, html);
    await writeFile(manifest, [
      "- Pulse",
      "- Refunds are processed within 5 days.",
      "- Teams start at $12 per seat",
      "- Available in 14 regions",
      "- Not on this page at all",
    ].join("\n"));

    const report = await runCopyCheck({ source: page, manifestPath: manifest });
    assert.equal(report.statesExplored, 3);
    assert.deepEqual(report.missingLines, ["Not on this page at all"]);
    assert.deepEqual(
      report.revealedLines.map((r) => r.line),
      ["Refunds are processed within 5 days.", "Teams start at $12 per seat", "Available in 14 regions"],
    );
    assert.match(report.revealedLines[0]!.state, /details "Refund policy"/);
    assert.match(report.revealedLines[1]!.state, /tab "Pricing"/);

    const noSweep = await runCopyCheck({ source: page, manifestPath: manifest, exploreStates: false });
    assert.equal(noSweep.statesExplored, 0);
    assert.equal(noSweep.missingLines.length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
