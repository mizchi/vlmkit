import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildMarkupLoopCommands,
  checkMarkupLoopReadiness,
  createDefaultMarkupLoopConfig,
  initMarkupLoop,
  loadMarkupLoopConfig,
  runMarkupLoop,
} from "./markup-loop.ts";

describe("markup-loop drop-in config", () => {
  it("creates a practical starter harness for real markup work", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-"));
    try {
      const result = await initMarkupLoop({
        cwd,
        topic: "checkout",
        title: "Checkout Smoke",
        baseUrl: "http://127.0.0.1:5173",
        provider: "anthropic",
      });

      assert.equal(result.created.length, 6);
      assert.ok(existsSync(join(cwd, ".vlmkit/markup-loop.json")));
      assert.ok(existsSync(join(cwd, ".vlmkit/markup-loop/AGENT.md")));
      assert.ok(existsSync(join(cwd, ".vlmkit/markup-loop/request.md")));
      assert.ok(existsSync(join(cwd, ".vlmkit/markup-loop/observations.json")));
      assert.ok(existsSync(join(cwd, ".vlmkit/markup-loop/_generation-rules.md")));
      assert.ok(existsSync(join(cwd, "tests/vlmkit/support/goto-app.ts")));

      const config = await loadMarkupLoopConfig(join(cwd, ".vlmkit/markup-loop.json"));
      assert.equal(config.title, "Checkout Smoke");
      assert.equal(config.provider, "anthropic");
      assert.equal(config.baseUrl, "http://127.0.0.1:5173");
      assert.equal(config.generatedTestFile, "tests/vlmkit/checkout.spec.ts");
      assert.equal(config.helperImport, "./support/goto-app");
      assert.equal(config.runtimeGateRuns, 2);

      const agentRunbook = await readFile(join(cwd, ".vlmkit/markup-loop/AGENT.md"), "utf8");
      assert.match(agentRunbook, /Playwright Test Agents/);
      assert.match(agentRunbook, /pnpm exec vlmkit markup-loop run/);
      assert.match(agentRunbook, /Do not weaken the generated scenario/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("renders the plan and generate steps that an agent can dry-run before spending tokens", () => {
    const config = createDefaultMarkupLoopConfig({
      topic: "settings",
      title: "Settings Smoke",
      provider: "openrouter",
      baseUrl: "http://localhost:3000",
    });

    const commands = buildMarkupLoopCommands(config);

    assert.match(commands.plan.display, /vlmkit-plan --title "Settings Smoke"/);
    assert.match(commands.plan.display, /--request-file \.vlmkit\/markup-loop\/request\.md/);
    assert.match(commands.plan.display, /--structured-out \.vlmkit\/markup-loop\/plan\.json/);
    assert.match(commands.plan.display, /--locator-inventory-out \.vlmkit\/markup-loop\/locators\.json/);
    assert.match(commands.generate.display, /vlmkit-generate --plan \.vlmkit\/markup-loop\/plan\.md/);
    assert.match(commands.generate.display, /--helper-import \.\/support\/goto-app/);
    assert.match(commands.generate.display, /--runtime-gate-runs 2/);
    assert.match(commands.generate.display, /--gate-command "pnpm exec playwright test --config playwright\.config\.ts tests\/vlmkit\/settings\.spec\.ts --update-snapshots"/);
  });

  it("checks the generated helper because missing glue breaks generated tests", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-"));
    try {
      await initMarkupLoop({
        cwd,
        topic: "checkout",
        title: "Checkout Smoke",
      });
      await writeFile(join(cwd, "playwright.config.ts"), "export default {};\n", "utf8");
      await unlink(join(cwd, "tests/vlmkit/support/goto-app.ts"));

      const config = await loadMarkupLoopConfig(join(cwd, ".vlmkit/markup-loop.json"));
      const readiness = checkMarkupLoopReadiness(config, cwd);

      assert.equal(readiness.ok, false);
      assert.deepEqual(readiness.missing, ["tests/vlmkit/support/goto-app.ts"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("fails run readiness before spending planner or generator tokens", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-"));
    const previousCwd = process.cwd();
    try {
      await initMarkupLoop({
        cwd,
        topic: "checkout",
        title: "Checkout Smoke",
      });
      await writeFile(join(cwd, "playwright.config.ts"), "export default {};\n", "utf8");
      await unlink(join(cwd, "tests/vlmkit/support/goto-app.ts"));

      process.chdir(cwd);
      const errors: string[] = [];
      const originalError = console.error;
      console.error = (message?: unknown) => {
        errors.push(String(message));
      };
      let code = -1;
      try {
        code = await runMarkupLoop();
      } finally {
        console.error = originalError;
      }

      assert.equal(code, 1);
      assert.deepEqual(errors, ["Missing tests/vlmkit/support/goto-app.ts"]);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
