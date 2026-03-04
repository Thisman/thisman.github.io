import test from "node:test";
import assert from "node:assert/strict";

import { stepOne } from "../src/core/movement.js";
import { buildRuntimeLevel } from "../src/core/level.js";
import { createGameSession } from "../src/game/session.js";

function makeLevelSpec(overrides = {}) {
  const base = {
    format: "dualgrid-level@2",
    id: "level_0001",
    title: "Level 1",
    rules: {
      moveSet: "UDLR",
      collision: "bump",
      winOnExactT: true,
      mapsCount: 1,
    },
    T: 2,
    maps: [
      {
        w: 2,
        h: 2,
        obstacles: [],
        A: [0, 0],
        B: [1, 0],
        rotation: 0,
        teleport: { in: null, out: null },
      },
    ],
  };
  const level = { ...base, ...overrides };
  if (overrides.maps) {
    level.rules = { ...base.rules, mapsCount: overrides.maps.length };
  }
  return level;
}

test("stepOne bumps on walls and bounds", () => {
  const map = {
    w: 3,
    h: 3,
    walls: ["...", ".#.", "..."],
    teleport: null,
  };
  const hitWall = stepOne({ x: 0, y: 1 }, "R", map);
  assert.equal(hitWall.bump, true);
  assert.deepEqual(hitWall, {
    x: 0,
    y: 1,
    bump: true,
    teleported: false,
    teleportEntry: null,
    fell: false,
  });

  const hitEdge = stepOne({ x: 0, y: 0 }, "U", map);
  assert.equal(hitEdge.bump, true);
});

test("stepOne teleports when entering entry", () => {
  const map = {
    w: 3,
    h: 3,
    walls: ["...", "...", "..."],
    teleport: { in: [1, 0], out: [2, 2] },
  };
  const result = stepOne({ x: 0, y: 0 }, "R", map);
  assert.equal(result.teleported, true);
  assert.deepEqual(
    { x: result.x, y: result.y, entry: result.teleportEntry },
    { x: 2, y: 2, entry: { x: 1, y: 0 } }
  );
});

test("game session sets win/lose states", () => {
  const runtimeLevel = buildRuntimeLevel(makeLevelSpec({ T: 1 }));
  const session = createGameSession(runtimeLevel);

  const win = session.step("R");
  assert.equal(win.state, "won");
  assert.equal(session.state, "won");

  const runtimeLevel2 = buildRuntimeLevel(
    makeLevelSpec({
      T: 1,
      maps: [
        {
          w: 2,
          h: 2,
          obstacles: [],
          A: [0, 0],
          B: [1, 1],
          rotation: 0,
          teleport: { in: null, out: null },
        },
      ],
    })
  );
  const session2 = createGameSession(runtimeLevel2);
  const lose = session2.step("R");
  assert.equal(lose.state, "lost");
  assert.equal(session2.state, "lost");
});
