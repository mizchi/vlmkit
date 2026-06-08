import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseToml } from "./toml-min.ts";

describe("parseToml", () => {
  it("parses top-level scalars and arrays", () => {
    const obj = parseToml(`
baseUrl = "http://localhost:3000"
tokens = './DESIGN.md'
viewports = ["mobile", "desktop", "wide"]
`);
    assert.equal(obj.baseUrl, "http://localhost:3000");
    assert.equal(obj.tokens, "./DESIGN.md");
    assert.deepEqual(obj.viewports, ["mobile", "desktop", "wide"]);
  });

  it("parses numbers and booleans", () => {
    const obj = parseToml(`
count = 3
ratio = 0.005
neg = -2
enabled = true
disabled = false
`);
    assert.equal(obj.count, 3);
    assert.equal(obj.ratio, 0.005);
    assert.equal(obj.neg, -2);
    assert.equal(obj.enabled, true);
    assert.equal(obj.disabled, false);
  });

  it("ignores comments and blank lines", () => {
    const obj = parseToml(`
# a comment
baselineDir = ".vrt/baselines"   # trailing comment

`);
    assert.equal(obj.baselineDir, ".vrt/baselines");
  });

  it("parses nested tables", () => {
    const obj = parseToml(`
[thresholds]
wide = 0.005
desktop = 0.005
mobile = 0.01

[a11y]
level = "AA"
maxContrastFailures = 0
`);
    assert.deepEqual(obj.thresholds, { wide: 0.005, desktop: 0.005, mobile: 0.01 });
    assert.deepEqual(obj.a11y, { level: "AA", maxContrastFailures: 0 });
  });

  it("parses arrays of tables with dotted sub-tables", () => {
    const obj = parseToml(`
[[routes]]
name = "home"
url = "http://localhost:3000/"

[[routes]]
name = "admin"
url = "http://localhost:3000/admin/"
[routes.thresholds]
wide = 0.02
mobile = 0.03
`);
    const routes = obj.routes as Array<Record<string, unknown>>;
    assert.equal(routes.length, 2);
    assert.equal(routes[0].name, "home");
    assert.equal(routes[1].name, "admin");
    assert.deepEqual(routes[1].thresholds, { wide: 0.02, mobile: 0.03 });
    assert.equal(routes[0].thresholds, undefined);
  });

  it("handles a hash inside a quoted string", () => {
    const obj = parseToml(`anchor = "http://x/#frag"`);
    assert.equal(obj.anchor, "http://x/#frag");
  });

  it("throws on a malformed line", () => {
    assert.throws(() => parseToml(`this is not toml`), /TOML/);
  });
});
