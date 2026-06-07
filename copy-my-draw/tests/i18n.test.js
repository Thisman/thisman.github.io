import test from "node:test";
import assert from "node:assert/strict";

import { getNextLanguage, normalizeLanguage, translate } from "../src/i18n.js";

test("all interface translations exist in Russian and English", () => {
  const keys = [
    "pageTitle",
    "canvasLabel",
    "gameTitle",
    "bestScore",
    "start",
    "draw",
    "check",
    "result",
    "previousBest",
    "again",
    "themeToggleLabel",
    "languageToggleLabel",
    "themeSystem",
    "themeLight",
    "themeDark",
    "languageControl",
    "secondsUnit"
  ];

  for (const language of ["ru", "en"]) {
    for (const key of keys) {
      assert.notEqual(translate(language, key), key, `${language}.${key}`);
    }
  }
});

test("language helpers normalize and toggle supported languages", () => {
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("de"), "ru");
  assert.equal(getNextLanguage("ru"), "en");
  assert.equal(getNextLanguage("en"), "ru");
});
