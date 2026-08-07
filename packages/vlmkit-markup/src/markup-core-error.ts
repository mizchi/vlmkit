/**
 * Rendering a MoonBit error value into a message a human can act on.
 *
 * A `raise` from the direct-JS module arrives as a tagged runtime value, not an
 * `Error`. The previous handling was `String(value._0)`, which produces
 * `[object Object]` for every error MoonBit's standard library raises — so the
 * whole point of the JSON boundary ("a wrong field tells you which field") was
 * lost on exactly the backend that is used by default. The spawned CLI kept its
 * message only because it prints before panicking.
 *
 * Three shapes matter, taken from the built module rather than guessed:
 *
 *   JsonDecodeError  _0 = { _0: <JsonPath>, _1: "Double::from_json: expected number" }
 *   Failure          _0 = "unknown markup-core JSON command: nope"
 *   ParseError       _0 = Position { line, column },  _1 = <char code>
 *
 * Constructor names are mangled with a length-prefixed, percent-ish encoding —
 * `moonbitlang_2fcore_2fjson_2eJsonDecodeError_2eJsonDecodeError` is
 * `moonbitlang/core/json.JsonDecodeError.JsonDecodeError`. The readable tail is
 * worth recovering because it is what names the *kind* of failure.
 *
 * Pure and dependency-free, so it is unit-testable against captured shapes
 * without a MoonBit build.
 */

/** A MoonBit `JsonPath` chain, rendered as `/width_value` or `/items[2]/name`. */
function renderJsonPath(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const kind = moonBitKind(value);
  if (kind === undefined) return undefined;
  if (kind.endsWith("Root")) return "";
  const parent = renderJsonPath(value._0);
  if (parent === undefined) return undefined;
  const segment = value._1;
  if (kind.endsWith("Key")) return `${parent}/${String(segment)}`;
  if (kind.endsWith("Index")) return `${parent}[${String(segment)}]`;
  return parent;
}

/**
 * The readable tail of a mangled constructor name.
 *
 * `_2e` and `_2f` are `.` and `/`; the leading `_M0…` and the decimal lengths are
 * the mangling's own bookkeeping and carry nothing for a reader.
 */
function moonBitKind(value: Record<string, unknown>): string | undefined {
  const raw = (value as { constructor?: { name?: string } }).constructor?.name;
  if (typeof raw !== "string" || raw === "Object") return undefined;
  const decoded = raw.replace(/_2e/g, ".").replace(/_2f/g, "/");
  const tail = decoded.split(".").pop() ?? decoded;
  // The mangling is length-prefixed segments (`…5Error20SomethingWentWrong`), so
  // splitting on digit runs isolates the name as the last segment. A regex anchored
  // at the end does not work: `[A-Z][A-Za-z0-9]*$` matches from the FIRST uppercase
  // letter that reaches the end, which is the mangle header, not the name.
  const segments = tail.split(/\d+/).filter(Boolean);
  return segments[segments.length - 1] ?? tail;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Leaf values worth printing, in field order.
 *
 * Walks `_0`, `_1`, … because that is how MoonBit lays out constructor payloads.
 * A `Position` is special-cased: `{line, column}` is far more useful as
 * `line 1, column 1` than as its two numbers in sequence.
 */
function collectDetail(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (!isRecord(value)) return [];

  const path = renderJsonPath(value);
  if (path !== undefined) return path === "" ? [] : [`at ${path}`];

  if (typeof value.line === "number" && typeof value.column === "number") {
    return [`line ${value.line}, column ${value.column}`];
  }

  const out: string[] = [];
  for (let i = 0; i in value || `_${i}` in value; i++) {
    if (!(`_${i}` in value)) break;
    out.push(...collectDetail(value[`_${i}`], depth + 1));
  }
  return out;
}

/**
 * A one-line description of a MoonBit error value.
 *
 * Returns `undefined` when the value is not recognisably a MoonBit error, so the
 * caller can fall back rather than print a confident wrong answer.
 */
export function describeMoonBitError(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  const kind = moonBitKind(value);
  const detail = collectDetail(value);
  if (detail.length === 0) return kind;
  // The path reads better after the message: "expected number (at /width_value)".
  const positions = detail.filter((part) => part.startsWith("at "));
  const rest = detail.filter((part) => !part.startsWith("at "));
  const body = rest.join(": ") || kind || "unknown error";
  return positions.length > 0 ? `${body} (${positions.join(", ")})` : body;
}
