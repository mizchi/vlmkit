import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeCopy, parseCopyManifest, normalizeWhitespace, runCopyCheck } from "./copy-check.ts";

test("normalizeWhitespace collapses runs and trims", () => {
  assert.equal(normalizeWhitespace("  Ship\n  dashboards\tin  minutes "), "Ship dashboards in minutes");
});

test("parseCopyManifest strips list markers, skips heading comments and blank lines", () => {
  const lines = parseCopyManifest([
    "# Hero", // markdown heading = section comment, NOT a required line
    "- Ship dashboards in minutes",
    "* Start free",
    "3. Third item",
    "",
    "## Footer",
    "Plain line",
    "- #10412", // hash glued to content is NOT a heading
    "#general",
  ].join("\n"));
  assert.deepEqual(lines, ["Ship dashboards in minutes", "Start free", "Third item", "Plain line", "#10412", "#general"]);
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

test("manifest line present only in invisible text is a copy-invisible suspect", () => {
  const report = analyzeCopy({
    source: "x.html",
    pageText: "Pulse. Start free. Hidden manifest words",
    visibleText: "Pulse. Start free.",
    manifestLines: ["Start free", "Hidden manifest words", "Changelog"],
  });
  assert.deepEqual(report.invisibleLines, [{ line: "Hidden manifest words", reason: "unknown" }]);
  assert.deepEqual(report.missingLines, ["Changelog"]);
  const invisible = report.issues.filter((i) => i.kind === "copy-invisible");
  assert.equal(invisible.length, 1);
  assert.match(invisible[0]!.message, /does not satisfy the copy gate/);
  assert.match(invisible[0]!.message, /--allow-invisible unknown/);
  assert.equal(invisible[0]!.severity, "suspect");
});

test("allowInvisible accepts matching reason classes as satisfied, with provenance", () => {
  const base = {
    source: "x.html",
    pageText: "Pulse. Hidden a11y words",
    visibleText: "Pulse.",
    invisibleChunks: [{ reason: "visually-hidden", text: "Hidden a11y words" }],
    manifestLines: ["Hidden a11y words"],
  };
  const strict = analyzeCopy(base);
  assert.deepEqual(strict.invisibleLines, [{ line: "Hidden a11y words", reason: "visually-hidden" }]);
  assert.equal(strict.issues.length, 1);

  const relaxed = analyzeCopy({ ...base, allowInvisible: ["visually-hidden"] });
  assert.deepEqual(relaxed.allowedInvisibleLines, [{ line: "Hidden a11y words", reason: "visually-hidden" }]);
  assert.deepEqual(relaxed.invisibleLines, []);
  assert.deepEqual(relaxed.issues, []);

  // Allowing one class must not suppress a different class.
  const other = analyzeCopy({
    ...base,
    invisibleChunks: [{ reason: "camouflage", text: "Hidden a11y words" }],
    allowInvisible: ["visually-hidden"],
  });
  assert.deepEqual(other.invisibleLines, [{ line: "Hidden a11y words", reason: "camouflage" }]);
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

test("invisible-text gaming vectors are caught; text-transform and select stay legitimate (E2E)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "copy-invisible-"));
  try {
    const html = `<!doctype html><body>
      <h1>Pulse</h1>
      <span style="font-size:0">Packed hidden line</span>
      <div style="opacity:0">Ghost opacity line</div>
      <p style="color:transparent">Transparent ink line</p>
      <span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Screen reader only line</span>
      <p style="text-transform:uppercase">shouted line</p>
      <p>Plain visible line</p>
      <select><option>Pick a country</option><option>Germany</option></select>
      <select style="display:none"><option>Hidden select option</option></select>
    </body>`;
    const page = join(dir, "page.html");
    const manifest = join(dir, "copy.md");
    await writeFile(page, html);
    await writeFile(manifest, [
      "# Section heading is a comment",
      "- Plain visible line",
      "- Packed hidden line",
      "- Ghost opacity line",
      "- Transparent ink line",
      "- Screen reader only line",
      "- SHOUTED LINE",
      "- Germany",
      "- Hidden select option",
    ].join("\n"));

    const report = await runCopyCheck({ source: page, manifestPath: manifest });
    assert.equal(report.manifestLines, 8);
    // sr-only counts as invisible BY POLICY since the 2026-07-31 silencing
    // battery: manifest lines are the user-visible copy spec. Reasons are
    // attributed per class so --allow-invisible can suppress selectively.
    assert.deepEqual(report.invisibleLines, [
      { line: "Packed hidden line", reason: "zero-size" },
      { line: "Ghost opacity line", reason: "hidden" },
      { line: "Transparent ink line", reason: "transparent" },
      { line: "Screen reader only line", reason: "visually-hidden" },
    ]);
    // display:none select text is absent from raw innerText too → plain missing
    assert.deepEqual(report.missingLines, ["Hidden select option"]);
    assert.equal(report.issues.filter((i) => i.kind === "copy-invisible").length, 4);

    // Re-run accepting the sr-only class: that line flips to allowed, others stay suspect.
    const relaxed = await runCopyCheck({ source: page, manifestPath: manifest, allowInvisible: ["visually-hidden"] });
    assert.deepEqual(relaxed.allowedInvisibleLines, [{ line: "Screen reader only line", reason: "visually-hidden" }]);
    assert.equal(relaxed.issues.filter((i) => i.kind === "copy-invisible").length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("silencing battery: geometric hiding vectors are caught, reachable text stays visible (E2E)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "copy-battery-"));
  try {
    // One case per hiding vector from the 2026-07-31 battery. Before the
    // geometric reachability pass, 10 of 12 vectors silenced the gate.
    const vectors: [string, string][] = [
      [`<p style="position:absolute;left:-9999px">VEC offscreen left</p>`, "VEC offscreen left"],
      [`<p style="position:fixed;top:-9999px">VEC offscreen fixed</p>`, "VEC offscreen fixed"],
      [`<p style="text-indent:-9999px;white-space:nowrap">VEC text indent</p>`, "VEC text indent"],
      [`<p style="transform:translateX(-9999px)">VEC transform translate</p>`, "VEC transform translate"],
      [`<p style="transform:scale(0)">VEC transform scale</p>`, "VEC transform scale"],
      [`<p style="position:absolute;clip:rect(0 0 0 0)">VEC clip rect</p>`, "VEC clip rect"],
      [`<p style="clip-path:inset(100%)">VEC clip path inset</p>`, "VEC clip path inset"],
      [`<div style="width:0;height:0;overflow:hidden"><p>VEC zero box</p></div>`, "VEC zero box"],
      [`<div style="background:#fff"><p style="color:#fff">VEC camouflage</p></div>`, "VEC camouflage"],
      [`<div style="overflow-x:hidden"><p style="position:relative;left:5000px;white-space:nowrap">VEC offscreen right</p></div>`, "VEC offscreen right"],
      // The unclipped right-offscreen variant extends scrollWidth and is
      // scan scroll's catch (page-overflow-x), not this gate's — see report.
    ];
    const legit: [string, string][] = [
      [`<p>LEGIT plain</p>`, "LEGIT plain"],
      [`<p style="margin-top:3000px">LEGIT below fold</p>`, "LEGIT below fold"],
      [`<div style="height:60px;overflow-y:auto"><p style="margin-top:200px">LEGIT inner scrollport</p></div>`, "LEGIT inner scrollport"],
      [`<div style="width:200px;overflow-x:auto"><p style="width:900px;padding-left:600px;white-space:nowrap">LEGIT h scrollport</p></div>`, "LEGIT h scrollport"],
    ];
    const all = [...vectors, ...legit];
    const page = join(dir, "page.html");
    const manifest = join(dir, "copy.txt");
    await writeFile(page, `<!doctype html><body>\n${all.map(([h]) => h).join("\n")}\n</body>`);
    await writeFile(manifest, all.map(([, line]) => line).join("\n"));

    const report = await runCopyCheck({ source: page, manifestPath: manifest, exploreStates: false });
    assert.deepEqual(
      report.invisibleLines.map((i) => i.line).sort(),
      vectors.map(([, line]) => line).sort(),
    );
    // Reason attribution: geometric vectors read unreachable; the classic
    // hiding techniques get their specific class.
    const reasonOf = Object.fromEntries(report.invisibleLines.map((i) => [i.line, i.reason]));
    assert.equal(reasonOf["VEC offscreen left"], "unreachable");
    assert.equal(reasonOf["VEC text indent"], "unreachable");
    assert.equal(reasonOf["VEC transform scale"], "zero-size");
    assert.equal(reasonOf["VEC clip rect"], "visually-hidden");
    assert.equal(reasonOf["VEC zero box"], "visually-hidden");
    assert.equal(reasonOf["VEC camouflage"], "camouflage");
    assert.deepEqual(report.missingLines, []);
    for (const [, line] of legit) {
      assert.ok(!report.invisibleLines.some((i) => i.line === line), `legit case flagged invisible: ${line}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// 2026-08-01 hard-target audit: a custom element's visible badge text was
// reported copy-missing because innerText and a document-scoped TreeWalker
// both stop at the shadow boundary. Design systems built on web components
// keep ALL their copy there, so this was a first-day false positive.
test("open shadow-root copy counts as visible; hidden shadow copy still caught (E2E)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "copy-shadow-"));
  try {
    const html = `<!doctype html><body>
      <h1>Ledger</h1>
      <ledger-badge></ledger-badge>
      <sneaky-badge></sneaky-badge>
      <script>
        customElements.define("ledger-badge", class extends HTMLElement {
          connectedCallback() {
            this.attachShadow({ mode: "open" }).innerHTML =
              '<style>.b{font:600 13px system-ui;color:#1a7f42}</style><span class="b">Reconciled nightly</span>';
          }
        });
        customElements.define("sneaky-badge", class extends HTMLElement {
          connectedCallback() {
            this.attachShadow({ mode: "open" }).innerHTML =
              '<span style="font-size:0">Fees may apply</span>';
          }
        });
      </script></body>`;
    const page = join(dir, "page.html");
    const manifest = join(dir, "copy.txt");
    await writeFile(page, html);
    await writeFile(manifest, ["Ledger", "Reconciled nightly", "Fees may apply"].join("\n"));

    const report = await runCopyCheck({ source: page, manifestPath: manifest });
    // Visible shadow text satisfies the gate...
    assert.deepEqual(report.missingLines, [], JSON.stringify(report.issues));
    // ...but hiding copy inside a shadow root is still not a way to pass.
    assert.deepEqual(report.invisibleLines.map((l) => l.line), ["Fees may apply"]);
    assert.equal(report.invisibleLines[0]!.reason, "zero-size");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
            // rAF-batched reveal, like framework-scheduled renders: the DOM
            // updates only after the click's synchronous context returns.
            requestAnimationFrame(() => {
              for (const t of document.querySelectorAll("[role=tab]")) t.setAttribute("aria-selected", String(t === tab));
              document.getElementById("p1").hidden = tab.dataset.panel !== "p1";
              document.getElementById("p2").hidden = tab.dataset.panel !== "p2";
            });
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
