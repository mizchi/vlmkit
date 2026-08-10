/**
 * Lossless WebP encoding for the strip/sheet outputs, via libwebp compiled to
 * WASM (`@jsquash/webp`).
 *
 * Chosen against two alternatives, measured on the real strips this repo writes
 * (`check animation --strip` on `fixtures/css-challenge/dashboard.html`, a
 * 1526x492 sheet, and an uncapped 2-up full-viewport sheet at 2584x736):
 *
 *   encoder                 106.8 KB PNG    165.3 KB PNG   install
 *   @jsquash/webp lossless    24.0 KB         39.3 KB        1.1 MB (pure WASM)
 *   sharp lossless            24.0 KB         38.9 KB         29 MB (libvips 18 MB
 *                                                             + a wasm32 fallback)
 *   mizchi/image (MoonBit)   701.6 KB       1748.1 KB        none (no npm dep)
 *
 * Identical bytes from the two libwebp bindings, 26x apart on install weight, so
 * the WASM one wins. `mizchi/image` 0.4.3 was the appealing option — it would have
 * added no npm dependency at all and fits this repo's MoonBit boundary — but its
 * `encode_webp` emits a valid VP8L stream (verified: decodes to 1526x492 in
 * Chromium) that is **6.6x larger than the PNG it replaces**, i.e. 29x libwebp.
 * It is a correct minimal encoder, not a competitive one.
 *
 * Lossless rather than lossy, and not out of caution: on flat UI screenshots
 * lossless measured *smaller* than quality 90 (24.0 KB against 55.9 KB), because
 * lossy first adds noise it then has to encode. So there is no size-for-fidelity
 * trade to make here — the artifact-free choice is also the small one. `quality`
 * is still exposed for callers with photographic content.
 *
 * An **optional peer**, so `npx vlmkit` stays a PNG-only install and nobody pays
 * 1.1 MB for a format they did not ask for.
 */
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import type { PngData } from "./png-utils.ts";

export const WEBP_ENCODER_PACKAGE = "@jsquash/webp";

export interface WebpEncodeOptions {
  /**
   * Lossy quality 0-100. Omit for lossless, which is both smaller and
   * artifact-free on UI screenshots — see the header.
   */
  quality?: number;
}

/**
 * One sentence naming what is missing and how to get it, in the shape
 * `cli-error.ts` uses for the Playwright diagnoses: the caller asked for webp
 * explicitly, so "not installed" is the whole answer and a stack adds nothing.
 */
export function formatMissingWebpEncoderError(error?: unknown): string {
  const detail = error === undefined ? "" : `\n       (${String((error as Error)?.message ?? error).split("\n")[0]})`;
  return `error: WebP output needs the optional \`${WEBP_ENCODER_PACKAGE}\` package.`
    + `\n       run:  npm install --save-dev ${WEBP_ENCODER_PACKAGE}`
    + `\n       or write a .png instead — PNG needs no extra dependency.${detail}`;
}

export class WebpEncoderMissingError extends Error {
  override readonly name = "WebpEncoderMissingError";
}

/**
 * `@jsquash/webp` locates its `.wasm` with `fetch()`, which Node's undici refuses
 * for a `file://` URL — "not implemented... yet...". So the module is compiled
 * here and handed in through the package's own `init`.
 *
 * Resolved with `createRequire(import.meta.url)` rather than a relative path,
 * for the same reason `cli-error.ts` resolves Playwright that way: this module
 * gets bundled into a hashed chunk in the shipped CLI, and only a package
 * resolution survives that.
 */
let encoderPromise: Promise<(data: ImageData, options?: { quality?: number; lossless?: number }) => Promise<ArrayBuffer>> | null = null;

async function loadEncoder() {
  if (encoderPromise) return encoderPromise;
  encoderPromise = (async () => {
    const require = createRequire(import.meta.url);
    let mod: {
      default: (data: ImageData, options?: { quality?: number; lossless?: number }) => Promise<ArrayBuffer>;
      init: (module: WebAssembly.Module) => Promise<unknown>;
    };
    try {
      mod = await import(`${WEBP_ENCODER_PACKAGE}/encode.js`);
    } catch (error) {
      throw new WebpEncoderMissingError(formatMissingWebpEncoderError(error));
    }
    // SIMD build first; the plain one is the fallback on runtimes without it.
    let wasmPath: string;
    try {
      wasmPath = require.resolve(`${WEBP_ENCODER_PACKAGE}/codec/enc/webp_enc_simd.wasm`);
    } catch {
      wasmPath = require.resolve(`${WEBP_ENCODER_PACKAGE}/codec/enc/webp_enc.wasm`);
    }
    await mod.init(await WebAssembly.compile(await readFile(wasmPath)));
    return mod.default;
  })();
  return encoderPromise;
}

/** Is the optional encoder installed? For a caller that wants to offer the flag. */
export async function webpEncoderAvailable(): Promise<boolean> {
  try {
    await loadEncoder();
    return true;
  } catch {
    return false;
  }
}

export async function encodeWebp(
  image: PngData,
  options: WebpEncodeOptions = {},
): Promise<Uint8Array> {
  const encode = await loadEncoder();
  const buffer = await encode(
    {
      // `Uint8ClampedArray` over the same bytes, not a copy: libwebp wants
      // ImageData and a 2584x736 sheet is 7.6 MB of RGBA.
      data: new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.byteLength),
      width: image.width,
      height: image.height,
      colorSpace: "srgb",
    } as ImageData,
    options.quality === undefined ? { lossless: 1 } : { quality: options.quality },
  );
  return new Uint8Array(buffer);
}

/**
 * Which format a path asks for. Extension-driven so `--out strip.webp` needs no
 * second flag, and an unknown extension is PNG rather than an error — the caller
 * asked for a file, not for a format quiz.
 */
export function imageFormatForPath(path: string): "png" | "webp" {
  return /\.webp$/i.test(path) ? "webp" : "png";
}
