import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
}

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
      "close",
    ]);
  });
});
