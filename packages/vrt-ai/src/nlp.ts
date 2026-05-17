/**
 * Text-matching helpers shared between expectation matching and reasoning.
 */

export const STOP_WORDS = new Set([
  "gets", "from", "with", "that", "this", "should",
  "have", "the", "for", "and", "all", "proper",
]);

export const SYNONYMS: Record<string, string[]> = {
  input: ["textbox", "searchbox", "combobox"],
  textbox: ["input", "searchbox"],
  searchbox: ["input", "textbox", "search"],
  label: ["name", "accessible"],
  name: ["label"],
  button: ["btn"],
  nav: ["navigation"],
  navigation: ["nav"],
  search: ["searchbox"],
  tab: ["tablist", "tabpanel"],
  tablist: ["tab", "tabs"],
  tabpanel: ["tab", "panel", "content"],
  panel: ["tabpanel"],
  table: ["grid"],
  column: ["columnheader", "header"],
  header: ["columnheader", "column"],
};
