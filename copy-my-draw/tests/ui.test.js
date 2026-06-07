import test from "node:test";
import assert from "node:assert/strict";

import { getScoreOutcome } from "../src/ui.js";

test("score color thresholds apply only below the previous record", () => {
  assert.equal(getScoreOutcome(10, 70), "far");
  assert.equal(getScoreOutcome(20, 70), "medium");
  assert.equal(getScoreOutcome(55, 70), "medium");
  assert.equal(getScoreOutcome(56, 70), "close");
  assert.equal(getScoreOutcome(70, 70), "close");
  assert.equal(getScoreOutcome(90, 70), "close");
  assert.equal(getScoreOutcome(100, 0), "close");
});
