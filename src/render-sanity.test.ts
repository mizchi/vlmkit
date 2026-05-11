import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateRenderSanity,
  probeSourceHtml,
  type RenderProbe,
} from "./render-sanity.ts";

function probe(over: Partial<RenderProbe> = {}): RenderProbe {
  return {
    bodyFontFamily: "ui-sans-serif, system-ui, sans-serif",
    styleSheetCount: 2,
    hasClassAttributes: true,
    declaredExternalScripts: false,
    declaredExternalStylesheets: false,
    ...over,
  };
}

describe("evaluateRenderSanity", () => {
  it("returns ok with no warnings when everything looks fine", () => {
    const r = evaluateRenderSanity({ failedRequests: [], probe: probe() });
    assert.equal(r.ok, true);
    assert.equal(r.warnings.length, 0);
  });

  it("flags failed CDN load that drives Tailwind-style breakage", () => {
    const r = evaluateRenderSanity({
      failedRequests: [
        { url: "https://cdn.tailwindcss.com/", errorText: "net::ERR_CERT_AUTHORITY_INVALID" },
      ],
      probe: probe({
        bodyFontFamily: "Times New Roman",
        styleSheetCount: 1,
        hasClassAttributes: true,
        declaredExternalScripts: true,
      }),
    });

    assert.equal(r.ok, false);
    const codes = r.warnings.map((w) => w.code);
    assert.ok(codes.includes("failed-resource-load"), `got ${codes}`);
    assert.ok(codes.includes("default-font-with-classes"), `got ${codes}`);
  });

  it("ignores non-critical failed requests (favicon, analytics pixels)", () => {
    const r = evaluateRenderSanity({
      failedRequests: [
        { url: "http://example.com/favicon.ico", errorText: "net::ERR_NOT_FOUND" },
        { url: "http://example.com/analytics.png", errorText: "net::ERR_BLOCKED" },
      ],
      probe: probe(),
    });

    assert.equal(r.ok, true);
    assert.equal(r.warnings.length, 0);
  });

  it("flags external stylesheet declared but no stylesheets attached", () => {
    const r = evaluateRenderSanity({
      failedRequests: [],
      probe: probe({
        styleSheetCount: 0,
        hasClassAttributes: true,
        declaredExternalStylesheets: true,
      }),
    });

    const codes = r.warnings.map((w) => w.code);
    assert.ok(codes.includes("external-asset-declared-but-missing"));
  });

  it("flags inline <style> stripped scenario", () => {
    const r = evaluateRenderSanity({
      failedRequests: [],
      probe: probe({
        bodyFontFamily: "serif",
        styleSheetCount: 0,
        hasClassAttributes: true,
        declaredExternalScripts: false,
        declaredExternalStylesheets: false,
      }),
    });

    const codes = r.warnings.map((w) => w.code);
    assert.ok(codes.includes("no-styles-but-classes"));
  });

  it("does not flag default font when there are no class attributes (e.g. minimal demo pages)", () => {
    const r = evaluateRenderSanity({
      failedRequests: [],
      probe: probe({
        bodyFontFamily: "Times New Roman",
        hasClassAttributes: false,
        declaredExternalScripts: true,
      }),
    });
    assert.equal(r.warnings.length, 0);
  });
});

describe("probeSourceHtml", () => {
  it("detects external script tags", () => {
    assert.deepEqual(
      probeSourceHtml('<html><head><script src="https://cdn.tailwindcss.com"></script></head></html>'),
      { declaredExternalScripts: true, declaredExternalStylesheets: false },
    );
  });

  it("detects external stylesheet links (both attribute orders)", () => {
    assert.equal(
      probeSourceHtml('<link rel="stylesheet" href="x.css">').declaredExternalStylesheets,
      true,
    );
    assert.equal(
      probeSourceHtml('<link href="x.css" rel="stylesheet">').declaredExternalStylesheets,
      true,
    );
  });

  it("does not match inline <style> blocks", () => {
    assert.deepEqual(
      probeSourceHtml("<html><head><style>body{color:red}</style></head></html>"),
      { declaredExternalScripts: false, declaredExternalStylesheets: false },
    );
  });
});
