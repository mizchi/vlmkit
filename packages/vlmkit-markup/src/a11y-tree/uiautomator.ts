/**
 * The Android importer: `adb shell uiautomator dump` XML as a `vlmkit-a11y/1` tree.
 *
 * No device code runs here — the dump is a file the project already knows how to make:
 *
 *   adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml
 *   adb exec-out screencap -p > frame.png
 *   adb shell wm density            # the --density this needs
 *
 * `bounds` in a dump are device pixels, and WCAG's target floors are not: 24 CSS px is 24 dp
 * on Android. So the tree is written in dp (pixels / (dpi / 160)) and `scale` carries the
 * density back to the screenshot's pixels. A dump imported at the wrong density misjudges
 * every target, which is why `--density` is required rather than defaulted.
 *
 * Roles come from the view's class. A class this does not know becomes `button` when the
 * dump says it is clickable (the platform says it is operable; the class name is incidental)
 * and `group` otherwise, keeping the class in the path so a finding can be traced back.
 */
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import { A11Y_TREE_FORMAT, type A11yNode, type A11yTree } from "@mizchi/vlmkit-judge/a11y-tree.ts";

const CLASS_ROLES: Array<[RegExp, string]> = [
  [/(^|\.)(Button|ImageButton|MaterialButton|FloatingActionButton|Chip)$/, "button"],
  [/(^|\.)(EditText|TextInputEditText|AutoCompleteTextView)$/, "textfield"],
  [/(^|\.)(CheckBox|CheckedTextView)$/, "checkbox"],
  [/(^|\.)RadioButton$/, "radio"],
  [/(^|\.)(Switch|SwitchCompat|SwitchMaterial|ToggleButton)$/, "switch"],
  [/(^|\.)(SeekBar|Slider|RatingBar)$/, "slider"],
  [/(^|\.)Spinner$/, "combobox"],
  [/(^|\.)(ScrollView|HorizontalScrollView|NestedScrollView|RecyclerView|ListView|GridView|ViewPager2?)$/, "scrollview"],
  [/(^|\.)ImageView$/, "image"],
  [/(^|\.)TextView$/, "text"],
  [/(^|\.)WebView$/, "group"],
];

const decode = (s: string): string =>
  s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return "\"";
    if (e === "apos") return "'";
    return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });

/** Attributes of one start tag. A dump's attributes are always double-quoted. */
function attributes(tag: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out.set(m[1]!, decode(m[2]!));
  return out;
}

const BOUNDS = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/;

export interface UiautomatorOptions {
  /** `adb shell wm density`: dots per inch. 160 is 1 px per dp. */
  density: number;
  /** The screenshot, relative to where the tree will be written. */
  frame?: string;
}

/** Parse a uiautomator dump. Pure: the XML text in, the tree out. */
export function importUiautomatorDump(xml: string, options: UiautomatorOptions): A11yTree {
  if (!Number.isFinite(options.density) || options.density <= 0) {
    throw new UsageError("--density must be the device's dpi (adb shell wm density), e.g. --density 420.");
  }
  if (!/<hierarchy\b/.test(xml)) {
    throw new UsageError("not a uiautomator dump: no <hierarchy> element (adb shell uiautomator dump).");
  }
  const perDp = options.density / 160;
  const dp = (px: number) => Math.round((px / perDp) * 10) / 10;
  const nodes: A11yNode[] = [];
  const stack: Array<{ path: string; children: number }> = [{ path: "", children: 0 }];
  // The screen is the root node's bounds. Not the widest bounds seen: a node laid out past the
  // fold reports bounds past it, and taking those as the screen made it look on-screen.
  let screen: { width: number; height: number } | null = null;
  for (const m of xml.matchAll(/<(\/?)node\b([^>]*?)(\/?)>/g)) {
    if (m[1] === "/") {
      stack.pop();
      continue;
    }
    const a = attributes(m[2]!);
    const parent = stack[stack.length - 1]!;
    const cls = a.get("class") ?? "View";
    const short = cls.slice(cls.lastIndexOf(".") + 1);
    const path = `${parent.path ? `${parent.path}>` : ""}${short}[${parent.children++}]`;
    const b = BOUNDS.exec(a.get("bounds") ?? "");
    if (!b) throw new UsageError(`uiautomator dump: node ${path} has no parsable bounds (${JSON.stringify(a.get("bounds"))}).`);
    const [x0, y0, x1, y1] = [Number(b[1]), Number(b[2]), Number(b[3]), Number(b[4])];
    screen ??= { width: x1, height: y1 };
    const clickable = a.get("clickable") === "true" || a.get("long-clickable") === "true";
    let role = CLASS_ROLES.find(([re]) => re.test(cls))?.[1] ?? (clickable ? "button" : "group");
    // A clickable picture is a button with a picture on it.
    if (role === "image" && clickable) role = "button";
    const description = (a.get("content-desc") ?? "").trim();
    const text = (a.get("text") ?? "").trim();
    // A field's text is its value; its name is the description or, failing that, the hint.
    const name = role === "textfield" ? description || (a.get("hint") ?? "").trim() : description || text;
    const actions = [
      ...(a.get("clickable") === "true" ? ["tap"] : []),
      ...(a.get("long-clickable") === "true" ? ["longPress"] : []),
      ...(a.get("scrollable") === "true" ? ["scroll"] : []),
      ...(a.get("focusable") === "true" ? ["focus"] : []),
      ...(role === "textfield" && a.get("enabled") !== "false" ? ["setText"] : []),
    ];
    const states: NonNullable<A11yNode["states"]> = {
      ...(a.get("enabled") === "false" ? { disabled: true } : {}),
      ...(a.get("focused") === "true" ? { focused: true } : {}),
      ...(a.get("checkable") === "true" ? { checked: a.get("checked") === "true" } : {}),
      ...(a.get("selected") === "true" ? { selected: true } : {}),
      ...(a.get("visible-to-user") === "false" ? { hidden: true } : {}),
    };
    nodes.push({
      path,
      role,
      ...(name ? { name } : {}),
      ...(role === "textfield" && text && a.get("password") !== "true" ? { value: text } : {}),
      rect: { left: dp(x0), top: dp(y0), width: dp(x1 - x0), height: dp(y1 - y0) },
      ...(Object.keys(states).length > 0 ? { states } : {}),
      ...(actions.length > 0 ? { actions } : {}),
    });
    if (m[3] !== "/") stack.push({ path, children: 0 });
  }
  if (nodes.length === 0 || !screen) throw new UsageError("uiautomator dump: the hierarchy holds no <node> elements.");
  return {
    format: A11Y_TREE_FORMAT,
    platform: "android",
    viewport: { width: dp(screen.width), height: dp(screen.height) },
    scale: perDp,
    ...(options.frame ? { frame: options.frame } : {}),
    nodes,
  };
}
