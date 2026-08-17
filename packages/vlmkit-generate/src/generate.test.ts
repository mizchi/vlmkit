import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  buildGeneratePrompt,
  extractTypescriptSource,
  generatePlaywrightTest,
  generatePlaywrightTestWithRetry,
  resolveGeneratorModelOptions,
  validateGeneratedTestSource,
} from "./index.ts";

const validSource = `import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("checkout", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole("button", { name: "Pay now" })).toBeVisible();
  await expect(page).toHaveScreenshot("01-start.png");
});
`;

describe("buildGeneratePrompt", () => {
  it("includes the plan, rules, helper import, and output contract", () => {
    const prompt = buildGeneratePrompt({
      planMarkdown: "# Checkout\n\n## Test Scenarios\n...",
      testFilePath: "tests/checkout.spec.ts",
      rulesMarkdown: "Use role locators.",
      helperImportPath: "./_helpers",
      seedTestPath: "tests/seed.spec.ts",
    });

    assert.match(prompt, /Target file: tests\/checkout\.spec\.ts/);
    assert.match(prompt, /Seed test reference: tests\/seed\.spec\.ts/);
    assert.match(prompt, /Use role locators/);
    assert.match(prompt, /Import and use `gotoApp` from `\.\/_helpers`/);
    assert.match(prompt, /Keep comments sparse/);
    assert.match(prompt, /# Checkout/);
  });

  it("includes observed locator inventory when provided", () => {
    const prompt = buildGeneratePrompt({
      planMarkdown: "# Checkout",
      testFilePath: "tests/checkout.spec.ts",
      locatorInventory: {
        roles: ['button "Pay now"'],
        labels: ["Email"],
        testIds: ["cart-count"],
      },
    });

    assert.match(prompt, /Allowed observed locators/);
    assert.match(prompt, /button "Pay now"/);
    assert.match(prompt, /cart-count/);
  });

  it("does not force an extra start snapshot when the rules require one goal baseline", () => {
    const prompt = buildGeneratePrompt({
      planMarkdown: "# Preferences\n\nCapture the persisted dark goal state.",
      testFilePath: "tests/preferences.spec.ts",
      rulesMarkdown: 'Finish with exactly one `toHaveScreenshot("goal.png")` assertion.',
    });

    assert.doesNotMatch(prompt, /checks for the start and goal states/);
    assert.match(prompt, /required by the plan and additional generation rules/);
    assert.match(prompt, /Do not invent extra snapshots/);
  });
});

describe("extractTypescriptSource", () => {
  it("extracts a TypeScript code block", () => {
    assert.equal(extractTypescriptSource(`Here:\n\`\`\`ts\n${validSource}\`\`\``), validSource);
  });

  it("unwraps nested TypeScript code fences returned by chat models", () => {
    assert.equal(
      extractTypescriptSource(`\`\`\`typescript\n\`\`\`ts\n${validSource}\`\`\`\n\`\`\``),
      validSource,
    );
  });
});

describe("validateGeneratedTestSource", () => {
  it("accepts a deterministic generated spec", () => {
    assert.deepEqual(validateGeneratedTestSource(validSource), []);
  });

  it("reports direct page.goto and missing screenshots", () => {
    const diagnostics = validateGeneratedTestSource(`import { test } from "@playwright/test";
test("x", async ({ page }) => { await page.goto("/"); });
`);
    assert.ok(diagnostics.includes("missing gotoApp usage"));
    assert.ok(diagnostics.includes("direct page.goto is not allowed; use gotoApp(page)"));
    assert.ok(diagnostics.includes("missing toHaveScreenshot assertions"));
  });

  it("does not count a gotoApp import as usage", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("x", async ({ page }) => {
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(page).toHaveScreenshot("x.png");
});
`);

    assert.ok(diagnostics.includes("missing gotoApp usage"));
  });

  it("requires expect to be imported and used for assertions", () => {
    const diagnostics = validateGeneratedTestSource(`import { test } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("x", async ({ page }) => {
  await gotoApp(page);
  await page.getByRole("button").click();
  await page.screenshot();
});
`, { requireScreenshots: false });

    assert.ok(diagnostics.includes("missing expect import from @playwright/test"));
    assert.ok(diagnostics.includes("missing expect assertions"));
  });

  it("reports leftover markdown code fences in generated source", () => {
    const diagnostics = validateGeneratedTestSource(`\`\`\`ts
${validSource}\`\`\``);

    assert.ok(diagnostics.includes("source contains markdown code fences"));
  });

  it("reports excessive standalone comments in generated source", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("x", async ({ page }) => {
  // Open the app.
  await gotoApp(page);
  // Find the heading.
  await expect(page.getByRole("heading")).toBeVisible();
  // Capture the screenshot.
  await expect(page).toHaveScreenshot("x.png");
});
`);

    assert.ok(diagnostics.includes("generated source has excessive comments; keep only non-obvious comments"));
  });

  it("allows a small number of non-obvious comments", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("x", async ({ page }) => {
  await gotoApp(page);
  // The status region has no accessible name in Playwright.
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(page).toHaveScreenshot("x.png");
});
`);

    assert.deepEqual(diagnostics, []);
  });

  it("does not treat comments or strings as direct page.goto calls", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("x", async ({ page }) => {
  // Never use page.goto("/") directly.
  const note = "page.goto('/debug') is banned";
  await gotoApp(page);
  await expect(page.getByText(note)).toBeHidden();
  await expect(page).toHaveScreenshot("x.png");
});
`);

    assert.ok(!diagnostics.includes("direct page.goto is not allowed; use gotoApp(page)"));
  });

  it("reports TypeScript syntax errors", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";
test("x", async ({ page }) => {
  await gotoApp(page)
  await expect(page).toHaveScreenshot("x.png")
`);

    assert.ok(diagnostics.some((d) => d.startsWith("typescript syntax error:")));
  });

  it("reports locators that are not in the observed inventory", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("checkout", async ({ page }) => {
  await gotoApp(page);
  await page.getByLabel("Email").fill("guest@example.test");
  await page.getByLabel("Coupon").fill("SAVE");
  await expect(page.getByRole("button", { name: "Pay now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete account" })).toBeHidden();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await expect(page.getByTestId("admin-panel")).toBeHidden();
  await expect(page).toHaveScreenshot("checkout.png");
});
`, {
      locatorInventory: {
        labels: ["Email"],
        roles: ['button "Pay now"'],
        testIds: ["cart-count"],
      },
    });

    assert.ok(diagnostics.includes('unknown label locator: "Coupon"'));
    assert.ok(diagnostics.includes('unknown role locator: button "Delete account"'));
    assert.ok(diagnostics.includes('unknown test id locator: "admin-panel"'));
  });

  it("rejects name filters on status role locators", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("profile", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole("status", { name: "Profile saved" })).toBeVisible();
  await expect(page).toHaveScreenshot("profile.png");
});
`, {
      locatorInventory: {
        roles: ['status "Profile saved"'],
      },
    });

    assert.ok(diagnostics.includes('role "status" should not use a name filter; assert text separately'));
  });

  it("allows nameless status role locators when a status role was observed", () => {
    const diagnostics = validateGeneratedTestSource(`import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

test("profile", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await expect(page).toHaveScreenshot("profile.png");
});
`, {
      locatorInventory: {
        roles: ['status "Profile saved"'],
        texts: ["Profile saved"],
      },
    });

    assert.deepEqual(diagnostics, []);
  });
});

describe("generatePlaywrightTest", () => {
  it("uses an injected model, extracts source, and returns diagnostics", async () => {
    const result = await generatePlaywrightTest(
      { planMarkdown: "# Checkout", testFilePath: "tests/checkout.spec.ts" },
      undefined,
      {
        complete: async () => ({ content: `\`\`\`ts\n${validSource}\`\`\``, costUsd: 0.02, provider: "test", model: "generator" }),
      },
    );

    assert.equal(result.source, validSource);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.costUsd, 0.02);
    assert.equal(result.model, "generator");
  });
});

describe("generatePlaywrightTestWithRetry", () => {
  it("retries with diagnostics until generated source validates", async () => {
    const prompts: string[] = [];
    const result = await generatePlaywrightTestWithRetry(
      { planMarkdown: "# Checkout", testFilePath: "tests/checkout.spec.ts" },
      undefined,
      {
        complete: async (prompt) => {
          prompts.push(prompt);
          if (prompts.length === 1) {
            return {
              content: `\`\`\`ts
import { test } from "@playwright/test";
test("bad", async ({ page }) => { await page.goto("/"); });
\`\`\``,
            };
          }
          return { content: `\`\`\`ts\n${validSource}\`\`\`` };
        },
      },
      { maxAttempts: 2 },
    );

    assert.equal(result.attempts, 2);
    assert.deepEqual(result.diagnostics, []);
    assert.match(prompts[1]!, /Previous generator diagnostics/);
    assert.match(prompts[1]!, /direct page\.goto is not allowed/);
  });

  it("returns the last invalid result after the attempt budget", async () => {
    const result = await generatePlaywrightTestWithRetry(
      { planMarkdown: "# Checkout", testFilePath: "tests/checkout.spec.ts" },
      undefined,
      { complete: async () => ({ content: "test('bad', async () => {});" }) },
      { maxAttempts: 2 },
    );

    assert.equal(result.attempts, 2);
    assert.ok(result.diagnostics.includes("missing @playwright/test import"));
  });
});

describe("resolveGeneratorModelOptions", () => {
  it("uses VLMKIT_LLM_PROVIDER before API-key based defaults", () => {
    assert.deepEqual(resolveGeneratorModelOptions(undefined, {
      VLMKIT_LLM_PROVIDER: "openrouter",
      ANTHROPIC_API_KEY: "anthropic-key",
      OPENROUTER_API_KEY: "openrouter-key",
    }), {
      provider: "openrouter",
      model: "openai/gpt-5-codex",
      maxTokens: 4096,
    });
  });

  it("prefers Anthropic when no provider is explicit but an Anthropic key exists", () => {
    assert.deepEqual(resolveGeneratorModelOptions(undefined, {
      ANTHROPIC_API_KEY: "anthropic-key",
      OPENROUTER_API_KEY: "openrouter-key",
    }), {
      provider: "anthropic",
      maxTokens: 4096,
    });
  });

  it("preserves an explicit model for any provider", () => {
    assert.deepEqual(resolveGeneratorModelOptions({ provider: "anthropic", model: "claude-test", maxTokens: 1234 }, {
      VLMKIT_LLM_PROVIDER: "openrouter",
    }), {
      provider: "anthropic",
      model: "claude-test",
      maxTokens: 1234,
    });
  });

  it("falls back to OpenRouter when no environment gives a provider", () => {
    assert.deepEqual(resolveGeneratorModelOptions(undefined, {}), {
      provider: "openrouter",
      model: "openai/gpt-5-codex",
      maxTokens: 4096,
    });
  });
});
