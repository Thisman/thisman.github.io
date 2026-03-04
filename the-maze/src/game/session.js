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

function isCrumbleCell(map, x, y) {
  return (map.crumbles || []).some((p) => p[0] === x && p[1] === y);
}

function isSwampCell(map, x, y) {
  return (map.swamp || []).some((p) => p[0] === x && p[1] === y);
}

export function createGameSession(level) {
  const maps = level.maps;
  const maxMoves = level.T;
  const positions = maps.map((map) => ({ x: map.A[0], y: map.A[1] }));
  let movesUsed = 0;
  let state = "playing";

  const collapsedCrumbles = maps.map(() => new Set());
  const stuckInSwamp = maps.map(() => false);

  function isDoorOpen(i) {
    const map = maps[i];
    const pos = positions[i];
    return !!(map.button && pos.x === map.button[0] && pos.y === map.button[1]);
  }

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
    const fells = [];
    const wasStuck = [];

    for (let i = 0; i < maps.length; i += 1) {
      if (stuckInSwamp[i]) {
        wasStuck[i] = true;
        nextPositions.push({ x: prevPositions[i].x, y: prevPositions[i].y });
        bumps.push(false);
        teleports.push(false);
        teleportEntries.push(null);
        fells.push(false);
        stuckInSwamp[i] = false;
      } else {
        wasStuck[i] = false;
        const next = stepOne(prevPositions[i], action, maps[i], {
          collapsedCrumbles: collapsedCrumbles[i],
          doorOpen: isDoorOpen(i),
        });
        nextPositions.push({ x: next.x, y: next.y });
        bumps.push(next.bump);
        teleports.push(Boolean(next.teleported));
        teleportEntries.push(next.teleportEntry);
        fells.push(Boolean(next.fell));
      }
    }

    for (let i = 0; i < positions.length; i += 1) {
      positions[i].x = nextPositions[i].x;
      positions[i].y = nextPositions[i].y;
    }

    // Update crumble/swamp state for players who moved
    for (let i = 0; i < maps.length; i += 1) {
      if (!wasStuck[i] && !fells[i]) {
        const map = maps[i];
        const pos = positions[i];
        const crumbleKey = pos.y * map.w + pos.x;
        if (isCrumbleCell(map, pos.x, pos.y) && !collapsedCrumbles[i].has(crumbleKey)) {
          collapsedCrumbles[i].add(crumbleKey);
        }
        if (isSwampCell(map, pos.x, pos.y)) {
          stuckInSwamp[i] = true;
        }
      }
    }

    movesUsed += 1;

    const anyFell = fells.some(Boolean);
    if (anyFell) {
      state = "lost";
    } else if (allAtGoals(positions, maps)) {
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
      fells,
      movesUsed,
      state,
    };
  }

  function reset() {
    for (let i = 0; i < maps.length; i += 1) {
      positions[i].x = maps[i].A[0];
      positions[i].y = maps[i].A[1];
      collapsedCrumbles[i].clear();
      stuckInSwamp[i] = false;
    }
    movesUsed = 0;
    state = "playing";
  }

  function getDynamicState() {
    return {
      collapsedCrumbles,
      stuckInSwamp,
      doorOpen: maps.map((_, i) => isDoorOpen(i)),
    };
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
    getDynamicState,
  };
}
