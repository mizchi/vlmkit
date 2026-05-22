import {
  withOnlyOnFailure,
  type FailureDiagnostic,
  type PlaywrightLikeTestInfo,
} from "./only-on-failure.ts";

type MaybePromise<T> = T | Promise<T>;

export type ToHaveScreenshotName = string | string[];
export type ToHaveScreenshotOptions = Record<string, unknown>;
export type ToHaveScreenshotArgs =
  | []
  | [ToHaveScreenshotOptions]
  | [ToHaveScreenshotName]
  | [ToHaveScreenshotName, ToHaveScreenshotOptions];

export interface ToHaveScreenshotMatcherLike {
  toHaveScreenshot(...args: ToHaveScreenshotArgs): MaybePromise<void>;
}

export type PlaywrightExpectLike = (target: unknown) => ToHaveScreenshotMatcherLike;

export interface ToHaveScreenshotWithDiagnosticsOptions {
  expect: PlaywrightExpectLike;
  target: unknown;
  name?: ToHaveScreenshotName;
  options?: ToHaveScreenshotOptions;
  args?: ToHaveScreenshotArgs;
  testInfo?: PlaywrightLikeTestInfo;
  onFailure: FailureDiagnostic;
}

export function buildToHaveScreenshotArgs(
  options: Pick<ToHaveScreenshotWithDiagnosticsOptions, "args" | "name" | "options">,
): ToHaveScreenshotArgs {
  if (options.args) return options.args;
  if (options.name !== undefined && options.options !== undefined) {
    return [options.name, options.options];
  }
  if (options.name !== undefined) return [options.name];
  if (options.options !== undefined) return [options.options];
  return [];
}

export async function toHaveScreenshotWithDiagnostics(
  options: ToHaveScreenshotWithDiagnosticsOptions,
): Promise<void> {
  const args = buildToHaveScreenshotArgs(options);
  await withOnlyOnFailure(
    () => options.expect(options.target).toHaveScreenshot(...args),
    options.onFailure,
    options.testInfo,
  );
}
