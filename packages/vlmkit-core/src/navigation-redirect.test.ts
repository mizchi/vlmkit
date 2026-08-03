import assert from "node:assert/strict";
import { test } from "node:test";
import { describeRedirect } from "./navigation-redirect.ts";

test("auth-wall redirect is called out as a login wall", () => {
  const msg = describeRedirect("http://127.0.0.1:8901/dashboard", "http://127.0.0.1:8901/login");
  assert.ok(msg, "expected a warning");
  assert.match(msg!, /requested \/dashboard/);
  assert.match(msg!, /measured http:\/\/127\.0\.0\.1:8901\/login/);
  assert.match(msg!, /login wall/i);
  // Points at the fix the tool actually offers. This assertion previously
  // pinned "cannot inject a session", which stopped being true when
  // --storage-state landed — the test was holding the stale claim in place.
  assert.match(msg!, /--storage-state/);
  assert.doesNotMatch(msg!, /cannot inject a session/i);
});

test("non-auth cross-path redirect warns without the auth hint", () => {
  const msg = describeRedirect("https://example.com/old-pricing", "https://example.com/pricing");
  assert.ok(msg);
  assert.match(msg!, /measured the destination/);
  assert.doesNotMatch(msg!, /login wall/i);
});

test("cosmetic redirects stay quiet", () => {
  // trailing slash, scheme upgrade, www canonicalization — same page
  assert.equal(describeRedirect("http://example.com/pricing", "https://example.com/pricing"), null);
  assert.equal(describeRedirect("https://example.com/pricing", "https://example.com/pricing/"), null);
  assert.equal(describeRedirect("https://example.com/pricing/", "https://example.com/pricing"), null);
  assert.equal(describeRedirect("https://www.example.com/a", "https://example.com/a"), null);
  assert.equal(describeRedirect("https://example.com/a", "https://example.com/a"), null);
});

test("different host is reported even when the path matches", () => {
  const msg = describeRedirect("https://staging.example.com/app", "https://example.com/app");
  assert.ok(msg);
  assert.match(msg!, /measured https:\/\/example\.com\/app/);
});

test("file:// and malformed inputs produce no warning", () => {
  assert.equal(describeRedirect("file:///tmp/a.html", "file:///tmp/a.html"), null);
  assert.equal(describeRedirect("page.html", "file:///tmp/page.html"), null);
  assert.equal(describeRedirect("", "https://example.com/"), null);
});
