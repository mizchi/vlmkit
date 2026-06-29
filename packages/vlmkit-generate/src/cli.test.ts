import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseGenerateCliArgs, runGenerateCli } from "./cli.ts";

const validSource = `import { test, expect } from "@playwright/test";
import { gotoApp } from "../support/goto-app";

test("checkout", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole("button", { name: "Pay now" })).toBeVisible();
  await expect(page).toHaveScreenshot("01-start.png");
});
`;

describe("parseGenerateCliArgs", () => {
  it("parses required files and retry/model options", () => {
    const args = parseGenerateCliArgs([
      "--plan", "specs/checkout.md",
      "--out", "tests/checkout.spec.ts",
      "--rules", "specs/rules.md",
      "--helper-import", "../support/goto-app",
      "--locator-inventory", "specs/locators.json",
      "--runtime-gate",
      "--playwright-config", "playwright.e2e.config.ts",
      "--runtime-gate-runs", "2",
      "--provider", "anthropic",
      "--max-attempts", "3",
    ]);

    assert.equal(args.plan, "specs/checkout.md");
    assert.equal(args.out, "tests/checkout.spec.ts");
    assert.equal(args.rules, "specs/rules.md");
    assert.equal(args.helperImportPath, "../support/goto-app");
    assert.equal(args.locatorInventory, "specs/locators.json");
    assert.equal(args.runtimeGate, true);
    assert.equal(args.playwrightConfig, "playwright.e2e.config.ts");
    assert.deepEqual(args.gateCommands, [{
      name: "playwright-runtime",
      command: "pnpm exec playwright test --config playwright.e2e.config.ts {testFile}",
      runs: 2,
    }]);
    assert.equal(args.provider, "anthropic");
    assert.equal(args.maxAttempts, 3);
  });
});

describe("runGenerateCli", () => {
  it("prints help with exit code 0", async () => {
    assert.equal(await runGenerateCli(["--help"]), 0);
  });

  it("writes a valid generated spec to --out", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-generate-cli-"));
    try {
      const plan = join(dir, "specs", "checkout.md");
      const rules = join(dir, "specs", "rules.md");
      const out = join(dir, "tests", "checkout.spec.ts");
      await mkdir(join(dir, "specs"), { recursive: true });
      await writeFile(plan, "# Checkout\n", "utf8");
      await writeFile(rules, "Use role locators.\n", "utf8");

      const code = await runGenerateCli([
        "--plan", plan,
        "--rules", rules,
        "--out", out,
        "--helper-import", "../support/goto-app",
      ], {
        complete: async () => ({ content: `\`\`\`ts\n${validSource}\`\`\`` }),
      });

      assert.equal(code, 0);
      assert.equal(await readFile(out, "utf8"), validSource);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 2 and does not write when diagnostics remain", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-generate-cli-"));
    try {
      const plan = join(dir, "plan.md");
      const out = join(dir, "checkout.spec.ts");
      await writeFile(plan, "# Checkout\n", "utf8");

      const code = await runGenerateCli([
        "--plan", plan,
        "--out", out,
        "--max-attempts", "1",
      ], {
        complete: async () => ({
          content: `\`\`\`ts
import { test } from "@playwright/test";
test("bad", async ({ page }) => { await page.goto("/"); });
\`\`\``,
        }),
      });

      assert.equal(code, 2);
      await assert.rejects(() => readFile(out, "utf8"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
