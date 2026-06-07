import test from "node:test";
import assert from "node:assert/strict";

import { calculateMaskScore, dilateMask } from "../src/scoring.js";

test("identical masks score 100 percent", () => {
  const target = createMask(8, 8, [[1, 1], [2, 1], [3, 1]]);
  const user = createMask(8, 8, [[1, 1], [2, 1], [3, 1]]);

  const result = calculateMaskScore(target, user, 8, 8, 0);

  assert.equal(result.percent, 100);
  assert.equal(result.precision, 1);
  assert.equal(result.recall, 1);
});

test("empty player mask scores zero", () => {
  const target = createMask(8, 8, [[1, 1], [2, 1], [3, 1]]);
  const user = new Uint8Array(64);

  const result = calculateMaskScore(target, user, 8, 8, 0);

  assert.equal(result.percent, 0);
  assert.equal(result.precision, 0);
  assert.equal(result.recall, 0);
});

test("extra user pixels lower precision", () => {
  const target = createMask(8, 8, [[1, 1], [2, 1]]);
  const user = createMask(8, 8, [[1, 1], [2, 1], [7, 7], [7, 6]]);

  const result = calculateMaskScore(target, user, 8, 8, 0);

  assert.equal(result.recall, 1);
  assert.equal(result.precision, 0.5);
  assert.equal(result.percent, 67);
});

test("missing target pixels lower recall", () => {
  const target = createMask(8, 8, [[1, 1], [2, 1], [3, 1], [4, 1]]);
  const user = createMask(8, 8, [[1, 1], [2, 1]]);

  const result = calculateMaskScore(target, user, 8, 8, 0);

  assert.equal(result.precision, 1);
  assert.equal(result.recall, 0.5);
  assert.equal(result.percent, 67);
});

test("tolerance improves score for small offset", () => {
  const target = createMask(8, 8, [[2, 2], [3, 2]]);
  const shifted = createMask(8, 8, [[2, 3], [3, 3]]);

  const strictResult = calculateMaskScore(target, shifted, 8, 8, 0);
  const tolerantResult = calculateMaskScore(target, shifted, 8, 8, 1);

  assert.equal(strictResult.percent, 0);
  assert.equal(tolerantResult.percent, 100);
});

test("dilation expands around a pixel inside the radius", () => {
  const mask = createMask(5, 5, [[2, 2]]);
  const dilated = dilateMask(mask, 5, 5, 1);

  assert.equal(dilated[2 * 5 + 2], 1);
  assert.equal(dilated[1 * 5 + 2], 1);
  assert.equal(dilated[2 * 5 + 1], 1);
  assert.equal(dilated[1 * 5 + 1], 0);
});

function createMask(width, height, points) {
  const mask = new Uint8Array(width * height);
  for (const [x, y] of points) {
    mask[y * width + x] = 1;
  }
  return mask;
}
