const ACTIONS = ["U", "D", "L", "R"];
const DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

export function simulate(level, sequence) {
  const maps = level.maps;
  const positions = maps.map((map) => ({ x: map.A[0], y: map.A[1] }));
  const trails = maps.map(() => []);
  maps.forEach((_, i) => trails[i].push({ ...positions[i] }));

  for (let t = 0; t < sequence.length; t += 1) {
    const action = sequence[t];
    if (!ACTIONS.includes(action)) {
      throw new Error(`Invalid action ${action}`);
    }
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
        trails[i].push({ ...pos });
      } else {
        pos.x = nx;
        pos.y = ny;
        trails[i].push({ ...pos });
      }
    }
  }

  return { positions, trails };
}

export function validateLevel(level, sequence) {
  if (!level || typeof level !== "object") {
    throw new Error("Level is not an object");
  }
  if (level.format !== "dualgrid-level@1") {
    throw new Error("Invalid level format");
  }
  if (!level.rules || level.rules.collision !== "bump") {
    throw new Error("Only bump collision supported");
  }
  if (!Array.isArray(level.maps) || level.maps.length < 1) {
    throw new Error("Level maps must be an array");
  }

  level.maps.forEach((map, index) => {
    if (!Number.isInteger(map.w) || !Number.isInteger(map.h)) {
      throw new Error("Invalid map size");
    }
    if (!Array.isArray(map.walls) || map.walls.length !== map.h) {
      throw new Error("Walls mismatch");
    }
    if (map.walls.some((row) => row.length !== map.w)) {
      throw new Error("Walls row width mismatch");
    }
    if (!Array.isArray(map.A) || map.A.length !== 2) {
      throw new Error("A must be [x,y]");
    }
    if (!Array.isArray(map.B) || map.B.length !== 2) {
      throw new Error("B must be [x,y]");
    }
    if (map.A[0] === map.B[0] && map.A[1] === map.B[1]) {
      throw new Error(`A == B in map ${index}`);
    }
    if (map.walls[map.A[1]][map.A[0]] === "#") {
      throw new Error("A must be empty");
    }
    if (map.walls[map.B[1]][map.B[0]] === "#") {
      throw new Error("B must be empty");
    }
  });

  if (sequence) {
    const result = simulate(level, sequence);
    for (let i = 0; i < level.maps.length; i += 1) {
      const pos = result.positions[i];
      const goal = level.maps[i].B;
      if (pos.x !== goal[0] || pos.y !== goal[1]) {
        throw new Error("Sequence does not reach B");
      }
    }
  }
  return true;
}

function parseArgs(argv) {
  const cfg = { level: null, seq: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--level") {
      cfg.level = argv[i + 1];
      i += 1;
    } else if (arg === "--sequence") {
      cfg.seq = argv[i + 1];
      i += 1;
    }
  }
  return cfg;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs/promises");
  const cfg = parseArgs(process.argv);
  if (!cfg.level) {
    console.error("Usage: node tools/check-level.mjs --level path --sequence UDLR");
    process.exit(1);
  }
  const raw = await fs.readFile(cfg.level, "utf8");
  const level = JSON.parse(raw);
  validateLevel(level, cfg.seq || null);
  console.log("Level OK");
}
