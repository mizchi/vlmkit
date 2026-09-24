/**
 * `@mizchi/vlmkit-judge` — the pure layer.
 *
 * Every export here takes a plain snapshot (boxes, colours, style signatures)
 * and returns findings. Nothing imports a browser, the DOM, or a Node built-in,
 * which `purity.test.ts` enforces, so the same judges run on a snapshot a
 * browser collected, one read back from disk, or one built from a non-DOM scene
 * graph.
 */
export * from "./errors.ts";
export * from "./allow.ts";
export * from "./composition.ts";
export * from "./color-roles.ts";
export * from "./design-policy.ts";
