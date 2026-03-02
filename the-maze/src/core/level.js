import { isValidRotation, normalizeRotation } from "../rotation.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPoint(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1])
  );
}

function inBounds(point, w, h) {
  return point[0] >= 0 && point[1] >= 0 && point[0] < w && point[1] < h;
}

function normalizeRules(rules, mapsCount) {
  const baseRules = {
    moveSet: "UDLR",
    collision: "bump",
    winOnExactT: true,
    mapsCount,
  };
  if (!rules || typeof rules !== "object") {
    return baseRules;
  }
  return {
    ...baseRules,
    ...rules,
    mapsCount,
  };
}

function validateRules(rules, mapsCount) {
  assert(rules && typeof rules === "object", "Missing rules");
  assert(rules.moveSet === "UDLR", "Only UDLR moveSet supported");
  assert(rules.collision === "bump", "Only bump collision supported");
  assert(rules.winOnExactT === true, "winOnExactT must be true");
  assert(
    Number.isInteger(rules.mapsCount),
    "rules.mapsCount must be integer"
  );
  assert(rules.mapsCount === mapsCount, "rules.mapsCount mismatch maps length");
}

export function validateLevelsIndex(config) {
  assert(config && typeof config === "object", "Levels index is not an object");
  assert(config.format === "dualgrid-levels@2", "Invalid levels index format");
  assert(Array.isArray(config.levels), "Levels must be an array");
  config.levels.forEach((entry, index) => {
    assert(entry && typeof entry === "object", `Level ${index + 1} invalid`);
    assert(typeof entry.file === "string", `Level ${index + 1} missing file`);
    if (entry.id !== undefined) {
      assert(typeof entry.id === "string", `Level ${index + 1} invalid id`);
    }
  });
}

export function validateLevelSpec(level, { allowMissingEndpoints = false } = {}) {
  assert(level && typeof level === "object", "Level is not an object");
  assert(level.format === "dualgrid-level@2", "Invalid level format");
  assert(Number.isInteger(level.T) && level.T > 0, "Invalid T value");
  assert(Array.isArray(level.maps), "Level maps must be an array");
  assert(
    level.maps.length >= 1 && level.maps.length <= 4,
    "mapsCount must be between 1 and 4"
  );
  validateRules(level.rules, level.maps.length);

  level.maps.forEach((map, index) => {
    assert(Number.isInteger(map.w) && map.w > 1, "Invalid map width");
    assert(Number.isInteger(map.h) && map.h > 1, "Invalid map height");
    const rotation = map.rotation ?? 0;
    assert(
      isValidRotation(rotation),
      `Rotation must be 0,90,180,270 in map ${index}`
    );
    const obstacles = Array.isArray(map.obstacles) ? map.obstacles : [];
    const occupied = new Set();

    obstacles.forEach((point) => {
      assert(isPoint(point), `Obstacle must be [x,y] in map ${index}`);
      assert(inBounds(point, map.w, map.h), `Obstacle out of bounds ${index}`);
      const key = point[1] * map.w + point[0];
      assert(!occupied.has(key), `Duplicate obstacle in map ${index}`);
      occupied.add(key);
    });

    const teleport = map.teleport;
    let teleportIn = null;
    let teleportOut = null;
    if (teleport !== undefined && teleport !== null) {
      assert(
        teleport && typeof teleport === "object",
        `Teleport must be object in map ${index}`
      );
      teleportIn = teleport.in ?? null;
      teleportOut = teleport.out ?? null;
      const hasIn = teleportIn !== null;
      const hasOut = teleportOut !== null;

      if (hasIn !== hasOut) {
        assert(
          allowMissingEndpoints,
          `Teleport requires in/out in map ${index}`
        );
      }

      if (hasIn) {
        assert(isPoint(teleportIn), `Teleport in must be [x,y] in map ${index}`);
        assert(
          inBounds(teleportIn, map.w, map.h),
          `Teleport in out of bounds in map ${index}`
        );
        const key = teleportIn[1] * map.w + teleportIn[0];
        assert(
          !occupied.has(key),
          `Teleport in overlaps obstacle in map ${index}`
        );
      }
      if (hasOut) {
        assert(
          isPoint(teleportOut),
          `Teleport out must be [x,y] in map ${index}`
        );
        assert(
          inBounds(teleportOut, map.w, map.h),
          `Teleport out of bounds in map ${index}`
        );
        const key = teleportOut[1] * map.w + teleportOut[0];
        assert(
          !occupied.has(key),
          `Teleport out overlaps obstacle in map ${index}`
        );
      }
      if (teleportIn && teleportOut) {
        assert(
          teleportIn[0] !== teleportOut[0] ||
            teleportIn[1] !== teleportOut[1],
          `Teleport points must differ in map ${index}`
        );
      }
    }

    if (map.A !== undefined && map.A !== null) {
      assert(isPoint(map.A), `A must be [x,y] in map ${index}`);
      assert(inBounds(map.A, map.w, map.h), `A out of bounds in map ${index}`);
      const key = map.A[1] * map.w + map.A[0];
      assert(!occupied.has(key), `A overlaps obstacle in map ${index}`);
      if (teleportIn) {
        assert(
          map.A[0] !== teleportIn[0] || map.A[1] !== teleportIn[1],
          `A overlaps teleport in map ${index}`
        );
      }
      if (teleportOut) {
        assert(
          map.A[0] !== teleportOut[0] || map.A[1] !== teleportOut[1],
          `A overlaps teleport in map ${index}`
        );
      }
    } else {
      assert(allowMissingEndpoints, `Missing A in map ${index}`);
    }

    if (map.B !== undefined && map.B !== null) {
      assert(isPoint(map.B), `B must be [x,y] in map ${index}`);
      assert(inBounds(map.B, map.w, map.h), `B out of bounds in map ${index}`);
      const key = map.B[1] * map.w + map.B[0];
      assert(!occupied.has(key), `B overlaps obstacle in map ${index}`);
      if (teleportIn) {
        assert(
          map.B[0] !== teleportIn[0] || map.B[1] !== teleportIn[1],
          `B overlaps teleport in map ${index}`
        );
      }
      if (teleportOut) {
        assert(
          map.B[0] !== teleportOut[0] || map.B[1] !== teleportOut[1],
          `B overlaps teleport in map ${index}`
        );
      }
    } else {
      assert(allowMissingEndpoints, `Missing B in map ${index}`);
    }
  });
}

export function buildRuntimeLevel(
  level,
  { allowMissingEndpoints = false } = {}
) {
  validateLevelSpec(level, { allowMissingEndpoints });
  const mapsCount = level.maps.length;
  const rules = normalizeRules(level.rules, mapsCount);

  const runtimeMaps = level.maps.map((map) => {
    const grid = Array.from({ length: map.h }, () =>
      Array.from({ length: map.w }, () => ".")
    );
    const obstacles = Array.isArray(map.obstacles) ? map.obstacles : [];
    obstacles.forEach((point) => {
      grid[point[1]][point[0]] = "#";
    });
    const fallbackA = [0, 0];
    const A = isPoint(map.A)
      ? map.A
      : allowMissingEndpoints
      ? null
      : fallbackA;
    const B = isPoint(map.B) ? map.B : null;
    const teleport = map.teleport || null;
    const teleportIn = teleport && isPoint(teleport.in) ? teleport.in : null;
    const teleportOut = teleport && isPoint(teleport.out) ? teleport.out : null;
    const teleportRuntime = teleport ? { in: teleportIn, out: teleportOut } : null;
    return {
      w: map.w,
      h: map.h,
      walls: grid.map((row) => row.join("")),
      A,
      B,
      rotation: normalizeRotation(map.rotation),
      teleport: teleportRuntime,
    };
  });

  return {
    format: "dualgrid-level@1",
    id: level.id,
    title: level.title,
    rules,
    T: level.T,
    maps: runtimeMaps,
    meta: level.meta ? { ...level.meta } : undefined,
  };
}
