import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCraterWasmLayoutBackend,
  loadCraterWasmModule,
  normalizeCraterLayoutJson,
} from "./crater-wasm.ts";

const SAMPLE_LAYOUT_JSON = JSON.stringify({
  id: "root",
  x: 0,
  y: 0,
  width: 320,
  height: 180,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  padding: { top: 8, right: 8, bottom: 8, left: 8 },
  border: { top: 1, right: 1, bottom: 1, left: 1 },
  children: [{
    id: "title",
    x: 8,
    y: 8,
    width: 120,
    height: 32,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    border: { top: 0, right: 0, bottom: 0, left: 0 },
    children: [],
  }],
});

describe("Crater WASM layout backend", () => {
  it("renders HTML through the Crater WPT JS export and summarizes layout JSON", async () => {
    const calls: Array<{ html: string; width: number; height: number }> = [];
    const backend = createCraterWasmLayoutBackend({
      renderHtmlToJsonForWpt(html, width, height) {
        calls.push({ html, width, height });
        return SAMPLE_LAYOUT_JSON;
      },
    });

    const result = await backend.renderLayout({
      html: "<main><h1>Hello</h1></main>",
      viewport: { width: 320, height: 180, label: "small" },
    });

    assert.equal(result.backend, "crater-wasm");
    assert.deepEqual(calls, [{
      html: "<main><h1>Hello</h1></main>",
      width: 320,
      height: 180,
    }]);
    assert.equal(result.viewport.label, "small");
    assert.equal(result.layout.id, "root");
    assert.equal(result.layout.children[0]?.id, "title");
    assert.equal(result.diagnostics.nodeCount, 2);
    assert.equal(result.diagnostics.maxDepth, 2);
    assert.equal(result.diagnostics.rootBox.width, 320);
  });

  it("normalizes Crater layout JSON and rejects malformed boxes", () => {
    const layout = normalizeCraterLayoutJson(SAMPLE_LAYOUT_JSON);
    assert.equal(layout.padding.left, 8);

    assert.throws(
      () => normalizeCraterLayoutJson(JSON.stringify({ id: "bad", children: [] })),
      /missing numeric x/,
    );
  });

  it("loads a dynamically imported Crater WPT module", async () => {
    const source = `
      export function renderHtmlToJsonForWpt(html, width, height) {
        return JSON.stringify({
          id: html.includes("main") ? "main-root" : "root",
          x: 0,
          y: 0,
          width,
          height,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { top: 0, right: 0, bottom: 0, left: 0 },
          children: []
        });
      }
    `;
    const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`;
    const module = await loadCraterWasmModule({ modulePath: moduleUrl });

    const backend = createCraterWasmLayoutBackend(module);
    const result = await backend.renderLayout({
      html: "<main></main>",
      viewport: { width: 640, height: 360 },
    });

    assert.equal(result.layout.id, "main-root");
    assert.equal(result.diagnostics.nodeCount, 1);
  });

  it("fails fast when the loaded module does not expose the WPT layout renderer", async () => {
    await assert.rejects(
      () => loadCraterWasmModule({
        modulePath: "data:text/javascript,export const nope = true;",
      }),
      /renderHtmlToJsonForWpt/,
    );
  });
});
