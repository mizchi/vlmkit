/**
 * The `check integrity` exemption form (`<kind>[@<selector>][@<viewport>];<reason>`).
 * Moved to `@mizchi/vlmkit-judge/integrity-allow.ts` with the judges it filters
 * (it is pure: no page, no file system), and re-exported here so every existing
 * import keeps working.
 */
export * from "@mizchi/vlmkit-judge/integrity-allow.ts";
