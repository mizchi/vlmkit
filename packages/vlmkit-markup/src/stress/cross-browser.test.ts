import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { engineInstallCommand } from "./cross-browser.ts";

describe("engineInstallCommand", () => {
  // `diff browsers` is the only launch site in the repo that launches firefox
  // and webkit, so it is the one that most needed the issue-#112 fix: its advice
  // used to be `npx playwright install <engine>`, which resolves the *project's*
  // playwright rather than the one this module imported.
  it("targets the resolved playwright's own CLI, not npx", () => {
    const command = engineInstallCommand("firefox");
    assert.match(command, /playwright[/\\]cli\.js install firefox$/);
    assert.doesNotMatch(command, /^npx /);
  });

  it("passes several engines to one invocation", () => {
    assert.match(engineInstallCommand("firefox", "webkit"), /cli\.js install firefox webkit$/);
  });

  it("names every engine when called with none", () => {
    assert.match(engineInstallCommand(), /cli\.js install chromium firefox webkit$/);
  });
});
