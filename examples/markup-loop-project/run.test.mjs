import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const exampleDir = dirname(fileURLToPath(import.meta.url));

test("markup-loop project example reproduces the drop-in observe loop", async () => {
  const result = spawnSync(process.execPath, ["run.mjs"], {
    cwd: exampleDir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /created \.vlmkit\/markup-loop\.json/);
  assert.match(result.stdout, /observed http:\/\/127\.0\.0\.1:\d+\/dashboard/);
  assert.match(result.stdout, /vlmkit-plan --title "Operations Dashboard Smoke"/);
  assert.match(result.stdout, /vlmkit-generate --plan \.vlmkit\/markup-loop\/plan\.md/);
  assert.match(result.stdout, /Markup loop project example passed/);

  const observations = JSON.parse(
    await readFile(join(exampleDir, ".vlmkit/markup-loop/observations.json"), "utf8"),
  );
  assert.equal(observations[0]?.title, "Operations Dashboard");
  assert.ok(observations[0]?.roles.includes('heading "Operations Dashboard"'));
  assert.ok(observations[0]?.roles.includes('button "Approve deployment"'));
  assert.ok(observations[0]?.labels.includes("Filter services"));
  assert.ok(observations[0]?.testIds.includes("service-health"));
  assert.ok(observations[0]?.texts.includes("2 incidents need review"));
});
