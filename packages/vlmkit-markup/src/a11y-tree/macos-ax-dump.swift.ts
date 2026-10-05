/**
 * The Swift source of the macOS AX collector, as a string so it ships inside the bundled CLI
 * (a `.swift` file beside this one would not survive `vp pack`). `macos-ax-collector.ts`
 * compiles it once with `swiftc` and caches the binary by the source's hash.
 *
 * It reports facts only — attributes as the AX API returns them, and the window's frame —
 * and `macos-ax.ts` maps them onto `vlmkit-a11y/1`. Usage of the compiled binary:
 *
 *   ax-dump --app <name|bundle id|pid> [--window <title substring>] [--click <name>]...
 *           [--frame out.png] [--max-nodes 4000] [--wait 5] [--prompt]
 *
 * stdout: the `vlmkit-ax-dump/1` JSON. Exit 2: bad arguments or no such app/window.
 * Exit 3: this terminal is not trusted for Accessibility (System Settings → Privacy &
 * Security → Accessibility); `--prompt` asks macOS to show the request.
 *
 * Written with String.raw: Swift's `\(…)` interpolation must reach swiftc with its
 * backslash. The source therefore holds no backtick and no dollar-brace.
 */
export const AX_DUMP_SWIFT = String.raw`
import AppKit
import ApplicationServices
import Foundation

func fail(_ message: String, _ code: Int32 = 2) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(code)
}

struct Options {
  var app: String? = nil
  var window: String? = nil
  var clicks: [String] = []
  var frame: String? = nil
  var maxNodes = 4000
  var maxDepth = 60
  var wait = 5.0
  var prompt = false
}

func parseOptions() -> Options {
  var o = Options()
  var args = Array(CommandLine.arguments.dropFirst())
  func value(_ flag: String) -> String {
    if args.isEmpty { fail(flag + " needs a value") }
    return args.removeFirst()
  }
  while !args.isEmpty {
    let a = args.removeFirst()
    switch a {
    case "--app": o.app = value(a)
    case "--window": o.window = value(a)
    case "--click": o.clicks.append(value(a))
    case "--frame": o.frame = value(a)
    case "--max-nodes": o.maxNodes = Int(value(a)) ?? o.maxNodes
    case "--max-depth": o.maxDepth = Int(value(a)) ?? o.maxDepth
    case "--wait": o.wait = Double(value(a)) ?? o.wait
    case "--prompt": o.prompt = true
    default: fail("unknown argument: " + a)
    }
  }
  return o
}

func attr(_ el: AXUIElement, _ name: String) -> CFTypeRef? {
  var v: CFTypeRef?
  return AXUIElementCopyAttributeValue(el, name as CFString, &v) == .success ? v : nil
}

func string(_ el: AXUIElement, _ name: String) -> String? {
  guard let s = attr(el, name) as? String else { return nil }
  let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
  return t.isEmpty ? nil : t
}

func bool(_ el: AXUIElement, _ name: String) -> Bool? {
  return (attr(el, name) as? NSNumber)?.boolValue
}

func element(_ v: CFTypeRef?) -> AXUIElement? {
  guard let v = v, CFGetTypeID(v) == AXUIElementGetTypeID() else { return nil }
  return (v as! AXUIElement)
}

func children(_ el: AXUIElement) -> [AXUIElement] {
  return (attr(el, kAXChildrenAttribute) as? [AXUIElement]) ?? []
}

func frame(_ el: AXUIElement) -> CGRect? {
  guard let p = attr(el, kAXPositionAttribute), let s = attr(el, kAXSizeAttribute),
    CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID()
  else { return nil }
  var point = CGPoint.zero
  var size = CGSize.zero
  guard AXValueGetValue(p as! AXValue, .cgPoint, &point), AXValueGetValue(s as! AXValue, .cgSize, &size) else {
    return nil
  }
  return CGRect(origin: point, size: size)
}

func json(_ r: CGRect) -> [String: Any] {
  return ["x": Double(r.minX), "y": Double(r.minY), "width": Double(r.width), "height": Double(r.height)]
}

func actions(_ el: AXUIElement) -> [String] {
  var names: CFArray?
  guard AXUIElementCopyActionNames(el, &names) == .success, let list = names as? [String] else { return [] }
  return list
}

/// AXValue when it is a string, number or boolean — the types a judge can read.
func plainValue(_ el: AXUIElement) -> Any? {
  guard let v = attr(el, kAXValueAttribute) else { return nil }
  if let s = v as? String { return s }
  if let n = v as? NSNumber {
    return CFGetTypeID(n) == CFBooleanGetTypeID() ? (n.boolValue as Any) : (n.doubleValue as Any)
  }
  return nil
}

/// The text of a linked label (AXTitleUIElement): its title, else its string value.
func titleElementText(_ el: AXUIElement) -> String? {
  guard let label = element(attr(el, kAXTitleUIElementAttribute)) else { return nil }
  if let t = string(label, kAXTitleAttribute) { return t }
  if let s = plainValue(label) as? String {
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? nil : t
  }
  return nil
}

final class Walker {
  let options: Options
  var count = 0
  var truncated = false
  init(_ options: Options) { self.options = options }

  func walk(_ el: AXUIElement, _ depth: Int) -> [String: Any]? {
    if count >= options.maxNodes {
      truncated = true
      return nil
    }
    count += 1
    var n: [String: Any] = ["role": string(el, kAXRoleAttribute) ?? "AXUnknown"]
    if let v = string(el, kAXSubroleAttribute) { n["subrole"] = v }
    if let v = string(el, kAXRoleDescriptionAttribute) { n["roleDescription"] = v }
    if let v = string(el, kAXTitleAttribute) { n["title"] = v }
    if let v = string(el, kAXDescriptionAttribute) { n["description"] = v }
    if let v = plainValue(el) { n["value"] = v }
    if let v = string(el, "AXPlaceholderValue") { n["placeholder"] = v }
    if let v = titleElementText(el) { n["titleElement"] = v }
    if let v = string(el, "AXIdentifier") { n["identifier"] = v }
    if let r = frame(el) { n["frame"] = json(r) }
    if let v = bool(el, kAXEnabledAttribute) { n["enabled"] = v }
    if bool(el, kAXFocusedAttribute) == true { n["focused"] = true }
    if bool(el, kAXSelectedAttribute) == true { n["selected"] = true }
    if let v = bool(el, kAXExpandedAttribute) { n["expanded"] = v }
    if bool(el, kAXHiddenAttribute) == true { n["hidden"] = true }
    var settable: DarwinBoolean = false
    if AXUIElementIsAttributeSettable(el, kAXFocusedAttribute as CFString, &settable) == .success,
      settable.boolValue
    {
      n["focusable"] = true
    }
    let acts = actions(el)
    if !acts.isEmpty { n["actions"] = acts }
    if depth < options.maxDepth {
      let kids = children(el).compactMap { walk($0, depth + 1) }
      if !kids.isEmpty { n["children"] = kids }
    }
    return n
  }
}

func findApp(_ query: String) -> NSRunningApplication? {
  if let pid = Int32(query) { return NSRunningApplication(processIdentifier: pid) }
  let apps = NSWorkspace.shared.runningApplications
  if let a = apps.first(where: { $0.bundleIdentifier == query }) { return a }
  return apps.first(where: { ($0.localizedName ?? "").lowercased() == query.lowercased() })
}

func windows(_ app: AXUIElement) -> [AXUIElement] {
  return (attr(app, kAXWindowsAttribute) as? [AXUIElement]) ?? []
}

func pickWindow(_ app: AXUIElement, _ title: String?) -> AXUIElement? {
  let all = windows(app)
  if let title = title {
    return all.first(where: { (string($0, kAXTitleAttribute) ?? "").localizedCaseInsensitiveContains(title) })
  }
  return element(attr(app, kAXFocusedWindowAttribute)) ?? element(attr(app, kAXMainWindowAttribute)) ?? all.first
}

func names(_ el: AXUIElement) -> [String] {
  return [string(el, kAXTitleAttribute), string(el, kAXDescriptionAttribute), titleElementText(el),
    (plainValue(el) as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)].compactMap { $0 }
}

func findPressable(_ el: AXUIElement, _ name: String, _ depth: Int) -> AXUIElement? {
  if names(el).contains(name) && actions(el).contains(kAXPressAction) { return el }
  if depth > 60 { return nil }
  for child in children(el) {
    if let hit = findPressable(child, name, depth + 1) { return hit }
  }
  return nil
}

func pressableNames(_ el: AXUIElement, _ depth: Int, _ out: inout [String]) {
  if actions(el).contains(kAXPressAction), let n = names(el).first { out.append(n) }
  if depth > 60 || out.count > 40 { return }
  for child in children(el) { pressableNames(child, depth + 1, &out) }
}

/// The window server's id for an AX window: same owner, layer 0, nearest bounds.
func windowId(_ pid: pid_t, _ bounds: CGRect) -> CGWindowID? {
  guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
    as? [[String: Any]]
  else { return nil }
  var best: (id: CGWindowID, distance: CGFloat)? = nil
  for w in list {
    guard (w[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == pid,
      (w[kCGWindowLayer as String] as? NSNumber)?.intValue == 0,
      let b = w[kCGWindowBounds as String] as? NSDictionary,
      let r = CGRect(dictionaryRepresentation: b),
      let id = (w[kCGWindowNumber as String] as? NSNumber)?.uint32Value
    else { continue }
    let d = abs(r.minX - bounds.minX) + abs(r.minY - bounds.minY) + abs(r.width - bounds.width)
      + abs(r.height - bounds.height)
    if best == nil || d < best!.distance { best = (id, d) }
  }
  return best?.id
}

/// Capture one window with no shadow. Returns why not, or nil on success.
func capture(_ id: CGWindowID?, _ path: String) -> String? {
  if #available(macOS 11.0, *), !CGPreflightScreenCaptureAccess() {
    return "Screen Recording is not allowed for this terminal (System Settings → Privacy & Security → Screen Recording), so a capture would hold the desktop instead of the window; contrast is not measured"
  }
  guard let id = id else { return "the window server lists no on-screen window for it" }
  let p = Process()
  p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
  p.arguments = ["-x", "-o", "-l", String(id), path]
  do { try p.run() } catch { return "screencapture did not start: " + error.localizedDescription }
  p.waitUntilExit()
  if p.terminationStatus != 0 || !FileManager.default.fileExists(atPath: path) {
    return "screencapture exited with status " + String(p.terminationStatus)
  }
  return nil
}

let options = parseOptions()
guard let query = options.app else { fail("--app <name|bundle id|pid> is required") }

let trustKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
if !AXIsProcessTrustedWithOptions([trustKey: options.prompt] as CFDictionary) {
  fail(
    "this terminal is not allowed to read other apps' accessibility: add it in System Settings → Privacy & Security → Accessibility (or re-run with --prompt), then run again",
    3)
}

guard let running = findApp(query) else {
  let regular = NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }
    .compactMap { $0.localizedName }
  fail("no running app matches " + query + ". Running apps: " + regular.joined(separator: ", "))
}
let pid = running.processIdentifier
let app = AXUIElementCreateApplication(pid)
AXUIElementSetMessagingTimeout(app, 2.0)

// A just-launched app publishes its window a moment after it starts.
var window = pickWindow(app, options.window)
let deadline = Date().addingTimeInterval(options.wait)
while window == nil && Date() < deadline {
  Thread.sleep(forTimeInterval: 0.2)
  window = pickWindow(app, options.window)
}
guard var win = window else {
  let titles = windows(app).map { string($0, kAXTitleAttribute) ?? "(untitled)" }
  fail("no window" + (options.window.map { " titled like " + $0 } ?? "") + " in " + (running.localizedName ?? query)
    + ". Windows: " + (titles.isEmpty ? "(none)" : titles.joined(separator: ", ")))
}

var pressed: [String] = []
for name in options.clicks {
  guard let target = findPressable(win, name, 0) else {
    var available: [String] = []
    pressableNames(win, 0, &available)
    fail("--click " + name + ": no pressable element has that exact title or description. Pressable here: "
      + (available.isEmpty ? "(none)" : available.joined(separator: ", ")))
  }
  AXUIElementPerformAction(target, kAXPressAction as CFString)
  pressed.append(name)
  Thread.sleep(forTimeInterval: 0.8)
  if let again = pickWindow(app, options.window) { win = again }
}

guard let winFrame = frame(win) else { fail("the window reports no position and size") }
let walker = Walker(options)
guard let root = walker.walk(win, 0) else { fail("the window reports no accessibility element") }

var dump: [String: Any] = [
  "format": "vlmkit-ax-dump/1",
  "app": ["name": running.localizedName ?? "", "bundleId": running.bundleIdentifier ?? "", "pid": Int(pid)],
  "window": ["title": string(win, kAXTitleAttribute) ?? "", "frame": json(winFrame)],
  "root": root,
]
if walker.truncated { dump["truncated"] = true }
if !pressed.isEmpty { dump["pressed"] = pressed }
if let path = options.frame {
  let id = windowId(pid, winFrame)
  if let id = id, var w = dump["window"] as? [String: Any] {
    w["windowId"] = Int(id)
    dump["window"] = w
  }
  if let why = capture(id, path) { dump["frameError"] = why } else { dump["frame"] = path }
}
let data = try! JSONSerialization.data(withJSONObject: dump, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
`;
