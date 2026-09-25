import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "vitest";
import { judgeCollectedColorRoles, runColorRolesCheck } from "./color-roles.ts";
import { judgeCollectedComposition, runCompositionCheck } from "./composition.ts";
import { judgeCollectedDesign, runDesignPolicyCheck } from "./design-policy.ts";
import { captureStyleSnapshot, readFromSnapshotFlag, readStyleSnapshot, STYLE_SNAPSHOT_FORMAT } from "./style-snapshot.ts";

/**
 * A snapshot judgement is the live judgement. Each page is run the old way — three gates, three
 * browsers — and the new way — one `scan style` capture, three judges with no browser — and the
 * three reports must be equal field for field. Pages chosen to cover every verdict each gate
 * has: composition's paired mutants (unbalanced), app shells with fields and links (colour
 * findings), a demo site with a drifting component (design drift), and an intact page.
 */
const ROOT = resolve(import.meta.dirname!, "../../../..");
const PAGES = [
  "fixtures/composition/composed.html",
  "fixtures/composition/proximity-broken.html",
  "fixtures/css-challenge/form-app.html",
  "fixtures/css-challenge/dashboard.html",
  "fixtures/css-challenge/blog-magazine.html",
  "examples/sites/shop/index.html",
].map((page) => join(ROOT, page));

describe("scan style: one capture judges the same as three live runs", () => {
  for (const source of PAGES) {
    it(source.slice(ROOT.length + 1), async () => {
      const snapshot = await captureStyleSnapshot({ source });
      assert.equal(snapshot.format, STYLE_SNAPSHOT_FORMAT);

      const design = await runDesignPolicyCheck({ source });
      assert.deepEqual(judgeCollectedDesign(snapshot.design, snapshot.redirect, { source: snapshot.source }), design);

      const composition = await runCompositionCheck({ source });
      assert.deepEqual(judgeCollectedComposition(snapshot.composition, snapshot.redirect, { source: snapshot.source }), composition);

      const color = await runColorRolesCheck({ source });
      assert.deepEqual(await judgeCollectedColorRoles(snapshot.color, snapshot.redirect, { source: snapshot.source }), color);
    }, 120_000);
  }

  it("covers verdicts worth comparing, not just clean pages", async () => {
    // Guard against a vacuous pass: across the pages above, each gate must produce at least one
    // finding, or equality would only prove that nothing equals nothing.
    const kinds = { design: new Set<string>(), composition: new Set<string>(), color: new Set<string>() };
    for (const source of PAGES) {
      const s = await captureStyleSnapshot({ source });
      for (const f of judgeCollectedDesign(s.design, s.redirect, { source }).findings) kinds.design.add(f.kind);
      for (const f of judgeCollectedComposition(s.composition, s.redirect, { source }).findings) kinds.composition.add(f.kind);
      for (const f of (await judgeCollectedColorRoles(s.color, s.redirect, { source })).findings) kinds.color.add(f.kind);
    }
    assert.ok(kinds.design.has("component-drift"), [...kinds.design].join(", "));
    assert.ok(kinds.composition.has("proximity-inversion"), [...kinds.composition].join(", "));
    assert.ok(kinds.color.size > 0, "no colour finding on any page");
  }, 240_000);

  it("round-trips through the file and refuses anything that is not a snapshot", async () => {
    const dir = mkdtempSync(join(tmpdir(), "style-snapshot-"));
    const out = join(dir, "snap.json");
    const written = await captureStyleSnapshot({ source: PAGES[0]!, out });
    assert.deepEqual(await readStyleSnapshot(out), JSON.parse(JSON.stringify(written)));
    const bogus = join(dir, "scene.json");
    writeFileSync(bogus, JSON.stringify({ elements: [] }));
    await assert.rejects(() => readStyleSnapshot(bogus), /is not a style snapshot/);
  }, 60_000);
});

describe("--from on a gate", () => {
  const flags = ["--viewport", "--allow"];
  it("reads the snapshot path in both spellings, and is absent without the flag", () => {
    assert.equal(readFromSnapshotFlag(["--from", "s.json"], "check color", flags), "s.json");
    assert.equal(readFromSnapshotFlag(["--from=s.json", "--allow", "x;y"], "check color", flags), "s.json");
    assert.equal(readFromSnapshotFlag(["page.html"], "check color", flags), undefined);
  });

  it("refuses a page next to it, and every flag that was fixed at capture", () => {
    assert.throws(() => readFromSnapshotFlag(["page.html", "--from", "s.json"], "check color", flags), /page source or --from, not both/);
    for (const flag of ["--viewport", "--har", "--wait-until", "--timeout", "--storage-state", "--elements"]) {
      assert.throws(() => readFromSnapshotFlag(["--from", "s.json", flag, "1"], "check color", flags), new RegExp(`${flag} does not apply with --from`), flag);
    }
    assert.throws(() => readFromSnapshotFlag(["--from", "s.json", "--exclude", ".ad"], "check design", [...flags, "--exclude"], ["exclude"]), /--exclude does not apply/);
    assert.throws(() => readFromSnapshotFlag(["--from"], "check color", flags), /needs a snapshot file/);
  });
});

