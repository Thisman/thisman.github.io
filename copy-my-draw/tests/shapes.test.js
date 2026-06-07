import test from "node:test";
import assert from "node:assert/strict";

import { GAME_CONFIG } from "../config.js";
import { createShapePath, getPathBounds, selectRandomRound, transformShapePath } from "../src/shapes.js";

test("enabled shapes are closed, centered, and normalized", () => {
  for (const shapeName of GAME_CONFIG.shapes.enabled) {
    const path = createShapePath(shapeName, GAME_CONFIG);
    const first = path[0];
    const last = path[path.length - 1];
    const bounds = getPathBounds(path);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    assert.deepEqual(last, first, `${shapeName} must be one closed stroke`);
    assert.ok(Math.abs(centerX) < 1e-12, `${shapeName} x center`);
    assert.ok(Math.abs(centerY) < 1e-12, `${shapeName} y center`);
    assert.ok(bounds.minX >= -0.5 - 1e-12);
    assert.ok(bounds.maxX <= 0.5 + 1e-12);
    assert.ok(bounds.minY >= -0.5 - 1e-12);
    assert.ok(bounds.maxY <= 0.5 + 1e-12);
  }
});

test("random round picks enabled shape and configured scale bounds", () => {
  const randomValues = [0.51, 0.25, 0.75];
  const round = selectRandomRound(GAME_CONFIG, () => randomValues.shift() ?? 0);

  assert.equal(round.shapeName, "star");
  assert.ok(round.viewportScale >= GAME_CONFIG.shapes.minViewportScale);
  assert.ok(round.viewportScale <= GAME_CONFIG.shapes.maxViewportScale);
  assert.equal(round.rotation, Math.PI * 1.5);
});

test("transformed shape remains centered and inside viewport limit", () => {
  const viewport = { width: 1200, height: 800 };
  const path = createShapePath("square", GAME_CONFIG);
  const transformed = transformShapePath(path, viewport, 0.8);
  const bounds = transformed.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y)
  }), {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  });

  assert.equal((bounds.minX + bounds.maxX) / 2, viewport.width / 2);
  assert.equal((bounds.minY + bounds.maxY) / 2, viewport.height / 2);
  assert.equal(bounds.maxX - bounds.minX, viewport.height * 0.8);
  assert.equal(bounds.maxY - bounds.minY, viewport.height * 0.8);
});

test("rotated shape remains centered and fully inside configured size", () => {
  const viewport = { width: 1200, height: 800 };
  const path = createShapePath("square", GAME_CONFIG);
  const transformed = transformShapePath(path, viewport, 0.8, Math.PI / 4);
  const bounds = transformed.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y)
  }), {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  });

  assert.ok(Math.abs((bounds.minX + bounds.maxX) / 2 - viewport.width / 2) < 1e-12);
  assert.ok(Math.abs((bounds.minY + bounds.maxY) / 2 - viewport.height / 2) < 1e-12);
  assert.ok(bounds.maxX - bounds.minX <= viewport.height * 0.8 + 1e-12);
  assert.ok(bounds.maxY - bounds.minY <= viewport.height * 0.8 + 1e-12);
});
