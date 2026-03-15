import { gameConfig } from "./src/config.js";
import { createGameEngine } from "./src/game/engine.js";
import { createRenderer } from "./src/render/canvas.js";
import { loadProgress, saveRecords, saveTutorialCompletion } from "./src/storage.js";

const canvas = document.getElementById("game");
const menuOverlay = document.getElementById("menu-overlay");
const rulesModal = document.getElementById("rules-modal");
const rulesSheet = document.getElementById("rules-sheet");
const tutorialOverlay = document.getElementById("tutorial-overlay");
const tutorialHand = document.getElementById("tutorial-hand");
const tutorialLabel = document.getElementById("tutorial-label");
const scoreDisplay = document.getElementById("score-display");
const scorePopups = document.getElementById("score-popups");
const toast = document.getElementById("toast");

const progress = loadProgress(gameConfig);
const renderer = createRenderer(canvas, gameConfig);
const engine = createGameEngine({
  config: gameConfig,
  progress,
  onTutorialComplete() {
    saveTutorialCompletion(gameConfig);
  },
  onRecordsChange(records) {
    saveRecords(records);
  },
});

let lastTimestamp = 0;
let latestSnapshot = engine.getSnapshot();
let lastScoreAwardToken = latestSnapshot.scoreAwardToken || 0;
let lastComboBonusToken = latestSnapshot.comboBonusToken || 0;
let rulesCloseTimer = 0;
let rulesDrag = null;

function resetRulesSheetPosition() {
  rulesModal.classList.remove("is-dragging");
  rulesSheet.style.removeProperty("--sheet-translate");
  rulesDrag = null;
}

function completeRulesClose() {
  window.clearTimeout(rulesCloseTimer);
  rulesModal.classList.remove("is-open", "is-dragging");
  rulesModal.classList.add("hidden");
  rulesSheet.style.removeProperty("--sheet-translate");
  rulesDrag = null;
}

function openRules() {
  window.clearTimeout(rulesCloseTimer);
  rulesModal.classList.remove("hidden");
  requestAnimationFrame(() => {
    rulesModal.classList.add("is-open");
  });
}

function closeRules() {
  if (rulesModal.classList.contains("hidden")) {
    return;
  }

  resetRulesSheetPosition();
  rulesModal.classList.remove("is-open");
  rulesCloseTimer = window.setTimeout(completeRulesClose, 240);
}

function startGame() {
  closeRules();
  menuOverlay.classList.add("hidden");
  engine.startGame();
}

function syncViewport() {
  const stage = canvas.parentElement;
  const width = Math.round(stage.clientWidth);
  const height = Math.round(stage.clientHeight);
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  renderer.resize(width, height, dpr);
  engine.setBounds(width, height);
  latestSnapshot = engine.getSnapshot();
}

function eventToCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function spawnScorePopup(value, position, options = {}) {
  if (!position || !value) {
    return;
  }

  const popup = document.createElement("div");
  popup.className = options.bonus ? "score-popup score-popup-bonus" : "score-popup";
  popup.textContent = `+${value}`;
  popup.style.left = `${position.x}px`;
  popup.style.top = `${position.y}px`;
  popup.addEventListener("animationend", () => {
    popup.remove();
  }, { once: true });
  scorePopups.appendChild(popup);
}

function updateHud(snapshot) {
  scoreDisplay.textContent =
    `Очки - ${snapshot.score}/${snapshot.bestScore} · Комбо - ${snapshot.combo}/${snapshot.nextComboThreshold}`;

  if (snapshot.scoreAwardToken !== lastScoreAwardToken) {
    lastScoreAwardToken = snapshot.scoreAwardToken;
    spawnScorePopup(snapshot.scoreAwardValue, snapshot.scoreAwardPosition);
  }

  if (snapshot.comboBonusToken !== lastComboBonusToken) {
    lastComboBonusToken = snapshot.comboBonusToken;
    spawnScorePopup(
      snapshot.comboBonusValue,
      {
        x: snapshot.bounds.width / 2,
        y: snapshot.bounds.height / 2,
      },
      { bonus: true }
    );
  }
}

function updateTutorialOverlay(snapshot) {
  const visible =
    snapshot.mode === "game" &&
    (
      snapshot.tutorialStage === "tutorial_step_1" ||
      snapshot.tutorialStage === "tutorial_step_2_pause"
    );

  tutorialOverlay.classList.toggle("hidden", !visible);

  if (!visible || !snapshot.target) {
    return;
  }

  const handX = snapshot.target.x;
  const handY = snapshot.target.y - snapshot.target.radius - 42;
  const labelX = snapshot.target.x;
  const labelY = snapshot.target.y + snapshot.target.radius + 34;

  tutorialHand.style.left = `${handX}px`;
  tutorialHand.style.top = `${handY}px`;
  tutorialLabel.style.left = `${labelX}px`;
  tutorialLabel.style.top = `${labelY}px`;
  tutorialLabel.textContent = "Нажми";
}

function updateToast(snapshot) {
  const visible = Boolean(snapshot.toast);
  toast.classList.toggle("hidden", !visible);
  if (visible) {
    toast.textContent = snapshot.toast;
  }
}

function updateUi(snapshot) {
  updateHud(snapshot);
  updateTutorialOverlay(snapshot);
  updateToast(snapshot);
}

function frame(timestamp) {
  requestAnimationFrame(frame);

  const delta = lastTimestamp ? Math.min(32, timestamp - lastTimestamp) : 16;
  lastTimestamp = timestamp;

  engine.stepFrame(delta);
  latestSnapshot = engine.getSnapshot();
  renderer.render(latestSnapshot, timestamp);
  updateUi(latestSnapshot);
}

function finishRulesDrag(event) {
  if (!rulesDrag || event.pointerId !== rulesDrag.pointerId) {
    return;
  }

  const translateY = Math.max(0, event.clientY - rulesDrag.startY);
  resetRulesSheetPosition();

  if (translateY > 96) {
    closeRules();
  }
}

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("rules-btn").addEventListener("click", openRules);
rulesModal.addEventListener("click", (event) => {
  if (event.target === rulesModal) {
    closeRules();
  }
});
rulesSheet.addEventListener("pointerdown", (event) => {
  rulesDrag = {
    pointerId: event.pointerId,
    startY: event.clientY,
  };
  rulesModal.classList.add("is-dragging");
  rulesSheet.setPointerCapture(event.pointerId);
});
rulesSheet.addEventListener("pointermove", (event) => {
  if (!rulesDrag || event.pointerId !== rulesDrag.pointerId) {
    return;
  }

  const translateY = Math.max(0, event.clientY - rulesDrag.startY);
  rulesSheet.style.setProperty("--sheet-translate", `${translateY}px`);
});
rulesSheet.addEventListener("pointerup", finishRulesDrag);
rulesSheet.addEventListener("pointercancel", resetRulesSheetPosition);

canvas.addEventListener("pointerdown", (event) => {
  if (menuOverlay.classList.contains("hidden")) {
    engine.pointerDown(eventToCanvasPoint(event));
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeRules();
  }
});
window.addEventListener("resize", syncViewport);
window.addEventListener("orientationchange", syncViewport);

syncViewport();
renderer.render(latestSnapshot, 0);
updateUi(latestSnapshot);
requestAnimationFrame(frame);
