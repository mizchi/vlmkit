import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  framesFromPaths,
  renderFlipbookHtml,
  writeFlipbook,
} from "./flipbook.ts";

// 1x1 transparent PNG
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=",
  "base64",
);

async function makePng(dir: string, name: string): Promise<string> {
  const p = join(dir, name);
  await writeFile(p, PNG_BYTES);
  return p;
}

describe("renderFlipbookHtml", () => {
  it("embeds frames as JSON and shows the title", () => {
    const html = renderFlipbookHtml(
      [{ dataUrl: "data:image/png;base64,xxxxxx", label: "round 0", sublabel: "31.06%" }],
      { title: "demo flipbook" },
    );
    assert.match(html, /<title>demo flipbook<\/title>/);
    assert.match(html, /"label":"round 0"/);
    assert.match(html, /"sublabel":"31.06%"/);
    assert.match(html, /demo flipbook<\/h1>/);
  });

  it("respects custom delayMs/autoplay/loop options", () => {
    const html = renderFlipbookHtml(
      [{ dataUrl: "data:image/png;base64,a", label: "f1" }],
      { title: "t", delayMs: 1500, autoplay: false, loop: false },
    );
    assert.match(html, /delayMs: 1500/);
    assert.match(html, /autoplay: false/);
    assert.match(html, /loop: false/);
  });

  it("escapes title HTML to prevent injection", () => {
    const html = renderFlipbookHtml(
      [{ dataUrl: "data:image/png;base64,a", label: "f1" }],
      { title: "<script>alert(1)</script>" },
    );
    assert.match(html, /&lt;script&gt;/);
    // Page <script> tag must still be present for the player itself.
    assert.match(html, /const frames =/);
    assert.doesNotMatch(html, /<title><script>/);
  });
});

describe("writeFlipbook", () => {
  it("writes a self-contained HTML file with embedded base64 frames", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-flipbook-"));
    try {
      const p1 = await makePng(dir, "frame1.png");
      const p2 = await makePng(dir, "frame2.png");
      const out = join(dir, "out.html");
      const result = await writeFlipbook(out, framesFromPaths([p1, p2], ["a", "b"]), {
        title: "two frames",
      });
      assert.equal(result.frameCount, 2);
      assert.ok(result.bytes > 1000);
      const html = await readFile(out, "utf-8");
      assert.match(html, /two frames/);
      // both frames embedded
      assert.equal((html.match(/data:image\/png;base64,/g) || []).length, 2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws on empty frame list", async () => {
    await assert.rejects(
      () => writeFlipbook("/tmp/never.html", [], { title: "x" }),
      /zero frames/,
    );
  });
});

describe("framesFromPaths", () => {
  it("derives label from basename when not provided", () => {
    const frames = framesFromPaths(["/a/round-0.png", "/a/round-1.png"]);
    assert.deepEqual(frames.map((f) => f.label), ["round-0", "round-1"]);
  });

  it("honors explicit labels", () => {
    const frames = framesFromPaths(["/a/round-0.png"], ["start"]);
    assert.equal(frames[0]!.label, "start");
  });
});
