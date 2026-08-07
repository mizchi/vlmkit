/**
 * The JSON boundary to markup-core.
 *
 * These tests are about the *boundary*, not about any rule it carries. The rules
 * have their own tests; what needs asserting here is the three properties the
 * boundary was built for, because each one was a defect in the positional path:
 *
 *   - records and arrays survive the trip at all,
 *   - a malformed payload raises instead of quietly decoding as something else,
 *   - the two backends (direct JS module, spawned CLI) answer identically.
 *
 * The third is the one that could not be tested before: the positional dispatch is
 * duplicated across `markup-core-api/main.mbt` and `markup-core-cli/main.mbt`, 61
 * commands each, with nothing checking that they agree. The JSON dispatch lives in
 * the shared `markup-core` package precisely so they cannot drift — and that
 * claim is only worth making if something checks it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  callMarkupCoreJson,
  computeUiContractLayoutIssueIds,
  getMarkupCoreRuntimeBackend,
  markupCoreJsonCommands,
} from "./markup-core-runtime.ts";

const COMMAND = "layout-policy-issue-ids";

describe("markup-core JSON boundary", { timeout: 240_000 }, () => {
  it("accepts a record and returns an array", () => {
    const issues = callMarkupCoreJson<string[]>(COMMAND, {
      width_kind: "fluid",
      height_kind: "content",
      display_kind: "grid",
      display_columns_count: 0,
      display_rows_count: 2,
    });
    assert.deepEqual(issues, ["layout-width-fluid-bounds", "layout-grid-columns"]);
  });

  it("treats an omitted optional as absent, not as zero", () => {
    // The distinction the positional encoding could not carry: it sent `0` for an
    // absent width, so "no width declared" and "width: 0" were the same wire
    // value and one of them had to be wrong.
    const absent = callMarkupCoreJson<string[]>(COMMAND, {
      width_kind: "fixed",
      height_kind: "content",
      display_kind: "block",
      display_columns_count: 1,
      display_rows_count: 1,
    });
    const zero = callMarkupCoreJson<string[]>(COMMAND, {
      width_kind: "fixed",
      width_value: 0,
      height_kind: "content",
      display_kind: "block",
      display_columns_count: 1,
      display_rows_count: 1,
    });
    const positive = callMarkupCoreJson<string[]>(COMMAND, {
      width_kind: "fixed",
      width_value: 320,
      height_kind: "content",
      display_kind: "block",
      display_columns_count: 1,
      display_rows_count: 1,
    });
    assert.deepEqual(zero, ["layout-width-fixed-positive"]);
    assert.deepEqual(absent, ["layout-width-fixed-positive"], "an absent fixed width is still not positive");
    assert.deepEqual(positive, []);
  });

  it("accepts `null` from TypeScript, which MoonBit itself rejects", () => {
    // MoonBit decodes an Option field from a MISSING key and fails on explicit
    // null. TypeScript spells absence both ways, so the helper strips nulls; a
    // caller who writes null should not get a decode error about a field they did
    // supply.
    const withNulls = callMarkupCoreJson<string[]>(COMMAND, {
      width_kind: "fluid",
      width_min: null,
      width_max: null,
      width_value: null,
      height_kind: "content",
      height_value: null,
      height_max: null,
      display_kind: "block",
      display_columns_count: 1,
      display_rows_count: 1,
    });
    assert.deepEqual(withNulls, ["layout-width-fluid-bounds"]);
  });

  it("raises on an unknown command rather than returning empty", () => {
    // An unknown command that answered `[]` would read as "this rule found
    // nothing" — a typo in a command name would look like a clean run.
    assert.throws(
      () => callMarkupCoreJson(`${COMMAND}-does-not-exist`, { width_kind: "fluid" }),
      /unknown markup-core JSON command/,
    );
  });

  it("raises on a mistyped field, naming the field", () => {
    // The payoff over positional strings: the error says WHICH field and what was
    // expected, instead of a rule silently seeing a value it parsed differently.
    assert.throws(
      () => callMarkupCoreJson(COMMAND, {
        width_kind: "fluid",
        width_value: "not a number",
        height_kind: "content",
        display_kind: "block",
        display_columns_count: 1,
        display_rows_count: 1,
      }),
      /width_value/,
    );
  });

  it("raises on a missing required field", () => {
    assert.throws(() => callMarkupCoreJson(COMMAND, { width_kind: "fluid" }), /height_kind|display_kind/);
  });

  it("uses the in-process module, not the spawned CLI", () => {
    // Found by writing this: `loadMarkupCoreApi` rebuilt a narrow object holding
    // only `run_markup_core`, so the JSON entry points were invisible and every
    // call spawned a node process while appearing to work. A boundary meant to
    // make MoonBit cheap to call had quietly become the expensive path.
    callMarkupCoreJson<string[]>(COMMAND, {
      width_kind: "fluid",
      height_kind: "content",
      display_kind: "block",
      display_columns_count: 1,
      display_rows_count: 1,
    });
    assert.equal(getMarkupCoreRuntimeBackend(), "direct-js");
  });

  it("the TypeScript view of the command list matches MoonBit's", () => {
    // A typo in a command name is otherwise found at the first call, in whatever
    // code path happens to reach it. Asserted as properties rather than as a literal
    // list: restating fifteen names here made this fail on every migration for no
    // reason, which trains people to update the expectation without reading it.
    const commands = markupCoreJsonCommands();
    assert.ok(commands.includes(COMMAND), `missing ${COMMAND}: ${commands.join(", ")}`);
    assert.ok(commands.includes("goal-status"));
    assert.ok(commands.includes("interaction-issues"));
    assert.equal(new Set(commands).size, commands.length, "duplicate command names");
    assert.ok(commands.every((name) => /^[a-z0-9-]+$/.test(name)), commands.join(", "));
    // `markup-core-migration.test.ts` is what checks the whole set has coverage.
  });

  it("both backends answer identically", async () => {
    // The property the shared dispatch is FOR. The positional path has two
    // hand-written dispatch tables, 61 commands each, and nothing compares them;
    // this asserts the JSON path really does have one.
    const { spawnSync } = await import("node:child_process");
    const { join, dirname, resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const cli = join(packageRoot, "_build/js/debug/build/markup-core-cli/markup-core-cli.js");

    const payload = {
      width_kind: "fluid",
      height_kind: "scrollport",
      height_max: 0,
      display_kind: "grid",
      display_columns_count: 0,
      display_rows_count: 0,
    };
    const direct = callMarkupCoreJson<string[]>(COMMAND, payload);
    const spawned = spawnSync(
      process.execPath,
      [cli, "--json", COMMAND, JSON.stringify(payload)],
      { encoding: "utf8" },
    );
    assert.equal(spawned.status, 0, spawned.stderr);
    assert.deepEqual(JSON.parse(spawned.stdout.trim()), direct);
    // And it is a non-trivial answer, so agreeing on `[]` cannot pass this.
    assert.ok(direct.length >= 3, `expected several issues, got ${JSON.stringify(direct)}`);
  });

  it("the migrated caller still behaves as its own tests expect", () => {
    // computeUiContractLayoutIssueIds moved from the positional path to this one.
    // Its contract is unchanged, which is the whole point of migrating one caller
    // rather than adding a parallel API.
    assert.deepEqual(
      computeUiContractLayoutIssueIds({ widthKind: "fluid", heightKind: "content", displayKind: "block" }),
      ["layout-width-fluid-bounds"],
    );
    assert.deepEqual(
      computeUiContractLayoutIssueIds({
        widthKind: "fluid",
        widthMinPresent: true,
        heightKind: "content",
        displayKind: "block",
      }),
      [],
    );
  });
});
