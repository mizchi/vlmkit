///| Keyboard-interaction issue rules.
///
/// Moved here from `src/inspect/interaction-map.ts` because it is the shape the
/// JSON boundary was built for and the positional one could not carry: eleven
/// rules over an **array of records with an optional nested record**. With
/// tab-separated positional strings there was no encoding for that at all, so the
/// rules stayed in TypeScript regardless of where they belonged.
///
/// ## What crosses the boundary, and what deliberately does not
///
/// Rules in, **issue ids out** — never messages. The prose is presentation and
/// stays in TypeScript, so rewording a diagnostic does not mean rebuilding
/// MoonBit. What comes back is the id, the severity, the element index, and the
/// couple of values the wording needs to interpolate.
///
/// The input is also *reduced* rather than mirrored. The TypeScript type carries
/// `ariaDelta : Record<String, [String?, String?]>`, and these rules only ever ask
/// two things of it — does it mention `expanded`, and is it empty. So the wire
/// format carries those two facts instead of the map. Passing the whole structure
/// because it exists would make the boundary wider than the logic needs, and every
/// future change to that map would become a change here.

///|
/// One probed element, reduced to the facts the rules read.
pub struct InteractionElementInput {
  role : String
  has_aria_expanded : Bool
  has_popup : Bool
  tab_reachable : Bool
  /// `None` when the tab walk never reached the element, which is not the same as
  /// "reached it and found no indicator" — the rule only fires on the latter.
  focus_indicator : Bool?
  /// Absent when the element was never activated.
  activation : InteractionActivationInput?
} derive(FromJson, ToJson)

///|
pub struct InteractionActivationInput {
  key : String
  aria_delta_empty : Bool
  aria_delta_has_expanded : Bool
  layout_changed : Bool
  focus_moved : Bool
  focus_moved_within : Bool
  broken_controls_id : String?
  popup_role : String?
  focus_moved_into_popup : Bool?
  focus_trapped : Bool?
  popup_arrow_cycles : Bool?
  escape_closes : Bool?
  focus_returns_to_opener : Bool?
} derive(FromJson, ToJson)

///|
pub struct InteractionIssuesInput {
  elements : Array[InteractionElementInput]
} derive(FromJson, ToJson)

///|
/// An issue, as an id plus what the message needs. No prose.
pub struct InteractionIssueOutput {
  kind : String
  severity : String
  /// Position in the input array, NOT any id the element carries. Callers map it
  /// back by position, which is unambiguous — an earlier version reported the
  /// element's own `index` field and a caller that reused one value across
  /// elements got every finding labelled with the last of them.
  element_position : Int
  /// Values the TypeScript wording interpolates: the activation key, the popup
  /// role, the dangling `aria-controls` id. Only ever set when that rule's message
  /// uses them.
  key : String?
  popup_role : String?
  broken_controls_id : String?
} derive(ToJson)

///|
/// Roles where a roving tabindex is the correct pattern: the composite exposes one
/// tab stop and arrows reach the rest.
let roving_roles : Array[String] = ["tab", "radio", "menuitem", "option"]

///|
fn issue(
  kind : String,
  severity : String,
  index : Int,
  key~ : String? = None,
  popup_role~ : String? = None,
  broken_controls_id~ : String? = None,
) -> InteractionIssueOutput {
  { kind, severity, element_position: index, key, popup_role, broken_controls_id }
}

///|
/// Every keyboard-interaction issue the probe's observations imply.
///
/// Order matters and is preserved from the TypeScript original: callers and tests
/// read the first issue of a run, and reordering would silently change which
/// finding a reader sees first.
pub fn interaction_issues(
  input : InteractionIssuesInput,
) -> Array[InteractionIssueOutput] {
  let issues : Array[InteractionIssueOutput] = []
  // Roles that ARE reachable somewhere in the document. A roving composite's
  // unreachable member is the pattern working, not a defect — but only when a
  // same-role sibling really is reachable.
  let reachable_roles : Array[String] = []
  for element in input.elements {
    if element.tab_reachable && !(reachable_roles.contains(element.role)) {
      reachable_roles.push(element.role)
    }
  }
  for i, element in input.elements {
    match element.activation {
      Some(activation) => {
        if element.has_aria_expanded &&
          !(activation.aria_delta_has_expanded) &&
          !(activation.layout_changed) {
          issues.push(issue("dead-disclosure", "suspect", i, key=Some(activation.key)))
        }
        match activation.broken_controls_id {
          Some(id) =>
            issues.push(
              issue("broken-aria-controls", "suspect", i, broken_controls_id=Some(id)),
            )
          None => ()
        }
        if activation.key != "ArrowRight" &&
          activation.key != "ArrowDown" &&
          activation.aria_delta_empty &&
          !(activation.layout_changed) &&
          !(activation.focus_moved) &&
          !(element.has_aria_expanded) {
          issues.push(issue("inert-control", "warn", i, key=Some(activation.key)))
        }
        if element.tab_reachable && element.focus_indicator is Some(false) {
          issues.push(issue("no-focus-indicator", "warn", i))
        }
        if !(element.tab_reachable) &&
          !(roving_roles.contains(element.role) && reachable_roles.contains(element.role)) {
          issues.push(issue("not-tab-reachable", "warn", i))
        }
        match activation.popup_role {
          Some(popup_role) =>
            if (popup_role == "dialog" || popup_role == "menu" || popup_role == "listbox") &&
              activation.focus_moved_into_popup is Some(false) {
              issues.push(
                issue("popup-no-focus-move", "warn", i, popup_role=Some(popup_role)),
              )
            }
          None => ()
        }
        if activation.focus_trapped is Some(false) {
          issues.push(issue("focus-escapes-trap", "suspect", i))
        }
        if (element.role == "grid" || element.role == "listbox") &&
          activation.aria_delta_empty &&
          !(activation.focus_moved_within) &&
          !(activation.focus_moved) {
          issues.push(issue("composite-arrows-dead", "warn", i, key=Some(activation.key)))
        }
        if activation.popup_arrow_cycles is Some(false) {
          issues.push(
            issue("popup-arrows-dead", "warn", i, popup_role=activation.popup_role),
          )
        }
        if activation.escape_closes is Some(true) &&
          activation.focus_returns_to_opener is Some(false) {
          issues.push(issue("focus-not-returned", "warn", i))
        }
        if (element.has_popup || element.role == "combobox") &&
          activation.escape_closes is Some(false) {
          issues.push(issue("escape-stuck", "warn", i))
        }
      }
      // No activation: only the two rules that read the element itself apply.
      // Keeping them outside the `Some` branch matters — an element that was never
      // activated can still be unreachable or paint no focus ring, and folding
      // these into the activation case would silently stop reporting that.
      None => {
        if element.tab_reachable && element.focus_indicator is Some(false) {
          issues.push(issue("no-focus-indicator", "warn", i))
        }
        if !(element.tab_reachable) &&
          !(roving_roles.contains(element.role) && reachable_roles.contains(element.role)) {
          issues.push(issue("not-tab-reachable", "warn", i))
        }
      }
    }
  }
  issues
}
