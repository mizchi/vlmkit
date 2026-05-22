type MaybePromise<T> = T | Promise<T>;

export type NlAssertImage = Buffer | Uint8Array | string;

export interface ScreenshotTargetLike {
  screenshot(options?: Record<string, unknown>): MaybePromise<Buffer | Uint8Array>;
}

export interface NlAssertReviewRequest {
  assertion: string;
  image: NlAssertImage;
  metadata?: Record<string, unknown>;
}

export interface NlAssertReviewResult {
  pass: boolean;
  reasoning: string;
  confidence?: number;
  evidence?: string[];
}

export type NlAssertReviewer = (
  request: NlAssertReviewRequest,
) => MaybePromise<NlAssertReviewResult>;

export interface NlAssertOptions {
  assertion: string;
  target?: ScreenshotTargetLike;
  screenshot?: NlAssertImage;
  screenshotOptions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  reviewer: NlAssertReviewer;
}

export class NlAssertError extends Error {
  assertion: string;
  result: NlAssertReviewResult;

  constructor(assertion: string, result: NlAssertReviewResult) {
    super(`nlAssert failed: ${assertion}\n${result.reasoning}`);
    this.name = "NlAssertError";
    this.assertion = assertion;
    this.result = result;
  }
}

export async function captureNlAssertImage(
  options: Pick<NlAssertOptions, "target" | "screenshot" | "screenshotOptions">,
): Promise<NlAssertImage> {
  if (options.screenshot !== undefined) return options.screenshot;
  if (!options.target) {
    throw new Error("nlAssert requires either `screenshot` or a Playwright-like `target` with screenshot()");
  }
  return await options.target.screenshot(options.screenshotOptions);
}

export async function nlAssert(options: NlAssertOptions): Promise<NlAssertReviewResult> {
  const image = await captureNlAssertImage(options);
  const result = await options.reviewer({
    assertion: options.assertion,
    image,
    metadata: options.metadata,
  });
  if (!result.pass) {
    throw new NlAssertError(options.assertion, result);
  }
  return result;
}
