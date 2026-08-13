import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "vitest";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import {
  inlineLocalStylesheets,
  sampleContrastFromImage,
  suggestDeviceScaleFactorForTarget,
} from "./component-from-image.ts";

test("inlineLocalStylesheets inlines relative stylesheet links", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-component-inline-"));
  try {
    const htmlPath = join(dir, "page.html");
    const cssPath = join(dir, "style.css");
    await writeFile(cssPath, "body { background: rgb(1, 2, 3); }\n");
    await writeFile(htmlPath, [
      "<!doctype html>",
      "<html>",
      "<head>",
      '<link rel="stylesheet" href="./style.css">',
      '<link rel="preconnect" href="https://example.com">',
      "</head>",
      "<body>hello</body>",
      "</html>",
    ].join("\n"));

    const html = await inlineLocalStylesheets(await readFile(htmlPath, "utf-8"), htmlPath);

    assert.match(html, /<style data-vlmkit-inline-stylesheet="\.\/style\.css">/);
    assert.match(html, /body \{ background: rgb\(1, 2, 3\); \}/);
    assert.match(html, /<link rel="preconnect" href="https:\/\/example\.com">/);
    assert.doesNotMatch(html, /rel="stylesheet"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inlineLocalStylesheets leaves remote stylesheet links untouched", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-component-inline-"));
  try {
    const htmlPath = join(dir, "page.html");
    const html = [
      "<!doctype html>",
      "<html>",
      "<head>",
      '<link rel="stylesheet" href="https://cdn.example.com/style.css">',
      "</head>",
      "<body>hello</body>",
      "</html>",
    ].join("\n");

    const inlined = await inlineLocalStylesheets(html, htmlPath);
    assert.equal(inlined, html);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("suggestDeviceScaleFactorForTarget detects high-resolution mobile portrait targets", () => {
  assert.deepEqual(suggestDeviceScaleFactorForTarget({ width: 864, height: 1821 }), {
    deviceScaleFactor: 2,
    cssViewport: { width: 432, height: 911 },
    reason: "portrait target 864×1821 looks like a 2x mobile mock",
  });
});

test("suggestDeviceScaleFactorForTarget ignores normal desktop landscape targets", () => {
  assert.equal(suggestDeviceScaleFactorForTarget({ width: 1536, height: 1024 }), undefined);
});

test("sampleContrastFromImage estimates backdrop behind transparent menu text", () => {
  const png = new PNG({ width: 96, height: 48 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = 230;
      png.data[i + 1] = 0;
      png.data[i + 2] = 18;
      png.data[i + 3] = 255;
    }
  }
  for (let y = 15; y < 33; y++) {
    for (let x = 24; x < 72; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = 255;
    }
  }

  const result = sampleContrastFromImage(png, {
    bbox: { x: 0, y: 0, width: 96, height: 48 },
    color: [255, 255, 255],
  });

  assert.deepEqual(result.background, [232, 0, 16]);
  assert.ok((result.contrastRatio ?? 0) >= 4.5);
});
