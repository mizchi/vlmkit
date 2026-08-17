import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { composeFilmstrip } from "./filmstrip.ts";
import type { PngData } from "./png-utils.ts";
import {
  WEBP_ENCODER_PACKAGE,
  encodeWebp,
  formatMissingWebpEncoderError,
  imageFormatForPath,
  webpEncoderAvailable,
} from "./webp.ts";

function solid(width: number, height: number, rgb: [number, number, number]): PngData {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe("imageFormatForPath", () => {
  it("lets the extension pick the format, case-insensitively", () => {
    assert.equal(imageFormatForPath("strip.webp"), "webp");
    assert.equal(imageFormatForPath("out/STRIP.WebP"), "webp");
    assert.equal(imageFormatForPath("strip.png"), "png");
  });

  it("falls back to PNG rather than erroring on an unfamiliar extension", () => {
    // The caller asked for a file, not for a format quiz — and PNG is the format
    // that needs no optional dependency.
    assert.equal(imageFormatForPath("strip"), "png");
    assert.equal(imageFormatForPath("strip.jpg"), "png");
    // `.webp` must be the extension, not merely present in the path.
    assert.equal(imageFormatForPath("webp/strip.png"), "png");
  });
});

describe("formatMissingWebpEncoderError", () => {
  it("names the package, the install command, and the way out", () => {
    const text = formatMissingWebpEncoderError();
    assert.match(text, /optional `@jsquash\/webp` package/);
    assert.match(text, /npm install --save-dev @jsquash\/webp/);
    // The escape hatch matters: the caller does not have to install anything to
    // get a sheet, only to get a smaller one.
    assert.match(text, /write a \.png instead/);
    assert.doesNotMatch(text, /\n\s*\(/, "no cause line when none was given");
  });

  it("appends the underlying reason's first line when there is one", () => {
    const text = formatMissingWebpEncoderError(new Error("Cannot find package '@jsquash/webp'\n    at ..."));
    assert.match(text, /\(Cannot find package '@jsquash\/webp'\)/);
    assert.doesNotMatch(text, /\s+at \.\.\./, "the stack is dropped");
  });
});

describe("encodeWebp (real libwebp)", () => {
  it("is installed in this workspace", async () => {
    // It is an optional peer, so a red result here means the dev install, not the
    // contract — but the encode assertions below cannot run without it.
    assert.equal(await webpEncoderAvailable(), true, `${WEBP_ENCODER_PACKAGE} should be a devDependency here`);
  });

  it("emits a valid lossless VP8L file", async () => {
    const out = await encodeWebp(solid(64, 32, [20, 90, 200]));
    const header = Buffer.from(out.subarray(0, 16));
    assert.equal(header.subarray(0, 4).toString(), "RIFF");
    assert.equal(header.subarray(8, 12).toString(), "WEBP");
    // VP8L is the lossless chunk. `VP8 ` (with the trailing space) would mean the
    // lossless request silently became lossy.
    assert.equal(header.subarray(12, 16).toString(), "VP8L");
  });

  it("takes the lossy path only when a quality is given", async () => {
    const image = solid(64, 32, [20, 90, 200]);
    const lossy = await encodeWebp(image, { quality: 60 });
    assert.equal(Buffer.from(lossy.subarray(12, 16)).toString(), "VP8 ");
  });

  it("beats PNG on the shape this exists for, losslessly", async () => {
    // A strip is many near-identical UI cells — large flat regions, which is
    // exactly what lossless WebP is good at. Measured on the real 1526x492 sheet:
    // 106.8 KB PNG -> 24.0 KB WebP. This asserts the direction on a synthetic
    // stand-in so the test needs no fixture, and asserts it losslessly, because
    // lossy measured *larger* than lossless on this content (55.9 KB at q90).
    const { encodePng } = await import("./png-utils.ts");
    const { mkdtemp, readFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const cells = Array.from({ length: 6 }, (_, i) => solid(200, 120, [20 + i * 6, 90, 200]));
    const sheet = composeFilmstrip(cells, { columns: 3 });
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-webp-"));
    const pngPath = join(dir, "sheet.png");
    await encodePng(pngPath, sheet);
    const png = await readFile(pngPath);
    const webp = await encodeWebp(sheet);
    assert.ok(
      webp.byteLength < png.byteLength,
      `lossless webp (${webp.byteLength}) should be smaller than png (${png.byteLength})`,
    );
  });
});
