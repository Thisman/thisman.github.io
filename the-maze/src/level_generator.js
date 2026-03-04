import { stepOne } from "./core/movement.js";

const ACTIONS = ["U", "D", "L", "R"];
const DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};
const OPPOSITE = { U: "D", D: "U", L: "R", R: "L" };

const MAX_ATTEMPTS = 300;

// Tier 0 = tier 1 (levels 1-8), tier 6 = tier 7 (levels 49+, repeating)
const TIERS = [
  { cells: [],                                               wRange: [4, 4], hRange: [4, 4], TRange: [4, 6]  },
  { cells: ["teleport"],                                     wRange: [4, 5], hRange: [4, 5], TRange: [5, 9]  },
  { cells: ["teleport", "spring"],                           wRange: [4, 5], hRange: [4, 5], TRange: [7, 12] },
  { cells: ["teleport", "spring", "ice", "hole"],            wRange: [5, 6], hRange: [5, 6], TRange: [9, 14] },
  { cells: ["teleport", "spring", "ice", "hole", "crumble"], wRange: [5, 6], hRange: [5, 6], TRange: [10, 16]},
  { cells: ["teleport", "spring", "ice", "hole", "crumble", "swamp"],         wRange: [5, 7], hRange: [5, 7], TRange: [12, 18]},
  { cells: ["teleport", "spring", "ice", "hole", "crumble", "swamp", "arrow"], wRange: [6, 8], hRange: [6, 8], TRange: [14, 22]},
];

// Per-position modifiers within a tier (8 positions: pos 0..7)
const POS_MODIFIERS = [
  { mapsCount: 1, rotMode: "zero" },    // pos 0: 1 карта, без поворота
  { mapsCount: 2, rotMode: "zero" },    // pos 1: 2 карты, без поворота
  { mapsCount: 1, rotMode: "nonzero" }, // pos 2: 1 карта, с поворотом
  { mapsCount: 2, rotMode: "any" },     // pos 3: 2 карты, случайный поворот
  { mapsCount: 3, rotMode: "any" },     // pos 4: 3 карты
  { mapsCount: 3, rotMode: "any" },     // pos 5: 3 карты
  { mapsCount: 4, rotMode: "any" },     // pos 6: 4 карты
  { mapsCount: 4, rotMode: "any" },     // pos 7: 4 карты
];

const OBSTACLE_DENSITY_MIN = 0.15;
const OBSTACLE_DENSITY_MAX = 0.25;

// Special cell placement probabilities per step
const CELL_PROB = {
  teleport: 0.12,
  spring:   0.12,
  swamp:    0.10,
  crumble:  0.13,
  arrow:    0.13,
};

// ─── RNG ───────────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function choice(rng, arr) {
  return arr[randInt(rng, 0, arr.length - 1)];
}

// ─── Tier / position helpers ────────────────────────────────────────────────

function getTierAndPos(levelNumber) {
  const n = Math.max(1, levelNumber);
  // Levels 1-8 → tier 0, 9-16 → tier 1, ..., 49+ cycle through tiers 0-6
  const block = n - 1; // 0-based
  const tierIndex = Math.min(6, Math.floor(block / 8));
  const pos = block % 8;
  return { tierIndex, pos };
}

function getRotation(rotMode, rng) {
  if (rotMode === "zero") return 0;
  if (rotMode === "nonzero") return choice(rng, [90, 180, 270]);
  return choice(rng, [0, 90, 180, 270]);
}

// ─── Wall building ──────────────────────────────────────────────────────────

function buildWallsSet(w, h, starts, density, rng) {
  const walls = new Set();
  const target = Math.floor(w * h * density);
  const startKeys = new Set(starts.map((s) => s.y * w + s.x));
  let safety = 0;
  while (walls.size < target && safety < 10000) {
    safety += 1;
    const x = randInt(rng, 0, w - 1);
    const y = randInt(rng, 0, h - 1);
    const key = y * w + x;
    if (startKeys.has(key)) continue;
    walls.add(key);
  }
  return walls;
}

function wallsSetToGrid(w, h, wallsSet) {
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (wallsSet.has(y * w + x) ? "#" : "."))
  );
  return grid.map((row) => row.join(""));
}

function isWallAt(wallsSet, w, x, y) {
  return wallsSet.has(y * w + x);
}

function inBounds(x, y, w, h) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function isFree(wallsSet, w, h, x, y) {
  return inBounds(x, y, w, h) && !isWallAt(wallsSet, w, x, y);
}

// ─── Walk with effects ──────────────────────────────────────────────────────

/**
 * Walks T steps from `start` on a grid with `wallsSet`.
 * Along the way, places special cells from `availableCells`.
 * Returns { finalPos, actions, specialCells } or null if walk fails (fell in hole, etc).
 */
function walkWithEffects(start, wallsSet, w, h, T, availableCells, rng) {
  let pos = { x: start.x, y: start.y };
  const pathKeys = new Set([pos.y * w + pos.x]);

  const actions = [];

  // Special cells collected during walk
  let teleport = null;   // { in: [x,y], out: [x,y] }
  const springs = [];    // [x, y]
  const swampCells = []; // [x, y]
  const crumbleCells = [];
  const collapsedCrumbles = new Set(); // cells that have crumbled already
  const arrowCells = [];  // [x, y, dir]

  let stuckInSwamp = false;

  for (let step = 0; step < T; step += 1) {
    if (stuckInSwamp) {
      // Stuck: consume a step without moving, use any action
      actions.push(choice(rng, ACTIONS));
      stuckInSwamp = false;
      continue;
    }

    // Pick a direction
    const last = actions.length > 0 ? actions[actions.length - 1] : null;
    let opts = ACTIONS;
    if (last && rng() < 0.7) {
      opts = ACTIONS.filter((a) => a !== OPPOSITE[last]);
    }
    const action = choice(rng, opts);
    const dir = DIRS[action];
    actions.push(action);

    const nx = pos.x + dir.x;
    const ny = pos.y + dir.y;

    // ── Special cell placement (before normal move) ──────────────────────

    // TELEPORT: if no teleport yet and cell is available
    if (
      !teleport &&
      availableCells.includes("teleport") &&
      rng() < CELL_PROB.teleport
    ) {
      // Pick a free out-position not on the path
      const candidates = [];
      for (let cy = 0; cy < h; cy += 1) {
        for (let cx = 0; cx < w; cx += 1) {
          const key = cy * w + cx;
          if (!wallsSet.has(key) && !pathKeys.has(key) && !(cx === pos.x && cy === pos.y)) {
            candidates.push({ x: cx, y: cy });
          }
        }
      }
      if (candidates.length > 0) {
        const out = choice(rng, candidates);
        teleport = { in: [pos.x, pos.y], out: [out.x, out.y] };
        pos = { x: out.x, y: out.y };
        pathKeys.add(out.y * w + out.x);
        continue;
      }
    }

    // SPRING: if next and next+1 in same dir are free
    if (
      availableCells.includes("spring") &&
      rng() < CELL_PROB.spring
    ) {
      const s2x = pos.x + dir.x * 2;
      const s2y = pos.y + dir.y * 2;
      if (
        isFree(wallsSet, w, h, nx, ny) &&
        isFree(wallsSet, w, h, s2x, s2y) &&
        !collapsedCrumbles.has(ny * w + nx) &&
        !collapsedCrumbles.has(s2y * w + s2x)
      ) {
        springs.push([pos.x, pos.y]);
        pos = { x: s2x, y: s2y };
        pathKeys.add(s2y * w + s2x);
        continue;
      }
    }

    // SWAMP: place on nextPos (before actually moving there)
    if (
      availableCells.includes("swamp") &&
      rng() < CELL_PROB.swamp &&
      isFree(wallsSet, w, h, nx, ny) &&
      !collapsedCrumbles.has(ny * w + nx)
    ) {
      swampCells.push([nx, ny]);
      pos = { x: nx, y: ny };
      pathKeys.add(ny * w + nx);
      stuckInSwamp = true;
      continue;
    }

    // CRUMBLE: place at current pos, then move normally
    if (
      availableCells.includes("crumble") &&
      rng() < CELL_PROB.crumble &&
      crumbleCells.length < 2 // limit to 2 per map for manageable BFS state
    ) {
      const key = pos.y * w + pos.x;
      const alreadyCrumble = crumbleCells.some((c) => c[0] === pos.x && c[1] === pos.y);
      if (!alreadyCrumble && !collapsedCrumbles.has(key)) {
        crumbleCells.push([pos.x, pos.y]);
        collapsedCrumbles.add(key); // crumbles after standing on it
      }
    }

    // ARROW: place at current pos with current action direction
    if (
      availableCells.includes("arrow") &&
      rng() < CELL_PROB.arrow &&
      !arrowCells.some((a) => a[0] === pos.x && a[1] === pos.y)
    ) {
      arrowCells.push([pos.x, pos.y, action]);
    }

    // ── Normal move ──────────────────────────────────────────────────────
    // Check if can move (wall, bounds, collapsed crumble)
    if (
      !inBounds(nx, ny, w, h) ||
      isWallAt(wallsSet, w, nx, ny) ||
      collapsedCrumbles.has(ny * w + nx)
    ) {
      // Bump — stay in place (action was still consumed)
      continue;
    }

    pos = { x: nx, y: ny };
    pathKeys.add(ny * w + nx);
  }

  // Fell into a hole? Not possible during walk — holes are placed after.
  // finalPos must differ from start
  if (pos.x === start.x && pos.y === start.y) {
    return null;
  }

  return {
    finalPos: pos,
    actions,
    pathKeys,
    specialCells: {
      teleport,
      springs,
      swampCells,
      crumbleCells,
      arrowCells,
    },
  };
}

// ─── Ice placement ──────────────────────────────────────────────────────────

/**
 * Place ice cells on free cells NOT on the solution path.
 * Ice is added after the walk (doesn't affect path construction).
 */
function placeIceCells(wallsSet, w, h, pathKeys, specialCells, rng) {
  const count = randInt(rng, 1, 3);
  const ice = [];
  const occupied = buildOccupiedSet(w, h, pathKeys, specialCells, wallsSet);
  for (let cy = 0; cy < h; cy += 1) {
    for (let cx = 0; cx < w; cx += 1) {
      const key = cy * w + cx;
      if (!occupied.has(key) && !wallsSet.has(key)) {
        ice.push([cx, cy]);
        if (ice.length >= count) break;
      }
    }
    if (ice.length >= count) break;
  }
  return ice;
}

/**
 * Place hole cells near the path — adjacent to path but NOT on it.
 */
function placeHoleCells(wallsSet, w, h, pathKeys, specialCells, rng) {
  const count = randInt(rng, 1, 2);
  const holes = [];
  const occupied = buildOccupiedSet(w, h, pathKeys, specialCells, wallsSet);

  // Collect candidate cells: adjacent to path cells
  const candidates = new Set();
  for (const key of pathKeys) {
    const x = key % w;
    const y = Math.floor(key / w);
    for (const dir of Object.values(DIRS)) {
      const cx = x + dir.x;
      const cy = y + dir.y;
      if (inBounds(cx, cy, w, h)) {
        const ck = cy * w + cx;
        if (!occupied.has(ck) && !wallsSet.has(ck)) {
          candidates.add(ck);
        }
      }
    }
  }

  const list = [...candidates];
  // shuffle
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, 0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  for (let i = 0; i < Math.min(count, list.length); i += 1) {
    holes.push([list[i] % w, Math.floor(list[i] / w)]);
  }
  return holes;
}

function buildOccupiedSet(w, h, pathKeys, specialCells, wallsSet) {
  const occupied = new Set(wallsSet);
  for (const key of pathKeys) occupied.add(key);
  if (specialCells.teleport) {
    if (specialCells.teleport.in) {
      const [tx, ty] = specialCells.teleport.in;
      occupied.add(ty * w + tx);
    }
    if (specialCells.teleport.out) {
      const [tx, ty] = specialCells.teleport.out;
      occupied.add(ty * w + tx);
    }
  }
  for (const [x, y] of specialCells.springs) occupied.add(y * w + x);
  for (const [x, y] of specialCells.swampCells) occupied.add(y * w + x);
  for (const [x, y] of specialCells.crumbleCells) occupied.add(y * w + x);
  for (const [x, y] of specialCells.arrowCells) occupied.add(y * w + x);
  return occupied;
}

// ─── BFS with dynamic state ─────────────────────────────────────────────────

function encodeState(positions, collapsedSets, stuckArr) {
  let key = "";
  for (let i = 0; i < positions.length; i += 1) {
    key += `${positions[i].x},${positions[i].y}|`;
    // Encode collapsed crumbles as sorted list
    const sorted = [...collapsedSets[i]].sort((a, b) => a - b).join(",");
    key += `[${sorted}]|`;
    key += stuckArr[i] ? "1" : "0";
    key += "|";
  }
  return key;
}

function allAtGoals(positions, maps) {
  for (let i = 0; i < maps.length; i += 1) {
    const g = maps[i].B;
    if (positions[i].x !== g[0] || positions[i].y !== g[1]) return false;
  }
  return true;
}

const BFS_MAX_VISITED = 150_000;

function hasShorterSolution(runtimeLevel, T) {
  const maps = runtimeLevel.maps;
  // Reject only if solvable in ≤60% of T steps (lenient for small grids/early tiers)
  const maxDepth = Math.max(1, Math.floor(T * 0.6));
  if (maxDepth <= 0) return false;

  const startPositions = maps.map((m) => ({ x: m.A[0], y: m.A[1] }));
  const startCollapsed = maps.map(() => new Set());
  const startStuck = maps.map(() => false);

  if (allAtGoals(startPositions, maps)) return true;

  const queue = [{ positions: startPositions, collapsed: startCollapsed, stuck: startStuck, depth: 0 }];
  const visited = new Set([encodeState(startPositions, startCollapsed, startStuck)]);

  for (let head = 0; head < queue.length; head += 1) {
    // If BFS is getting too large, conservatively say no shorter solution
    if (visited.size > BFS_MAX_VISITED) return false;
    const { positions, collapsed, stuck, depth } = queue[head];
    if (depth >= maxDepth) continue;

    for (const action of ACTIONS) {
      const nextPositions = [];
      const nextCollapsed = collapsed.map((s) => new Set(s));
      const nextStuck = [...stuck];

      let fell = false;

      for (let i = 0; i < maps.length; i += 1) {
        if (stuck[i]) {
          // Stuck in swamp this turn
          nextPositions.push({ ...positions[i] });
          nextStuck[i] = false;
        } else {
          const result = stepOne(positions[i], action, maps[i], {
            collapsedCrumbles: collapsed[i],
            doorOpen: false,
          });
          nextPositions.push({ x: result.x, y: result.y });
          if (result.fell) {
            fell = true;
            break;
          }
        }
      }

      if (fell) continue;

      // Update crumble/swamp state
      for (let i = 0; i < maps.length; i += 1) {
        if (stuck[i]) continue;
        const map = maps[i];
        const pos = nextPositions[i];
        const key = pos.y * map.w + pos.x;
        if ((map.crumbles || []).some((c) => c[0] === pos.x && c[1] === pos.y)) {
          nextCollapsed[i].add(key);
        }
        if ((map.swamp || []).some((s) => s[0] === pos.x && s[1] === pos.y)) {
          nextStuck[i] = true;
        }
      }

      const nextDepth = depth + 1;
      if (allAtGoals(nextPositions, maps)) return true;
      if (nextDepth >= T) continue;

      const key = encodeState(nextPositions, nextCollapsed, nextStuck);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ positions: nextPositions, collapsed: nextCollapsed, stuck: nextStuck, depth: nextDepth });
    }
  }

  return false;
}

// ─── Level spec builder ─────────────────────────────────────────────────────

function buildMapSpec(w, h, wallsSet, start, finalPos, specialCells, holes, iceCells, rotation) {
  const obstacles = [];
  for (const key of wallsSet) {
    obstacles.push([key % w, Math.floor(key / w)]);
  }

  const spec = {
    w,
    h,
    rotation,
    obstacles,
    A: [start.x, start.y],
    B: [finalPos.x, finalPos.y],
  };

  if (specialCells.teleport) {
    spec.teleport = specialCells.teleport;
  }
  if (iceCells && iceCells.length > 0) spec.ice = iceCells;
  if (holes && holes.length > 0) spec.holes = holes;
  if (specialCells.springs.length > 0) spec.springs = specialCells.springs;
  if (specialCells.swampCells.length > 0) spec.swamp = specialCells.swampCells;
  if (specialCells.crumbleCells.length > 0) spec.crumbles = specialCells.crumbleCells;
  if (specialCells.arrowCells.length > 0) spec.arrows = specialCells.arrowCells;

  return spec;
}

// ─── Single map generator ───────────────────────────────────────────────────

function buildSingleMap(w, h, T, availableCells, rotation, rng) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const density = OBSTACLE_DENSITY_MIN + rng() * (OBSTACLE_DENSITY_MAX - OBSTACLE_DENSITY_MIN);
    const start = { x: randInt(rng, 0, w - 1), y: randInt(rng, 0, h - 1) };
    const wallsSet = buildWallsSet(w, h, [start], density, rng);

    const walkResult = walkWithEffects(start, wallsSet, w, h, T, availableCells, rng);
    if (!walkResult) continue;

    const { finalPos, pathKeys, specialCells } = walkResult;

    // Place holes (only if 'hole' in available)
    let holes = [];
    if (availableCells.includes("hole")) {
      holes = placeHoleCells(wallsSet, w, h, pathKeys, specialCells, rng);
    }

    // Place ice (only if 'ice' in available)
    let iceCells = [];
    if (availableCells.includes("ice")) {
      iceCells = placeIceCells(wallsSet, w, h, pathKeys, specialCells, rng);
    }

    const mapSpec = buildMapSpec(w, h, wallsSet, start, finalPos, specialCells, holes, iceCells, rotation);
    return mapSpec;
  }
  return null;
}

// ─── Main export ────────────────────────────────────────────────────────────

import { buildRuntimeLevel, validateLevelSpec } from "./core/level.js";

export function generateLevel(levelNumber, seed) {
  const rngSeed = typeof seed === "number" ? seed : Date.now();
  const rng = mulberry32(rngSeed);

  const { tierIndex, pos } = getTierAndPos(levelNumber);
  const tier = TIERS[tierIndex];
  const modifier = POS_MODIFIERS[pos];

  const w = randInt(rng, tier.wRange[0], tier.wRange[1]);
  const h = randInt(rng, tier.hRange[0], tier.hRange[1]);
  const T = randInt(rng, tier.TRange[0], tier.TRange[1]);
  const mapsCount = modifier.mapsCount;
  const availableCells = tier.cells;

  const id = `level_${String(levelNumber).padStart(4, "0")}`;
  const title = `Level ${levelNumber}`;

  for (let outerAttempt = 0; outerAttempt < MAX_ATTEMPTS; outerAttempt += 1) {
    const maps = [];
    let failed = false;

    for (let mi = 0; mi < mapsCount; mi += 1) {
      const rotation = getRotation(modifier.rotMode, rng);
      const mapSpec = buildSingleMap(w, h, T, availableCells, rotation, rng);
      if (!mapSpec) {
        failed = true;
        break;
      }
      maps.push(mapSpec);
    }

    if (failed) continue;

    const levelSpec = {
      format: "dualgrid-level@2",
      id,
      title,
      rules: {
        moveSet: "UDLR",
        collision: "bump",
        winOnExactT: true,
        mapsCount,
      },
      T,
      maps,
      meta: {
        generator: "runtime-level-generator",
        seed: rngSeed,
        tier: tierIndex + 1,
        levelNumber,
      },
    };

    try {
      validateLevelSpec(levelSpec);
    } catch {
      continue;
    }

    const runtimeLevel = buildRuntimeLevel(levelSpec);
    if (hasShorterSolution(runtimeLevel, T)) continue;

    return levelSpec;
  }

  throw new Error(`Failed to generate level ${levelNumber} after ${MAX_ATTEMPTS} outer attempts`);
}
