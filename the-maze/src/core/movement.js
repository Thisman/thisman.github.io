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

export function stepOne(pos, action, map) {
  const dir = DIRS[action];
  if (!dir) {
    return { x: pos.x, y: pos.y, bump: true, teleported: false, teleportEntry: null };
  }
  const nx = pos.x + dir.x;
  const ny = pos.y + dir.y;
  if (!inBounds(nx, ny, map.w, map.h)) {
    return { x: pos.x, y: pos.y, bump: true, teleported: false, teleportEntry: null };
  }
  if (isWall(map, nx, ny)) {
    return { x: pos.x, y: pos.y, bump: true, teleported: false, teleportEntry: null };
  }
  const moved = { x: nx, y: ny, bump: false };
  const teleported = applyTeleport(moved, map);
  return {
    x: teleported.pos.x,
    y: teleported.pos.y,
    bump: false,
    teleported: teleported.teleported,
    teleportEntry: teleported.teleported ? { x: nx, y: ny } : null,
  };
}

export { ACTIONS };
