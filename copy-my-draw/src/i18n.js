export const SUPPORTED_LANGUAGES = Object.freeze(["ru", "en"]);

const TRANSLATIONS = Object.freeze({
  ru: Object.freeze({
    pageTitle: "Повтори фигуру",
    canvasLabel: "Игровое поле для рисования",
    gameTitle: "Повтори фигуру",
    bestScore: "Лучший результат",
    start: "Начать",
    draw: "Нарисовать",
    check: "Проверить",
    result: "Результат",
    previousBest: "Предыдущий рекорд",
    again: "Еще раз",
    themeToggleLabel: "Переключить тему",
    languageToggleLabel: "Переключить язык",
    themeSystem: "Тема: авто",
    themeLight: "Тема: светлая",
    themeDark: "Тема: темная",
    languageControl: "RU",
    secondsUnit: "с"
  }),
  en: Object.freeze({
    pageTitle: "Copy the Shape",
    canvasLabel: "Drawing game area",
    gameTitle: "Copy the Shape",
    bestScore: "Best score",
    start: "Start",
    draw: "Draw",
    check: "Check",
    result: "Result",
    previousBest: "Previous best",
    again: "Play again",
    themeToggleLabel: "Switch theme",
    languageToggleLabel: "Switch language",
    themeSystem: "Theme: auto",
    themeLight: "Theme: light",
    themeDark: "Theme: dark",
    languageControl: "EN",
    secondsUnit: "s"
  })
});

export function translate(language, key) {
  const dictionary = TRANSLATIONS[normalizeLanguage(language)];
  return dictionary[key] ?? key;
}

export function normalizeLanguage(language, fallback = "ru") {
  return SUPPORTED_LANGUAGES.includes(language) ? language : fallback;
}

export function getNextLanguage(language) {
  return normalizeLanguage(language) === "ru" ? "en" : "ru";
}
