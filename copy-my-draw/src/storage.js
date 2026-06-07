const BEST_SCORE_KEY = "copy-my-draw:best-score";
const THEME_KEY = "copy-my-draw:theme";
const LANGUAGE_KEY = "copy-my-draw:language";

export function loadBestScore() {
  const raw = window.localStorage.getItem(BEST_SCORE_KEY);
  const value = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(value) ? value : 0;
}

export function saveBestScore(percent) {
  window.localStorage.setItem(BEST_SCORE_KEY, String(Math.max(0, Math.round(percent))));
}

export function loadThemeMode(defaultMode) {
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "system" || raw === "light" || raw === "dark" ? raw : defaultMode;
}

export function saveThemeMode(mode) {
  window.localStorage.setItem(THEME_KEY, mode);
}

export function loadLanguage(defaultLanguage) {
  const raw = window.localStorage.getItem(LANGUAGE_KEY);
  return raw === "ru" || raw === "en" ? raw : defaultLanguage;
}

export function saveLanguage(language) {
  window.localStorage.setItem(LANGUAGE_KEY, language);
}
