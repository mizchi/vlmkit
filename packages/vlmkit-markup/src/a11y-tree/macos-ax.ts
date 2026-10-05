/**
 * The macOS importer: an Accessibility (AX) dump of one window as a `vlmkit-a11y/1` tree.
 *
 * The dump is what `macos-ax-collector.ts` writes on a Mac: the window's `AXUIElement`
 * subtree with each element's attributes as the AX API reports them, plus the window's
 * screen frame. This file only maps those facts onto the contract, so it runs (and is
 * tested) anywhere — a dump taken on a Mac can be imported on Linux:
 *
 *   vlmkit scan a11y --app TextEdit --out a11y.json          # on the Mac: collect + import
 *   vlmkit scan a11y window.ax.json --frame window.png ...   # anywhere: import a saved dump
 *
 * Units: AX reports global screen points with a top-left origin. WCAG's target floors are
 * written in the platform's logical unit, which on macOS is the point, so the tree stays in
 * points and every rect is made relative to the window's top-left corner. The frame is a
 * Retina capture of the window, so `scale` is left to the judge's default (frame width /
 * window width) rather than trusted from the screen.
 *
 * Names follow what VoiceOver announces, in the order the AX API resolves a label: the
 * element's own `AXTitle`, then `AXDescription`, then the text of its `AXTitleUIElement` (a
 * separate label view linked to it). Static text is named by its `AXValue`. A text field's
 * `AXValue` is its content, never its name; its placeholder names it only when nothing else
 * does, as Android's hint does.
 */
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import { A11Y_TREE_FORMAT, type A11yNode, type A11yTree } from "@mizchi/vlmkit-judge/a11y-tree.ts";

export const AX_DUMP_FORMAT = "vlmkit-ax-dump/1";

export interface AxFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One `AXUIElement`, as the collector read it. Every field is optional except the role. */
export interface AxElement {
  role: string;
  subrole?: string;
  roleDescription?: string;
  title?: string;
  description?: string;
  /** `AXValue` when it is a string, number or boolean. Other value types are omitted. */
  value?: string | number | boolean;
  placeholder?: string;
  /** The title or value of the element named by `AXTitleUIElement`. */
  titleElement?: string;
  identifier?: string;
  /** `AXPosition` + `AXSize`, global screen points. Absent when the element reports neither. */
  frame?: AxFrame;
  enabled?: boolean;
  focused?: boolean;
  selected?: boolean;
  expanded?: boolean;
  hidden?: boolean;
  /** `AXFocused` is settable: keyboard focus can be moved to it. */
  focusable?: boolean;
  /** `AXUIElementCopyActionNames`: `AXPress`, `AXShowMenu`, `AXIncrement`, … */
  actions?: string[];
  children?: AxElement[];
}

export interface AxDump {
  format: typeof AX_DUMP_FORMAT;
  app?: { name?: string; bundleId?: string; pid?: number };
  window: { title?: string; frame: AxFrame; windowId?: number };
  /** The PNG the collector wrote, relative to the dump file. */
  frame?: string;
  /** Why no frame was written (a missing Screen Recording permission, a capture error). */
  frameError?: string;
  /** The collector stopped at its node limit. */
  truncated?: boolean;
  /** `--click` names pressed, in order, before the tree was read. */
  pressed?: string[];
  root: AxElement;
}

const SUBROLE_ROLES: Record<string, string> = {
  AXSwitch: "switch",
  AXToggle: "switch",
  AXTabButton: "tab",
  AXSearchField: "textfield",
  AXSecureTextField: "textfield",
  AXDialog: "dialog",
  AXSystemDialog: "dialog",
};

const ROLES: Record<string, string> = {
  AXButton: "button",
  AXMenuButton: "button",
  AXDisclosureTriangle: "button",
  AXColorWell: "button",
  AXLink: "link",
  AXTextField: "textfield",
  AXTextArea: "textfield",
  AXCheckBox: "checkbox",
  AXRadioButton: "radio",
  AXSlider: "slider",
  AXIncrementor: "slider",
  AXPopUpButton: "combobox",
  AXComboBox: "combobox",
  AXMenuItem: "menuitem",
  AXMenuBarItem: "menuitem",
  AXHeading: "heading",
  AXStaticText: "text",
  AXImage: "image",
  AXScrollArea: "scrollview",
  AXWindow: "window",
  AXSheet: "dialog",
  AXList: "list",
  AXOutline: "list",
  AXTable: "list",
  AXBrowser: "list",
  AXRow: "listitem",
  AXGroup: "group",
  AXSplitGroup: "group",
  AXToolbar: "group",
  AXLayoutArea: "group",
  AXTabGroup: "group",
  AXRadioGroup: "group",
  AXWebArea: "group",
};

/** `AXScrollBar` → `scrollbar`: a role this has no mapping for keeps its own name, lowercased. */
const ownRole = (role: string) => role.replace(/^AX/, "").toLowerCase() || "unknown";

export function axRole(element: Pick<AxElement, "role" | "subrole">): string {
  return (
    (element.subrole && SUBROLE_ROLES[element.subrole]) ??
    ROLES[element.role] ??
    // A window's subrole decides dialog vs window; an unknown subrole leaves the role.
    ownRole(element.role)
  );
}

const ACTIONS: Record<string, string> = {
  AXPress: "tap",
  AXShowMenu: "showMenu",
  AXIncrement: "increment",
  AXDecrement: "decrement",
  AXConfirm: "confirm",
  AXCancel: "cancel",
  AXRaise: "raise",
  AXPick: "pick",
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function nameOf(element: AxElement, role: string): string {
  const own = text(element.title) || text(element.description) || text(element.titleElement);
  if (role === "textfield") return own || text(element.placeholder);
  if (role === "text" || role === "heading") return text(element.value) || own;
  return own;
}

const CHECKABLE = new Set(["checkbox", "radio", "switch", "tab"]);
const round = (n: number) => Math.round(n * 10) / 10;

export interface AxImportOptions {
  /**
   * The screenshot, relative to where the tree will be written. The dump's own `frame` is
   * relative to the dump file, so the caller resolves it and passes it here.
   */
  frame?: string;
}

const isFrame = (f: unknown): f is AxFrame =>
  !!f &&
  typeof f === "object" &&
  ["x", "y", "width", "height"].every((k) => Number.isFinite((f as Record<string, unknown>)[k]));

/** Map a dump onto the contract. Pure: the parsed dump in, the tree out. */
export function importAxDump(source: string | unknown, options: AxImportOptions = {}): A11yTree {
  let raw: unknown = source;
  if (typeof source === "string") {
    try {
      raw = JSON.parse(source);
    } catch (error) {
      throw new UsageError(`not a macOS AX dump: ${(error as Error).message}`);
    }
  }
  const dump = raw as Partial<AxDump> | null;
  if (!dump || dump.format !== AX_DUMP_FORMAT) {
    throw new UsageError(
      `not a macOS AX dump: expected "format": "${AX_DUMP_FORMAT}" (written by vlmkit scan a11y --app on a Mac).`,
    );
  }
  if (!isFrame(dump.window?.frame) || !dump.root || typeof dump.root.role !== "string") {
    throw new UsageError("macOS AX dump: it needs window.frame {x,y,width,height} and a root element with a role.");
  }
  const win = dump.window.frame;
  const nodes: A11yNode[] = [];
  const visit = (element: AxElement, parentPath: string, siblings: Map<string, number>) => {
    const role = axRole(element);
    const label = ownRole(element.role);
    // Indexed per role among siblings, so a path reads like the Android one: window[0]>button[2].
    const n = siblings.get(label) ?? 0;
    siblings.set(label, n + 1);
    const path = `${parentPath ? `${parentPath}>` : ""}${label}[${n}]`;
    // An element with no frame announces nothing a judge can place; its children may still.
    if (isFrame(element.frame)) {
      const name = nameOf(element, role);
      const operable = element.actions ?? [];
      const actions = [
        ...operable.map((a) => ACTIONS[a] ?? a.replace(/^AX/, "").replace(/^./, (c) => c.toLowerCase())),
        ...(element.focusable ? ["focus"] : []),
        ...(role === "textfield" && element.enabled !== false ? ["setText"] : []),
      ];
      const states: NonNullable<A11yNode["states"]> = {
        ...(element.enabled === false ? { disabled: true } : {}),
        ...(element.focused ? { focused: true } : {}),
        // A check box's AXValue is 0, 1 or 2 (mixed); a radio or tab's is 0 or 1.
        ...(CHECKABLE.has(role) && typeof element.value === "number" ? { checked: element.value === 1 } : {}),
        ...(element.selected ? { selected: true } : {}),
        ...(element.expanded !== undefined ? { expanded: element.expanded } : {}),
        ...(element.hidden ? { hidden: true } : {}),
      };
      const value =
        role === "textfield" && element.subrole !== "AXSecureTextField" && typeof element.value === "string"
          ? element.value
          : "";
      nodes.push({
        path,
        role,
        ...(name ? { name } : {}),
        ...(value ? { value } : {}),
        rect: {
          left: round(element.frame.x - win.x),
          top: round(element.frame.y - win.y),
          width: round(element.frame.width),
          height: round(element.frame.height),
        },
        ...(Object.keys(states).length > 0 ? { states } : {}),
        ...(actions.length > 0 ? { actions: [...new Set(actions)] } : {}),
      });
    }
    const childSiblings = new Map<string, number>();
    for (const child of element.children ?? []) visit(child, path, childSiblings);
  };
  visit(dump.root, "", new Map());
  if (nodes.length === 0) throw new UsageError("macOS AX dump: no element in it reports a frame.");
  const frame = options.frame;
  return {
    format: A11Y_TREE_FORMAT,
    platform: "macos",
    viewport: { width: round(win.width), height: round(win.height) },
    ...(frame ? { frame } : {}),
    nodes,
  };
}
