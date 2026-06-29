import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlanPrompt,
  buildStructuredPlanPrompt,
  buildLocatorInventoryFromObservations,
  createPlan,
  createPlanWithRetry,
  createStructuredPlan,
  createStructuredPlanWithRetry,
  normalizePlanMarkdown,
  parseStructuredPlan,
  renderStructuredPlanMarkdown,
  resolvePlannerModelOptions,
  structuredPlanToLocatorInventory,
  validatePlanMarkdown,
  validateStructuredPlan,
} from "./index.ts";

describe("buildPlanPrompt", () => {
  it("includes request, seed, PRD, observations, and planning rules", () => {
    const prompt = buildPlanPrompt({
      title: "Checkout",
      request: "Plan guest checkout coverage.",
      seed: { path: "tests/seed.spec.ts", source: "test('seed', async () => {})" },
      prd: "Guest users can buy one item.",
      observations: [{
        url: "http://localhost:4173/checkout",
        roles: ['button "Pay now"', 'textbox "Email"'],
        labels: ["Email"],
        testIds: ["cart-total"],
        notes: ["Payment is mocked."],
      }],
      constraints: ["Use two screenshots for VRT scenarios."],
    });

    assert.match(prompt, /Plan guest checkout coverage/);
    assert.match(prompt, /Seed test: tests\/seed\.spec\.ts/);
    assert.match(prompt, /Guest users can buy one item/);
    assert.match(prompt, /button "Pay now"/);
    assert.match(prompt, /cart-total/);
    assert.match(prompt, /Prefer role, label, and test id locators/);
  });

  it("explicitly states when no seed test is available", () => {
    const prompt = buildPlanPrompt({
      title: "Login",
      request: "Plan login coverage.",
    });

    assert.match(prompt, /Seed test: not provided/);
    assert.match(prompt, /Do not invent seed tests/);
  });

  it("adds scope guidance to keep smoke plans focused", () => {
    const prompt = buildPlanPrompt({
      title: "Login",
      request: "Plan login coverage.",
      scope: "smoke",
    });

    assert.match(prompt, /Scope: smoke/);
    assert.match(prompt, /Plan exactly one primary end-to-end scenario/);
  });
});

describe("structured plan contract", () => {
  const structured = {
    title: "Checkout",
    applicationOverview: "Guest checkout.",
    scenarios: [{
      title: "Checkout succeeds",
      seed: "tests/seed.spec.ts",
      steps: ["Open checkout.", "Pay."],
      expectedResults: ["Confirmation is visible."],
      vrt: { startState: "empty cart", goalState: "confirmation" },
    }],
    generationNotes: ["Use role locators."],
    locatorInventory: {
      roles: ['button "Pay now"'],
      labels: ["Email"],
      testIds: ["cart-count"],
    },
  };

  it("builds a JSON-only structured plan prompt", () => {
    const prompt = buildStructuredPlanPrompt({
      title: "Checkout",
      request: "Plan checkout.",
      scope: "focused",
    });

    assert.match(prompt, /Return only JSON/);
    assert.match(prompt, /"scenarios"/);
    assert.match(prompt, /Scope: focused/);
  });

  it("parses fenced structured plan JSON", () => {
    assert.deepEqual(
      parseStructuredPlan(`\`\`\`json\n${JSON.stringify(structured)}\n\`\`\``, "Fallback"),
      structured,
    );
  });

  it("parses a structured plan JSON block with surrounding prose", () => {
    assert.deepEqual(
      parseStructuredPlan(`Here is the plan:\n\n\`\`\`json\n${JSON.stringify(structured)}\n\`\`\`\n`, "Fallback"),
      structured,
    );
  });

  it("renders structured plans to the Markdown plan contract", () => {
    const markdown = renderStructuredPlanMarkdown(structured);
    assert.match(markdown, /# Checkout/);
    assert.match(markdown, /\*\*Seed:\*\* tests\/seed\.spec\.ts/);
    assert.match(markdown, /Start state: empty cart/);
    assert.match(markdown, /button "Pay now"/);
  });

  it("validates seed and required scenario fields", () => {
    const diagnostics = validateStructuredPlan({
      title: "Checkout",
      applicationOverview: "",
      scenarios: [{ title: "x", steps: [], expectedResults: [] }],
      generationNotes: [],
    }, { seed: { path: "tests/seed.spec.ts" } });

    assert.ok(diagnostics.includes("missing Application Overview"));
    assert.ok(diagnostics.includes("scenario 1 missing steps"));
    assert.ok(diagnostics.includes("scenario 1 missing expected results"));
    assert.ok(diagnostics.includes("scenario 1 missing Seed reference"));
    assert.ok(diagnostics.includes("missing Generation Notes"));
  });

  it("rejects too many scenarios for smoke scope", () => {
    const diagnostics = validateStructuredPlan({
      title: "Checkout",
      applicationOverview: "Checkout.",
      scenarios: [
        { title: "first", steps: ["Open checkout."], expectedResults: ["Checkout is visible."] },
        { title: "second", steps: ["Open cart."], expectedResults: ["Cart is visible."] },
      ],
      generationNotes: ["Use observed locators."],
    }, { scope: "smoke" });

    assert.ok(diagnostics.includes("scope smoke allows at most 1 scenario"));
  });

  it("rejects locator inventory entries that were not observed", () => {
    const diagnostics = validateStructuredPlan({
      title: "Checkout",
      applicationOverview: "Checkout.",
      scenarios: [{ title: "x", steps: ["Open checkout."], expectedResults: ["Checkout is visible."] }],
      generationNotes: ["Use observed locators."],
      locatorInventory: {
        roles: ['button "Pay now"', 'button "Delete account"'],
        labels: ["Email", "Coupon"],
        testIds: ["cart-count", "admin-panel"],
        texts: ["Order confirmed", "Admin"],
      },
    }, {
      observations: [{
        roles: ['button "Pay now"'],
        labels: ["Email"],
        testIds: ["cart-count"],
        texts: ["Order confirmed"],
      }],
    });

    assert.ok(diagnostics.includes('locatorInventory.roles contains unobserved locator: button "Delete account"'));
    assert.ok(diagnostics.includes('locatorInventory.labels contains unobserved locator: Coupon'));
    assert.ok(diagnostics.includes('locatorInventory.testIds contains unobserved locator: admin-panel'));
    assert.ok(diagnostics.includes('locatorInventory.texts contains unobserved locator: Admin'));
  });

  it("accepts equivalent role inventory quote styles", () => {
    const diagnostics = validateStructuredPlan({
      title: "Checkout",
      applicationOverview: "Checkout.",
      scenarios: [{ title: "x", steps: ["Open checkout."], expectedResults: ["Checkout is visible."] }],
      generationNotes: ["Use observed locators."],
      locatorInventory: {
        roles: ["button 'Pay now'", "heading 'Checkout'"],
      },
    }, {
      observations: [{
        roles: ['button "Pay now"', 'heading "Checkout"'],
      }],
    });

    assert.deepEqual(diagnostics, []);
  });

  it("rejects locator inventory when no UI observations were supplied", () => {
    const diagnostics = validateStructuredPlan({
      title: "Checkout",
      applicationOverview: "Checkout.",
      scenarios: [{ title: "x", steps: ["Open checkout."], expectedResults: ["Checkout is visible."] }],
      generationNotes: ["Use observed locators."],
      locatorInventory: { labels: ["Email"] },
    });

    assert.ok(diagnostics.includes("unexpected locatorInventory without observed UI"));
  });

  it("rejects retry diagnostic leakage in a structured plan", () => {
    const diagnostics = validateStructuredPlan({
      title: "Checkout",
      applicationOverview: "Checkout.",
      scenarios: [{ title: "x", steps: ["Open checkout."], expectedResults: ["Checkout is visible."] }],
      generationNotes: ["Previous structured plan diagnostics revealed a missing locatorInventory."],
    });

    assert.ok(diagnostics.includes("plan leaks retry diagnostics"));
  });

  it("builds locator inventory directly from observations", () => {
    assert.deepEqual(buildLocatorInventoryFromObservations([{
      roles: ['button "Pay now"', 'button "Pay now"', "role=heading[name='Checkout']"],
      labels: ["Email"],
      testIds: ["cart-count"],
      texts: ["Order confirmed"],
    }]), {
      roles: ['button "Pay now"', 'heading "Checkout"'],
      labels: ["Email"],
      testIds: ["cart-count"],
      texts: ["Order confirmed"],
    });
  });

  it("canonicalizes structured locator inventory before rendering and exporting", async () => {
    const result = await createStructuredPlan(
      {
        title: "Checkout",
        request: "Plan checkout.",
        observations: [{
          roles: ['button "Pay now"', 'heading "Checkout"', 'textbox "Email"'],
          labels: ["Email"],
        }],
      },
      undefined,
      {
        complete: async () => ({
          content: JSON.stringify({
            title: "Checkout",
            applicationOverview: "Guest checkout.",
            scenarios: [{
              title: "Checkout succeeds",
              steps: ["Open checkout."],
              expectedResults: ["Checkout is visible."],
            }],
            generationNotes: ["Use observed locators."],
            locatorInventory: {
              roles: ["button 'Pay now'", "role=heading[name='Checkout']", "textbox: Email", "button 'Pay now'"],
              labels: ["Email", "Email"],
            },
          }),
        }),
      },
    );

    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.plan?.locatorInventory, {
      roles: ['button "Pay now"', 'heading "Checkout"', 'textbox "Email"'],
      labels: ["Email"],
    });
    assert.match(result.markdown, /- Roles: button "Pay now", heading "Checkout", textbox "Email"/);
    assert.deepEqual(structuredPlanToLocatorInventory(result.plan!), result.plan?.locatorInventory);
  });

  it("fills missing locator inventory from observed UI facts", async () => {
    const result = await createStructuredPlan(
      {
        title: "Checkout",
        request: "Plan checkout.",
        observations: [{
          roles: ['button "Pay now"'],
          labels: ["Email"],
          testIds: ["cart-count"],
          texts: ["Order confirmed"],
        }],
      },
      undefined,
      {
        complete: async () => ({
          content: JSON.stringify({
            title: "Checkout",
            applicationOverview: "Guest checkout.",
            scenarios: [{
              title: "Checkout succeeds",
              steps: ["Open checkout.", "Pay."],
              expectedResults: ["Confirmation is visible."],
            }],
            generationNotes: ["Use observed locators."],
          }),
        }),
      },
    );

    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.plan?.locatorInventory, {
      roles: ['button "Pay now"'],
      labels: ["Email"],
      testIds: ["cart-count"],
      texts: ["Order confirmed"],
    });
    assert.match(result.markdown, /## Locator Inventory/);
    assert.deepEqual(
      structuredPlanToLocatorInventory(result.plan!, [{
        roles: ['button "Pay now"'],
      }]),
      result.plan?.locatorInventory,
    );
  });

  it("creates a structured plan and rendered markdown with an injected model", async () => {
    const result = await createStructuredPlan(
      {
        title: "Checkout",
        request: "Plan checkout.",
        seed: { path: "tests/seed.spec.ts" },
        observations: [{
          roles: ['button "Pay now"'],
          labels: ["Email"],
          testIds: ["cart-count"],
        }],
      },
      undefined,
      {
        complete: async () => ({
          content: JSON.stringify(structured),
          costUsd: 0.01,
          provider: "test",
          model: "planner",
        }),
      },
    );

    assert.deepEqual(result.plan, structured);
    assert.deepEqual(result.diagnostics, []);
    assert.match(result.markdown, /# Checkout/);
    assert.equal(result.costUsd, 0.01);
  });

  it("converts structured locator inventory for generator validation", () => {
    assert.deepEqual(structuredPlanToLocatorInventory(structured), structured.locatorInventory);
  });

  it("retries structured plans with diagnostics until the contract validates", async () => {
    const prompts: string[] = [];
    const result = await createStructuredPlanWithRetry(
      {
        title: "Checkout",
        request: "Plan checkout.",
        seed: { path: "tests/seed.spec.ts" },
        observations: [{
          roles: ['button "Pay now"'],
          labels: ["Email"],
          testIds: ["cart-count"],
        }],
      },
      undefined,
      {
        complete: async (prompt) => {
          prompts.push(prompt);
          if (prompts.length === 1) return { content: "{ not json" };
          return { content: JSON.stringify(structured) };
        },
      },
      { maxAttempts: 2 },
    );

    assert.equal(result.attempts, 2);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.plan, structured);
    assert.match(prompts[1]!, /Previous structured plan diagnostics/);
  });

  it("returns the last invalid structured result after the attempt budget", async () => {
    const result = await createStructuredPlanWithRetry(
      { title: "Checkout", request: "Plan checkout." },
      undefined,
      {
        complete: async () => ({
          content: JSON.stringify({
            title: "Checkout",
            applicationOverview: "",
            scenarios: [],
            generationNotes: [],
          }),
        }),
      },
      { maxAttempts: 2 },
    );

    assert.equal(result.attempts, 2);
    assert.ok(result.diagnostics.includes("missing Application Overview"));
    assert.equal(result.plan?.title, "Checkout");
  });
});

describe("normalizePlanMarkdown", () => {
  it("strips markdown fences and adds a title when missing", () => {
    assert.equal(
      normalizePlanMarkdown("```markdown\n## Test Scenarios\n...\n```", "Checkout"),
      "# Checkout\n\n## Test Scenarios\n...\n",
    );
  });
});

describe("validatePlanMarkdown", () => {
  it("accepts a complete planner artifact", () => {
    const diagnostics = validatePlanMarkdown(`# Checkout

## Application Overview
Guest checkout.

## Test Scenarios

### 1. Guest checkout succeeds
**Seed:** tests/seed.spec.ts

**Steps**
1. Open checkout.

**Expected Results**
- Confirmation is visible.

## Generation Notes
Use role locators.
`, { seed: { path: "tests/seed.spec.ts" } });

    assert.deepEqual(diagnostics, []);
  });

  it("reports an underspecified plan", () => {
    const diagnostics = validatePlanMarkdown("# Checkout\n", {
      seed: { path: "tests/seed.spec.ts" },
    });

    assert.ok(diagnostics.includes("missing Application Overview section"));
    assert.ok(diagnostics.includes("missing Test Scenarios section"));
    assert.ok(diagnostics.includes("missing numbered scenario heading"));
    assert.ok(diagnostics.includes("missing Seed reference"));
    assert.ok(diagnostics.includes("missing Generation Notes section"));
  });

  it("rejects markdown plans with too many scenarios for smoke scope", () => {
    const diagnostics = validatePlanMarkdown(`# Checkout

## Application Overview
Guest checkout.

## Test Scenarios

### 1. Checkout succeeds

### 2. Cart updates

## Generation Notes
Use role locators.
`, { scope: "smoke" });

    assert.ok(diagnostics.includes("scope smoke allows at most 1 scenario"));
  });

  it("rejects invented seed references when no seed was provided", () => {
    const diagnostics = validatePlanMarkdown(`# Checkout

## Application Overview
Guest checkout.

## Test Scenarios

### 1. Guest checkout succeeds
**Seed:** tests/invented.seed.spec.ts

## Generation Notes
Use role locators.
`);

    assert.ok(diagnostics.includes("unexpected Seed reference"));
  });
});

describe("createPlan", () => {
  it("uses an injected model and normalizes the markdown", async () => {
    let sawPrompt = "";
    const result = await createPlan(
      { title: "Checkout", request: "Plan checkout." },
      undefined,
      {
        complete: async (prompt) => {
          sawPrompt = prompt;
          return { content: "## Test Scenarios\n...", costUsd: 0.01, provider: "test", model: "planner" };
        },
      },
    );

    assert.match(sawPrompt, /Plan checkout/);
    assert.equal(result.markdown, "# Checkout\n\n## Test Scenarios\n...\n");
    assert.ok(result.diagnostics.includes("missing Application Overview section"));
    assert.equal(result.costUsd, 0.01);
    assert.equal(result.model, "planner");
  });
});

describe("createPlanWithRetry", () => {
  it("retries with diagnostics until the plan validates", async () => {
    const prompts: string[] = [];
    const result = await createPlanWithRetry(
      { title: "Checkout", request: "Plan checkout." },
      undefined,
      {
        complete: async (prompt) => {
          prompts.push(prompt);
          if (prompts.length === 1) {
            return { content: "# Checkout\n" };
          }
          return {
            content: `# Checkout

## Application Overview
Guest checkout.

## Test Scenarios

### 1. Checkout succeeds

**Steps**
1. Open checkout.

**Expected Results**
- Confirmation is visible.

## Generation Notes
Use role locators.
`,
          };
        },
      },
      { maxAttempts: 2 },
    );

    assert.equal(result.attempts, 2);
    assert.deepEqual(result.diagnostics, []);
    assert.match(prompts[1]!, /Previous plan diagnostics/);
    assert.match(prompts[1]!, /missing Application Overview section/);
  });

  it("returns the last invalid result after the attempt budget", async () => {
    const result = await createPlanWithRetry(
      { title: "Checkout", request: "Plan checkout." },
      undefined,
      { complete: async () => ({ content: "# Checkout\n" }) },
      { maxAttempts: 2 },
    );

    assert.equal(result.attempts, 2);
    assert.ok(result.diagnostics.includes("missing Test Scenarios section"));
  });
});

describe("resolvePlannerModelOptions", () => {
  it("uses VRT_LLM_PROVIDER before API-key based defaults", () => {
    assert.deepEqual(resolvePlannerModelOptions(undefined, {
      VRT_LLM_PROVIDER: "openrouter",
      ANTHROPIC_API_KEY: "anthropic-key",
      OPENROUTER_API_KEY: "openrouter-key",
    }), {
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      maxTokens: 2048,
    });
  });

  it("prefers Anthropic when no provider is explicit but an Anthropic key exists", () => {
    assert.deepEqual(resolvePlannerModelOptions(undefined, {
      ANTHROPIC_API_KEY: "anthropic-key",
      OPENROUTER_API_KEY: "openrouter-key",
    }), {
      provider: "anthropic",
      maxTokens: 2048,
    });
  });

  it("preserves an explicit model for any provider", () => {
    assert.deepEqual(resolvePlannerModelOptions({ provider: "anthropic", model: "claude-test", maxTokens: 1234 }, {
      VRT_LLM_PROVIDER: "openrouter",
    }), {
      provider: "anthropic",
      model: "claude-test",
      maxTokens: 1234,
    });
  });

  it("falls back to OpenRouter when no environment gives a provider", () => {
    assert.deepEqual(resolvePlannerModelOptions(undefined, {}), {
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      maxTokens: 2048,
    });
  });
});
