import { commandScenarios, findCommandScenario } from "./scenarios.js";
import { translate } from "./content.js";
import {
  nextLocale,
  nextTheme,
  preferenceStorageKeys,
  resolveLocale,
  resolveTheme,
} from "./preferences.js";

const root = document.documentElement;
const commandTabs = [...document.querySelectorAll("[data-command-tab]")];
const commandKicker = document.querySelector("[data-command-kicker]");
const commandText = document.querySelector("[data-command-text]");
const commandOutput = document.querySelector("[data-command-output]");
const copyButton = document.querySelector("[data-copy-install]");
const copyStatus = document.querySelector("[data-copy-status]");
const localeToggle = document.querySelector("[data-locale-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");
const themeSymbol = document.querySelector("[data-theme-symbol]");
const description = document.querySelector('meta[name="description"]');

function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The controls still work when storage is unavailable.
  }
}

const query = new URLSearchParams(window.location.search);
let locale = resolveLocale(query.get("lang") ?? readPreference(preferenceStorageKeys.locale));
let theme = resolveTheme(query.get("theme") ?? readPreference(preferenceStorageKeys.theme));
let currentScenarioId = commandScenarios[0].id;

function updateThemeControl() {
  if (!themeToggle || !themeLabel || !themeSymbol) return;

  const isDark = theme === "dark";
  themeToggle.setAttribute("aria-checked", String(isDark));
  themeToggle.setAttribute(
    "aria-label",
    translate(locale, isDark ? "controls.themeToLight" : "controls.themeToDark"),
  );
  themeLabel.textContent = translate(
    locale,
    isDark ? "controls.themeLight" : "controls.themeDark",
  );
  themeSymbol.textContent = isDark ? "◑" : "◐";
}

function applyLocale(next) {
  locale = resolveLocale(next);
  root.lang = locale;
  document.title = translate(locale, "page.title");
  description?.setAttribute("content", translate(locale, "meta.description"));

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = translate(locale, element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", translate(locale, element.dataset.i18nAriaLabel));
  }
  for (const element of document.querySelectorAll("[data-i18n-alt]")) {
    element.setAttribute("alt", translate(locale, element.dataset.i18nAlt));
  }

  if (localeToggle) {
    localeToggle.dataset.activeLocale = locale;
    localeToggle.setAttribute(
      "aria-label",
      translate(locale, locale === "ja" ? "controls.localeToEnglish" : "controls.localeToJapanese"),
    );
  }
  if (copyStatus) copyStatus.textContent = "";
  updateThemeControl();
  renderScenario(currentScenarioId);
}

function applyTheme(next) {
  theme = resolveTheme(next);
  root.dataset.theme = theme;
  updateThemeControl();
}

function renderScenario(id) {
  const scenario = findCommandScenario(id);
  if (!scenario || !commandKicker || !commandText || !commandOutput) return;

  currentScenarioId = id;

  commandKicker.textContent = scenario.kicker;
  commandText.textContent = scenario.command;
  commandOutput.replaceChildren(
    ...scenario.output.map((line, index) => {
      const row = document.createElement("span");
      row.className = index === scenario.output.length - 1 ? "terminal-verdict" : "";
      row.textContent = line;
      return row;
    }),
  );

  for (const tab of commandTabs) {
    const selected = tab.dataset.commandTab === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}

for (const tab of commandTabs) {
  tab.addEventListener("click", () => renderScenario(tab.dataset.commandTab));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = commandTabs.indexOf(tab);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = commandTabs[(current + offset + commandTabs.length) % commandTabs.length];
    next.focus();
    renderScenario(next.dataset.commandTab);
  });
}

copyButton?.addEventListener("click", async () => {
  const command = copyButton.dataset.copyInstall ?? "";
  try {
    await navigator.clipboard.writeText(command);
    copyStatus.textContent = translate(locale, "start.copied");
  } catch {
    copyStatus.textContent = command;
  }
});

localeToggle?.addEventListener("click", () => {
  const value = nextLocale(locale);
  applyLocale(value);
  writePreference(preferenceStorageKeys.locale, value);
});

themeToggle?.addEventListener("click", () => {
  const value = nextTheme(theme);
  applyTheme(value);
  writePreference(preferenceStorageKeys.theme, value);
});

applyTheme(theme);
applyLocale(locale);
