import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { clampBox, fitToBudget, toViewBox, viewBoxToOriginal, zoomSize } from "./zoom-geometry.ts";
import { cropImage, decodeImage, encodePngImage, prepareZoomSource, resample, zoomInto, type RgbaImage } from "./zoom-image.ts";
import { parseZoomRequests, runZoomLoop, zoomCallFromArgs, type DriverTurn, type VisionChatDriver, type ZoomTurn } from "./zoom-loop.ts";
import { anthropicDriver, geminiDriver, openAiCompatibleDriver } from "./zoom-drivers.ts";

/** A white image with a 1px black vertical rule at `ruleX` and a red block in a corner. */
function canvas(width: number, height: number, ruleX = -1): RgbaImage {
  const data = new Uint8Array(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (x === ruleX) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
      if (x >= width - 10 && y >= height - 10) { data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; }
    }
  }
  return { width, height, data };
}
const png = (img: RgbaImage) => encodePngImage(img);

describe("zoom geometry", () => {
  const budget = { maxEdge: 1000, maxPixels: 500_000 };

  it("leaves an image that fits alone and shrinks one that does not, keeping the aspect", () => {
    assert.deepEqual(fitToBudget({ width: 800, height: 600 }, budget), { width: 800, height: 600 });
    assert.deepEqual(fitToBudget({ width: 3000, height: 1000 }, budget), { width: 1000, height: 333 });
    const byArea = fitToBudget({ width: 1000, height: 1000 }, budget);
    assert.ok(byArea.width * byArea.height <= 500_000 && byArea.width === byArea.height);
  });

  it("magnifies a small crop to fill the budget", () => {
    assert.deepEqual(zoomSize({ width: 60, height: 20 }, budget), { width: 1000, height: 333 });
  });

  it("clamps a box past the edge and refuses one with no area", () => {
    assert.deepEqual(clampBox({ x1: -5, y1: 10, x2: 1600, y2: 40 }, { width: 1000, height: 500 }), { ok: true, box: { x1: 0, y1: 10, x2: 1000, y2: 40 } });
    assert.equal(clampBox({ x1: 50, y1: 10, x2: 50, y2: 40 }, { width: 1000, height: 500 }).ok, false);
    assert.equal(clampBox({ x1: 1200, y1: 10, x2: 1300, y2: 40 }, { width: 1000, height: 500 }).ok, false);
  });

  it("maps a view box onto the original, rounding outward", () => {
    assert.deepEqual(viewBoxToOriginal({ x1: 10, y1: 10, x2: 11, y2: 11 }, { width: 1000, height: 333 }, { width: 3000, height: 1000 }), { x1: 30, y1: 30, x2: 33, y2: 34 });
  });

  it("reads normalized coordinates against the view", () => {
    assert.deepEqual(toViewBox({ x1: 0, y1: 500, x2: 250, y2: 1000 }, { width: 800, height: 400 }, "normalized"), { x1: 0, y1: 200, x2: 200, y2: 400 });
  });
});

describe("zoom image", () => {
  it("flattens transparency onto white and refuses what is not PNG", () => {
    const transparent = { width: 2, height: 1, data: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]) };
    const decoded = decodeImage(encodePngImage(transparent));
    assert.deepEqual([...decoded.data.slice(0, 4)], [255, 255, 255, 255]);
    assert.deepEqual([...decoded.data.slice(4, 8)], [0, 0, 0, 255]);
    assert.throws(() => decodeImage(Buffer.from("\xff\xd8\xff\xe0 jpeg")), /PNG images only/);
  });

  it("keeps a 1px rule visible when shrinking (area average, not point sampling)", () => {
    const view = resample(canvas(3000, 100, 1501), { width: 1000, height: 33 });
    const row = [...Array(1000).keys()].map((x) => view.data[(10 * 1000 + x) * 4]!);
    assert.ok(Math.min(...row) < 200, `the rule survives as a darker column (min ${Math.min(...row)})`);
  });

  it("zooms from the original, not from the view", () => {
    const source = prepareZoomSource(png(canvas(3000, 1000, 1501)), { maxEdge: 1000, maxPixels: 1e9 });
    assert.deepEqual([source.view.width, source.view.height], [1000, 333]);
    const out = zoomInto(source, { x1: 495, y1: 100, x2: 505, y2: 110 }, { maxEdge: 1000, maxPixels: 1e9 });
    assert.ok(out.ok);
    assert.deepEqual(out.originalBox, { x1: 1485, y1: 300, x2: 1515, y2: 331 });
    const zoomed = decodeImage(out.png);
    // The 1px rule at x=1501 is column 16 of the 30px crop: magnified ~32x it is a dark band, not a grey smear.
    const col = Math.round(((1501 - 1485 + 0.5) / 30) * zoomed.width);
    assert.ok(zoomed.data[(Math.floor(zoomed.height / 2) * zoomed.width + col) * 4]! < 30);
    assert.match(out.text, /a 30x31px region of the original, returned magnified to/);
  });

  it("crops exactly", () => {
    const c = cropImage(canvas(20, 20), { x1: 10, y1: 10, x2: 20, y2: 20 });
    assert.deepEqual([...c.data.slice((9 * 10 + 9) * 4, (9 * 10 + 9) * 4 + 3)], [255, 0, 0]);
  });
});

describe("text protocol", () => {
  it("reads ZOOM lines and nothing else", () => {
    const calls = parseZoomRequests("Let me look closer.\nZOOM 0 10 20 110 60\n  zoom 1 0 0 5.5 9\nZOOM 0 1 2 3", 3);
    assert.deepEqual(calls.map((c) => [c.imageIndex, c.box]), [[0, { x1: 10, y1: 20, x2: 110, y2: 60 }], [1, { x1: 0, y1: 0, x2: 5.5, y2: 9 }]]);
    assert.equal(calls[0]!.id, "text-3-0");
  });

  it("parses native arguments given as JSON text or objects, and says what is wrong", () => {
    assert.deepEqual(zoomCallFromArgs("a", '{"x1":1,"y1":2,"x2":3,"y2":4,"image_index":1}'), { id: "a", imageIndex: 1, box: { x1: 1, y1: 2, x2: 3, y2: 4 } });
    assert.deepEqual(zoomCallFromArgs("b", { x1: "1", y1: 2, x2: 3, y2: 4 }), { id: "b", imageIndex: 0, box: { x1: 1, y1: 2, x2: 3, y2: 4 } });
    assert.ok("error" in zoomCallFromArgs("c", "{nope"));
    assert.ok("error" in zoomCallFromArgs("d", { x1: 1 }));
  });
});

/** A driver that replays scripted turns and records what it was shown. */
function scripted(nativeTools: boolean, turns: DriverTurn[]): VisionChatDriver & { seen: ZoomTurn[][]; offered: boolean[] } {
  const seen: ZoomTurn[][] = [];
  const offered: boolean[] = [];
  return {
    model: "fake",
    nativeTools,
    seen,
    offered,
    async turn(transcript, { tool }) {
      seen.push([...transcript]);
      offered.push(tool !== undefined);
      return turns.shift() ?? { text: "out of script", calls: [] };
    },
  };
}

describe("runZoomLoop", () => {
  const image = png(canvas(3000, 1000, 1501));

  it("answers a native zoom with the magnified crop and returns the final answer", async () => {
    const driver = scripted(true, [
      { text: "", calls: [{ id: "c1", imageIndex: 0, box: { x1: 700, y1: 50, x2: 800, y2: 100 } }], usage: { promptTokens: 10, completionTokens: 2 } },
      { text: "The rule is at the centre.", calls: [], usage: { promptTokens: 20, completionTokens: 5 } },
    ]);
    const result = await runZoomLoop(driver, [{ png: image }], "Where is the rule?");
    assert.equal(result.answer, "The rule is at the centre.");
    assert.equal(result.zooms.length, 1);
    assert.deepEqual(result.usage, { promptTokens: 30, completionTokens: 7 });
    const intro = driver.seen[0]![0]!;
    assert.equal(intro.role, "user");
    assert.match(JSON.stringify(intro), /Image 0 \(1568x522 pixels\)/, "the model is told the size of what it sees");
    const toolTurn = driver.seen[1]!.find((t) => t.role === "tool")!;
    assert.ok(toolTurn.role === "tool" && toolTurn.native && toolTurn.results[0]!.parts.some((p) => p.type === "image"));
  });

  it("runs the text protocol for a model without function calling", async () => {
    const driver = scripted(false, [
      { text: "ZOOM 0 700 50 800 100", calls: [] },
      { text: "Centre.", calls: [] },
    ]);
    const result = await runZoomLoop(driver, [{ png: image }], "Where?");
    assert.equal(result.protocol, "text");
    assert.equal(result.zooms.length, 1);
    assert.equal(result.answer, "Centre.");
    assert.match(JSON.stringify(driver.seen[0]![0]), /ZOOM <image> <x1> <y1> <x2> <y2>/);
    assert.deepEqual(driver.offered, [false, false], "no native tool is offered on the text protocol");
  });

  it("tells the model about a bad box instead of throwing, and keeps going", async () => {
    const driver = scripted(true, [
      { text: "", calls: [{ id: "c1", imageIndex: 3, box: { x1: 0, y1: 0, x2: 10, y2: 10 } }, { id: "c2", imageIndex: 0, box: { x1: 50, y1: 50, x2: 50, y2: 90 } }] },
      { text: "ok", calls: [] },
    ]);
    const result = await runZoomLoop(driver, [{ png: image }], "?");
    assert.equal(result.rejected.length, 2);
    const results = driver.seen[1]!.find((t) => t.role === "tool");
    assert.ok(results?.role === "tool" && results.results.every((r) => r.isError));
  });

  it("wraps up when the zoom budget is spent: no tool on the last turn", async () => {
    const zoom = (id: string): DriverTurn => ({ text: "", calls: [{ id, imageIndex: 0, box: { x1: 0, y1: 0, x2: 100, y2: 100 } }] });
    const driver = scripted(true, [zoom("a"), zoom("b"), { text: "final", calls: [] }]);
    const result = await runZoomLoop(driver, [{ png: image }], "?", { maxZooms: 2 });
    assert.equal(result.wrappedUp, true);
    assert.equal(result.answer, "final");
    assert.deepEqual(driver.offered, [true, true, false]);
    assert.match(JSON.stringify(driver.seen[2]!.at(-1)), /used your zoom budget/);
  });

  it("labels several images and zooms into the one asked for", async () => {
    const driver = scripted(true, [
      { text: "", calls: [{ id: "c", imageIndex: 1, box: { x1: 0, y1: 0, x2: 100, y2: 100 } }] },
      { text: "done", calls: [] },
    ]);
    const result = await runZoomLoop(driver, [{ png: image, label: "Baseline" }, { png: png(canvas(400, 300)), label: "Current" }], "Diff?");
    assert.equal(result.zooms[0]!.imageIndex, 1);
    assert.match(JSON.stringify(driver.seen[0]![0]), /Current — Image 1 \(400x300 pixels\)/);
  });
});

/** A fetch that records requests and answers from a script. */
function mockFetch(responses: unknown[]) {
  const requests: { url: string; headers: Record<string, string>; body: any }[] = [];
  const f = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return { ok: true, json: async () => responses.shift(), text: async () => "" } as unknown as Response;
  }) as unknown as typeof fetch;
  return { f, requests };
}

describe("drivers: the same loop on three wire formats", () => {
  const image = png(canvas(1200, 400, 600));

  it("OpenAI-compatible: tools as functions, results as a tool message plus a user image", async () => {
    const { f, requests } = mockFetch([
      { choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "zoom", arguments: '{"x1":550,"y1":100,"x2":650,"y2":200}' } }] } }], usage: { prompt_tokens: 5, completion_tokens: 1 } },
      { choices: [{ finish_reason: "stop", message: { content: "A thin rule." } }], usage: { prompt_tokens: 9, completion_tokens: 3 } },
    ]);
    const result = await runZoomLoop(openAiCompatibleDriver({ model: "qwen/qwen3-vl", apiKey: "k", fetch: f }), [{ png: image }], "What is at the centre?");
    assert.equal(result.answer, "A thin rule.");
    assert.equal(requests[0]!.headers.Authorization, "Bearer k");
    assert.equal(requests[0]!.body.tools[0].function.name, "zoom");
    const msgs = requests[1]!.body.messages;
    assert.deepEqual(msgs.map((m: { role: string }) => m.role), ["user", "assistant", "tool", "user"]);
    assert.equal(msgs[1].tool_calls[0].id, "call_1", "the assistant's call is replayed verbatim");
    assert.equal(typeof msgs[2].content, "string", "tool messages carry text only");
    assert.equal(msgs[3].content[1].type, "image_url");
  });

  it("Anthropic: tool_use in, tool_result with an image block out", async () => {
    const { f, requests } = mockFetch([
      { stop_reason: "tool_use", content: [{ type: "text", text: "Looking closer." }, { type: "tool_use", id: "tu_1", name: "zoom", input: { x1: 550, y1: 100, x2: 650, y2: 200 } }], usage: { input_tokens: 5, output_tokens: 2 } },
      { stop_reason: "end_turn", content: [{ type: "text", text: "A rule." }], usage: { input_tokens: 9, output_tokens: 2 } },
    ]);
    const result = await runZoomLoop(anthropicDriver({ model: "claude-haiku-4-5", apiKey: "k", fetch: f }), [{ png: image }], "?");
    assert.equal(result.answer, "A rule.");
    assert.equal(requests[0]!.url, "https://api.anthropic.com/v1/messages");
    assert.equal(requests[0]!.body.tools[0].input_schema.type, "object");
    const msgs = requests[1]!.body.messages;
    assert.deepEqual(msgs.map((m: { role: string }) => m.role), ["user", "assistant", "user"]);
    const toolResult = msgs[2].content[0];
    assert.equal(toolResult.type, "tool_result");
    assert.equal(toolResult.tool_use_id, "tu_1");
    assert.deepEqual(toolResult.content.map((b: { type: string }) => b.type), ["text", "image"]);
  });

  it("Gemini: functionCall in, functionResponse plus an inline image out", async () => {
    const { f, requests } = mockFetch([
      { candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "zoom", args: { x1: 550, y1: 100, x2: 650, y2: 200 } } }] } }] },
      { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "A rule." }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } },
    ]);
    const result = await runZoomLoop(geminiDriver({ model: "gemini-2.5-flash", apiKey: "k", fetch: f }), [{ png: image }], "?");
    assert.equal(result.answer, "A rule.");
    assert.match(requests[0]!.url, /models\/gemini-2\.5-flash:generateContent$/);
    assert.equal(requests[0]!.body.tools[0].functionDeclarations[0].parameters.additionalProperties, undefined);
    const last = requests[1]!.body.contents.at(-1);
    assert.ok(last.parts[0].functionResponse);
    assert.ok(last.parts[1].inlineData);
  });

  it("answers a call whose arguments do not parse, so the next request is still valid", async () => {
    const { f, requests } = mockFetch([
      { choices: [{ message: { content: null, tool_calls: [{ id: "bad", type: "function", function: { name: "zoom", arguments: "{oops" } }] } }] },
      { choices: [{ message: { content: "fine" } }] },
    ]);
    const result = await runZoomLoop(openAiCompatibleDriver({ model: "m", fetch: f }), [{ png: image }], "?");
    assert.equal(result.rejected[0]!.reason, "arguments are not valid JSON");
    assert.equal(requests[1]!.body.messages[2].tool_call_id, "bad");
  });
});

describe("analyzeWithZoom: model ids the rest of the package already takes", () => {
  it("routes claude: / gemini: / OpenRouter ids to their driver and names a missing key", async () => {
    const { createZoomDriver } = await import("./zoom.ts");
    const model = (id: string) => ({ id, name: id, promptCostPer1k: 0, completionCostPer1k: 0, contextLength: 0, modality: "" });
    assert.equal(createZoomDriver(model("claude:claude-haiku-4-5-20251001"), { apiKey: "k" }).model, "claude-haiku-4-5-20251001");
    assert.equal(createZoomDriver(model("gemini:gemini-2.5-flash"), { apiKey: "k" }).model, "gemini-2.5-flash");
    assert.equal(createZoomDriver(model("qwen/qwen3-vl-30b-a3b-instruct"), { apiKey: "k", nativeTools: false }).nativeTools, false);
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      assert.throws(() => createZoomDriver(model("qwen/qwen3-vl")), /OPENROUTER_API_KEY is required/);
    } finally {
      if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
    }
  });

  it("returns a VlmResponse-shaped answer with the zooms and the cost", async () => {
    const { analyzeWithZoom } = await import("./zoom.ts");
    const { f } = mockFetch([
      { choices: [{ message: { content: null, tool_calls: [{ id: "c", type: "function", function: { name: "zoom", arguments: '{"x1":0,"y1":0,"x2":50,"y2":50}' } }] } }], usage: { prompt_tokens: 1000, completion_tokens: 10 } },
      { choices: [{ message: { content: "red block" } }], usage: { prompt_tokens: 2000, completion_tokens: 20 } },
    ]);
    const original = globalThis.fetch;
    globalThis.fetch = f;
    try {
      const res = await analyzeWithZoom(
        { id: "vendor/model", name: "m", promptCostPer1k: 0.001, completionCostPer1k: 0.002, contextLength: 0, modality: "" },
        [{ png: png(canvas(200, 200)) }],
        "What is in the corner?",
        { apiKey: "k" },
      );
      assert.equal(res.content, "red block");
      assert.equal(res.zoom.zooms.length, 1);
      assert.equal(res.totalTokens, 3030);
      assert.ok(Math.abs(res.costUsd - (3 * 0.001 + 0.03 * 0.002)) < 1e-9);
    } finally {
      globalThis.fetch = original;
    }
  });
});
