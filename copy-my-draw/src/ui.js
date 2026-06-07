import { GAME_PHASES } from "./gameState.js";
import { translate } from "./i18n.js";

export class GameUI {
  constructor(elements) {
    this.elements = elements;
  }

  bind(actions) {
    this.elements.startButton.addEventListener("click", actions.onStart);
    this.elements.readyButton.addEventListener("click", actions.onReady);
    this.elements.checkButton.addEventListener("click", actions.onCheck);
    this.elements.againButton.addEventListener("click", actions.onAgain);
    this.elements.themeToggle.addEventListener("click", actions.onThemeToggle);
    this.elements.languageToggle.addEventListener("click", actions.onLanguageToggle);
  }

  render(state, bestScore, themeMode, language) {
    const text = (key) => translate(language, key);
    this.elements.app.dataset.screen = state.phase;
    document.documentElement.lang = language;
    document.title = text("pageTitle");
    this.elements.canvas.setAttribute("aria-label", text("canvasLabel"));
    this.elements.gameTitle.textContent = text("gameTitle");
    this.elements.bestScoreText.textContent = text("bestScore");
    this.elements.startButton.textContent = text("start");
    this.elements.readyButton.textContent = text("draw");
    this.elements.checkButton.textContent = text("check");
    this.elements.resultText.textContent = text("result");
    this.elements.previousBestText.textContent = text("previousBest");
    this.elements.againButton.textContent = text("again");
    this.elements.homeBest.textContent = `${bestScore}%`;
    this.elements.themeToggle.textContent = text(getThemeTranslationKey(themeMode));
    this.elements.themeToggle.setAttribute("aria-label", text("themeToggleLabel"));
    this.elements.languageToggle.textContent = text("languageControl");
    this.elements.languageToggle.setAttribute("aria-label", text("languageToggleLabel"));

    if (state.timerSeconds === null) {
      this.elements.timerBadge.textContent = "--";
    } else {
      this.elements.timerBadge.textContent = `${state.timerSeconds} ${text("secondsUnit")}`;
    }

    this.elements.checkButton.hidden = state.phase !== GAME_PHASES.DRAW || state.stroke.length === 0;

    if (state.phase === GAME_PHASES.RESULT) {
      this.elements.scoreLabel.textContent = `${Math.round(state.scoreDisplay)}%`;
      this.elements.previousBestLabel.textContent = `${state.result.previousBest}%`;
      this.elements.resultCard.dataset.outcome = getScoreOutcome(
        state.result.percent,
        state.result.previousBest
      );
    }
  }
}

function getThemeTranslationKey(themeMode) {
  if (themeMode === "light") {
    return "themeLight";
  }

  if (themeMode === "dark") {
    return "themeDark";
  }

  return "themeSystem";
}

export function getScoreOutcome(score, previousBest) {
  if (score >= previousBest) {
    return "close";
  }

  const difference = previousBest - score;

  if (difference > 50) {
    return "far";
  }

  if (difference >= 15) {
    return "medium";
  }

  return "close";
}
