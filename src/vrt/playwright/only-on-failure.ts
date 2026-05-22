type MaybePromise<T> = T | Promise<T>;

export interface PlaywrightLikeTestInfo {
  title?: string;
  status?: string;
  expectedStatus?: string;
  retry?: number;
}

export interface FailureDiagnosticContext {
  error?: unknown;
  testInfo?: PlaywrightLikeTestInfo;
}

export type FailureDiagnostic = (context: FailureDiagnosticContext) => MaybePromise<void>;

export function isUnexpectedPlaywrightStatus(testInfo: PlaywrightLikeTestInfo): boolean {
  const status = testInfo.status;
  if (!status || status === "skipped") return false;
  const expectedStatus = testInfo.expectedStatus ?? "passed";
  return status !== expectedStatus;
}

export async function onlyOnFailure(
  testInfo: PlaywrightLikeTestInfo,
  diagnostic: FailureDiagnostic,
): Promise<boolean> {
  if (!isUnexpectedPlaywrightStatus(testInfo)) return false;
  await diagnostic({ testInfo });
  return true;
}

export async function withOnlyOnFailure<T>(
  run: () => MaybePromise<T>,
  diagnostic: FailureDiagnostic,
  testInfo?: PlaywrightLikeTestInfo,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    try {
      await diagnostic({ error, testInfo });
    } catch (diagnosticError) {
      throw new AggregateError(
        [error, diagnosticError],
        "Test action failed, and the only-on-failure diagnostic also failed",
      );
    }
    throw error;
  }
}
