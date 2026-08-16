import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  buildMarkupLoopCommands,
  checkMarkupLoopReadiness,
  createDefaultMarkupLoopConfig,
  initMarkupLoop,
  loadMarkupLoopConfig,
  markupLoopRoot,
  observeMarkupLoop,
  runMarkupLoop,
  runMarkupLoopCli,
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
      assert.equal(config.maxTokens, 4096);
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
    assert.match(commands.plan.display, /--max-tokens 4096/);
    assert.match(commands.generate.display, /vlmkit-generate --plan \.vlmkit\/markup-loop\/plan\.md/);
    assert.match(commands.generate.display, /--helper-import \.\/support\/goto-app/);
    assert.match(commands.generate.display, /--max-tokens 4096/);
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

  it("observes a live page and replaces placeholder observations with real UI facts", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-"));
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html>
        <html>
          <head><title>Checkout</title></head>
          <body>
            <main>
              <h1>Checkout</h1>
              <label for="email">Email address</label>
              <input id="email" type="email" />
              <section aria-label="Order Summary">
                <p data-testid="order-total">Order total $42.00</p>
                <button data-testid="pay-button">Pay now</button>
              </section>
            </main>
          </body>
        </html>`);
    });
    const previousCwd = process.cwd();
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;
      await initMarkupLoop({
        cwd,
        topic: "checkout",
        title: "Checkout Smoke",
        baseUrl,
      });

      process.chdir(cwd);
      const result = await observeMarkupLoop();

      assert.equal(result.outputPath, ".vlmkit/markup-loop/observations.json");
      assert.equal(result.observations.length, 1);
      assert.equal(result.observations[0]!.title, "Checkout");
      assert.ok(result.observations[0]!.roles?.includes('heading "Checkout"'));
      assert.ok(result.observations[0]!.roles?.includes('button "Pay now"'));
      assert.ok(result.observations[0]!.roles?.includes('textbox "Email address"'));
      assert.ok(result.observations[0]!.labels?.includes("Email address"));
      assert.ok(result.observations[0]!.testIds?.includes("order-total"));
      assert.ok(result.observations[0]!.testIds?.includes("pay-button"));
      assert.ok(result.observations[0]!.texts?.includes("Order total $42.00"));

      const written = JSON.parse(await readFile(join(cwd, ".vlmkit/markup-loop/observations.json"), "utf8"));
      assert.deepEqual(written, result.observations);
    } finally {
      process.chdir(previousCwd);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * The CLI surface: `runMarkupLoopCli`, which nothing in this file called.
 *
 * Every function it dispatches to is tested above, and the dispatch itself was not — so the argv
 * parsing (four separate parsers, each rejecting unknown flags), the exit codes, and `doctor`
 * were unexecuted. That is the layer where `--config` reaches one command and is ignored by
 * another, and where a typo'd flag is silently dropped instead of reported.
 */
describe("runMarkupLoopCli", () => {
  it("prints usage: exit 1 with no command, exit 0 when help was asked for", async () => {
    // The distinction is the convention the rest of this CLI follows — no arguments is a usage
    // ERROR, `--help` is a request that succeeded.
    assert.equal(await runMarkupLoopCli([]), 1);
    for (const flag of ["help", "--help", "-h"]) {
      assert.equal(await runMarkupLoopCli([flag]), 0, flag);
    }
  });

  it("names an unknown command instead of doing nothing", async () => {
    assert.equal(await runMarkupLoopCli(["nope"]), 1);
  });

  it("init creates the harness, and says so when it already exists", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-cli-"));
    const configPath = join(cwd, "markup-loop.json");
    assert.equal(await runMarkupLoopCli(["init", "--config", configPath, "--topic", "pricing page"]), 0);
    assert.ok(existsSync(configPath));
    // Idempotent: running init twice must not overwrite an edited harness.
    const before = await readFile(configPath, "utf8");
    assert.equal(await runMarkupLoopCli(["init", "--config", configPath]), 0);
    assert.equal(await readFile(configPath, "utf8"), before, "the second init changed nothing");
    await rm(cwd, { recursive: true, force: true });
  });

  it("doctor fails with the command to run when the config is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-doctor-"));
    assert.equal(await runMarkupLoopCli(["doctor", "--config", join(cwd, "nope.json")]), 1);
    await rm(cwd, { recursive: true, force: true });
  });

  it("init writes the whole harness next to the config it was given", async () => {
    // Found the hard way: this test in its first form passed `--config <tmp>/markup-loop.json`
    // and six starter files landed in the REPO, because only the config honoured the path. The
    // config and the harness it describes have to be in one place or nothing can find the other.
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-init-elsewhere-"));
    const configPath = join(cwd, "markup-loop.json");
    assert.equal(await runMarkupLoopCli(["init", "--config", configPath]), 0);
    const config = await loadMarkupLoopConfig(configPath);
    for (const path of [config.requestFile, config.observationsFile, config.rulesFile]) {
      assert.ok(existsSync(join(cwd, path)), `${path} should sit next to the config`);
    }
    assert.ok(existsSync(join(cwd, "tests/vlmkit/support/goto-app.ts")));
    // And readiness — which resolves against a cwd — agrees, apart from `playwright.config.ts`,
    // which init does not write because a project's own config is not vlmkit's to invent.
    assert.deepEqual(checkMarkupLoopReadiness(config, cwd).missing, ["playwright.config.ts"]);
    await rm(cwd, { recursive: true, force: true });
  });

  it("doctor resolves against the config's own directory, not the process cwd", async () => {
    // Was pinned as a known limitation: `doctor --config <elsewhere>` accepted a config anywhere
    // and then checked THIS directory's files, so a harness `init` had just written correctly
    // reported as not ready. `markupLoopRoot` is now the single definition of where config paths
    // resolve from, and init / doctor / run / observe all use it.
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-doctor-elsewhere-"));
    const configPath = join(cwd, "markup-loop.json");
    assert.equal(await runMarkupLoopCli(["init", "--config", configPath]), 0);
    const config = await loadMarkupLoopConfig(configPath);
    // Only the project's own `playwright.config.ts` is outstanding — init deliberately does not
    // invent one — so doctor must report exactly that, and exit 1 for exactly that reason.
    assert.deepEqual(checkMarkupLoopReadiness(config, cwd).missing, ["playwright.config.ts"]);
    assert.equal(await runMarkupLoopCli(["doctor", "--config", configPath]), 1);
    // With the project's config present, doctor is satisfied — the assertion the old pinned
    // version could not make, and the one that proves the resolution moved.
    await writeFile(join(cwd, "playwright.config.ts"), "export default {};\n", "utf8");
    assert.equal(await runMarkupLoopCli(["doctor", "--config", configPath]), 0);
    await rm(cwd, { recursive: true, force: true });
  });

  it("markupLoopRoot: absolute config roots at its directory, relative at the cwd", async () => {
    assert.equal(markupLoopRoot("/elsewhere/markup-loop.json"), "/elsewhere");
    assert.equal(markupLoopRoot(".vlmkit/markup-loop.json"), process.cwd());
    // An explicit cwd always wins — that is how `initMarkupLoop({ cwd })` is driven in tests.
    assert.equal(markupLoopRoot("/elsewhere/markup-loop.json", "/given"), "/given");
  });

  it("commands built for another root carry absolute paths, so in-process plan/generate hit it", async () => {
    // `runMarkupLoop` calls runPlanCli / runGenerateCli IN-PROCESS, where a relative
    // `--request-file` resolves against the process cwd. Left relative for the default root so
    // the displayed command stays short; absolutized when the config came from elsewhere.
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-cmds-"));
    const config = createDefaultMarkupLoopConfig({ title: "Elsewhere" });
    const here = buildMarkupLoopCommands(config);
    assert.ok(here.plan.argv.includes(config.requestFile), "default root keeps paths as written");

    const there = buildMarkupLoopCommands(config, cwd);
    assert.ok(there.plan.argv.includes(join(cwd, config.requestFile)));
    assert.ok(there.generate.argv.includes(join(cwd, config.playwrightConfig)));
    // `--helper-import` is a module specifier inside the generated test file, relative to that
    // file. Absolutizing it would break the import it becomes.
    assert.ok(there.generate.argv.includes(config.helperImport));
    await rm(cwd, { recursive: true, force: true });
  });

  it("observe writes beside the config it was given, not into the process cwd", async () => {
    // The worst of the four, because it WROTE: `observe --config /elsewhere/x.json` dropped its
    // observations here and left the config's own harness untouched. No browser needed to show
    // where the write lands — an explicit `--output` is still honoured as the caller's word.
    const cwd = await mkdtemp(join(tmpdir(), "vlmkit-markup-loop-observe-"));
    const configPath = join(cwd, "markup-loop.json");
    assert.equal(await runMarkupLoopCli(["init", "--config", configPath]), 0);
    const config = await loadMarkupLoopConfig(configPath);
    assert.equal(
      resolve(markupLoopRoot(configPath), config.observationsFile),
      join(cwd, config.observationsFile),
    );
    await rm(cwd, { recursive: true, force: true });
  });

  it("rejects an unknown flag on each subcommand rather than ignoring it", async () => {
    // Four parsers, four chances to silently drop a flag the caller believed in. `--dry-run` on
    // `doctor` is the realistic version: it is valid on `run` and meaningless here.
    await assert.rejects(() => runMarkupLoopCli(["doctor", "--dry-run"]), /Unknown argument: --dry-run/);
    await assert.rejects(() => runMarkupLoopCli(["run", "--headed"]), /Unknown argument: --headed/);
    await assert.rejects(() => runMarkupLoopCli(["observe", "--dry-run"]), /Unknown argument: --dry-run/);
    await assert.rejects(() => runMarkupLoopCli(["init", "--url", "http://x"]), /Unknown argument: --url/);
  });

  it("reports a flag given without its value", async () => {
    await assert.rejects(() => runMarkupLoopCli(["run", "--config"]), /--config/);
    await assert.rejects(() => runMarkupLoopCli(["observe", "--timeout"]), /--timeout/);
  });

  it("rejects a non-numeric timeout", async () => {
    await assert.rejects(() => runMarkupLoopCli(["observe", "--timeout", "soon"]), /--timeout/);
  });
});
