/**
 * Deterministic component-kind classification from bbox pixel stats.
 *
 * The pairing gates grew bottom-up (hairline geometry, fill distance)
 * as stopgaps for nonsense pairs like text↔divider. The principled
 * constraint is *kind identity*: a text run, a solid block, and a
 * photo are different things and should not pair. A VLM could name
 * kinds semantically ("button", "nav"), but every measured attempt to
 * make a VLM assert facts about regions it must locate itself has
 * failed (fabricated deltas, wrong attribution) — whereas kind is
 * computable from the pixels we already have, on both sides, for free.
 *
 * Kinds are coarse on purpose:
 *   - hairline: ≤2px in either dimension (rules, dividers)
 *   - solid:    one quantized color dominates the bbox
 *   - text:     a dominant background plus high-frequency ink runs
 *   - image:    many colors, no dominant background (photos, gradients)
 *   - mixed:    everything else — a wildcard that never gates
 *
 * The classification is used two ways with different bars:
 *   - Kickback labels (always): "[text]" on a missing/extra item stops
 *     the reader from "fixing" a heading by deleting it (S7 leg-5).
 *   - Pairing gate (only when BOTH sides are `confident`): a confident
 *     solid must not pair with a confident text/image. Border cases
 *     are deliberately not confident — a wrong hard gate creates fake
 *     missing/extra pairs, which is worse than an occasional odd pair.
 */

export type ComponentKind = "hairline" | "solid" | "text" | "image" | "mixed";

export interface ComponentKindInfo {
  kind: ComponentKind;
  /** True only well inside the thresholds; gates require it. */
  confident: boolean;
}

/** Quantize an RGB pixel to a 4-bit-per-channel bucket key. */
function bucket(r: number, g: number, b: number): number {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
}

/** Cap sampling around ~40k pixels so huge regions stay cheap. */
function strideFor(width: number, height: number): number {
  return Math.max(1, Math.floor(Math.sqrt((width * height) / 40000)));
}

export function classifyRegion(
  data: Uint8Array,
  imageWidth: number,
  bbox: { top: number; left: number; width: number; height: number },
): ComponentKindInfo {
  if (bbox.width <= 2 || bbox.height <= 2) {
    return { kind: "hairline", confident: true };
  }

  const stride = strideFor(bbox.width, bbox.height);
  const counts = new Map<number, number>();
  let samples = 0;
  let transitions = 0;
  let bigJumps = 0;
  let pairs = 0;
  for (let y = bbox.top; y < bbox.top + bbox.height; y += stride) {
    let prev = -1;
    let pr = 0, pg = 0, pb = 0;
    for (let x = bbox.left; x < bbox.left + bbox.width; x += stride) {
      const o = (y * imageWidth + x) * 4;
      const r = data[o]!, g = data[o + 1]!, b = data[o + 2]!;
      const key = bucket(r, g, b);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      samples++;
      if (prev >= 0) {
        pairs++;
        if (key !== prev) transitions++;
        const jump = Math.max(Math.abs(r - pr), Math.abs(g - pg), Math.abs(b - pb));
        if (jump > 48) bigJumps++;
      }
      prev = key;
      pr = r; pg = g; pb = b;
    }
  }
  if (samples === 0) return { kind: "mixed", confident: false };

  const sorted = [...counts.values()].sort((a, b) => b - a);
  const dominantShare = sorted[0]! / samples;
  const distinctColors = counts.size;
  const transitionDensity = pairs > 0 ? transitions / pairs : 0;
  // The load-bearing discriminator, calibrated on real renders: text is
  // hard ink↔background edges (big-jump density 0.13-0.52 measured on
  // clean AND jpeg-degraded text), while photos/gradients change color
  // in small steps (0-0.005 measured) — a quantized-bucket transition
  // count can NOT separate them (a smooth gradient transitions every
  // few pixels too), the JUMP SIZE can.
  const bigJumpDensity = pairs > 0 ? bigJumps / pairs : 0;

  // A truly solid block transitions only at antialiased borders. The
  // big-jump exclusion keeps a sparse text line inside a roomy bbox
  // (background-dominant but full of hard edges) out of "solid", and
  // the tight confident bar keeps labeled buttons out of the gate's
  // reach.
  if (dominantShare >= 0.85 && bigJumpDensity < 0.08) {
    return { kind: "solid", confident: dominantShare >= 0.92 && transitionDensity < 0.02 };
  }
  if (bigJumpDensity >= 0.08) {
    return { kind: "text", confident: bigJumpDensity >= 0.13 };
  }
  if (dominantShare < 0.5 && distinctColors >= 24) {
    return { kind: "image", confident: dominantShare < 0.4 && distinctColors >= 40 };
  }
  return { kind: "mixed", confident: false };
}

/**
 * Pairing gate: forbid only confident solid↔(text|image) pairs.
 * Hairline identity is enforced geometrically by the caller (both
 * sides classify hairline by the same rule, so it is equivalent).
 */
export function kindsCanPair(a?: ComponentKindInfo, b?: ComponentKindInfo): boolean {
  if (!a || !b || !a.confident || !b.confident) return true;
  if (a.kind === b.kind) return true;
  const pair = new Set([a.kind, b.kind]);
  if (pair.has("solid") && (pair.has("text") || pair.has("image"))) return false;
  return true;
}

export function kindLabel(info?: ComponentKindInfo): string {
  if (!info || info.kind === "mixed") return "";
  return `[${info.kind}]`;
}
