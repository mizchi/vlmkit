/**
 * docs/features.md is the one page that names everything vlmkit does. It is held to the CLI here:
 * every registered gate, every leaf of the dispatcher's legacy groups and every top-level verb
 * must appear on it, and the gate and rule counts it states must be the registry's. A command
 * added without a line there fails this test instead of going unmentioned.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";

const repoRoot = join(import.meta.dirname, "..");
const page = readFileSync(join(repoRoot, "docs/features.md"), "utf8");
const cli = readFileSync(join(repoRoot, "src/cli/cli.ts"), "utf8");

/** `<group> <leaf>` for every entry of the dispatcher's GROUPS table. */
function legacyLeaves() {
  const start = cli.indexOf("const GROUPS");
  const block = cli.slice(start, cli.indexOf("\n};", start));
  const out = [];
  let group = "";
  for (const line of block.split("\n")) {
    const g = line.match(/^ {2}([a-z][a-z0-9-]*): \{/);
    if (g) group = g[1];
    const l = line.match(/^ {4}"?([a-z][a-z0-9 -]*)"?: \{/);
    if (l && group) out.push(`${group} ${l[1]}`);
  }
  return out;
}

/** Top-level verbs (`cli.command("act [...args]"`), the group template's identifier left out. */
function topLevelVerbs() {
  return [...cli.matchAll(/cli\s*\.command\(\s*`?"?\$?\{?([a-z][a-z0-9-]*)/g)]
    .map((m) => m[1])
    .filter((v) => v !== "group");
}

const named = (command) => new RegExp(`(\`|vlmkit )${command.replace(/[-]/g, "\\-")}(\`| |$)`, "m").test(page);

describe("docs/features.md names everything vlmkit does", () => {
  it("every gate, with the registry's gate and rule counts", async () => {
    const { loadGateRegistry, resetGateRegistryCache } = await import("../src/cli/gate-registry.ts");
    resetGateRegistryCache();
    const registry = await loadGateRegistry({ builtinsOnly: true });
    const gates = registry.list().map(({ gate }) => gate.command.join(" "));
    assert.deepEqual(
      gates.filter((g) => !named(g)),
      [],
    );
    const rules = registry.list().reduce((n, { gate }) => n + gate.rules.length, 0);
    const stated = page.match(/\*\*(\d+) gates\*\* with \*\*(\d+) tunable rules\*\*/);
    assert.ok(stated, "the page states its gate and rule counts as **N gates** with **M tunable rules**");
    assert.deepEqual([Number(stated[1]), Number(stated[2])], [gates.length, rules]);
  });

  it("every leaf of the legacy groups and every top-level verb", () => {
    const leaves = legacyLeaves();
    const verbs = topLevelVerbs();
    assert.ok(leaves.length >= 25, `only ${leaves.length} legacy leaves parsed from src/cli/cli.ts`);
    assert.ok(verbs.includes("act") && verbs.includes("snapshot"), "top-level verbs parsed from src/cli/cli.ts");
    assert.deepEqual(
      [...leaves, ...verbs].filter((c) => !named(c)),
      [],
    );
  });
});

describe("docs/README.md indexes every document", () => {
  it("links each .md under docs/ and docs/design/", () => {
    const index = readFileSync(join(repoRoot, "docs/README.md"), "utf8");
    const docs = [
      ...readdirSync(join(repoRoot, "docs")).filter((f) => f.endsWith(".md") && f !== "README.md"),
      ...readdirSync(join(repoRoot, "docs/design"))
        .filter((f) => f.endsWith(".md"))
        .map((f) => `design/${f}`),
    ];
    assert.ok(docs.length > 20, `only ${docs.length} documents found`);
    assert.deepEqual(
      docs.filter((d) => !index.includes(`(./${d})`)),
      [],
    );
  });
});
