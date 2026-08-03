export const supportedLocales = Object.freeze(["ja", "en"]);
export const supportedThemes = Object.freeze(["light", "dark"]);
export const preferenceStorageKeys = Object.freeze({
  locale: "vlmkit-intro-locale",
  theme: "vlmkit-intro-theme",
});

export function resolveLocale(value) {
  return supportedLocales.includes(value) ? value : "ja";
}

export function nextLocale(locale) {
  return resolveLocale(locale) === "ja" ? "en" : "ja";
}

export function resolveTheme(value) {
  return supportedThemes.includes(value) ? value : "light";
}

export function nextTheme(theme) {
  return resolveTheme(theme) === "light" ? "dark" : "light";
}
