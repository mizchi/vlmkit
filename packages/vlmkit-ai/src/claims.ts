/**
 * Cheap typed checks on a screenshot: statements a page must or must not make visible ("shows
 * an error message", "shows a modal dialog open over the page"), each answered by Jev as a
 * `noul` (the probability the statement is true), no prose to parse.
 *
 * All claims share one request and one image: Jev reads the image once and each further question
 * costs about 20 tokens, so ten claims on a 1280x800 screenshot are about $0.00014 and 0.2s.
 *
 * Advisory, not a gate. The deterministic gates measure; this asks a model what a person would
 * notice at a glance. Measured 2026-10-17 (`docs/reports/2026-10-17-jev-claims.md`) — read its
 * per-claim false-alarm rates before trusting a claim worded differently.
 */
import { askJev, JEV_DEFAULT_MODEL, JEV_IMAGE_LIMITS, pngImage } from "./jev-client.ts";
import type { JevAnswer, JevClientOptions } from "./jev-client.ts";
import type { JevAsk } from "./locate.ts";
import { firstLookScale } from "./locate.ts";
import { decodeImage, encodePngImage, resample } from "./zoom-image.ts";

export type ClaimExpectation = "shown" | "absent";

export interface Claim {
  /** What the screenshot shows, as a statement: "an error message", "a modal dialog open over the page". */
  statement: string;
  expect: ClaimExpectation;
}

export interface ClaimResult extends Claim {
  /** Jev's probability that the screenshot shows it (0-1). */
  noul: number;
  pass: boolean;
  /** Within `uncertainBand` of the threshold: look at the screenshot before acting on it. */
  uncertain: boolean;
}

export interface ClaimsReport {
  results: ClaimResult[];
  passed: boolean;
  model: string;
  costUsd: number;
  inputTokens: number;
}

export interface ClaimsOptions {
  /** A claim is true at or above this (default 0.5). */
  threshold?: number;
  /** Distance from the threshold under which a result is `uncertain` (default 0.3). */
  uncertainBand?: number;
  model?: string;
  ask?: JevAsk;
  client?: JevClientOptions;
}

/** "an error message" → "`screenshot` shows an error message." A statement already starting with "shows" is kept. */
export function claimInstruction(statement: string): string {
  const s = statement
    .trim()
    .replace(/[.\s]+$/, "")
    .replace(/^(the\s+)?(screenshot|page|screen)\s+/i, "");
  return /^(shows|contains|has|displays)\b/i.test(s) ? `\`screenshot\` ${s}.` : `\`screenshot\` shows ${s}.`;
}

export async function checkClaims(
  png: Uint8Array,
  claims: readonly Claim[],
  options: ClaimsOptions = {},
): Promise<ClaimsReport> {
  if (claims.length === 0) throw new Error("no claims to check");
  const ask: JevAsk = options.ask ?? ((req) => askJev(req, options.client));
  const threshold = options.threshold ?? 0.5;
  const band = options.uncertainBand ?? 0.3;
  const img = decodeImage(Buffer.from(png));
  const scale = firstLookScale(img.width, img.height);
  if (scale === null) {
    throw new Error(
      `${img.width}x${img.height} cannot be shown within Jev's ${JEV_IMAGE_LIMITS.minEdge}-${JEV_IMAGE_LIMITS.maxEdge}px edges`,
    );
  }
  const shown =
    scale === 1
      ? png
      : encodePngImage(resample(img, { width: Math.round(img.width * scale), height: Math.round(img.height * scale) }));
  const questions: Record<string, { type: "noul"; instructions: string }> = {};
  claims.forEach((c, i) => {
    questions[`c${i}`] = { type: "noul", instructions: claimInstruction(c.statement) };
  });
  const r = await ask({
    model: options.model ?? JEV_DEFAULT_MODEL,
    state: { screenshot: "SHOT" },
    assets: { SHOT: pngImage(shown) },
    questions,
  });
  const answers = r.answers as Record<string, JevAnswer>;
  const results = claims.map((c, i): ClaimResult => {
    const noul = (answers[`c${i}`] as Extract<JevAnswer, { type: "noul" }>).noul;
    const pass = c.expect === "shown" ? noul >= threshold : noul < threshold;
    return { ...c, noul, pass, uncertain: Math.abs(noul - threshold) < band };
  });
  return {
    results,
    passed: results.every((x) => x.pass),
    model: r.model,
    costUsd: r.costUsd,
    inputTokens: r.usage.input_tokens,
  };
}
