const ACTIONS = ["U", "D", "L", "R"];
const DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

function inBounds(x, y, w, h) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function isWall(map, x, y) {
  return map.walls[y][x] === "#";
}

function isIce(map, x, y) {
  return (map.ice || []).some((p) => p[0] === x && p[1] === y);
}

function getArrowDir(map, x, y) {
  const entry = (map.arrows || []).find((p) => p[0] === x && p[1] === y);
  return entry ? entry[2] : null;
}

function isHole(map, x, y) {
  return (map.holes || []).some((p) => p[0] === x && p[1] === y);
}

function isSpring(map, x, y) {
  return (map.springs || []).some((p) => p[0] === x && p[1] === y);
}

function isDoor(map, x, y) {
  return !!(map.door && map.door[0] === x && map.door[1] === y);
}

function applyTeleport(pos, map) {
  if (!map.teleport || !map.teleport.in || !map.teleport.out) {
    return { pos, teleported: false };
  }
  const entry = map.teleport.in;
  if (pos.x === entry[0] && pos.y === entry[1]) {
    return {
      pos: { x: map.teleport.out[0], y: map.teleport.out[1] },
      teleported: true,
    };
  }
  return { pos, teleported: false };
}

function canEnterCell(nx, ny, action, map, collapsedCrumbles, doorOpen) {
  if (!inBounds(nx, ny, map.w, map.h)) return false;
  if (isWall(map, nx, ny)) return false;
  const crumbleKey = ny * map.w + nx;
  if (collapsedCrumbles && collapsedCrumbles.has(crumbleKey) &&
      (map.crumbles || []).some((p) => p[0] === nx && p[1] === ny)) {
    return false;
  }
  const arrowDir = getArrowDir(map, nx, ny);
  if (arrowDir && action !== arrowDir) return false;
  if (isDoor(map, nx, ny) && !doorOpen) return false;
  return true;
}

export function stepOne(pos, action, map, dynamicState = {}) {
  const { collapsedCrumbles = null, doorOpen = false } = dynamicState;
  const dir = DIRS[action];
  if (!dir) {
    return { x: pos.x, y: pos.y, bump: true, teleported: false, teleportEntry: null, fell: false };
  }
  const nx = pos.x + dir.x;
  const ny = pos.y + dir.y;

  if (!canEnterCell(nx, ny, action, map, collapsedCrumbles, doorOpen)) {
    return { x: pos.x, y: pos.y, bump: true, teleported: false, teleportEntry: null, fell: false };
  }

  // Successfully entered cell (nx, ny)
  let finalX = nx;
  let finalY = ny;

  // Ice sliding
  if (isIce(map, finalX, finalY)) {
    while (true) {
      const slideX = finalX + dir.x;
      const slideY = finalY + dir.y;
      if (!canEnterCell(slideX, slideY, action, map, collapsedCrumbles, doorOpen)) {
        break;
      }
      finalX = slideX;
      finalY = slideY;
      if (!isIce(map, finalX, finalY)) {
        break;
      }
    }
  }

  // Spring: one extra step in same direction
  if (isSpring(map, finalX, finalY)) {
    const springX = finalX + dir.x;
    const springY = finalY + dir.y;
    if (canEnterCell(springX, springY, action, map, collapsedCrumbles, doorOpen)) {
      finalX = springX;
      finalY = springY;
    }
  }

  // Hole check on final position
  if (isHole(map, finalX, finalY)) {
    return { x: finalX, y: finalY, bump: false, teleported: false, teleportEntry: null, fell: true };
  }

  // Teleport
  const moved = { x: finalX, y: finalY };
  const teleported = applyTeleport(moved, map);
  return {
    x: teleported.pos.x,
    y: teleported.pos.y,
    bump: false,
    teleported: teleported.teleported,
    teleportEntry: teleported.teleported ? { x: nx, y: ny } : null,
    fell: false,
  };
}

export { ACTIONS };
