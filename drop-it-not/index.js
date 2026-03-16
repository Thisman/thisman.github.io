import { createGame } from "./game.js";

const appShell = document.querySelector(".app-shell");
const startButton = document.getElementById("startButton");
const canvas = document.getElementById("gameCanvas");
const scoreHud = document.getElementById("scoreHud");
const comboHud = document.getElementById("comboHud");
const recordValue = document.getElementById("recordValue");
const comboValue = document.getElementById("comboValue");

const game = createGame({
  canvas,
  scoreEl: scoreHud,
  comboEl: comboHud,
  bestEl: recordValue,
  comboBestEl: comboValue,
});

function showGameScreen() {
  appShell.dataset.screen = "game";
}

startButton.addEventListener("click", () => {
  showGameScreen();
  game.start();
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  game.handleTap();
});

window.addEventListener("resize", () => {
  game.resize();
});

window.addEventListener("keydown", (event) => {
  if (appShell.dataset.screen !== "game") {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    game.handleTap();
  }
});
