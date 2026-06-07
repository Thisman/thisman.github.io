import { GAME_CONFIG } from "../config.js";
import { GameState, GAME_PHASES } from "./gameState.js";
import { DrawingInput } from "./input.js";
import { CanvasRenderer } from "./renderer.js";
import { scoreDrawing } from "./scoring.js";
import { selectRandomRound } from "./shapes.js";
import { getNextLanguage } from "./i18n.js";
import {
  loadBestScore,
  loadLanguage,
  loadThemeMode,
  saveBestScore,
  saveLanguage,
  saveThemeMode
} from "./storage.js";
import { GameUI } from "./ui.js";

const elements = {
  app: document.getElementById("app"),
  canvas: document.getElementById("gameCanvas"),
  gameTitle: document.getElementById("gameTitle"),
  bestScoreText: document.querySelector(".home-stats span"),
  startButton: document.getElementById("startButton"),
  readyButton: document.getElementById("readyButton"),
  checkButton: document.getElementById("checkButton"),
  againButton: document.getElementById("againButton"),
  themeToggle: document.getElementById("themeToggle"),
  languageToggle: document.getElementById("languageToggle"),
  timerBadge: document.getElementById("timerBadge"),
  homeBest: document.getElementById("homeBest"),
  scoreLabel: document.getElementById("scoreLabel"),
  previousBestLabel: document.getElementById("previousBestLabel"),
  resultText: document.getElementById("resultText"),
  previousBestText: document.getElementById("previousBestText"),
  resultCard: document.getElementById("resultCard")
};

const state = new GameState();
const renderer = new CanvasRenderer(elements.canvas, GAME_CONFIG);
const ui = new GameUI(elements);

let bestScore = loadBestScore();
let themeMode = loadThemeMode(GAME_CONFIG.theme.defaultMode);
let language = loadLanguage(GAME_CONFIG.language.default);
let countdownId = 0;
let animationId = 0;
let scoreAnimationId = 0;
let drawAutoCheckDone = false;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersDarkTheme = window.matchMedia("(prefers-color-scheme: dark)");

const input = new DrawingInput(elements.canvas, {
  minPointDistance: GAME_CONFIG.drawing.minPointDistance,
  onStart: (points) => {
    state.setStroke(points);
    render();
  },
  onChange: (points) => {
    state.setStroke(points);
    render();
  },
  onComplete: (points) => {
    state.setStroke(points);
    render();
  }
});

ui.bind({
  onStart: startRound,
  onReady: beginMemorize,
  onCheck: checkRound,
  onAgain: startRound,
  onThemeToggle: toggleTheme,
  onLanguageToggle: toggleLanguage
});

window.addEventListener("resize", () => {
  renderer.resize();
  render();
});
prefersDarkTheme.addEventListener("change", () => {
  applyTheme(themeMode);
  render();
});

applyTheme(themeMode);
render();

function startRound() {
  clearWork();
  if (state.phase === GAME_PHASES.HOME) {
    state.transition(GAME_PHASES.READY);
  } else if (state.phase !== GAME_PHASES.READY) {
    state.transition(GAME_PHASES.READY);
  }

  state.setRound(selectRandomRound(GAME_CONFIG));
  input.reset();
  input.setEnabled(false);
  drawAutoCheckDone = false;
  render();
}

function beginMemorize() {
  if (state.phase !== GAME_PHASES.READY) {
    return;
  }

  clearWork();
  input.setEnabled(false);
  state.transition(GAME_PHASES.MEMORIZE);
  state.setTimer(GAME_CONFIG.timings.memorizeSeconds);
  render();

  animateLineReveal(() => {
    startCountdown(GAME_CONFIG.timings.memorizeSeconds, (secondsLeft) => {
      state.setTimer(secondsLeft);
      render();
    }, beginDraw);
  });
}

function beginDraw() {
  if (state.phase !== GAME_PHASES.MEMORIZE) {
    return;
  }

  state.transition(GAME_PHASES.DRAW);
  state.setTimer(GAME_CONFIG.timings.drawSeconds);
  input.reset();
  input.setEnabled(true);
  render();

  startCountdown(GAME_CONFIG.timings.drawSeconds, (secondsLeft) => {
    state.setTimer(secondsLeft);
    render();
  }, () => {
    if (!drawAutoCheckDone && state.phase === GAME_PHASES.DRAW) {
      drawAutoCheckDone = true;
      checkRound();
    }
  });
}

function checkRound() {
  if (state.phase !== GAME_PHASES.DRAW) {
    return;
  }

  clearCountdown();
  input.finishStroke();
  input.setEnabled(false);

  const result = scoreDrawing(
    state.round,
    state.stroke,
    renderer.viewport,
    GAME_CONFIG
  );
  const previousBest = bestScore;

  state.transition(GAME_PHASES.RESULT);
  state.setResult({
    ...result,
    previousBest
  });
  state.setScoreDisplay(0);

  if (result.percent > bestScore) {
    bestScore = result.percent;
    saveBestScore(bestScore);
  }

  render();
  animateScore(result.percent);
}

function toggleTheme() {
  const nextMode = themeMode === "system"
    ? "light"
    : themeMode === "light"
      ? "dark"
      : "system";

  themeMode = nextMode;
  saveThemeMode(themeMode);
  applyTheme(themeMode);
  render();
}

function toggleLanguage() {
  language = getNextLanguage(language);
  saveLanguage(language);
  render();
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  const metaTheme = document.querySelector("meta[name='theme-color']");
  if (metaTheme) {
    metaTheme.setAttribute("content", resolveTheme(mode) === "dark" ? "#141218" : "#f4f1f7");
  }
}

function resolveTheme(mode) {
  if (mode === "system") {
    return prefersDarkTheme.matches ? "dark" : "light";
  }

  return mode;
}

function animateLineReveal(onDone) {
  const duration = prefersReducedMotion.matches ? 0 : GAME_CONFIG.timings.lineRevealMs;
  const start = performance.now();

  const step = (now) => {
    const progress = duration === 0 ? 1 : (now - start) / duration;
    state.setRevealProgress(progress);
    render();

    if (progress < 1) {
      animationId = requestAnimationFrame(step);
    } else {
      onDone();
    }
  };

  animationId = requestAnimationFrame(step);
}

function animateScore(targetPercent) {
  const duration = prefersReducedMotion.matches ? 0 : GAME_CONFIG.timings.scoreRevealMs;
  const start = performance.now();

  const step = (now) => {
    const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
    state.setScoreDisplay(Math.round(targetPercent * progress));
    render();

    if (progress < 1) {
      scoreAnimationId = requestAnimationFrame(step);
    }
  };

  scoreAnimationId = requestAnimationFrame(step);
}

function startCountdown(totalSeconds, onTick, onDone) {
  clearCountdown();
  const deadline = Date.now() + totalSeconds * 1000;
  let lastSeconds = totalSeconds;
  onTick(lastSeconds);

  countdownId = window.setInterval(() => {
    const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

    if (secondsLeft !== lastSeconds) {
      lastSeconds = secondsLeft;
      onTick(secondsLeft);
    }

    if (secondsLeft <= 0) {
      clearCountdown();
      onDone();
    }
  }, 100);
}

function clearWork() {
  clearCountdown();
  cancelAnimationFrame(animationId);
  cancelAnimationFrame(scoreAnimationId);
  animationId = 0;
  scoreAnimationId = 0;
}

function clearCountdown() {
  if (countdownId !== 0) {
    window.clearInterval(countdownId);
    countdownId = 0;
  }
}

function render() {
  renderer.render(state);
  ui.render(state, bestScore, themeMode, language);
}
