import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCraterSmokeArgs,
  runCraterBidiSmoke,
  type CraterSmokeClient,
} from "./crater-smoke.ts";

class FakeCraterClient implements CraterSmokeClient {
  closed = false;
  calls: string[] = [];

  async connect(): Promise<void> {
    this.calls.push("connect");
  }

  async close(): Promise<void> {
    this.closed = true;
    this.calls.push("close");
  }

  async setViewport(width: number, height: number): Promise<void> {
    this.calls.push(`setViewport:${width}x${height}`);
  }

  async setContent(_html: string): Promise<void> {
    this.calls.push("setContent");
  }

  async capturePng(): Promise<{ png: Buffer; width: number; height: number }> {
    this.calls.push("capturePng");
    return { png: Buffer.from([1, 2, 3]), width: 320, height: 180 };
  }

  async capturePaintTree(): Promise<unknown> {
    this.calls.push("capturePaintTree");
    return { tag: "body", x: 0, y: 0, w: 320, h: 180 };
  }

  async captureComputedStyles(): Promise<Map<string, Record<string, string>>> {
    this.calls.push("captureComputedStyles");
    return new Map([["body", { display: "block" }]]);
  }

  async getResponsiveBreakpoints(): Promise<{ breakpoints: unknown[] }> {
    this.calls.push("getResponsiveBreakpoints");
    return { breakpoints: [] };
  }

  async getRequiredTestViewports(): Promise<{ viewports: Array<{ width: number; reason: string }> }> {
    this.calls.push("getRequiredTestViewports");
    return { viewports: [{ width: 700, reason: "media-query" }] };
  }

  async getCssRuleViewportMap(): Promise<{ rules: unknown[] }> {
    this.calls.push("getCssRuleViewportMap");
    return { rules: [{ selector: "main", properties: ["max-width"], mediaCondition: "(min-width: 700px)", activeAtWidths: [800], inactiveAtWidths: [320] }] };
  }

  async getComputedStylesWithState(
    selector: string,
    forcedStates: string[],
    _properties: string[],
  ): Promise<{ normal: Record<string, string>; forced: Record<string, string>; diff: Array<{ property: string; normal: string; forced: string }> }> {
    this.calls.push(`getComputedStylesWithState:${selector}:${forcedStates.join("+")}`);
    return {
      normal: { "background-color": "rgb(37, 99, 235)" },
      forced: { "background-color": "rgb(29, 78, 216)" },
      diff: [{ property: "background-color", normal: "rgb(37, 99, 235)", forced: "rgb(29, 78, 216)" }],
    };
  }

  async batchRender(
    _baseHtml: string,
    _viewport: { width: number; height: number },
    variants: Array<{ id: string; mutations: Array<{ selector: string; property: string }> }>,
  ): Promise<{ results: Array<{ id: string; paintTree?: unknown }> }> {
    this.calls.push(`batchRender:${variants.map((v) => v.id).join(",")}`);
    return { results: variants.map((v) => ({ id: v.id, paintTree: {} })) };
  }
}

describe("parseCraterSmokeArgs", () => {
  it("uses the resolved crater BiDi URL unless --url overrides it", () => {
    assert.equal(
      parseCraterSmokeArgs([], {
        VLMKIT_CRATER_BIDI_URL: " ws://127.0.0.1:9222/session/from-env ",
      }).url,
      "ws://127.0.0.1:9222/session/from-env",
    );
    assert.equal(
      parseCraterSmokeArgs([
        "--url",
        "ws://127.0.0.1:9333/session/explicit",
      ], {
        VLMKIT_CRATER_BIDI_URL: "ws://127.0.0.1:9222/session/from-env",
      }).url,
      "ws://127.0.0.1:9333/session/explicit",
    );
  });
});

describe("runCraterBidiSmoke", () => {
  it("skips when crater is unavailable and not required", async () => {
    const result = await runCraterBidiSmoke({
      isAvailable: async () => false,
      requireAvailable: false,
    });

    assert.equal(result.status, "skip");
    assert.match(result.checks[0]?.message ?? "", /not available/);
  });

  it("fails when crater is unavailable and required", async () => {
    const result = await runCraterBidiSmoke({
      isAvailable: async () => false,
      requireAvailable: true,
    });

    assert.equal(result.status, "fail");
  });

  it("runs the expected BiDi smoke operations", async () => {
    const client = new FakeCraterClient();
    const result = await runCraterBidiSmoke({
      isAvailable: async () => true,
      createClient: () => client,
      viewport: { width: 320, height: 180 },
    });

    assert.equal(result.status, "pass");
    assert.equal(client.closed, true);
    assert.deepEqual(client.calls, [
      "connect",
      "setViewport:320x180",
      "setContent",
      "capturePng",
      "capturePaintTree",
      "captureComputedStyles",
      "getResponsiveBreakpoints",
      "getRequiredTestViewports",
      "getCssRuleViewportMap",
      "getComputedStylesWithState:button:hover",
      "close",
    ]);
    const checkNames = result.checks.map((c) => c.name);
    assert.ok(checkNames.includes("required-test-viewports"));
    assert.ok(checkNames.includes("css-rule-viewport-map"));
    assert.ok(checkNames.includes("computed-styles-with-state"));
    assert.ok(!checkNames.includes("batch-render"), "batch-render should be gated on --deep");
  });

  it("exercises batchRender when --deep is set", async () => {
    const client = new FakeCraterClient();
    const result = await runCraterBidiSmoke({
      isAvailable: async () => true,
      createClient: () => client,
      viewport: { width: 320, height: 180 },
      deep: true,
    });

    assert.equal(result.status, "pass");
    assert.ok(
      client.calls.some((call) => call.startsWith("batchRender:")),
      "batchRender should be called in deep mode",
    );
    const checkNames = result.checks.map((c) => c.name);
    assert.ok(checkNames.includes("batch-render"));
  });

  it("parses --deep flag", () => {
    assert.equal(parseCraterSmokeArgs(["--deep"]).deep, true);
    assert.equal(parseCraterSmokeArgs([]).deep, false);
  });
});
