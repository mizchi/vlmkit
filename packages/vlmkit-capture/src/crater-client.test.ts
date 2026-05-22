import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CraterClient,
  DEFAULT_BIDI_URL,
  resolveCraterBidiUrl,
} from "./crater-client.ts";

describe("resolveCraterBidiUrl", () => {
  it("prefers explicit environment URLs", () => {
    assert.equal(
      resolveCraterBidiUrl({
        env: { VLMKIT_CRATER_BIDI_URL: " ws://127.0.0.1:9222/session/from-env " },
      }),
      "ws://127.0.0.1:9222/session/from-env",
    );
    assert.equal(
      resolveCraterBidiUrl({
        env: { CRATER_BIDI_URL: "ws://127.0.0.1:9222/session/legacy" },
      }),
      "ws://127.0.0.1:9222/session/legacy",
    );
  });

  it("reads the Crater start-with-font URL file when a root is provided", async () => {
    const dir = await mkdtemp(join(tmpdir(), "crater-bidi-url-"));
    try {
      await writeFile(join(dir, ".bidi-ws-url"), "ws://127.0.0.1:9222/session/from-file\n");
      assert.equal(
        resolveCraterBidiUrl({ craterRoot: dir, env: {} }),
        "ws://127.0.0.1:9222/session/from-file",
      );
      assert.equal(
        resolveCraterBidiUrl({ env: { VLMKIT_CRATER_ROOT: dir } }),
        "ws://127.0.0.1:9222/session/from-file",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls back to the root BiDi URL", () => {
    assert.equal(resolveCraterBidiUrl({ env: {} }), DEFAULT_BIDI_URL);
  });
});

describe("CraterClient.captureComputedStyles", () => {
  it("uses native getAllComputedStyles when connected to crater", async () => {
    const client = new CraterClient("ws://unused");
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];

    (client as unknown as { contextId: string }).contextId = "session-1";
    (client as unknown as {
      sendBidi: (method: string, params: Record<string, unknown>) => Promise<unknown>;
    }).sendBidi = async (method, params) => {
      calls.push({ method, params });
      return {
        id: 1,
        type: "success",
        result: {
          styles: {
            "div#card": { display: "flex" },
          },
        },
      };
    };
    (client as unknown as { evaluate: () => Promise<unknown> }).evaluate = async () => {
      throw new Error("captureComputedStyles should prefer getAllComputedStyles");
    };

    const snapshot = await client.captureComputedStyles(["display"]);

    assert.equal(snapshot.get("div#card")?.display, "flex");
    assert.deepEqual(calls, [
      {
        method: "browsingContext.getAllComputedStyles",
        params: { context: "session-1", properties: ["display"] },
      },
    ]);
  });

  it("parses JSON-serialized snapshots returned by script.evaluate", async () => {
    const client = new CraterClient("ws://unused");
    const evaluateCalls: string[] = [];

    (client as unknown as { evaluate: (expression: string) => Promise<unknown> }).evaluate = async (expression) => {
      evaluateCalls.push(expression);
      return JSON.stringify({
        ".card": { color: "rgb(255, 0, 0)" },
        "#hero::before": { content: '"badge"' },
      });
    };

    const snapshot = await client.captureComputedStyles(["color", "content"]);

    assert.equal(snapshot.get(".card")?.color, "rgb(255, 0, 0)");
    assert.equal(snapshot.get("#hero::before")?.content, '"badge"');
    assert.match(evaluateCalls[0] ?? "", /JSON\.stringify/);
  });

  it("drops crater snapshots when every property is empty", async () => {
    const client = new CraterClient("ws://unused");

    (client as unknown as { evaluate: () => Promise<unknown> }).evaluate = async () => JSON.stringify({
      ".card": { color: "", display: "" },
    });

    const snapshot = await client.captureComputedStyles(["color", "display"]);

    assert.equal(snapshot.size, 0);
  });
});

describe("CraterClient.getComputedStylesWithState", () => {
  it("sends forced state requests to crater v0.18 BiDi", async () => {
    const client = new CraterClient("ws://unused");
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];

    (client as unknown as { contextId: string }).contextId = "session-1";
    (client as unknown as {
      sendBidi: (method: string, params: Record<string, unknown>) => Promise<unknown>;
    }).sendBidi = async (method, params) => {
      calls.push({ method, params });
      return {
        id: 1,
        type: "success",
        result: {
          normal: { "text-decoration": "none" },
          forced: { "text-decoration": "underline" },
          diff: [{ property: "text-decoration", normal: "none", forced: "underline" }],
        },
      };
    };

    const result = await client.getComputedStylesWithState(
      ".file-table .file-name a:hover",
      ["hover"],
      ["text-decoration"],
    );

    assert.deepEqual(result.forced, { "text-decoration": "underline" });
    assert.deepEqual(calls, [
      {
        method: "browsingContext.getComputedStylesWithState",
        params: {
          context: "session-1",
          selector: ".file-table .file-name a:hover",
          forcedStates: ["hover"],
          properties: ["text-decoration"],
        },
      },
    ]);
  });
});

describe("CraterClient.batchRender", () => {
  it("uses crater v0.18 mutation variants and returns paint trees", async () => {
    const client = new CraterClient("ws://unused");
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];

    (client as unknown as { contextId: string }).contextId = "session-1";
    (client as unknown as {
      sendBidi: (method: string, params: Record<string, unknown>) => Promise<unknown>;
    }).sendBidi = async (method, params) => {
      calls.push({ method, params });
      return {
        id: 1,
        type: "success",
        result: {
          results: [
            {
              id: "remove-card-padding",
              paintTree: { x: 0, y: 0, w: 1280, h: 900, tag: "root", ch: [] },
            },
          ],
        },
      };
    };

    const result = await client.batchRender(
      "<!doctype html><style>.card{padding:16px}</style><div class='card'>A</div>",
      { width: 1280, height: 900 },
      [{
        id: "remove-card-padding",
        mutations: [{ selector: ".card", property: "padding", action: "remove" }],
      }],
    );

    assert.equal(result.results[0]?.paintTree?.w, 1280);
    assert.deepEqual(calls, [
      {
        method: "browsingContext.batchRender",
        params: {
          context: "session-1",
          baseHtml: "<!doctype html><style>.card{padding:16px}</style><div class='card'>A</div>",
          viewport: { width: 1280, height: 900 },
          variants: [{
            id: "remove-card-padding",
            mutations: [{ selector: ".card", property: "padding", action: "remove" }],
          }],
        },
      },
    ]);
  });
});
