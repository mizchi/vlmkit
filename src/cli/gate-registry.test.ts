/**
 * The composed registry: every built-in plugin, loaded together.
 *
 * Each plugin has its own declaration test, but composition is where the
 * failures that matter live — two plugins claiming one command, an id that
 * does not match its command path, a three-token gate the resolver cannot
 * reach. None of that is visible from inside a single plugin, and all of it
 * used to be discoverable only by running the CLI.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadGateRegistry, resetGateRegistryCache } from "./gate-registry.ts";

/**
 * `builtinsOnly` so a `vlmkit.config.json` in the repo root (or in whatever
 * cwd the suite runs from) cannot add gates and change these counts.
 */
async function registry() {
  resetGateRegistryCache();
  return loadGateRegistry({ builtinsOnly: true });
}

describe("composed built-in registry", () => {
  it("loads all three built-in plugins", async () => {
    const r = await registry();
    assert.deepEqual(
      r.plugins.map((p) => p.name).sort(),
      ["@mizchi/vlmkit-capture", "@mizchi/vlmkit-markup", "vlmkit-app"],
    );
  });

  it("registers every gate without an id or command conflict", async () => {
    // createGateRegistry throws on a conflict, so reaching this line is the
    // assertion; the count guards against a plugin silently dropping out.
    const r = await registry();
    assert.equal(r.list().length, 26);
  });

  it("keeps each gate id in step with its command path", async () => {
    for (const { gate } of (await registry()).list()) {
      assert.equal(gate.id, gate.command.join("."), `${gate.id} vs ${gate.command.join(" ")}`);
    }
  });

  it("resolves three-token gates by longest prefix", async () => {
    const r = await registry();
    for (const command of ["check a11y contrast", "check a11y touch", "check a11y focus", "check drift component", "check drift pages"]) {
      const tokens = command.split(" ");
      const resolved = r.resolve([...tokens, "page.html", "--json"]);
      assert.equal(resolved?.gate.command.join(" "), command, `${command} did not resolve`);
      assert.deepEqual(resolved?.rest, ["page.html", "--json"]);
    }
  });

  it("does not resolve a two-token prefix of a three-token gate", async () => {
    // `vlmkit check a11y` is not a command; it has to fall through to the
    // did-you-mean path rather than silently running one of the three.
    const r = await registry();
    assert.equal(r.resolve(["check", "a11y"]), undefined);
    assert.equal(r.resolve(["check", "drift"]), undefined);
  });

  it("suggests the real commands for a bare group prefix", async () => {
    const r = await registry();
    assert.ok((await registry()).suggest(["check", "a11y", "contrst"]).includes("check a11y contrast"));
    assert.deepEqual(r.suggest(["check", "integrit"]), ["check integrity"]);
  });

  it("groups gates under every verb the CLI must register", async () => {
    const r = await registry();
    assert.deepEqual([...r.groups().keys()].sort(), ["check", "scan", "stress", "verify"]);
  });

  it("gives every gate a non-empty rule table with unique ids", async () => {
    for (const { gate } of (await registry()).list()) {
      assert.ok(gate.rules.length > 0, `${gate.id} has no rules`);
      const ids = gate.rules.map((rule) => rule.id);
      assert.equal(new Set(ids).size, ids.length, `${gate.id} has duplicate rule ids`);
    }
  });

  it("declares 115 tunable rules in total", async () => {
    // A canary, not a target: a gate losing its rule table to a bad merge is
    // otherwise invisible until someone tries to tune it.
    const total = (await registry()).list().reduce((n, { gate }) => n + gate.rules.length, 0);
    assert.equal(total, 115);
  });
});
