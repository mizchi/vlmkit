import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { PNG } from "pngjs";
import {
  askJev,
  buildJevForm,
  checkPngForJev,
  JevApiError,
  jevBoxToPixels,
  jevImageProblem,
  pngImage,
  pngSize,
} from "./jev-client.ts";

const png = (width: number, height: number) => new Uint8Array(PNG.sync.write(new PNG({ width, height })));

describe("jev-client", () => {
  it("checks the API's image limits locally", () => {
    assert.equal(jevImageProblem(1280, 800), null);
    assert.match(jevImageProblem(279, 800)!, />= 280px/);
    assert.match(jevImageProblem(1569, 800)!, /<= 1568px/);
    assert.equal(jevImageProblem(1568, 1568), null);
    assert.deepEqual(pngSize(png(300, 420)), { width: 300, height: 420 });
    assert.equal(checkPngForJev(png(300, 420)), null);
    assert.match(checkPngForJev(png(100, 420))!, /280/);
    assert.equal(checkPngForJev(new Uint8Array(30)), "not a PNG");
  });

  it("converts box fractions to pixels of the image asked about", () => {
    assert.deepEqual(jevBoxToPixels({ left: 0.25, right: 0.5, top: 0.1, bottom: 0.2 }, 1280, 800), {
      x1: 320,
      y1: 80,
      x2: 640,
      y2: 160,
    });
  });

  it("sends a request part, then one file part per asset referenced by key", async () => {
    const form = buildJevForm({
      state: { a: "IMG_A", b: "IMG_B" },
      assets: { IMG_A: pngImage(png(300, 300)), IMG_B: pngImage(png(300, 300)) },
      questions: { where: { type: "box", instructions: "the button in `a`" } },
    });
    const keys = [...form.keys()];
    assert.deepEqual(keys, ["request", "a0", "a1"]);
    const body = JSON.parse(await (form.get("request") as Blob).text());
    assert.equal(body.model, "jev-1.14.0");
    assert.deepEqual(body.assets, { IMG_A: { type: "image", part: "a0" }, IMG_B: { type: "image", part: "a1" } });
    assert.equal((form.get("a0") as Blob).type, "image/png");
  });

  it("sets the image header for images and box, retries 429, and prices input tokens", async () => {
    const seen: Headers[] = [];
    let calls = 0;
    const fake: typeof fetch = async (_url, init) => {
      seen.push(new Headers(init!.headers));
      if (calls++ === 0) return new Response("slow down", { status: 429, headers: { "retry-after": "0.01" } });
      return Response.json({
        model: "jev-1.14.0",
        answers: { where: { type: "box", box: { top: 0, bottom: 1, left: 0, right: 1 }, confidence: 0.5 } },
        usage: { input_tokens: 1_000_000, output_tokens: 9 },
      });
    };
    const r = await askJev(
      { state: "x", questions: { where: { type: "box", instructions: "y" } } },
      { apiKey: "k", fetch: fake },
    );
    assert.equal(calls, 2);
    assert.equal(seen[1]!.get("TypeSafe-Danger-Zone-Images"), "true");
    assert.equal(seen[1]!.get("Authorization"), "Bearer k");
    assert.equal(r.answers.where.confidence, 0.5);
    assert.ok(Math.abs(r.costUsd - 0.042) < 1e-12);
  });

  it("leaves the image header off a text-only request, and surfaces a 400 with its body", async () => {
    let header: string | null = "unset";
    const fake: typeof fetch = async (_url, init) => {
      header = new Headers(init!.headers).get("TypeSafe-Danger-Zone-Images");
      return new Response('{"error":"bad"}', { status: 400 });
    };
    await assert.rejects(
      askJev({ state: "x", questions: { q: { type: "noul", instructions: "y" } } }, { apiKey: "k", fetch: fake }),
      (e: unknown) => e instanceof JevApiError && e.status === 400 && e.body.includes("bad"),
    );
    assert.equal(header, null);
  });
});
