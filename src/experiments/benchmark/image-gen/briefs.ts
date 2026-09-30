/**
 * The figure briefs the image-generation bench asks every model for.
 *
 * Each brief makes claims a reader can check by looking — what the enlarged view must contain,
 * which panel shows the move, the exact caption, the direction of the arrows — because the
 * question is whether a generated picture can stand in a document as a figure, not whether it
 * is pretty. `checks` is the rubric a scorer reads; the prompt never mentions it.
 *
 * A saved evaluation records each brief's `briefHash`. Editing a prompt changes the hash and
 * `score.test.ts` fails on the saved evaluation, which is the point: the old verdicts were
 * given to a different question, and a re-run is what answers the new one.
 */
import { createHash } from "node:crypto";

export interface Brief {
  id: string;
  prompt: string;
  aspectRatio: string;
  /** What must hold for `pass`. One failing is `partial`; a figure that asserts something wrong is `fail`. */
  checks: string[];
}

export const BRIEFS: Brief[] = [
  {
    id: "zoom",
    aspectRatio: "16:9",
    prompt:
      "Technical illustration, clean flat style, white background, 16:9. Concept: a vision model inspecting a web page screenshot. Left: a full web page screenshot, small. A rectangle marks one tiny region of it (a line of small text and a green button). On the right, exactly that region is shown enlarged 4x, and two thin lines connect the corners of the small rectangle to the corners of the enlarged view. The enlarged view must contain exactly what is inside the small rectangle, nothing more. Only two labels in the image: 'original' under the left, 'zoom' under the right. No other text.",
    checks: [
      "the enlarged view holds what the marked region holds, and nothing outside it",
      "lines connect the mark to the enlarged view",
      "the only labels are 'original' and 'zoom' (text inside the drawn page is allowed)",
    ],
  },
  {
    id: "vrt",
    aspectRatio: "16:9",
    prompt:
      "Clean technical infographic, flat vector style, white background, 16:9. Three panels left to right, labelled exactly 'baseline', 'current', 'diff'. Baseline and current show the same small web card: a title bar and one blue button. In 'current' the button is shifted a little to the right; everything else is identical. The 'diff' panel shows a faint gray ghost of the card with only the button's old and new positions highlighted in red. Below all panels, one caption, exactly: 'Visual regression: 1 element moved 4px'. No other text.",
    checks: [
      "the button in 'current' is visibly moved relative to 'baseline'",
      "the diff panel marks the old and the new position, and nothing is marked in the other panels",
      "the caption reads exactly 'Visual regression: 1 element moved 4px' and there is no other text",
    ],
  },
  {
    id: "ja",
    aspectRatio: "16:9",
    prompt:
      "Isometric technical illustration, soft flat colors, white background, 16:9. Three isometric blocks in a row from left to right, connected by two arrows pointing left to right. Each block has one label in Japanese, exactly: left 'ブラウザ', middle '判定', right 'レポート'. The left block looks like a browser window, the middle like a gauge or checklist, the right like a document. No other text.",
    checks: [
      "labels are exactly ブラウザ / 判定 / レポート, left to right, and there is no other text",
      "both arrows point left to right",
      "the three blocks read as browser, gauge or checklist, document",
    ],
  },
];

export function briefHash(brief: Brief): string {
  return createHash("sha256").update(`${brief.aspectRatio}\n${brief.prompt}`).digest("hex").slice(0, 12);
}
