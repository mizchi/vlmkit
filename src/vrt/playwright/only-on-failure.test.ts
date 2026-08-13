import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  isUnexpectedPlaywrightStatus,
  onlyOnFailure,
  withOnlyOnFailure,
} from "./only-on-failure.ts";

describe("isUnexpectedPlaywrightStatus", () => {
  it("returns true for failed Playwright tests", () => {
    assert.equal(isUnexpectedPlaywrightStatus({ status: "failed", expectedStatus: "passed" }), true);
    assert.equal(isUnexpectedPlaywrightStatus({ status: "timedOut", expectedStatus: "passed" }), true);
  });

  it("returns false for passing, expected-failing, and skipped tests", () => {
    assert.equal(isUnexpectedPlaywrightStatus({ status: "passed", expectedStatus: "passed" }), false);
    assert.equal(isUnexpectedPlaywrightStatus({ status: "failed", expectedStatus: "failed" }), false);
    assert.equal(isUnexpectedPlaywrightStatus({ status: "skipped", expectedStatus: "passed" }), false);
  });
});

describe("onlyOnFailure", () => {
  it("runs diagnostics only when Playwright status is unexpected", async () => {
    const calls: string[] = [];

    assert.equal(
      await onlyOnFailure({ title: "ok", status: "passed", expectedStatus: "passed" }, () => {
        calls.push("ok");
      }),
      false,
    );
    assert.equal(
      await onlyOnFailure({ title: "bad", status: "failed", expectedStatus: "passed" }, ({ testInfo }) => {
        calls.push(testInfo?.title ?? "");
      }),
      true,
    );

    assert.deepEqual(calls, ["bad"]);
  });
});

describe("withOnlyOnFailure", () => {
  it("does not run diagnostics when the action succeeds", async () => {
    let called = false;
    const result = await withOnlyOnFailure(
      () => 42,
      () => {
        called = true;
      },
    );

    assert.equal(result, 42);
    assert.equal(called, false);
  });

  it("runs diagnostics and rethrows the original action error", async () => {
    const actionError = new Error("assertion failed");
    let diagnosticError: unknown;

    await assert.rejects(
      withOnlyOnFailure(
        () => {
          throw actionError;
        },
        ({ error }) => {
          diagnosticError = error;
        },
      ),
      actionError,
    );
    assert.equal(diagnosticError, actionError);
  });

  it("throws AggregateError when diagnostics fail too", async () => {
    const actionError = new Error("assertion failed");
    const diagnosticError = new Error("diagnostic failed");

    await assert.rejects(
      withOnlyOnFailure(
        () => {
          throw actionError;
        },
        () => {
          throw diagnosticError;
        },
      ),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [actionError, diagnosticError]);
        return true;
      },
    );
  });
});
