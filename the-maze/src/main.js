import { createGameSession } from "./game/session.js";
import { createRenderer } from "./renderer_canvas.js";
import { bindInput } from "./input.js";
import { buildRuntimeLevel } from "./core/level.js";
import { stepOne } from "./core/movement.js";
import { normalizeRotation, rotateVector } from "./rotation.js";
import { generateLevel } from "./level_generator.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const statusLevelEl = document.getElementById("status-level");
const statusStepsEl = document.getElementById("status-steps");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayButtonEl = document.getElementById("overlay-button");
const loadingEl = document.getElementById("loading");
const gameoverOverlayEl = document.getElementById("gameover-overlay");
const skipBtnEl = document.getElementById("skip-btn");
const skipCounterEl = document.getElementById("skip-counter");
const helpBtnEl = document.getElementById("help-btn");
const helpOverlayEl = document.getElementById("help-overlay");
const helpCloseEl = document.getElementById("help-close");
const statusTimerEl = document.getElementById("status-timer");

const MAX_SKIPS = 3;
let skipsLeft = MAX_SKIPS;

// ── Timer ──────────────────────────────────────────────────────────────────
let timerStartMs = 0;
let timerRafId = null;

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function tickTimer() {
  if (!statusTimerEl) return;
  statusTimerEl.textContent = formatTime(Date.now() - timerStartMs);
  timerRafId = requestAnimationFrame(tickTimer);
}

function startTimer() {
  stopTimer();
  timerStartMs = Date.now();
  if (statusTimerEl) statusTimerEl.textContent = "00:00";
  timerRafId = requestAnimationFrame(tickTimer);
}

function stopTimer() {
  if (timerRafId !== null) {
    cancelAnimationFrame(timerRafId);
    timerRafId = null;
  }
}

function elapsedTime() {
  return Date.now() - timerStartMs;
}

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

function setOverlay(visible, title, buttonText, buttonCommand, timeMs = null) {
  if (!overlayEl) {
    return;
  }
  overlayEl.classList.toggle("hidden", !visible);
  overlayTitleEl.textContent = title;
  overlayButtonEl.textContent = buttonText;
  overlayButtonEl.dataset.command = buttonCommand;

  let timeEl = overlayEl.querySelector(".overlay-time");
  if (visible && timeMs !== null) {
    if (!timeEl) {
      timeEl = document.createElement("p");
      timeEl.className = "overlay-time";
      overlayTitleEl.after(timeEl);
    }
    timeEl.textContent = `Время: ${formatTime(timeMs)}`;
  } else if (timeEl) {
    timeEl.remove();
  }
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
  updateSkipBtn();
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
  startTimer();
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

function updateSkipBtn() {
  if (!skipCounterEl || !skipBtnEl) return;
  skipCounterEl.textContent = skipsLeft;
  skipBtnEl.disabled = skipsLeft <= 0 || isLoading;
}

async function onSkip() {
  if (isLoading || skipsLeft <= 0) return;
  skipsLeft -= 1;
  updateSkipBtn();
  if (skipsLeft <= 0) {
    if (gameoverOverlayEl) gameoverOverlayEl.classList.remove("hidden");
    return;
  }
  setOverlay(false, "", "", "");
  try {
    await loadLevelByNumber(currentLevelNumber + 1);
  } catch (error) {
    console.error(error);
  }
}

function openHelp() {
  if (helpOverlayEl) helpOverlayEl.classList.remove("hidden");
}

function closeHelp() {
  if (helpOverlayEl) helpOverlayEl.classList.add("hidden");
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function generateLevelAsync(number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(generateLevel(number));
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
}

async function loadLevelByNumber(number) {
  const loadingStart = performance.now();
  stopTimer();
  setLoading(true, "Loading level...");
  setOverlay(false, "", "", "");
  let level = loadedLevels.get(number) || null;
  try {
    if (!level) {
      const levelSpec = await generateLevelAsync(number);
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
    startTimer();
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
          const elapsed = elapsedTime();
          stopTimer();
          ym(107098559, 'reachGoal', 'level_complete', { level: currentLevelNumber });
          setOverlay(true, "Level Complete", "Next", "next", elapsed);
        } else if (game.state === "lost") {
          stopTimer();
          setOverlay(true, "Try Again", "Restart", "restart");
        }
      }
    }
    renderer.render(game.level, game.positions, anim, {
      showRotationBadge: true,
      hoverCell,
      dynamicState: game.getDynamicState(),
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
      const unrotated = rotateVector(localX, localY, rotation);
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
  if ((map.ice || []).some((p) => p[0] === x && p[1] === y)) return "ice";
  if ((map.holes || []).some((p) => p[0] === x && p[1] === y)) return "hole";
  if ((map.springs || []).some((p) => p[0] === x && p[1] === y)) return "spring";
  if ((map.swamp || []).some((p) => p[0] === x && p[1] === y)) return "swamp";
  if ((map.crumbles || []).some((p) => p[0] === x && p[1] === y)) return "crumble";
  if ((map.arrows || []).some((p) => p[0] === x && p[1] === y)) return "arrow";
  if (map.button && map.button[0] === x && map.button[1] === y) return "button";
  if (map.door && map.door[0] === x && map.door[1] === y) return "door";
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
    case "ice":
      return "Лёд";
    case "hole":
      return "Яма";
    case "spring":
      return "Пружина";
    case "swamp":
      return "Болото";
    case "crumble":
      return "Рассыпающийся пол";
    case "arrow":
      return "Стрелка";
    case "button":
      return "Кнопка";
    case "door":
      return "Дверь";
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
    hoverCell = null;
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
  updateSkipBtn();
  await loadLevelByNumber(1);
  bindInput({ onAction, onRestart, onNext, onSkip, canInput });
  overlayButtonEl.addEventListener("click", () => {
    const command = overlayButtonEl.dataset.command;
    if (command === "next") {
      onNext();
    } else {
      onRestart();
    }
  });
  if (skipBtnEl) {
    skipBtnEl.addEventListener("click", onSkip);
  }
  if (helpBtnEl) {
    helpBtnEl.addEventListener("click", openHelp);
  }
  if (helpCloseEl) {
    helpCloseEl.addEventListener("click", closeHelp);
  }
  if (helpOverlayEl) {
    helpOverlayEl.addEventListener("click", (e) => {
      if (e.target === helpOverlayEl) closeHelp();
    });
  }
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

window.solve = function () {
  if (!game) {
    console.warn("No active game");
    return null;
  }

  const maps = game.level.maps;
  const T = game.level.T;
  const ACTIONS = ["U", "D", "L", "R"];

  function encodeState(positions, collapsed, stuck) {
    let k = "";
    for (let i = 0; i < positions.length; i++) {
      k += `${positions[i].x},${positions[i].y}|${[...collapsed[i]].sort((a, b) => a - b).join(",")}|${stuck[i] ? 1 : 0}|`;
    }
    return k;
  }

  function allAtGoals(positions) {
    return maps.every((m, i) => positions[i].x === m.B[0] && positions[i].y === m.B[1]);
  }

  const startPos = maps.map((m) => ({ x: m.A[0], y: m.A[1] }));
  const startCollapsed = maps.map(() => new Set());
  const startStuck = maps.map(() => false);
  const startKey = encodeState(startPos, startCollapsed, startStuck);

  const queue = [{ positions: startPos, collapsed: startCollapsed, stuck: startStuck, depth: 0 }];
  const prev = new Map([[startKey, null]]); // key → { parentKey, action }

  for (let head = 0; head < queue.length; head++) {
    const { positions, collapsed, stuck, depth } = queue[head];
    if (depth >= T) continue;

    for (const action of ACTIONS) {
      const nextPos = [];
      const nextCollapsed = collapsed.map((s) => new Set(s));
      const nextStuck = [...stuck];
      let fell = false;

      for (let i = 0; i < maps.length; i++) {
        if (stuck[i]) {
          nextPos.push({ ...positions[i] });
          nextStuck[i] = false;
        } else {
          const r = stepOne(positions[i], action, maps[i], {
            collapsedCrumbles: collapsed[i],
            doorOpen: false,
          });
          nextPos.push({ x: r.x, y: r.y });
          if (r.fell) { fell = true; break; }
        }
      }
      if (fell) continue;

      for (let i = 0; i < maps.length; i++) {
        if (stuck[i]) continue;
        const map = maps[i], pos = nextPos[i], key = pos.y * map.w + pos.x;
        if ((map.crumbles || []).some((c) => c[0] === pos.x && c[1] === pos.y)) nextCollapsed[i].add(key);
        if ((map.swamp || []).some((s) => s[0] === pos.x && s[1] === pos.y)) nextStuck[i] = true;
      }

      const nextKey = encodeState(nextPos, nextCollapsed, nextStuck);
      if (prev.has(nextKey)) continue;
      const parentKey = encodeState(positions, collapsed, stuck);
      prev.set(nextKey, { parentKey, action });

      if (allAtGoals(nextPos)) {
        // Reconstruct path
        const path = [];
        let cur = nextKey;
        while (prev.get(cur) !== null) {
          const { parentKey: pk, action: a } = prev.get(cur);
          path.unshift(a);
          cur = pk;
        }
        const solution = path.join("");
        console.log(`Solution (${path.length} moves): ${solution}`);
        return solution;
      }

      queue.push({ positions: nextPos, collapsed: nextCollapsed, stuck: nextStuck, depth: depth + 1 });
    }
  }

  console.warn("No solution found within T moves");
  return null;
};




