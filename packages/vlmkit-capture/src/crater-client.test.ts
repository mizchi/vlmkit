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
