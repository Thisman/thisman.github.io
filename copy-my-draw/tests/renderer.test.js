import test from "node:test";
import assert from "node:assert/strict";

import { getResultDrawRect } from "../src/renderer.js";

test("result overlay keeps its aspect ratio after orientation change", () => {
  const result = {
    sourceViewport: {
      width: 390,
      height: 844
    }
  };

  const rect = getResultDrawRect(result, {
    width: 844,
    height: 390
  });

  assert.ok(Math.abs((rect.width / rect.height) - (390 / 844)) < 1e-12);
  assert.ok(rect.width <= 844);
  assert.ok(rect.height <= 390);
  assert.equal(rect.x + rect.width / 2, 844 / 2);
  assert.equal(rect.y + rect.height / 2, 390 / 2);
});
