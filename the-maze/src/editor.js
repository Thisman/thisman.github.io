import { createRenderer } from "./renderer_canvas.js";
import { validateLevelSpec } from "./core/level.js";
import { normalizeRotation, rotateVector } from "./rotation.js";
import { createEditorState } from "./editor/state.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("editor-status");
const saveBtn = document.getElementById("save-btn");
const levelNumberInput = document.getElementById("level-number");
const levelFilenameEl = document.getElementById("level-filename");
const mapsCountSelect = document.getElementById("maps-count");
const mapSelect = document.getElementById("map-select");
const widthInput = document.getElementById("width-input");
const heightInput = document.getElementById("height-input");
const mapRotationsEl = document.getElementById("map-rotations");
const obstacleToolBtn = document.getElementById("obstacle-tool");
const startToolBtn = document.getElementById("start-tool");
const teleportInToolBtn = document.getElementById("teleport-in-tool");
const teleportOutToolBtn = document.getElementById("teleport-out-tool");
const iceToolBtn = document.getElementById("ice-tool");
const holeToolBtn = document.getElementById("hole-tool");
const springToolBtn = document.getElementById("spring-tool");
const swampToolBtn = document.getElementById("swamp-tool");
const crumbleToolBtn = document.getElementById("crumble-tool");
const arrowUToolBtn = document.getElementById("arrow-u-tool");
const arrowDToolBtn = document.getElementById("arrow-d-tool");
const arrowLToolBtn = document.getElementById("arrow-l-tool");
const arrowRToolBtn = document.getElementById("arrow-r-tool");
const buttonToolBtn = document.getElementById("button-tool");
const doorToolBtn = document.getElementById("door-tool");
const recordBtn = document.getElementById("record-btn");
const recordResetBtn = document.getElementById("record-reset-btn");
const stepsCountEl = document.getElementById("steps-count");

const renderer = createRenderer(canvas);
const MAX_MAPS = 4;
const ACTIONS = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  w: "U",
  s: "D",
  a: "L",
  d: "R",
  W: "U",
  S: "D",
  A: "L",
  D: "R",
};

let anim = null;
let isPainting = false;
let lastPaintCell = null;

function setStatus(message) {
  statusEl.textContent = message;
}

const state = createEditorState({
  onChange: () => {
    anim = null;
    refreshUI();
  },
  onStatus: setStatus,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function refreshUI() {
  refreshMapSelect();
  renderMapRotationControls();
  syncToolButtons();
  setRecordButtonLabel();
  updateStatus();
  updateUiState();
}

function updateStatus() {
  const levelSpec = state.getLevelSpec();
  const stepsLabel = state.getStepsLabel();
  const stageLabel = state.getStageLabel();
  const hasStart = state.hasStart();
  const hasFinish = state.hasFinish();
  statusEl.textContent = `Map ${state.getActiveMapIndex() + 1}/${
    levelSpec.maps.length
  } | Steps: ${stepsLabel} | Start: ${hasStart ? "set" : "none"} | Finish: ${
    hasFinish ? "set" : "none"
  } | ${stageLabel}`;
  stepsCountEl.textContent = String(stepsLabel);
}

function syncToolButtons() {
  const activeTool = state.getActiveTool();
  obstacleToolBtn.classList.toggle("active", activeTool === "obstacle");
  startToolBtn.classList.toggle("active", activeTool === "start");
  teleportInToolBtn.classList.toggle("active", activeTool === "teleportIn");
  teleportOutToolBtn.classList.toggle("active", activeTool === "teleportOut");
  iceToolBtn.classList.toggle("active", activeTool === "ice");
  holeToolBtn.classList.toggle("active", activeTool === "hole");
  springToolBtn.classList.toggle("active", activeTool === "spring");
  swampToolBtn.classList.toggle("active", activeTool === "swamp");
  crumbleToolBtn.classList.toggle("active", activeTool === "crumble");
  arrowUToolBtn.classList.toggle("active", activeTool === "arrowU");
  arrowDToolBtn.classList.toggle("active", activeTool === "arrowD");
  arrowLToolBtn.classList.toggle("active", activeTool === "arrowL");
  arrowRToolBtn.classList.toggle("active", activeTool === "arrowR");
  buttonToolBtn.classList.toggle("active", activeTool === "button");
  doorToolBtn.classList.toggle("active", activeTool === "door");
}

function setRecordButtonLabel() {
  recordBtn.textContent = state.getRecordMode() === "recording" ? "Stop" : "Record";
}

function updateUiState() {
  const recordMode = state.getRecordMode();
  const recording = recordMode === "recording";
  const saved = recordMode === "saved";
  const activeTool = state.getActiveTool();
  const toolActive = Boolean(activeTool);
  const canSaveNow = saved && state.isLevelSaveReady();

  const inputsDisabled = recording || toolActive || saved;
  levelNumberInput.disabled = inputsDisabled;
  mapsCountSelect.disabled = inputsDisabled;
  mapSelect.disabled = inputsDisabled;
  widthInput.disabled = inputsDisabled;
  heightInput.disabled = inputsDisabled;
  obstacleToolBtn.disabled = recording || saved || (toolActive && activeTool !== "obstacle");
  startToolBtn.disabled = recording || saved || (toolActive && activeTool !== "start");
  teleportInToolBtn.disabled = recording || saved || (toolActive && activeTool !== "teleportIn");
  teleportOutToolBtn.disabled = recording || saved || (toolActive && activeTool !== "teleportOut");
  iceToolBtn.disabled = recording || saved || (toolActive && activeTool !== "ice");
  holeToolBtn.disabled = recording || saved || (toolActive && activeTool !== "hole");
  springToolBtn.disabled = recording || saved || (toolActive && activeTool !== "spring");
  swampToolBtn.disabled = recording || saved || (toolActive && activeTool !== "swamp");
  crumbleToolBtn.disabled = recording || saved || (toolActive && activeTool !== "crumble");
  arrowUToolBtn.disabled = recording || saved || (toolActive && activeTool !== "arrowU");
  arrowDToolBtn.disabled = recording || saved || (toolActive && activeTool !== "arrowD");
  arrowLToolBtn.disabled = recording || saved || (toolActive && activeTool !== "arrowL");
  arrowRToolBtn.disabled = recording || saved || (toolActive && activeTool !== "arrowR");
  buttonToolBtn.disabled = recording || saved || (toolActive && activeTool !== "button");
  doorToolBtn.disabled = recording || saved || (toolActive && activeTool !== "door");

  saveBtn.disabled = toolActive || !canSaveNow;
  recordBtn.disabled =
    toolActive || saved || (!recording && !state.canStartRecording());
  recordResetBtn.disabled = toolActive;
  setRotationButtonsDisabled(inputsDisabled);
}

function refreshMapSelect() {
  const levelSpec = state.getLevelSpec();
  mapSelect.innerHTML = "";
  for (let i = 0; i < levelSpec.maps.length; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `Map ${i + 1}`;
    mapSelect.append(option);
  }
  mapSelect.value = String(state.getActiveMapIndex());
}

function renderMapRotationControls() {
  if (!mapRotationsEl) {
    return;
  }
  mapRotationsEl.innerHTML = "";
  const levelSpec = state.getLevelSpec();
  levelSpec.maps.forEach((map, index) => {
    const row = document.createElement("div");
    row.className = "map-rotation-row";

    const label = document.createElement("div");
    label.className = "map-rotation-label";
    label.textContent = `Map ${index + 1}`;

    const angle = document.createElement("div");
    angle.className = "map-rotation-angle";
    angle.textContent = `${normalizeRotation(map.rotation)} deg`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "rotation-btn";
    button.title = "Rotate clockwise";
    button.innerHTML = '<i class="fa-solid fa-rotate"></i>';
    button.addEventListener("click", () => state.rotateMap(index));

    row.append(label, angle, button);
    mapRotationsEl.append(row);
  });
}

function setRotationButtonsDisabled(disabled) {
  if (!mapRotationsEl) {
    return;
  }
  mapRotationsEl.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled;
  });
}

function applyLevelNumber() {
  const nextNumber = clamp(parseInt(levelNumberInput.value, 10), 1, 9999);
  levelNumberInput.value = String(nextNumber);
  const padded = state.setLevelNumber(nextNumber);
  if (levelFilenameEl) {
    levelFilenameEl.textContent = `level_${padded}.json`;
  }
  return padded;
}

function syncLevelNumberFromId() {
  const levelSpec = state.getLevelSpec();
  const match =
    typeof levelSpec.id === "string"
      ? levelSpec.id.match(/level_(\d{1,4})/)
      : null;
  const number = match ? parseInt(match[1], 10) : 1;
  levelNumberInput.value = String(number);
  applyLevelNumber();
}

function getCellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const layout = renderer.getLayout();
  if (!layout) {
    return null;
  }
  const runtimeLevel = state.getRuntimeLevel();
  const { viewports } = layout;
  for (let i = 0; i < viewports.length; i += 1) {
    const viewport = viewports[i];
    if (
      x >= viewport.x &&
      y >= viewport.y &&
      x <= viewport.x + viewport.width &&
      y <= viewport.y + viewport.height
    ) {
      const map = runtimeLevel.maps[i];
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

function canMove() {
  if (anim) {
    return false;
  }
  return state.getRecordMode() === "recording";
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
  if (!canMove()) {
    return;
  }
  const result = state.step(action);
  if (!result) {
    return;
  }
  startAnimation(result);
}

function tick(now) {
  const runtimeLevel = state.getRuntimeLevel();
  const positions = state.getPositions();
  if (runtimeLevel) {
    if (anim) {
      const elapsed = now - anim.start;
      anim.progress = Math.min(1, elapsed / anim.duration);
      if (anim.progress >= 1) {
        anim = null;
      }
    }
    renderer.render(runtimeLevel, positions, anim, {
      showRotationBadge: false,
      dynamicState: state.getEditorDynamicState(),
    });
  }
  requestAnimationFrame(tick);
}

function saveLevel() {
  try {
    if (state.getRecordMode() === "recording") {
      state.stopRecording();
    }
    applyLevelNumber();
    validateLevelSpec(state.getLevelSpec());
  } catch (error) {
    setStatus(`Cannot save: ${error.message}`);
    return;
  }
  const json = JSON.stringify(state.getLevelSpec(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = state.getLevelSpec().id || "level_0001";
  link.href = url;
  link.download = `${baseName}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("Saved level file");
  resetAfterSave();
}

function resetAfterSave() {
  if (state.getRecordMode() === "recording") {
    state.stopRecording();
  }
  state.resetIdleState();
}

saveBtn.addEventListener("click", () => {
  saveLevel();
});

levelNumberInput.addEventListener("change", () => {
  applyLevelNumber();
});

mapsCountSelect.addEventListener("change", () => {
  const nextCount = clamp(parseInt(mapsCountSelect.value, 10), 1, MAX_MAPS);
  mapsCountSelect.value = String(nextCount);
  state.setMapsCount(nextCount);
});

mapSelect.addEventListener("change", () => {
  state.setActiveMap(parseInt(mapSelect.value, 10));
});

widthInput.addEventListener("change", () => {
  const nextWidth = clamp(parseInt(widthInput.value, 10), 2, 20);
  widthInput.value = String(nextWidth);
  const currentHeight = state.getLevelSpec().maps[0].h;
  state.setMapSize(nextWidth, currentHeight);
});

heightInput.addEventListener("change", () => {
  const nextHeight = clamp(parseInt(heightInput.value, 10), 2, 20);
  heightInput.value = String(nextHeight);
  const currentWidth = state.getLevelSpec().maps[0].w;
  state.setMapSize(currentWidth, nextHeight);
});

obstacleToolBtn.addEventListener("click", () => {
  state.toggleTool("obstacle");
});

startToolBtn.addEventListener("click", () => {
  state.toggleTool("start");
});

teleportInToolBtn.addEventListener("click", () => {
  state.toggleTool("teleportIn");
});

teleportOutToolBtn.addEventListener("click", () => {
  state.toggleTool("teleportOut");
});

iceToolBtn.addEventListener("click", () => { state.toggleTool("ice"); });
holeToolBtn.addEventListener("click", () => { state.toggleTool("hole"); });
springToolBtn.addEventListener("click", () => { state.toggleTool("spring"); });
swampToolBtn.addEventListener("click", () => { state.toggleTool("swamp"); });
crumbleToolBtn.addEventListener("click", () => { state.toggleTool("crumble"); });
arrowUToolBtn.addEventListener("click", () => { state.toggleTool("arrowU"); });
arrowDToolBtn.addEventListener("click", () => { state.toggleTool("arrowD"); });
arrowLToolBtn.addEventListener("click", () => { state.toggleTool("arrowL"); });
arrowRToolBtn.addEventListener("click", () => { state.toggleTool("arrowR"); });
buttonToolBtn.addEventListener("click", () => { state.toggleTool("button"); });
doorToolBtn.addEventListener("click", () => { state.toggleTool("door"); });

recordBtn.addEventListener("click", () => {
  if (state.getRecordMode() === "recording") {
    state.stopRecording();
    return;
  }
  state.startRecording();
});

recordResetBtn.addEventListener("click", () => {
  if (state.getRecordMode() === "recording") {
    state.resetRecordingProgress();
    return;
  }
  state.resetIdleState();
});

canvas.addEventListener("pointerdown", (event) => {
  const activeTool = state.getActiveTool();
  if (!activeTool) {
    return;
  }
  const cell = getCellFromEvent(event);
  if (!cell) {
    return;
  }
  if (cell.mapIndex !== state.getActiveMapIndex()) {
    state.setActiveMap(cell.mapIndex);
  }
  if (activeTool === "start") {
    state.applyPaintCell(cell);
    return;
  }
  if (activeTool === "obstacle") {
    if (state.isProtectedCell(cell.mapIndex, cell.x, cell.y)) {
      setStatus("Cell is protected");
      return;
    }
    isPainting = true;
    lastPaintCell = null;
    state.applyPaintCell(cell);
    return;
  }
  state.applyPaintCell(cell);
});

canvas.addEventListener("pointermove", (event) => {
  if (state.getActiveTool() !== "obstacle" || !isPainting) {
    return;
  }
  const cell = getCellFromEvent(event);
  if (!cell) {
    return;
  }
  const key = `${cell.mapIndex}:${cell.x}:${cell.y}`;
  if (lastPaintCell === key) {
    return;
  }
  lastPaintCell = key;
  state.applyPaintCell(cell);
});

window.addEventListener("pointerup", () => {
  isPainting = false;
  lastPaintCell = null;
});

window.addEventListener("keydown", (event) => {
  if (
    event.target &&
    ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)
  ) {
    return;
  }
  const action = ACTIONS[event.key];
  if (!action) {
    return;
  }
  event.preventDefault();
  onAction(action);
});

syncLevelNumberFromId();
refreshUI();
requestAnimationFrame(tick);
