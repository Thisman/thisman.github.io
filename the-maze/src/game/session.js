import { ACTIONS, stepOne } from "../core/movement.js";

function allAtGoals(positions, maps) {
  for (let i = 0; i < maps.length; i += 1) {
    const goal = maps[i].B;
    if (positions[i].x !== goal[0] || positions[i].y !== goal[1]) {
      return false;
    }
  }
  return true;
}

export function createGameSession(level) {
  const maps = level.maps;
  const maxMoves = level.T;
  const positions = maps.map((map) => ({ x: map.A[0], y: map.A[1] }));
  let movesUsed = 0;
  let state = "playing";

  function step(action) {
    if (!ACTIONS.includes(action)) {
      return null;
    }
    if (state !== "playing") {
      return null;
    }
    if (movesUsed >= maxMoves) {
      return null;
    }

    const prevPositions = positions.map((pos) => ({ ...pos }));
    const nextPositions = [];
    const bumps = [];
    const teleports = [];
    const teleportEntries = [];

    for (let i = 0; i < maps.length; i += 1) {
      const next = stepOne(prevPositions[i], action, maps[i]);
      nextPositions.push({ x: next.x, y: next.y });
      bumps.push(next.bump);
      teleports.push(Boolean(next.teleported));
      teleportEntries.push(next.teleportEntry);
    }

    for (let i = 0; i < positions.length; i += 1) {
      positions[i].x = nextPositions[i].x;
      positions[i].y = nextPositions[i].y;
    }

    movesUsed += 1;
    if (allAtGoals(positions, maps)) {
      state = "won";
    } else if (movesUsed === maxMoves) {
      state = "lost";
    }

    return {
      action,
      prevPositions,
      nextPositions,
      bumps,
      teleports,
      teleportEntries,
      movesUsed,
      state,
    };
  }

  function reset() {
    for (let i = 0; i < maps.length; i += 1) {
      positions[i].x = maps[i].A[0];
      positions[i].y = maps[i].A[1];
    }
    movesUsed = 0;
    state = "playing";
  }

  return {
    level,
    positions,
    get movesUsed() {
      return movesUsed;
    },
    get maxMoves() {
      return maxMoves;
    },
    get state() {
      return state;
    },
    step,
    reset,
  };
}
