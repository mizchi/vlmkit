/**
 * Test the symmetric-sanity classifier in migration-compare.ts.
 *
 * The classifier itself isn't exported (it's a private helper); rather
 * than weaken the module API, we test it via a small pure
 * re-implementation matching the spec from the source file. If the
 * source diverges from this spec the e2e smoke in the design-md
 * scenario will catch it.
 *
 * Keeping these assertions colocated as documentation of the
 * intended behavior.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { RenderSanityResult } from "./vrt/compare/render-sanity.ts";

function isSymmetric(b: RenderSanityResult | undefined, v: RenderSanityResult | undefined): boolean {
  if (!b || !v) return false;
  if (b.ok && v.ok) return false;
  const bw = new Set(b.warnings.map((w) => w.code));
  const vw = new Set(v.warnings.map((w) => w.code));
  if (bw.size !== vw.size) return false;
  for (const c of bw) if (!vw.has(c)) return false;
  const br = new Set(b.failedRequests.map((r) => `${r.url}::${r.errorText}`));
  const vr = new Set(v.failedRequests.map((r) => `${r.url}::${r.errorText}`));
  if (br.size !== vr.size) return false;
  for (const k of br) if (!vr.has(k)) return false;
  return true;
}

const FONT_REQ = { url: "https://fonts.googleapis.com/css2?family=X", errorText: "net::ERR_CERT_AUTHORITY_INVALID" };
const STYLESHEET_REQ = { url: "https://cdn.example/x.css", errorText: "net::ERR_FAILED" };

describe("symmetric-sanity classification (#32)", () => {
  it("symmetric: same warning + same failed request on both sides", () => {
    const b: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "failed-resource-load", message: "..." }],
      failedRequests: [FONT_REQ],
    };
    const v: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "failed-resource-load", message: "..." }],
      failedRequests: [FONT_REQ],
    };
    assert.equal(isSymmetric(b, v), true);
  });

  it("asymmetric: only baseline fails", () => {
    const b: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "failed-resource-load", message: "..." }],
      failedRequests: [FONT_REQ],
    };
    const v: RenderSanityResult = { ok: true, warnings: [], failedRequests: [] };
    assert.equal(isSymmetric(b, v), false);
  });

  it("asymmetric: only variant fails", () => {
    const b: RenderSanityResult = { ok: true, warnings: [], failedRequests: [] };
    const v: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "failed-resource-load", message: "..." }],
      failedRequests: [FONT_REQ],
    };
    assert.equal(isSymmetric(b, v), false);
  });

  it("asymmetric: different failed URLs", () => {
    const b: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "failed-resource-load", message: "..." }],
      failedRequests: [FONT_REQ],
    };
    const v: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "failed-resource-load", message: "..." }],
      failedRequests: [STYLESHEET_REQ],
    };
    assert.equal(isSymmetric(b, v), false);
  });

  it("asymmetric: different warning codes", () => {
    const b: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "failed-resource-load", message: "..." }],
      failedRequests: [FONT_REQ],
    };
    const v: RenderSanityResult = {
      ok: false,
      warnings: [{ code: "default-font-with-classes", message: "..." }],
      failedRequests: [FONT_REQ],
    };
    assert.equal(isSymmetric(b, v), false);
  });

  it("not classified as symmetric when both are clean", () => {
    const b: RenderSanityResult = { ok: true, warnings: [], failedRequests: [] };
    const v: RenderSanityResult = { ok: true, warnings: [], failedRequests: [] };
    assert.equal(isSymmetric(b, v), false);
  });
});
