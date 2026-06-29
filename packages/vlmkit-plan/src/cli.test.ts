import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePlanCliArgs, runPlanCli } from "./cli.ts";

describe("parsePlanCliArgs", () => {
  it("parses required files and retry/model options", () => {
    const args = parsePlanCliArgs([
      "--title", "Checkout",
      "--request", "Plan checkout.",
      "--out", "specs/checkout.md",
      "--structured-out", "specs/checkout.plan.json",
      "--locator-inventory-out", "specs/checkout.locators.json",
      "--provider", "anthropic",
      "--max-attempts", "3",
      "--constraint", "Use role locators.",
    ]);

    assert.equal(args.title, "Checkout");
    assert.equal(args.request, "Plan checkout.");
    assert.equal(args.out, "specs/checkout.md");
    assert.equal(args.structuredOut, "specs/checkout.plan.json");
    assert.equal(args.locatorInventoryOut, "specs/checkout.locators.json");
    assert.equal(args.provider, "anthropic");
    assert.equal(args.maxAttempts, 3);
    assert.deepEqual(args.constraints, ["Use role locators."]);
  });
});

describe("runPlanCli", () => {
  it("prints help with exit code 0", async () => {
    assert.equal(await runPlanCli(["--help"]), 0);
  });

  it("writes a valid plan to --out", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-plan-cli-"));
    try {
      const out = join(dir, "specs", "checkout.md");
      const code = await runPlanCli([
        "--title", "Checkout",
        "--request", "Plan checkout.",
        "--out", out,
      ], {
        complete: async () => ({
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
        }),
      });

      assert.equal(code, 0);
      assert.match(await readFile(out, "utf8"), /# Checkout/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes structured plan JSON and locator inventory when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-plan-cli-"));
    try {
      const out = join(dir, "specs", "checkout.md");
      const structuredOut = join(dir, "specs", "checkout.plan.json");
      const locatorInventoryOut = join(dir, "specs", "checkout.locators.json");
      const observationPath = join(dir, "specs", "observations.json");
      await mkdir(join(dir, "specs"), { recursive: true });
      await writeFile(observationPath, JSON.stringify([{
        roles: ['button "Pay now"'],
        labels: ["Email"],
        testIds: ["cart-total"],
      }]), "utf8");
      const code = await runPlanCli([
        "--title", "Checkout",
        "--request", "Plan checkout.",
        "--out", out,
        "--observations", observationPath,
        "--structured-out", structuredOut,
        "--locator-inventory-out", locatorInventoryOut,
      ], {
        complete: async () => ({
          content: JSON.stringify({
            title: "Checkout",
            applicationOverview: "Guest checkout.",
            scenarios: [{
              title: "Checkout succeeds",
              steps: ["Open checkout.", "Pay."],
              expectedResults: ["Confirmation is visible."],
            }],
            generationNotes: ["Use role locators."],
            locatorInventory: {
              roles: ['button "Pay now"'],
              labels: ["Email"],
              testIds: ["cart-total"],
            },
          }),
        }),
      });

      assert.equal(code, 0);
      assert.match(await readFile(out, "utf8"), /## Locator Inventory/);
      assert.deepEqual(JSON.parse(await readFile(structuredOut, "utf8")).title, "Checkout");
      assert.deepEqual(JSON.parse(await readFile(locatorInventoryOut, "utf8")), {
        roles: ['button "Pay now"'],
        labels: ["Email"],
        testIds: ["cart-total"],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 2 and does not write when diagnostics remain", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-plan-cli-"));
    try {
      const out = join(dir, "checkout.md");
      const code = await runPlanCli([
        "--title", "Checkout",
        "--request", "Plan checkout.",
        "--out", out,
        "--max-attempts", "1",
      ], {
        complete: async () => ({ content: "# Checkout\n" }),
      });

      assert.equal(code, 2);
      await assert.rejects(() => readFile(out, "utf8"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads request, PRD, observations, and seed source files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-plan-cli-"));
    try {
      const requestPath = join(dir, "request.txt");
      const prdPath = join(dir, "prd.md");
      const observationPath = join(dir, "observations.json");
      const seedPath = join(dir, "seed.spec.ts");
      const out = join(dir, "plan.md");
      await writeFile(requestPath, "Plan login.", "utf8");
      await writeFile(prdPath, "Users sign in with email.", "utf8");
      await writeFile(observationPath, JSON.stringify([{ roles: ["button: Sign in"] }]), "utf8");
      await writeFile(seedPath, "test('seed', async () => {});\n", "utf8");

      let prompt = "";
      const code = await runPlanCli([
        "--title", "Login",
        "--request-file", requestPath,
        "--prd", prdPath,
        "--observations", observationPath,
        "--seed", seedPath,
        "--seed-source", seedPath,
        "--out", out,
      ], {
        complete: async (p) => {
          prompt = p;
          return {
            content: `# Login

## Application Overview
Login.

## Test Scenarios

### 1. Login succeeds
**Seed:** ${seedPath}

**Steps**
1. Open login.

**Expected Results**
- Dashboard is visible.

## Generation Notes
Use role locators.
`,
          };
        },
      });

      assert.equal(code, 0);
      assert.match(prompt, /Users sign in with email/);
      assert.match(prompt, /button: Sign in/);
      assert.match(prompt, /test\('seed'/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
