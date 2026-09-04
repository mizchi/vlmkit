/**
 * `gifenc` ships no types; the three calls the video encoder uses. It is a
 * CommonJS bundle, so Node's ESM loader exposes it as `default` while a
 * bundler exposes the names — `video.ts` accepts either.
 */
declare module "gifenc" {
  export interface WriteFrameOptions {
    palette?: number[][];
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    /** Frame delay in milliseconds. */
    delay?: number;
    /** -1 once, 0 forever, N times. Read from the first frame. */
    repeat?: number;
    dispose?: number;
  }
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }
  export type QuantizeFormat = "rgb565" | "rgb444" | "rgba4444";
  export interface Gifenc {
    GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
    quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: QuantizeFormat; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }): number[][];
    applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: QuantizeFormat): Uint8Array;
  }
  export const GIFEncoder: Gifenc["GIFEncoder"];
  export const quantize: Gifenc["quantize"];
  export const applyPalette: Gifenc["applyPalette"];
  const gifenc: Gifenc;
  export default gifenc;
}
