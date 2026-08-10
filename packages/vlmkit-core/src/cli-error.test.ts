import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import {
  formatMissingPlaywrightBrowserError,
  formatMissingPlaywrightModuleError,
  playwrightEngineFromLaunchError,
  playwrightInstallCommand,
  resolvePlaywrightInstallTarget,
  resolvedPlaywrightHasCli,
} from "./cli-error.ts";

// Injected rather than resolved: the point of the diagnosis is that it names a
// *specific* installation, and a test that reads the ambient one cannot tell a
// correct answer from a coincidence.
const TARGET = {
  version: "1.61.0",
  packageDir: "/repo/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright",
  cliPath: "/repo/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/cli.js",
  nodePath: "/usr/local/bin/node",
};

// The shape issue #112 pasted: Playwright's own message, whose advice
// (`pnpm exec playwright install`) resolves the wrong installation.
const LAUNCH_ERROR = `browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
╚════════════════════════════════════════════════════════════╝`;

describe("formatMissingPlaywrightBrowserError", () => {
  it("names the resolved Playwright version and package directory", () => {
    const text = formatMissingPlaywrightBrowserError(new Error(LAUNCH_ERROR), TARGET) ?? "";
    assert.match(text, /Playwright 1\.61\.0 has no chromium browser executable installed/);
    assert.match(
      text,
      /resolved: playwright@1\.61\.0 at \/repo\/node_modules\/\.pnpm\/playwright@1\.61\.0\/node_modules\/playwright/,
    );
  });

  it("prints an install command that targets that installation's own CLI", () => {
    const text = formatMissingPlaywrightBrowserError(new Error(LAUNCH_ERROR), TARGET) ?? "";
    assert.match(
      text,
      /run:\s+\/usr\/local\/bin\/node \/repo\/node_modules\/\.pnpm\/playwright@1\.61\.0\/node_modules\/playwright\/cli\.js install chromium/,
    );
    // And warns off the advice Playwright itself gave, which is the whole bug.
    assert.match(text, /may resolve a different playwright and download a different build/);
  });

  it("quotes the executable path that was missing", () => {
    const text = formatMissingPlaywrightBrowserError(new Error(LAUNCH_ERROR), TARGET) ?? "";
    assert.match(
      text,
      /missing:\s+\/opt\/pw-browsers\/chromium_headless_shell-1234\/chrome-headless-shell-linux64\/chrome-headless-shell/,
    );
  });

  it("asks for the engine that actually failed, not always chromium", () => {
    const firefox = formatMissingPlaywrightBrowserError(
      new Error("browserType.launch: Executable doesn't exist at /opt/pw/firefox-1490/firefox/firefox"),
      TARGET,
    ) ?? "";
    assert.match(firefox, /no firefox browser executable/);
    assert.match(firefox, /cli\.js install firefox/);

    const webkit = formatMissingPlaywrightBrowserError(
      new Error("browserType.launch: Executable doesn't exist at /opt/pw/webkit-2247/pw_run.sh"),
      TARGET,
    ) ?? "";
    assert.match(webkit, /no webkit browser executable/);
    assert.match(webkit, /cli\.js install webkit/);
  });

  it("degrades to a claim-free message when the resolution fails", () => {
    const text = formatMissingPlaywrightBrowserError(new Error(LAUNCH_ERROR), null) ?? "";
    assert.match(text, /could not resolve its own playwright package/);
    // Must not invent a command it cannot verify.
    assert.doesNotMatch(text, /run:/);
  });

  it("does not claim unrelated launch errors are missing browsers", () => {
    assert.equal(
      formatMissingPlaywrightBrowserError(new Error("browserType.launch: Operation not permitted"), TARGET),
      null,
    );
  });
});

describe("playwrightEngineFromLaunchError", () => {
  it("maps both chromium flavours to the one installable name", () => {
    // `playwright install chromium` fetches the headless shell too, so
    // `chromium_headless_shell-*` must not become `chromium-headless-shell`.
    assert.equal(playwrightEngineFromLaunchError("/x/chromium_headless_shell-1228/y"), "chromium");
    assert.equal(playwrightEngineFromLaunchError("/x/chromium-1228/y"), "chromium");
  });

  it("defaults to chromium when the path names no engine", () => {
    assert.equal(playwrightEngineFromLaunchError("Executable doesn't exist at /nowhere"), "chromium");
  });
});

describe("formatMissingPlaywrightModuleError", () => {
  const err = Object.assign(
    new Error(
      "Cannot find package 'playwright' imported from /app/node_modules/@mizchi/vlmkit/dist/perf.gate-abc.mjs",
    ),
    { code: "ERR_MODULE_NOT_FOUND" },
  );

  it("explains that playwright is a required peer, and quotes the range", () => {
    const text = formatMissingPlaywrightModuleError(err) ?? "";
    assert.match(text, /`playwright` package is not installed/);
    assert.match(text, /declares it as a required peer dependency \(>=1\.61 <2\)/);
    assert.match(text, /imported by: \/app\/node_modules\/@mizchi\/vlmkit\/dist\/perf\.gate-abc\.mjs/);
    assert.match(text, /npm install --save-dev playwright/);
  });

  it("still points the browser download at that installation's CLI", () => {
    assert.match(
      formatMissingPlaywrightModuleError(err) ?? "",
      /node node_modules\/playwright\/cli\.js install chromium/,
    );
  });

  it("ignores a missing module that is not playwright", () => {
    assert.equal(
      formatMissingPlaywrightModuleError(
        Object.assign(new Error("Cannot find package 'pngjs' imported from /app/x.mjs"), {
          code: "ERR_MODULE_NOT_FOUND",
        }),
      ),
      null,
    );
  });

  it("ignores errors that are not module resolution failures", () => {
    assert.equal(formatMissingPlaywrightModuleError(new Error("boom")), null);
  });
});

describe("resolvePlaywrightInstallTarget (real resolution)", () => {
  // Happy path: in this workspace playwright IS installed, so the command we
  // would print must be runnable, not merely well-formed. This is the half of
  // the diagnosis a test cannot fake — the message-building half is above.
  it("resolves a playwright whose cli.js exists", () => {
    const target = resolvePlaywrightInstallTarget();
    assert.ok(target, "playwright should resolve from vlmkit-core in the workspace");
    assert.match(target.version, /^\d+\.\d+\.\d+/);
    assert.ok(existsSync(target.cliPath), `${target.cliPath} should exist`);
    assert.equal(resolvedPlaywrightHasCli(), true);
    assert.match(playwrightInstallCommand(target), /cli\.js install chromium$/);
  });
});
