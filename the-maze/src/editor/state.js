import { buildRuntimeLevel } from "../core/level.js";
import { stepOne } from "../core/movement.js";
import { normalizeRotation } from "../rotation.js";

const TOOL_TYPES = ["obstacle", "start", "teleportIn", "teleportOut"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createEmptyLevel() {
  const mapsCount = 1;
  const width = 4;
  const height = 4;
  return {
    format: "dualgrid-level@2",
    id: "level_0001",
    title: "Level 1",
    rules: {
      moveSet: "UDLR",
      collision: "bump",
      winOnExactT: true,
      mapsCount,
    },
    T: 1,
    maps: Array.from({ length: mapsCount }, () => ({
      w: width,
      h: height,
      obstacles: [],
      A: null,
      B: null,
      rotation: 0,
      teleport: { in: null, out: null },
    })),
  };
}

export function createEditorState({ onChange, onStatus } = {}) {
  let levelSpec = createEmptyLevel();
  let runtimeLevel = buildRuntimeLevel(levelSpec, { allowMissingEndpoints: true });
  let positions = runtimeLevel.maps.map(() => ({ x: 0, y: 0 }));
  let activeMapIndex = 0;
  let activeTool = null;
  let recordMode = "build";
  let recordSteps = 0;

  function notify() {
    if (typeof onChange === "function") {
      onChange();
    }
  }

  function setStatus(message) {
    if (typeof onStatus === "function") {
      onStatus(message);
    }
  }

  function syncRules() {
    levelSpec.rules = {
      moveSet: "UDLR",
      collision: "bump",
      winOnExactT: true,
      mapsCount: levelSpec.maps.length,
    };
  }

  function ensurePositions() {
    const count = levelSpec.maps.length;
    positions = positions.slice(0, count);
    while (positions.length < count) {
      positions.push({ x: 0, y: 0 });
    }
    for (let i = 0; i < count; i += 1) {
      const map = levelSpec.maps[i];
      positions[i].x = clamp(positions[i].x, 0, map.w - 1);
      positions[i].y = clamp(positions[i].y, 0, map.h - 1);
    }
  }

  function updateRuntime() {
    runtimeLevel = buildRuntimeLevel(levelSpec, { allowMissingEndpoints: true });
    ensurePositions();
    notify();
  }

  function clearEndpoints() {
    levelSpec.maps.forEach((map) => {
      map.A = null;
      map.B = null;
    });
  }

  function resetToDefaults() {
    clearEndpoints();
    recordMode = "build";
    recordSteps = 0;
    levelSpec.T = 1;
    positions = levelSpec.maps.map(() => ({ x: 0, y: 0 }));
  }

  function onStructureChange() {
    resetToDefaults();
    updateRuntime();
  }

  function isObstacle(map, x, y) {
    return map.obstacles.some((point) => point[0] === x && point[1] === y);
  }

  function hasTeleportPoint(map, x, y) {
    if (!map.teleport) {
      return false;
    }
    const entry = map.teleport.in;
    const exit = map.teleport.out;
    return (
      (Array.isArray(entry) && entry[0] === x && entry[1] === y) ||
      (Array.isArray(exit) && exit[0] === x && exit[1] === y)
    );
  }

  function setObstacle(mapIndex, x, y, mode) {
    const map = levelSpec.maps[mapIndex];
    const idx = map.obstacles.findIndex(
      (point) => point[0] === x && point[1] === y
    );
    if (mode === "add") {
      if (idx === -1) {
        map.obstacles.push([x, y]);
      }
    } else if (mode === "remove") {
      if (idx !== -1) {
        map.obstacles.splice(idx, 1);
      }
    } else if (idx === -1) {
      map.obstacles.push([x, y]);
    } else {
      map.obstacles.splice(idx, 1);
    }
    onStructureChange();
  }

  function setStartPoint(mapIndex, x, y) {
    const map = levelSpec.maps[mapIndex];
    if (isObstacle(map, x, y)) {
      setStatus("Start must be on empty cell");
      return false;
    }
    if (hasTeleportPoint(map, x, y)) {
      setStatus("Start cannot be on teleport");
      return false;
    }
    map.A = [x, y];
    map.B = null;
    recordMode = "build";
    recordSteps = 0;
    levelSpec.T = 1;
    positions[mapIndex] = { x, y };
    updateRuntime();
    return true;
  }

  function setTeleportPoint(mapIndex, x, y, which) {
    const map = levelSpec.maps[mapIndex];
    if (!map.teleport) {
      map.teleport = { in: null, out: null };
    }
    if (isObstacle(map, x, y)) {
      setStatus("Teleport must be on empty cell");
      return false;
    }
    if (Array.isArray(map.A) && map.A[0] === x && map.A[1] === y) {
      setStatus("Teleport cannot be on start");
      return false;
    }
    if (Array.isArray(map.B) && map.B[0] === x && map.B[1] === y) {
      setStatus("Teleport cannot be on finish");
      return false;
    }
    const pos = positions[mapIndex];
    if (pos.x === x && pos.y === y) {
      setStatus("Teleport cannot be on player");
      return false;
    }
    const other = which === "in" ? map.teleport.out : map.teleport.in;
    if (Array.isArray(other) && other[0] === x && other[1] === y) {
      setStatus("Teleport points must be different");
      return false;
    }
    const current = which === "in" ? map.teleport.in : map.teleport.out;
    if (Array.isArray(current) && current[0] === x && current[1] === y) {
      if (which === "in") {
        map.teleport.in = null;
      } else {
        map.teleport.out = null;
      }
    } else if (which === "in") {
      map.teleport.in = [x, y];
    } else {
      map.teleport.out = [x, y];
    }
    updateRuntime();
    return true;
  }

  function canStartRecording() {
    return levelSpec.maps.every((map) => {
      if (!Array.isArray(map.A)) {
        return false;
      }
      return !isObstacle(map, map.A[0], map.A[1]);
    });
  }

  function setPositionsToStart() {
    positions = levelSpec.maps.map((map) => ({
      x: map.A[0],
      y: map.A[1],
    }));
  }

  function startRecording() {
    if (!canStartRecording()) {
      setStatus("Set start for all maps");
      return false;
    }
    recordMode = "recording";
    recordSteps = 0;
    levelSpec.maps.forEach((map) => {
      map.B = null;
    });
    setPositionsToStart();
    levelSpec.T = 1;
    activeTool = null;
    updateRuntime();
    return true;
  }

  function stopRecording() {
    if (recordMode !== "recording") {
      return false;
    }
    levelSpec.maps.forEach((map, index) => {
      map.B = [positions[index].x, positions[index].y];
    });
    levelSpec.T = Math.max(1, recordSteps);
    recordMode = "saved";
    setPositionsToStart();
    updateRuntime();
    return true;
  }

  function resetRecordingProgress() {
    if (recordMode !== "recording") {
      return false;
    }
    recordSteps = 0;
    setPositionsToStart();
    levelSpec.T = 1;
    updateRuntime();
    return true;
  }

  function resetIdleState() {
    resetToDefaults();
    activeTool = null;
    updateRuntime();
    return true;
  }

  function applyPaintCell(cell) {
    if (recordMode === "recording" || !cell) {
      return false;
    }
    if (activeTool === "obstacle") {
      const map = levelSpec.maps[cell.mapIndex];
      if (isProtectedCell(cell.mapIndex, cell.x, cell.y)) {
        setStatus("Cell is protected");
        return false;
      }
      setObstacle(cell.mapIndex, cell.x, cell.y);
      return true;
    }
    if (activeTool === "start") {
      return setStartPoint(cell.mapIndex, cell.x, cell.y);
    }
    if (activeTool === "teleportIn") {
      return setTeleportPoint(cell.mapIndex, cell.x, cell.y, "in");
    }
    if (activeTool === "teleportOut") {
      return setTeleportPoint(cell.mapIndex, cell.x, cell.y, "out");
    }
    return false;
  }

  function step(action) {
    if (recordMode !== "recording") {
      return null;
    }
    const prevPositions = positions.map((pos) => ({ ...pos }));
    const nextPositions = [];
    const bumps = [];
    const teleports = [];
    const teleportEntries = [];
    for (let i = 0; i < runtimeLevel.maps.length; i += 1) {
      const map = runtimeLevel.maps[i];
      const next = stepOne(prevPositions[i], action, map);
      nextPositions.push({ x: next.x, y: next.y });
      bumps.push(next.bump);
      teleports.push(Boolean(next.teleported));
      teleportEntries.push(next.teleportEntry);
    }
    positions = nextPositions;
    recordSteps += 1;
    notify();
    return {
      action,
      prevPositions,
      nextPositions,
      bumps,
      teleports,
      teleportEntries,
    };
  }

  function setLevelNumber(number) {
    const padded = String(number).padStart(4, "0");
    levelSpec.id = `level_${padded}`;
    levelSpec.title = `Level ${number}`;
    notify();
    return padded;
  }

  function setMapsCount(nextCount) {
    const current = levelSpec.maps.length;
    if (nextCount === current) {
      return false;
    }
    if (nextCount > current) {
      const base = levelSpec.maps[0];
      for (let i = current; i < nextCount; i += 1) {
        levelSpec.maps.push({
          w: base.w,
          h: base.h,
          obstacles: [],
          A: null,
          B: null,
          rotation: 0,
          teleport: { in: null, out: null },
        });
      }
    } else {
      levelSpec.maps = levelSpec.maps.slice(0, nextCount);
    }
    activeMapIndex = clamp(activeMapIndex, 0, levelSpec.maps.length - 1);
    syncRules();
    onStructureChange();
    return true;
  }

  function setMapSize(nextWidth, nextHeight) {
    levelSpec.maps.forEach((map) => {
      map.w = nextWidth;
      map.h = nextHeight;
      map.obstacles = map.obstacles.filter(
        (point) => point[0] < nextWidth && point[1] < nextHeight
      );
      if (map.teleport) {
        if (Array.isArray(map.teleport.in) && map.teleport.in[0] >= nextWidth) {
          map.teleport.in = null;
        }
        if (Array.isArray(map.teleport.out) && map.teleport.out[0] >= nextWidth) {
          map.teleport.out = null;
        }
        if (Array.isArray(map.teleport.in) && map.teleport.in[1] >= nextHeight) {
          map.teleport.in = null;
        }
        if (Array.isArray(map.teleport.out) && map.teleport.out[1] >= nextHeight) {
          map.teleport.out = null;
        }
      }
    });
    onStructureChange();
  }

  function rotateMap(index) {
    const map = levelSpec.maps[index];
    map.rotation = (normalizeRotation(map.rotation) + 90) % 360;
    updateRuntime();
  }

  function setActiveMap(index) {
    activeMapIndex = clamp(index, 0, levelSpec.maps.length - 1);
    notify();
  }

  function setActiveTool(tool) {
    activeTool = TOOL_TYPES.includes(tool) ? tool : null;
    notify();
  }

  function toggleTool(tool) {
    if (activeTool === tool) {
      setActiveTool(null);
    } else {
      setActiveTool(tool);
    }
  }

  function hasStart() {
    return levelSpec.maps.every((map) => Array.isArray(map.A));
  }

  function hasFinish() {
    return levelSpec.maps.every((map) => Array.isArray(map.B));
  }

  function getStepsLabel() {
    return recordMode === "recording" ? recordSteps : levelSpec.T;
  }

  function getStageLabel() {
    if (recordMode === "recording") {
      return "Recording";
    }
    if (recordMode === "saved") {
      return "Saved";
    }
    return "Build";
  }

  function isLevelSaveReady() {
    return levelSpec.maps.every((map) => {
      if (!Array.isArray(map.A)) {
        return false;
      }
      if (!Array.isArray(map.B)) {
        return false;
      }
      return map.A[0] !== map.B[0] || map.A[1] !== map.B[1];
    });
  }

  function isProtectedCell(mapIndex, x, y) {
    const map = levelSpec.maps[mapIndex];
    const pos = positions[mapIndex];
    if (pos.x === x && pos.y === y) {
      return true;
    }
    if (Array.isArray(map.A) && map.A[0] === x && map.A[1] === y) {
      return true;
    }
    if (Array.isArray(map.B) && map.B[0] === x && map.B[1] === y) {
      return true;
    }
    if (hasTeleportPoint(map, x, y)) {
      return true;
    }
    return false;
  }

  function getSnapshot() {
    return {
      levelSpec,
      runtimeLevel,
      positions,
      activeMapIndex,
      activeTool,
      recordMode,
      recordSteps,
    };
  }

  return {
    getSnapshot,
    getLevelSpec() {
      return levelSpec;
    },
    getRuntimeLevel() {
      return runtimeLevel;
    },
    getPositions() {
      return positions;
    },
    getActiveMapIndex() {
      return activeMapIndex;
    },
    getActiveTool() {
      return activeTool;
    },
    getRecordMode() {
      return recordMode;
    },
    getRecordSteps() {
      return recordSteps;
    },
    getStepsLabel,
    getStageLabel,
    hasStart,
    hasFinish,
    canStartRecording,
    isLevelSaveReady,
    isProtectedCell,
    setLevelNumber,
    setMapsCount,
    setMapSize,
    setActiveMap,
    rotateMap,
    setActiveTool,
    toggleTool,
    applyPaintCell,
    setStartPoint,
    setTeleportPoint,
    setObstacle,
    startRecording,
    stopRecording,
    resetRecordingProgress,
    resetIdleState,
    step,
  };
}
