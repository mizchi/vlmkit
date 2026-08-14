import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { A11yNode, UiSpec } from "@mizchi/vlmkit-core/types.ts";
import { runExpect, runIntrospect, runSpecVerify, type SpecPaths } from "./spec.ts";

/**
 * `vlmkit workflow introspect / spec-verify / expect` against fixture snapshots.
 *
 * These three read `.a11y.json` sidecars out of a directory and never open a
 * browser, so a test only has to write the sidecars. What blocked it was six
 * `process.exit()` calls, which in a vitest worker end the file rather than the
 * assertion — and which hid `runSpecVerify`'s verdict, the one thing in this module
 * a caller most needs.
 */

let lines: string[] = [];
const realLog = console.log;
const realError = console.error;
beforeAll(() => {
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
});
afterAll(() => { console.log = realLog; console.error = realError; });
beforeEach(() => { lines = []; });
const output = () => lines.join("\n");

/** A page with a main landmark, a heading and two labelled buttons. */
const healthyTree: A11yNode = {
  role: "WebArea",
  name: "Dashboard",
  children: [
    {
      role: "banner", name: "", children: [
        { role: "heading", name: "Dashboard", level: 1 },
        { role: "link", name: "Home" },
      ],
    },
    {
      role: "main", name: "", children: [
        { role: "button", name: "Save" },
        { role: "button", name: "Cancel" },
        { role: "textbox", name: "Search" },
      ],
    },
    { role: "contentinfo", name: "", children: [{ role: "link", name: "Terms" }] },
  ],
} as A11yNode;

/** The same page after a regression: the buttons lost their accessible names. */
const unlabelledTree: A11yNode = {
  role: "WebArea",
  name: "Dashboard",
  children: [
    {
      role: "main", name: "", children: [
        { role: "button", name: "" },
        { role: "button", name: "" },
      ],
    },
  ],
} as A11yNode;

/** A blank page — nothing but the root. */
const blankTree: A11yNode = { role: "WebArea", name: "", children: [] } as A11yNode;

/** 1x1 PNG, so `screenshotExists` is true where an invariant needs it. */
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001"
  + "0d0a2db40000000049454e44ae426082", "hex",
);

/** A project root with the given trees written into `snapshots/` and/or `baselines/`. */
function project(
  name: string,
  dirs: { baselines?: Record<string, A11yNode>; snapshots?: Record<string, A11yNode> },
): SpecPaths {
  const root = mkdtempSync(join(tmpdir(), `vlmkit-spec-${name}-`));
  for (const [key, trees] of Object.entries(dirs)) {
    const dir = join(root, key);
    mkdirSync(dir, { recursive: true });
    for (const [testId, tree] of Object.entries(trees!)) {
      writeFileSync(join(dir, `${testId}.a11y.json`), JSON.stringify(tree));
      writeFileSync(join(dir, `${testId}.png`), PNG);
    }
  }
  return {
    projectRoot: root,
    baselinesDir: join(root, "baselines"),
    snapshotsDir: join(root, "snapshots"),
    specPath: join(root, "spec.json"),
    expectationPath: join(root, "expectation.json"),
  };
}

describe("runIntrospect", () => {
  it("derives a spec with invariants from the a11y trees and writes it", async () => {
    const paths = project("intro", { snapshots: { home: healthyTree, settings: healthyTree } });
    assert.equal(await runIntrospect(paths), 0);

    const spec: UiSpec = JSON.parse(readFileSync(paths.specPath, "utf-8"));
    assert.equal(spec.pages.length, 2);
    assert.deepEqual(spec.pages.map((p) => p.testId).sort(), ["home", "settings"]);
    for (const page of spec.pages) {
      assert.ok(page.invariants.length > 0, `${page.testId} got no invariants, so nothing is checkable`);
      // Every invariant needs a check kind, or spec-verify can only skip it.
      for (const inv of page.invariants) assert.ok(inv.check, `invariant without a check: ${inv.description}`);
    }
    // The global invariants are what make a spec useful on a page it has never seen.
    assert.ok((spec.global ?? []).some((g) => g.check === "no-whiteout"));
    assert.ok((spec.global ?? []).some((g) => g.check === "label-present"));

    const text = output();
    assert.match(text, /## home/);
    assert.match(text, /Landmarks:/);
    assert.match(text, /2 page\(s\)/);
  });

  it("prefers snapshots over baselines when both exist", async () => {
    // `introspect` describes the CURRENT state when there is one. Reading baselines
    // instead would silently describe the state before the change under test.
    const paths = project("both", {
      baselines: { home: blankTree },
      snapshots: { home: healthyTree },
    });
    assert.equal(await runIntrospect(paths), 0);
    assert.match(output(), /snapshots/, "the directory it chose is named in the header");
    const spec: UiSpec = JSON.parse(readFileSync(paths.specPath, "utf-8"));
    // The healthy tree has landmarks and labelled controls; the blank one has none,
    // so a different invariant count is the observable difference.
    assert.ok(spec.pages[0]!.invariants.length > 1, "read the blank baseline instead of the snapshot?");
  });

  it("falls back to baselines when nothing has been captured yet", async () => {
    const paths = project("baseonly", { baselines: { home: healthyTree } });
    assert.equal(await runIntrospect(paths), 0);
    assert.match(output(), /baselines/);
  });

  it("exits 1 when there is nothing to introspect", async () => {
    const paths = project("nothing", {});
    assert.equal(await runIntrospect(paths), 1);
    assert.match(output(), /No snapshots or baselines found/);
  });
});

describe("runSpecVerify", () => {
  const specFor = (paths: SpecPaths, spec: UiSpec) =>
    writeFileSync(paths.specPath, JSON.stringify(spec));

  it("exits 0 when every invariant holds", async () => {
    const paths = project("verify-pass", { snapshots: { home: healthyTree } });
    await runIntrospect(paths);   // generates the spec from this very tree
    lines = [];
    assert.equal(await runSpecVerify(paths), 0);
    const text = output();
    assert.match(text, /\[OK\] home/);
    assert.match(text, /Total: \d+ passed, 0 failed/);
    assert.doesNotMatch(text, /FAIL:/);
  });

  it("exits 1 and names the invariant when one fails", async () => {
    // A spec derived from the healthy tree, verified against the regressed one: the
    // buttons lost their names, so `label-present` must fail. An exit code of 0 here
    // would make the whole command decorative.
    const healthy = project("verify-src", { snapshots: { home: healthyTree } });
    await runIntrospect(healthy);
    const spec: UiSpec = JSON.parse(readFileSync(healthy.specPath, "utf-8"));

    const regressed = project("verify-fail", { snapshots: { home: unlabelledTree } });
    specFor(regressed, spec);
    lines = [];
    assert.equal(await runSpecVerify(regressed), 1);
    const text = output();
    assert.match(text, /\[NG\] home/);
    assert.match(text, /FAIL:/);
    assert.match(text, /Total: \d+ passed, [1-9]\d* failed/);
  });

  it("skips a page it has no data for instead of failing it", async () => {
    // A spec listing a page that was never captured is a stale spec, not a broken
    // page. Counting it as a failure would make `spec-verify` red for the wrong
    // reason and train people to ignore it.
    const paths = project("verify-missing", { snapshots: { home: healthyTree } });
    specFor(paths, {
      description: "spec naming a page that no longer exists",
      pages: [{ testId: "checkout", purpose: "buy things", invariants: [{ description: "has a main landmark", check: "landmark-present", cost: "low" }] }],
      global: [],
    } as unknown as UiSpec);
    assert.equal(await runSpecVerify(paths), 0);
    const text = output();
    assert.match(text, /SKIP:/);
    assert.match(text, /No snapshot data available/);
    assert.match(text, /0 passed, 0 failed, 1 skipped/);
  });

  it("skips high-cost invariants rather than running them", async () => {
    const paths = project("verify-cost", { snapshots: { home: healthyTree } });
    specFor(paths, {
      description: "one cheap, one expensive",
      pages: [{
        testId: "home",
        purpose: "landing",
        invariants: [
          { description: "not blank", check: "no-whiteout", cost: "low" },
          { description: "reads like a dashboard", check: "nl-assertion", cost: "high" },
        ],
      }],
      global: [],
    } as unknown as UiSpec);
    assert.equal(await runSpecVerify(paths), 0);
    assert.match(output(), /SKIP: reads like a dashboard — High-cost assertion/);
    assert.match(output(), /1 passed, 0 failed, 1 skipped/);
  });

  it("exits 1 with no spec, and with a spec but nothing captured", async () => {
    const noSpec = project("verify-nospec", { snapshots: { home: healthyTree } });
    assert.equal(await runSpecVerify(noSpec), 1);
    assert.match(output(), /No spec\.json found/);

    lines = [];
    const noData = project("verify-nodata", {});
    specFor(noData, { description: "d", pages: [], global: [] } as unknown as UiSpec);
    assert.equal(await runSpecVerify(noData), 1);
    assert.match(output(), /No snapshots or baselines found/);
  });
});

describe("runExpect", () => {
  it("records no changes when baseline and snapshot agree", async () => {
    const paths = project("expect-same", {
      baselines: { home: healthyTree },
      snapshots: { home: healthyTree },
    });
    assert.equal(await runExpect(paths), 0);
    const exp = JSON.parse(readFileSync(paths.expectationPath, "utf-8"));
    assert.equal(exp.pages.length, 1);
    assert.equal(exp.pages[0].testId, "home");
    assert.equal(exp.pages[0].expect, "No changes");
    // No `a11y` field at all on an unchanged page — an empty "changed" would read as
    // a change the reviewer has to dismiss.
    assert.equal(exp.pages[0].a11y, undefined);
  });

  it("marks a lost accessible name as a regression, not a plain change", async () => {
    // This is the distinction the file exists to draw: `changed` invites review,
    // `regression-expected` says a human already decided it is a loss.
    const paths = project("expect-regress", {
      baselines: { home: healthyTree },
      snapshots: { home: unlabelledTree },
    });
    assert.equal(await runExpect(paths), 0);
    const exp = JSON.parse(readFileSync(paths.expectationPath, "utf-8"));
    const page = exp.pages[0];
    assert.equal(page.testId, "home");
    assert.equal(page.a11y, "regression-expected");
    assert.match(page.expect, /A11y regression expected:/);
    assert.ok(page.expectedA11yChanges.length > 0, "the changes it expects have to be listed to be checkable");
    for (const c of page.expectedA11yChanges) assert.ok(c.description.length > 0);
    assert.match(output(), /\[!!\] home/);
  });

  it("ignores a baseline page that was not captured this time", async () => {
    // A route removed from the config is not a diff; pairing it against nothing
    // would invent one.
    const paths = project("expect-orphan", {
      baselines: { home: healthyTree, retired: healthyTree },
      snapshots: { home: healthyTree },
    });
    assert.equal(await runExpect(paths), 0);
    const exp = JSON.parse(readFileSync(paths.expectationPath, "utf-8"));
    assert.deepEqual(exp.pages.map((p: { testId: string }) => p.testId), ["home"]);
  });

  it("exits 1 without baselines, and without snapshots", async () => {
    const noBase = project("expect-nobase", { snapshots: { home: healthyTree } });
    assert.equal(await runExpect(noBase), 1);
    assert.match(output(), /No baselines found/);

    lines = [];
    const noSnap = project("expect-nosnap", { baselines: { home: healthyTree } });
    assert.equal(await runExpect(noSnap), 1);
    assert.match(output(), /No snapshots found/);
  });
});
