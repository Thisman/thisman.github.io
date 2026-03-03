import { createGameSession } from "./game/session.js";
import { createRenderer } from "./renderer_canvas.js";
import { bindInput } from "./input.js";
import { buildRuntimeLevel, validateLevelSpec } from "./core/level.js";
import { normalizeRotation, rotateVector } from "./rotation.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const statusLevelEl = document.getElementById("status-level");
const statusStepsEl = document.getElementById("status-steps");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayButtonEl = document.getElementById("overlay-button");
const loadingEl = document.getElementById("loading");

const renderer = createRenderer(canvas);

let currentLevelNumber = 1;
let game = null;
let anim = null;
let isLoading = false;
let hoverCell = null;
const loadedLevels = new Map();
const MIN_LOADING_MS = 1000;
const ROTATION_ICON_SIZE = 16;
const ROTATION_ICON_OFFSET_X = 12;
const ROTATION_ICON_OFFSET_Y = -14;

const appEl = document.getElementById("app");
const tooltipEl = document.createElement("div");
tooltipEl.className = "map-tooltip hidden";
if (appEl) {
  appEl.append(tooltipEl);
}

function setOverlay(visible, title, buttonText, buttonCommand) {
  if (!overlayEl) {
    return;
  }
  overlayEl.classList.toggle("hidden", !visible);
  overlayTitleEl.textContent = title;
  overlayButtonEl.textContent = buttonText;
  overlayButtonEl.dataset.command = buttonCommand;
}

function setLoading(visible, message = "Loading level...") {
  if (!loadingEl) {
    return;
  }
  loadingEl.classList.toggle("hidden", !visible);
  loadingEl.textContent = message;
  isLoading = visible;
  if (canvas) {
    canvas.style.visibility = visible ? "hidden" : "visible";
  }
}

function updateStatus() {
  if (!game) {
    statusLevelEl.textContent = "Уровень 1";
    statusStepsEl.textContent = "0 шагов";
    return;
  }
  const remaining = Math.max(0, game.maxMoves - game.movesUsed);
  statusLevelEl.textContent = `Уровень ${currentLevelNumber}`;
  statusStepsEl.textContent = `${remaining} шагов`;
}

function canInput() {
  return game && game.state === "playing" && !anim && !isLoading;
}

function startAnimation(stepResult) {
  const hasBump = stepResult.bumps.some(Boolean);
  const hasTeleport = stepResult.teleports && stepResult.teleports.some(Boolean);
  const duration = hasTeleport ? 140 : hasBump ? 120 : 140;
  anim = {
    action: stepResult.action,
    prevPositions: stepResult.prevPositions,
    nextPositions: stepResult.nextPositions,
    bumps: stepResult.bumps,
    teleports: stepResult.teleports || [],
    teleportEntries: stepResult.teleportEntries || [],
    start: performance.now(),
    duration,
    progress: 0,
  };
}

function onAction(action) {
  if (!game || !canInput()) {
    return;
  }
  const result = game.step(action);
  if (!result) {
    return;
  }
  updateStatus();
  startAnimation(result);
}

function onRestart() {
  if (!game) {
    return;
  }
  game.reset();
  anim = null;
  updateStatus();
  setOverlay(false, "", "", "");
}

async function onNext() {
  if (!game || isLoading || game.state !== "won") {
    return;
  }
  try {
    await loadLevelByNumber(currentLevelNumber + 1);
  } catch (error) {
    console.error(error);
    setOverlay(true, "Нет следующего уровня", "Restart", "restart");
  }
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }
  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function loadLevelByNumber(number) {
  const loadingStart = performance.now();
  setLoading(true, "Loading level...");
  setOverlay(false, "", "", "");
  let level = loadedLevels.get(number) || null;
  try {
    if (!level) {
      const filePath = `levels/level_${String(number).padStart(4, "0")}.json`;
      const levelSpec = await fetchJson(filePath);
      validateLevelSpec(levelSpec);
      level = buildRuntimeLevel(levelSpec);
      loadedLevels.set(number, level);
    }

    currentLevelNumber = number;
    game = createGameSession(level);
    anim = null;
    updateStatus();
  } finally {
    const elapsed = performance.now() - loadingStart;
    if (elapsed < MIN_LOADING_MS) {
      await delay(MIN_LOADING_MS - elapsed);
    }
    setLoading(false);
  }
}

async function startFromLevel(index) {
  if (isLoading) {
    return;
  }
  const levelNumber = Number(index);
  if (!Number.isInteger(levelNumber) || levelNumber < 1) {
    return;
  }
  try {
    await loadLevelByNumber(levelNumber);
  } catch (error) {
    console.error(error);
    setOverlay(true, "Load Failed", "Restart", "restart");
  }
}

function tick(now) {
  if (game) {
    if (anim) {
      const elapsed = now - anim.start;
      anim.progress = Math.min(1, elapsed / anim.duration);
      if (anim.progress >= 1) {
        anim = null;
        if (game.state === "won") {
          ym(107098559, 'reachGoal', 'level_complete', { level: currentLevelNumber });
          setOverlay(true, "Level Complete", "Next", "next");
        } else if (game.state === "lost") {
          setOverlay(true, "Try Again", "Restart", "restart");
        }
      }
    }
    renderer.render(game.level, game.positions, anim, {
      showRotationBadge: true,
      hoverCell,
    });
  }
  requestAnimationFrame(tick);
}

function showTooltip(text, clientX, clientY) {
  if (!tooltipEl || !appEl) {
    return;
  }
  const rect = appEl.getBoundingClientRect();
  const offset = 12;
  tooltipEl.textContent = text;
  tooltipEl.style.left = `${clientX - rect.left + offset}px`;
  tooltipEl.style.top = `${clientY - rect.top + offset}px`;
  tooltipEl.classList.remove("hidden");
}

function hideTooltip() {
  if (!tooltipEl) {
    return;
  }
  tooltipEl.classList.add("hidden");
}

function getCellFromPoint(x, y, level) {
  const layout = renderer.getLayout();
  if (!layout) {
    return null;
  }
  const { viewports } = layout;
  for (let i = 0; i < viewports.length; i += 1) {
    const viewport = viewports[i];
    if (
      x >= viewport.x &&
      y >= viewport.y &&
      x <= viewport.x + viewport.width &&
      y <= viewport.y + viewport.height
    ) {
      const map = level.maps[i];
      const rotation = normalizeRotation(map.rotation);
      const centerX = viewport.x + viewport.width / 2;
      const centerY = viewport.y + viewport.height / 2;
      const localX = x - centerX;
      const localY = y - centerY;
      const inverseRotation = (360 - rotation) % 360;
      const unrotated = rotateVector(localX, localY, inverseRotation);
      const mapWidth = map.w * viewport.tileSize;
      const mapHeight = map.h * viewport.tileSize;
      const mapX = unrotated.x + mapWidth / 2;
      const mapY = unrotated.y + mapHeight / 2;
      if (mapX < 0 || mapY < 0 || mapX >= mapWidth || mapY >= mapHeight) {
        return null;
      }
      const tx = Math.floor(mapX / viewport.tileSize);
      const ty = Math.floor(mapY / viewport.tileSize);
      return { mapIndex: i, x: tx, y: ty };
    }
  }
  return null;
}

function getCellType(map, x, y) {
  if (map.walls[y][x] === "#") {
    return "wall";
  }
  if (Array.isArray(map.A) && map.A[0] === x && map.A[1] === y) {
    return "start";
  }
  if (Array.isArray(map.B) && map.B[0] === x && map.B[1] === y) {
    return "goal";
  }
  if (map.teleport && Array.isArray(map.teleport.in)) {
    if (map.teleport.in[0] === x && map.teleport.in[1] === y) {
      return "teleport-in";
    }
  }
  if (map.teleport && Array.isArray(map.teleport.out)) {
    if (map.teleport.out[0] === x && map.teleport.out[1] === y) {
      return "teleport-out";
    }
  }
  return null;
}

function getTypeLabel(type) {
  switch (type) {
    case "wall":
      return "Стена";
    case "start":
      return "Старт";
    case "goal":
      return "Финиш";
    case "teleport-in":
      return "Телепорт (вход)";
    case "teleport-out":
      return "Телепорт (выход)";
    default:
      return "";
  }
}

function getRotationLabel(rotation) {
  if (rotation === 90) {
    return "Поворот: верх вправо";
  }
  if (rotation === 180) {
    return "Поворот: верх вниз";
  }
  if (rotation === 270) {
    return "Поворот: верх влево";
  }
  return "";
}

function updateHoverState(event) {
  if (!game || isLoading) {
    hoverCell = null;
    hideTooltip();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const layout = renderer.getLayout();
  if (!layout) {
    hoverType = null;
    hideTooltip();
    return;
  }

  const { viewports } = layout;
  for (let i = 0; i < viewports.length; i += 1) {
    const map = game.level.maps[i];
    const rotation = normalizeRotation(map.rotation);
    if (rotation === 0) {
      continue;
    }
    const viewport = viewports[i];
    const iconX = viewport.x + ROTATION_ICON_OFFSET_X - ROTATION_ICON_SIZE / 2;
    const iconY = viewport.y + ROTATION_ICON_OFFSET_Y - ROTATION_ICON_SIZE / 2;
    if (
      x >= iconX &&
      y >= iconY &&
      x <= iconX + ROTATION_ICON_SIZE &&
      y <= iconY + ROTATION_ICON_SIZE
    ) {
      hoverCell = null;
      const label = getRotationLabel(rotation);
      if (label) {
        showTooltip(label, event.clientX, event.clientY);
      } else {
        hideTooltip();
      }
      return;
    }
  }

  const cell = getCellFromPoint(x, y, game.level);
  if (!cell) {
    hoverCell = null;
    hideTooltip();
    return;
  }
  const map = game.level.maps[cell.mapIndex];
  const type = getCellType(map, cell.x, cell.y);
  if (!type) {
    hoverCell = null;
    hideTooltip();
    return;
  }
  hoverCell = cell;
  showTooltip(getTypeLabel(type), event.clientX, event.clientY);
}

async function init() {
  await loadLevelByNumber(1);
  bindInput({ onAction, onRestart, onNext, canInput });
  overlayButtonEl.addEventListener("click", () => {
    const command = overlayButtonEl.dataset.command;
    if (command === "next") {
      onNext();
    } else {
      onRestart();
    }
  });
  canvas.addEventListener("pointermove", updateHoverState);
  canvas.addEventListener("pointerleave", () => {
    hoverCell = null;
    hideTooltip();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    if (!overlayEl || overlayEl.classList.contains("hidden")) {
      return;
    }
    event.preventDefault();
    overlayButtonEl.click();
  });
  updateStatus();
  requestAnimationFrame(tick);
}

init().catch((error) => {
  setOverlay(true, "Load Failed", "Restart", "restart");
  console.error(error);
});

window.startFromLevel = startFromLevel;
