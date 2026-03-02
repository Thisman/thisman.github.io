import { mkdir, writeFile } from "node:fs/promises";
import { simulate, validateLevel } from "./check-level.mjs";

const ACTIONS = ["U", "D", "L", "R"];
const DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

const OBSTACLE_DENSITY = { min: 0.1, max: 0.25 };
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

function parseArgs(argv) {
  const cfg = {
    width: 13,
    height: 9,
    steps: 20,
    maps: 2,
    obstacles: 3,
    out: "levels",
    file: "level.json",
    seed: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      continue;
    }
    i += 1;
    switch (key) {
      case "width":
        cfg.width = Number.parseInt(value, 10);
        break;
      case "height":
        cfg.height = Number.parseInt(value, 10);
        break;
      case "steps":
        cfg.steps = Number.parseInt(value, 10);
        break;
      case "maps":
        cfg.maps = Number.parseInt(value, 10);
        break;
      case "obstacles":
        cfg.obstacles = Number.parseInt(value, 10);
        break;
      case "seed":
        cfg.seed = Number.parseInt(value, 10);
        break;
      case "out":
        cfg.out = value;
        break;
      case "file":
        cfg.file = value;
        break;
      default:
        break;
    }
  }
  return cfg;
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

function buildRandomWalls(width, height, start, density, rng) {
  const walls = new Set();
  const total = width * height;
  const target = Math.floor(total * density);

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

function buildLevel(cfg, rng) {
  if (cfg.maps < 1) {
    throw new Error("maps must be >= 1");
  }
  if (cfg.steps < 1) {
    throw new Error("steps must be >= 1");
  }
  if (cfg.width < 2 || cfg.height < 2) {
    throw new Error("width/height must be >= 2");
  }
  const directions = randomDirections(cfg.steps, rng);
  const starts = randomDistinctStarts(cfg.maps, cfg.width, cfg.height, rng);
  const maps = [];
  const density = randInt(rng, 0, 1000) / 1000;
  const obstacleDensity =
    OBSTACLE_DENSITY.min +
    (OBSTACLE_DENSITY.max - OBSTACLE_DENSITY.min) * density;

  for (let i = 0; i < cfg.maps; i += 1) {
    const wallsSet = buildRandomWalls(
      cfg.width,
      cfg.height,
      starts[i],
      obstacleDensity,
      rng
    );
    const grid = Array.from({ length: cfg.height }, () =>
      Array.from({ length: cfg.width }, () => ".")
    );
    wallsSet.forEach((idx) => {
      const x = idx % cfg.width;
      const y = Math.floor(idx / cfg.width);
      grid[y][x] = "#";
    });
    maps.push({
      w: cfg.width,
      h: cfg.height,
      walls: grid.map((row) => row.join("")),
      A: [starts[i].x, starts[i].y],
      B: [starts[i].x, starts[i].y],
    });
  }

  const levelSkeleton = {
    format: "dualgrid-level@1",
    id: cfg.file.replace(/\.[^/.]+$/, ""),
    title: "Generated Level",
    rules: {
      moveSet: "UDLR",
      collision: "bump",
      winOnExactT: true,
      mapsCount: cfg.maps,
    },
    T: cfg.steps,
    maps,
    meta: {
      generator: "gen-levels.mjs",
      seed: cfg.seed,
      params: {
        width: cfg.width,
        height: cfg.height,
        steps: cfg.steps,
        maps: cfg.maps,
        obstacles: cfg.obstacles,
      },
    },
  };

  const simResult = simulate(levelSkeleton, directions);
  const finals = simResult.positions;
  for (let i = 0; i < maps.length; i += 1) {
    maps[i].B = [finals[i].x, finals[i].y];
    if (maps[i].A[0] === maps[i].B[0] && maps[i].A[1] === maps[i].B[1]) {
      return null;
    }
  }

  validateLevel(levelSkeleton, directions);
  return levelSkeleton;
}

async function generateLevel(cfg) {
  await mkdir(cfg.out, { recursive: true });
  const seed = cfg.seed !== null ? cfg.seed : Date.now();
  const rng = createRng(seed);
  let level = null;
  const attemptsLimit = MAX_ATTEMPTS;

  for (let attempt = 0; attempt < attemptsLimit; attempt += 1) {
    level = buildLevel(cfg, rng);
    if (level) {
      break;
    }
  }

  if (!level) {
    throw new Error(`Failed to generate level after ${attemptsLimit} tries`);
  }

  level.meta.seed = seed;
  const filePath = `${cfg.out}/${cfg.file}`;
  await writeFile(filePath, JSON.stringify(level, null, 2), "utf8");
  console.log(`Generated ${filePath}`);
}

const cfg = parseArgs(process.argv);
generateLevel(cfg).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
