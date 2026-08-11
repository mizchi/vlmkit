import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import {
  UsageError,
  formatCliError,
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

/**
 * The branches themselves, which were untestable until `formatCliError` was
 * split out of `handleCliError` (the latter ends in `process.exit`, so covering
 * a branch meant spawning a child, and nothing did).
 *
 * The error strings are Playwright's own, copied from real runs in this repo
 * rather than paraphrased — every one of these is a message shape a Playwright
 * upgrade could change, and a paraphrase would keep passing after it did.
 */
describe("formatCliError", () => {
  it("reports a browser-reported missing file exactly like an fs-reported one", () => {
    // The regression this pair exists for: the base-URL refactor moved ten gates
    // from `readFile` (ENOENT) to `page.goto` (net::ERR_FILE_NOT_FOUND) on the
    // same user typo. If the two lines ever diverge again, the CLI answers the
    // most common invocation error two different ways depending on the gate.
    const fromFs = formatCliError(
      Object.assign(new Error("ENOENT: no such file or directory, open '/repo/nope.html'"), {
        code: "ENOENT",
        path: "/repo/nope.html",
      }),
    );
    const fromBrowser = formatCliError(
      new Error(
        `page.goto: net::ERR_FILE_NOT_FOUND at file:///repo/nope.html\n`
          + `Call log:\n  - navigating to "file:///repo/nope.html", waiting until "networkidle"\n`,
      ),
    );
    assert.equal(fromFs, "error: file not found: /repo/nope.html");
    assert.equal(fromBrowser, fromFs);
  });

  it("decodes a percent-encoded file URL back to the path the caller typed", () => {
    const text = formatCliError(
      new Error("page.goto: net::ERR_FILE_NOT_FOUND at file:///repo/my%20pages/a%2Bb.html"),
    );
    assert.equal(text, "error: file not found: /repo/my pages/a+b.html");
  });

  it("falls back to an argv path when the message shape stops matching", () => {
    // A Playwright upgrade that reworded the message must degrade to a worse
    // path, never to a raw stack. Simulated by omitting the `file://` URL.
    const argv = process.argv;
    process.argv = ["node", "vlmkit", "check", "integrity", "typo.html", "--json"];
    try {
      assert.equal(formatCliError(new Error("net::ERR_FILE_NOT_FOUND")), "error: file not found: typo.html");
    } finally {
      process.argv = argv;
    }
  });

  it("names a blocked port rather than blaming the server", () => {
    // Chromium refuses ports 1, 7, 22, 25, 6000 … before any request is sent, so
    // "connection refused (is the server running?)" would send the reader to
    // check a server that was never contacted.
    const text = formatCliError(
      new Error(
        `page.goto: net::ERR_UNSAFE_PORT at http://127.0.0.1:1/x.html\n`
          + `Call log:\n  - navigating to "http://127.0.0.1:1/x.html", waiting until "networkidle"\n`,
      ),
    ) ?? "";
    assert.match(text, /blocked-port list/);
    assert.doesNotMatch(text, /is the server running/);
  });

  it("distinguishes DNS failure, refused connection and an invalid URL", () => {
    const dns = formatCliError(new Error("page.goto: net::ERR_NAME_NOT_RESOLVED at http://nope.invalid/")) ?? "";
    const refused = formatCliError(new Error("page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:9999/")) ?? "";
    const invalid = formatCliError(new Error("page.goto: Cannot navigate to invalid URL")) ?? "";
    assert.match(dns, /host could not be resolved/);
    assert.match(refused, /connection refused \(is the server running\?\)/);
    assert.match(invalid, /not a valid URL/);
    // No URL in the invalid-URL message to quote, and inventing one would be
    // worse than the placeholder.
    assert.match(invalid, /cannot load the URL/);
  });

  it("gives a BrowserLaunchError exactly one `error: ` prefix", () => {
    // The two diagnoses that reach this branch disagree about the prefix:
    // core's missing-browser text builds its own, vlmkit-capture's sandbox text
    // does not. Both must come out looking like every other line the CLI prints.
    const prefixed = new Error("error: Playwright 1.61.0 has no chromium browser executable installed.");
    prefixed.name = "BrowserLaunchError";
    assert.equal(formatCliError(prefixed), prefixed.message, "must not become `error: error: …`");

    const bare = new Error("Playwright browser launch is blocked by a Codex/macOS sandbox restriction.");
    bare.name = "BrowserLaunchError";
    const out = formatCliError(bare) ?? "";
    assert.equal(out, `error: ${bare.message}`);
    assert.doesNotMatch(out, /error: error:/);
  });

  it("prints a UsageError as one line without a stack", () => {
    assert.equal(formatCliError(new UsageError("--concurrency expects a number, got \"abc\"")),
      'error: --concurrency expects a number, got "abc"');
  });

  it("adds the directory hint for EISDIR", () => {
    const text = formatCliError(
      Object.assign(new Error("EISDIR: illegal operation on a directory, read"), {
        code: "EISDIR",
        path: "/repo/fixtures",
      }),
    ) ?? "";
    assert.match(text, /expected an HTML file, got a directory: \/repo\/fixtures/);
    assert.match(text, /e\.g\. \/repo\/fixtures\/page\.html/);
  });

  it("summarizes a navigation timeout", () => {
    const text = formatCliError(new Error("page.goto: Timeout 30000ms exceeded.")) ?? "";
    assert.match(text, /page load timed out \(Timeout 30000ms exceeded\)/);
  });

  it("returns null for an error it has nothing to add to", () => {
    // Not a generic summary: an unrecognized error must reach the developer with
    // its stack intact, which is what `handleCliError` does with a null.
    assert.equal(formatCliError(new Error("Cannot read properties of undefined (reading 'x')")), null);
    assert.equal(formatCliError(new TypeError("boom")), null);
  });
});
