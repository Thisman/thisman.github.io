const ACTIONS = ["U", "D", "L", "R"];
const DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

const MAX_ATTEMPTS = 300;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  if (typeof seed !== "number") {
    return Math.random;
  }
  return mulberry32(seed);
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function choice(rng, list) {
  return list[randInt(rng, 0, list.length - 1)];
}

function randomDirections(steps, rng) {
  let path = "";
  let last = null;
  const opposite = { U: "D", D: "U", L: "R", R: "L" };
  for (let i = 0; i < steps; i += 1) {
    let options = ACTIONS;
    if (last && rng() < 0.7) {
      options = ACTIONS.filter((a) => a !== opposite[last]);
    }
    const action = choice(rng, options);
    path += action;
    last = action;
  }
  return path;
}

function randomDistinctStarts(count, width, height, rng) {
  const used = new Set();
  const starts = [];
  while (starts.length < count) {
    const x = randInt(rng, 0, width - 1);
    const y = randInt(rng, 0, height - 1);
    const key = y * width + x;
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    starts.push({ x, y });
  }
  return starts;
}

function buildRandomWalls(width, height, start, obstacles, rng) {
  const walls = new Set();
  const total = width * height;
  const target = Math.min(obstacles, total - 1);

  while (walls.size < target) {
    const x = randInt(rng, 0, width - 1);
    const y = randInt(rng, 0, height - 1);
    if (x === start.x && y === start.y) {
      continue;
    }
    walls.add(y * width + x);
  }
  return walls;
}

function simulatePositions(maps, starts, directions) {
  const positions = starts.map((pos) => ({ ...pos }));
  for (let t = 0; t < directions.length; t += 1) {
    const action = directions[t];
    const dir = DIRS[action];
    for (let i = 0; i < maps.length; i += 1) {
      const map = maps[i];
      const pos = positions[i];
      const nx = pos.x + dir.x;
      const ny = pos.y + dir.y;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= map.w ||
        ny >= map.h ||
        map.walls[ny][nx] === "#"
      ) {
        continue;
      }
      pos.x = nx;
      pos.y = ny;
    }
  }
  return positions;
}

function stepOne(pos, action, map) {
  const dir = DIRS[action];
  const nx = pos.x + dir.x;
  const ny = pos.y + dir.y;
  if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) {
    return { x: pos.x, y: pos.y };
  }
  if (map.walls[ny][nx] === "#") {
    return { x: pos.x, y: pos.y };
  }
  return { x: nx, y: ny };
}

function applyAction(positions, action, maps) {
  const next = [];
  for (let i = 0; i < maps.length; i += 1) {
    next.push(stepOne(positions[i], action, maps[i]));
  }
  return next;
}

function encodePositions(positions, maps) {
  let key = "";
  for (let i = 0; i < maps.length; i += 1) {
    const map = maps[i];
    const pos = positions[i];
    key += `${pos.x + pos.y * map.w}|`;
  }
  return key;
}

function isGoal(positions, maps) {
  for (let i = 0; i < maps.length; i += 1) {
    const goal = maps[i].B;
    if (positions[i].x !== goal[0] || positions[i].y !== goal[1]) {
      return false;
    }
  }
  return true;
}

function hasShorterSolution(maps, steps) {
  const start = maps.map((map) => ({ x: map.A[0], y: map.A[1] }));
  if (isGoal(start, maps)) {
    return true;
  }

  const maxDepth = steps - 1;
  if (maxDepth <= 0) {
    return false;
  }

  const queue = [start];
  const depths = [0];
  const visited = new Set([encodePositions(start, maps)]);

  for (let head = 0; head < queue.length; head += 1) {
    const positions = queue[head];
    const depth = depths[head];
    if (depth >= maxDepth) {
      continue;
    }
    for (const action of ACTIONS) {
      const nextPositions = applyAction(positions, action, maps);
      const nextDepth = depth + 1;
      if (isGoal(nextPositions, maps)) {
        return true;
      }
      if (nextDepth >= steps) {
        continue;
      }
      const key = encodePositions(nextPositions, maps);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push(nextPositions);
      depths.push(nextDepth);
    }
  }

  return false;
}

function buildLevel(params, rng, meta) {
  const directions = randomDirections(params.steps, rng);
  const starts = randomDistinctStarts(params.maps, params.width, params.height, rng);
  const maps = [];

  for (let i = 0; i < params.maps; i += 1) {
    const wallsSet = buildRandomWalls(
      params.width,
      params.height,
      starts[i],
      params.obstacles,
      rng
    );
    const grid = Array.from({ length: params.height }, () =>
      Array.from({ length: params.width }, () => ".")
    );
    wallsSet.forEach((idx) => {
      const x = idx % params.width;
      const y = Math.floor(idx / params.width);
      grid[y][x] = "#";
    });
    maps.push({
      w: params.width,
      h: params.height,
      walls: grid.map((row) => row.join("")),
      A: [starts[i].x, starts[i].y],
      B: [starts[i].x, starts[i].y],
    });
  }

  const levelSkeleton = {
    format: "dualgrid-level@1",
    id: meta.id,
    title: meta.title,
    rules: {
      moveSet: "UDLR",
      collision: "bump",
      winOnExactT: true,
      mapsCount: params.maps,
    },
    T: params.steps,
    maps,
    meta: {
      generator: "runtime-level-generator",
      seed: meta.seed,
      params: {
        width: params.width,
        height: params.height,
        steps: params.steps,
        maps: params.maps,
        obstacles: params.obstacles,
      },
    },
  };

  const finals = simulatePositions(maps, starts, directions);
  for (let i = 0; i < maps.length; i += 1) {
    maps[i].B = [finals[i].x, finals[i].y];
    if (maps[i].A[0] === maps[i].B[0] && maps[i].A[1] === maps[i].B[1]) {
      return null;
    }
  }
  if (hasShorterSolution(maps, params.steps)) {
    return null;
  }

  return levelSkeleton;
}

export function generateLevel(params, { levelNumber = 1, seed } = {}) {
  const rngSeed = typeof seed === "number" ? seed : Date.now();
  const rng = createRng(rngSeed);
  const attemptsLimit = MAX_ATTEMPTS;
  const id = `level_${String(levelNumber).padStart(4, "0")}`;
  const title = `Generated Level ${levelNumber}`;

  for (let attempt = 0; attempt < attemptsLimit; attempt += 1) {
    const level = buildLevel(params, rng, { id, title, seed: rngSeed });
    if (level) {
      return level;
    }
  }

  throw new Error(`Failed to generate level after ${attemptsLimit} tries`);
}
