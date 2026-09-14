/**
 * The CI gate for `.claude/skills/d2-diagram/assets/d2-facts.mjs`.
 *
 * That script is the only check a D2 diagram has: D2 itself has no `--expect`, no layout report,
 * and no error for the scoping rule that silently duplicates a box. The skill tells an agent to
 * trust it, so it needs a gate of its own — but it normally renders with `d2`, and the runner has
 * no `d2`.
 *
 * So the tests drive its READER half over renders committed in `fixtures/d2-scenario/`, through
 * `--from-svg` / `--from-txt`. `D2` is pointed at a path that does not exist in every run, so a
 * regression that reintroduces a render would fail here rather than pass quietly.
 *
 * What is pinned, and why each one:
 *
 *   - the three v2 attempts that were clean, at their measured widths — a change that breaks the
 *     SVG id decoding turns these red;
 *   - v1's `d`, the attempt that was green by every check its writer ran and had four phantom
 *     boxes: the duplicate-name lines are the reason this file exists;
 *   - v2's `f`, correct in every fact and over its width budget: exactly one error, so the width
 *     assertion cannot silently stop firing;
 *   - the frozen truncation pair, where a `top` / `left` pin pushed three of five tables off the
 *     ascii canvas and the checker used to pass it at a narrower width;
 *   - a synthetic reversed-edge sheet, because every other case here passes by finding nothing
 *     wrong in that dimension.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const checker = join(repoRoot, ".claude/skills/d2-diagram/assets/d2-facts.mjs");
const attempts = join(repoRoot, "fixtures/d2-scenario/attempts");
const sheets = join(repoRoot, "fixtures/d2-scenario/briefs/facts");
const truncation = join(repoRoot, "fixtures/d2-scenario/v2/pinned-truncation");

/** Run the checker over a render that already exists. Returns { status, out }. */
function read({ svg, txt, expect: sheet }) {
  const args = ["--from-svg", svg];
  if (txt) args.push("--from-txt", txt);
  if (sheet) args.push("--expect", sheet);
  try {
    const out = execFileSync(process.execPath, [checker, ...args], {
      encoding: "utf8",
      // Any attempt to render would exec this, so a lost `--from-svg` path fails loudly.
      env: { ...process.env, D2: "/nonexistent/d2" },
    });
    return { status: 0, out };
  } catch (error) {
    return { status: error.status, out: `${error.stdout || ""}${error.stderr || ""}` };
  }
}

const attempt = (letter, name) => ({
  svg: join(attempts, letter, `${name}.svg`),
  txt: join(attempts, letter, `${name}.txt`),
  expect: join(sheets, `${name}.expect.json`),
});

describe("d2-facts reads a drawn D2 figure back", () => {
  it("passes the attempts that are right, at the width they were measured at", () => {
    for (const [letter, columns] of [
      ["a", 75],
      ["e", 95],
      ["h", 65],
    ]) {
      const { status, out } = read(attempt(letter, "order-events"));
      assert.equal(status, 0, `attempt ${letter} should pass:\n${out}`);
      assert.match(out, /0 error\(s\)/);
      assert.match(out, new RegExp(`· ${columns} columns`), `attempt ${letter} width`);
      assert.match(out, /11 edges drawn/);
      // The three regions are checked by resolving each member, including abbreviated ids:
      // `a` wrote `gw: API gateway` and `pg: postgres`.
      assert.match(out, /edge holds gateway \(edge\.(gateway|gw)\)/);
    }
  });

  it("names every phantom box in the attempt that was green and wrong", () => {
    const { status, out } = read(attempt("d", "order-events"));
    assert.equal(status, 1);
    for (const name of ["stripe", "gateway", "orders", "browser"]) {
      assert.match(
        out,
        new RegExp(`"${name}" is drawn 2 times`),
        `the duplicate ${name} should be reported`,
      );
    }
    assert.match(out, /a reference to an id that is not in scope creates a new shape/);
    // The two "consume" arrows point from the consumer to the broker, which reverses the event.
    assert.match(out, /edge reversed: the sheet says broker->billing/);
    assert.match(out, /edge not drawn: gateway->orders/);
  });

  it("reports a correct figure that is over its width budget as exactly one error", () => {
    const { status, out } = read(attempt("f", "shop-schema"));
    assert.equal(status, 1);
    assert.match(out, /✗ the terminal render is 113 columns, the sheet allows 100/);
    assert.match(out, /1 error\(s\)/);
    assert.match(out, /4 edges drawn/);
  });

  it("passes a schema whose column-level edges read back as table-level", () => {
    const { status, out } = read(attempt("b", "shop-schema"));
    assert.equal(status, 0, out);
    assert.match(out, /edge orders\.customer_id->customers\.id → orders->customers/);
  });

  it("reads a sequence diagram's message order out of the geometry", () => {
    const { status, out } = read(attempt("c", "checkout-calls"));
    assert.equal(status, 0, out);
    assert.match(out, /7 messages drawn in the sheet's order/);
  });

  it("catches a terminal render that is missing boxes the SVG has", () => {
    const { status, out } = read({
      svg: join(truncation, "shop-schema-pinned.svg"),
      txt: join(truncation, "shop-schema-pinned.txt"),
      expect: join(sheets, "shop-schema.expect.json"),
    });
    assert.equal(status, 1);
    assert.match(out, /the terminal render is truncated: 3 of 5 boxes are missing/);
    for (const name of ["customers", "orders", "shipments"]) assert.ok(out.includes(name));
    // The width it would otherwise have reported as a win, kept in the message so the reader
    // sees what the number was measuring.
    assert.match(out, /measures a fragment/);
    assert.match(out, /71 columns/);
  });

  it("catches a reversed edge (this file is not vacuous)", () => {
    const dir = mkdtempSync(join(tmpdir(), "d2-facts-test-"));
    const sheet = join(dir, "reversed.expect.json");
    // `a`'s figure draws browser->cdn. A sheet claiming the opposite must be reported, with both
    // directions named so the reader can tell which way to fix.
    writeFileSync(sheet, JSON.stringify({ boxes: ["browser", "cdn"], deps: ["cdn->browser"] }));
    const { status, out } = read({ ...attempt("a", "order-events"), expect: sheet });
    assert.equal(status, 1);
    assert.match(out, /edge reversed: the sheet says cdn->browser, the picture draws \S*browser->\S*cdn/);
  });

  it("prints the drawn facts with no sheet and no terminal render", () => {
    const { status, out } = read({ svg: join(attempts, "a/order-events.svg") });
    assert.equal(status, 0, out);
    const facts = JSON.parse(out.slice(out.indexOf("{")));
    assert.equal(facts.boxes.length, 11);
    assert.equal(facts.deps.length, 11);
    assert.equal(facts.columns, null, "no --from-txt means no width, not a guessed one");
    assert.deepEqual(Object.keys(facts.containers).sort(), ["cluster", "edge", "outside"]);
    assert.ok(facts.deps.includes("edge.gw->cluster.orders"), "ids are fully qualified");
  });

  it("checks the skill's own example against the sheet it ships", () => {
    const assets = join(repoRoot, ".claude/skills/d2-diagram/assets");
    const { status, out } = read({
      svg: join(assets, "vlmkit-workspace.svg"),
      txt: join(assets, "vlmkit-workspace.txt"),
      expect: join(assets, "vlmkit-workspace.facts.json"),
    });
    assert.equal(status, 0, out);
    assert.match(out, /0 error\(s\)/);
  });
});
