/**
 * The npm release (scripts/publish-npm.mjs, run by .github/workflows/publish.yml): every public
 * package is published after everything it depends on, all at one version, and the workflow
 * holds the OIDC permission Trusted Publishing needs. A publish in the wrong order ships a
 * package whose dependency is not on the registry yet.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { publicPackages, publishOrder } from "../scripts/publish-npm.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("every public package is published after its workspace dependencies, the CLI last", () => {
  const order = publishOrder(publicPackages()).map((p) => p.manifest);
  const at = new Map(order.map((m, i) => [m.name, i]));
  for (const m of order) {
    for (const dep of Object.keys({ ...m.dependencies, ...m.peerDependencies, ...m.optionalDependencies })) {
      if (at.has(dep)) assert.ok(at.get(dep) < at.get(m.name), `${dep} before ${m.name}`);
    }
  }
  assert.equal(order.at(-1).name, "@mizchi/vlmkit");
  assert.ok(!order.some((m) => m.private), "no private package is published");
  assert.equal(new Set(order.map((m) => m.version)).size, 1, "one version across the release");
});

test("the publish workflow runs on a tag with the OIDC permission and calls the script", () => {
  const yml = readFileSync(join(repoRoot, ".github/workflows/publish.yml"), "utf8");
  assert.match(yml, /tags: \["v\*"\]/);
  assert.match(yml, /id-token: write/);
  assert.match(yml, /node scripts\/publish-npm\.mjs/);
  assert.doesNotMatch(yml, /NPM_TOKEN|NODE_AUTH_TOKEN:/, "trusted publishing needs no token");
});
