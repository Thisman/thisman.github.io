import test from "node:test";
import assert from "node:assert/strict";

import { applyBounceSpeed, createMovementBounds, advanceBall } from "../src/core/physics.js";
import { distance } from "../src/core/math.js";
import { createTargetPlan } from "../src/core/trajectory.js";
import { gameConfig } from "../src/config.js";
import { createGameEngine } from "../src/game/engine.js";

test("applyBounceSpeed delays acceleration until after tap window shrink", () => {
  const stableSpeed = applyBounceSpeed(gameConfig.physics.baseSpeed, 4, gameConfig.physics);
  assert.equal(stableSpeed, gameConfig.physics.baseSpeed);

  const acceleratedSpeed = applyBounceSpeed(gameConfig.physics.baseSpeed, 7, gameConfig.physics);
  assert.ok(acceleratedSpeed > gameConfig.physics.baseSpeed);

  const expectedMaxSpeed = gameConfig.physics.baseSpeed * gameConfig.physics.speedClampMultiplier;
  assert.equal(gameConfig.physics.speedClampMax, expectedMaxSpeed);

  const clampedSpeed = applyBounceSpeed(1000, 30, gameConfig.physics);
  assert.equal(clampedSpeed, gameConfig.physics.speedClampMax);
});

test("advanceBall reflects from the right wall", () => {
  const bounds = createMovementBounds(300, 500, gameConfig.input.ballRadius);
  const result = advanceBall(
    {
      x: bounds.maxX - 2,
      y: 140,
      vx: 220,
      vy: 0,
      speed: 220,
      wallHits: 0,
    },
    50,
    bounds,
    gameConfig.physics
  );

  assert.equal(result.wallHits, 1);
  assert.ok(result.vx < 0);
  assert.equal(result.vy, 0);
});

test("advanceBall handles a corner collision deterministically", () => {
  const bounds = createMovementBounds(260, 260, gameConfig.input.ballRadius);
  const speed = 220;
  const result = advanceBall(
    {
      x: bounds.maxX - 1,
      y: bounds.maxY - 1,
      vx: speed / Math.sqrt(2),
      vy: speed / Math.sqrt(2),
      speed,
      wallHits: 0,
    },
    40,
    bounds,
    gameConfig.physics
  );

  assert.equal(result.wallHits, 1);
  assert.ok(result.vx < 0);
  assert.ok(result.vy < 0);
});

test("advanceBall pushes the ball off the wall after a collision", () => {
  const bounds = createMovementBounds(280, 280, gameConfig.input.ballRadius);
  const result = advanceBall(
    {
      x: bounds.maxX - 1,
      y: 120,
      vx: 220,
      vy: 0,
      speed: 220,
      wallHits: 0,
    },
    16,
    bounds,
    gameConfig.physics
  );

  assert.ok(result.collisions[0].x < bounds.maxX);
  assert.ok(result.vx < 0);

  const nextStep = advanceBall(
    {
      x: result.currentPosition.x,
      y: result.currentPosition.y,
      vx: result.vx,
      vy: result.vy,
      speed: result.speed,
      wallHits: result.wallHits,
    },
    16,
    bounds,
    gameConfig.physics
  );

  assert.ok(nextStep.currentPosition.x < bounds.maxX);
});

test("advanceBall avoids near-vertical sticking on side walls", () => {
  const bounds = createMovementBounds(280, 420, gameConfig.input.ballRadius);
  const speed = 220;
  const result = advanceBall(
    {
      x: bounds.maxX - 0.02,
      y: 160,
      vx: 2,
      vy: Math.sqrt(speed ** 2 - 2 ** 2),
      speed,
      wallHits: 0,
    },
    40,
    bounds,
    gameConfig.physics
  );

  assert.ok(result.vx < 0);
  assert.ok(Math.abs(result.vx / result.speed) >= 0.17);

  const nextStep = advanceBall(
    {
      x: result.currentPosition.x,
      y: result.currentPosition.y,
      vx: result.vx,
      vy: result.vy,
      speed: result.speed,
      wallHits: result.wallHits,
    },
    24,
    bounds,
    gameConfig.physics
  );

  assert.ok(nextStep.currentPosition.x < result.currentPosition.x);
  assert.equal(nextStep.collisions.some((collision) => collision.hitX), false);
});

test("createTargetPlan keeps target on a safe visible trajectory point", () => {
  const width = 390;
  const height = 844;
  const plan = createTargetPlan({
    position: { x: width / 2, y: height / 2 },
    velocity: { x: 180, y: 220 },
    speed: 284,
    wallHits: 3,
    width,
    height,
    config: gameConfig,
  });

  assert.ok(plan.position.x >= gameConfig.targeting.targetRadius + gameConfig.targeting.targetEdgeMargin);
  assert.ok(plan.position.x <= width - (gameConfig.targeting.targetRadius + gameConfig.targeting.targetEdgeMargin));
  assert.ok(plan.position.y >= gameConfig.targeting.targetRadius + gameConfig.targeting.targetEdgeMargin);
  assert.ok(plan.position.y <= height - (gameConfig.targeting.targetRadius + gameConfig.targeting.targetEdgeMargin));
  assert.ok(plan.hitDistance >= plan.spawnDistance);
});

test("tutorial step one tap starts motion", () => {
  const engine = createGameEngine({
    progress: { tutorialCompleted: false, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
  });
  engine.startGame();
  let snapshot = engine.getSnapshot();

  assert.equal(snapshot.tutorialStage, "tutorial_step_1");

  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });
  snapshot = engine.getSnapshot();

  assert.equal(snapshot.phase, "moving_no_target");
  assert.equal(snapshot.tutorialStage, "armed_step2");
});

test("tutorial step two pauses at target center and awards five points", () => {
  let tutorialCompletedCalls = 0;
  const engine = createGameEngine({
    progress: { tutorialCompleted: false, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
    rng: () => 0.17,
    onTutorialComplete() {
      tutorialCompletedCalls += 1;
    },
  });

  engine.startGame();
  let snapshot = engine.getSnapshot();
  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });

  for (let index = 0; index < 400; index += 1) {
    engine.stepFrame(16);
    snapshot = engine.getSnapshot();
    if (snapshot.tutorialStage === "tutorial_step_2_pause") {
      break;
    }
  }

  assert.equal(snapshot.tutorialStage, "tutorial_step_2_pause");
  assert.equal(distance(snapshot.ball, snapshot.target), 0);
  const targetPosition = { x: snapshot.target.x, y: snapshot.target.y };

  engine.pointerDown({ x: snapshot.target.x, y: snapshot.target.y });
  snapshot = engine.getSnapshot();

  assert.equal(snapshot.tutorialCompleted, true);
  assert.equal(snapshot.phase, "moving_no_target");
  assert.equal(snapshot.score, 5);
  assert.equal(snapshot.bestScore, 5);
  assert.equal(snapshot.scoreAwardValue, 5);
  assert.deepEqual(snapshot.scoreAwardPosition, targetPosition);
  assert.equal(tutorialCompletedCalls, 1);
});

test("tap window shrinks before speed starts growing", () => {
  const engine = createGameEngine({
    progress: { tutorialCompleted: true, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
    rng: () => 0.17,
  });

  engine.setBounds(320, 560);
  engine.startGame();

  let snapshot = engine.getSnapshot();
  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });

  const initialThreshold = engine.getSnapshot().hitDistanceThreshold;
  const initialSpeed = engine.getSnapshot().ball.speed;
  let minThreshold = initialThreshold;
  let speedBeforeAcceleration = initialSpeed;

  for (let index = 0; index < 1800; index += 1) {
    engine.stepFrame(16);
    snapshot = engine.getSnapshot();

    if (
      snapshot.target?.visible &&
      distance(snapshot.ball, snapshot.target) <= snapshot.hitDistanceThreshold
    ) {
      engine.pointerDown({ x: snapshot.target.x, y: snapshot.target.y });
      snapshot = engine.getSnapshot();
    }

    if (snapshot.wallHits > 0 && snapshot.wallHits < gameConfig.physics.accelerationStartsAtWallHit) {
      minThreshold = Math.min(minThreshold, snapshot.hitDistanceThreshold);
      speedBeforeAcceleration = snapshot.ball.speed;
    }

    if (snapshot.wallHits >= gameConfig.physics.accelerationStartsAtWallHit) {
      break;
    }
  }

  assert.ok(minThreshold < initialThreshold);
  assert.ok(minThreshold >= snapshot.ball.radius * gameConfig.targeting.minRelativeSizeToBall);
  assert.equal(speedBeforeAcceleration, initialSpeed);
  assert.ok(snapshot.ball.speed > initialSpeed);
});

test("normal gameplay punishes an early tap after tutorial", () => {
  const engine = createGameEngine({
    progress: { tutorialCompleted: true, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
    rng: () => 0.17,
  });

  engine.startGame();
  let snapshot = engine.getSnapshot();
  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });
  snapshot = engine.getSnapshot();
  assert.equal(snapshot.phase, "moving_no_target");

  engine.pointerDown({ x: 10, y: 10 });
  snapshot = engine.getSnapshot();
  assert.equal(snapshot.phase, "lost");
  assert.equal(snapshot.target?.visible, true);
});

test("idle state keeps the starting target visible after tutorial", () => {
  const engine = createGameEngine({
    progress: { tutorialCompleted: true, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
  });

  engine.startGame();
  const snapshot = engine.getSnapshot();

  assert.equal(snapshot.phase, "idle");
  assert.equal(snapshot.target?.visible, true);
  assert.equal(snapshot.target?.x, snapshot.ball.x);
  assert.equal(snapshot.target?.y, snapshot.ball.y);
});

test("best wall hits updates immediately when the current run beats it", () => {
  const engine = createGameEngine({
    progress: { tutorialCompleted: true, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
    rng: () => 0.17,
  });

  engine.setBounds(220, 220);
  engine.startGame();

  let snapshot = engine.getSnapshot();
  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });

  for (let index = 0; index < 120; index += 1) {
    engine.stepFrame(16);
    snapshot = engine.getSnapshot();
    if (snapshot.wallHits > 0) {
      break;
    }
  }

  assert.ok(snapshot.wallHits > 0);
  assert.equal(snapshot.bestWallHits, snapshot.wallHits);
});

test("loss resets current score but preserves the record", () => {
  const engine = createGameEngine({
    progress: { tutorialCompleted: false, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
    rng: () => 0.17,
  });

  engine.startGame();
  let snapshot = engine.getSnapshot();
  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });

  for (let index = 0; index < 400; index += 1) {
    engine.stepFrame(16);
    snapshot = engine.getSnapshot();
    if (snapshot.tutorialStage === "tutorial_step_2_pause") {
      break;
    }
  }

  engine.pointerDown({ x: snapshot.target.x, y: snapshot.target.y });
  snapshot = engine.getSnapshot();
  assert.equal(snapshot.score, 5);

  engine.pointerDown({ x: 5, y: 5 });
  snapshot = engine.getSnapshot();

  assert.equal(snapshot.phase, "lost");
  assert.equal(snapshot.score, 0);
  assert.equal(snapshot.bestScore, 5);
});

test("combo at ten grants an extra twenty five points", () => {
  const config = {
    ...gameConfig,
    scoring: {
      ...gameConfig.scoring,
      minTapPoints: 1,
      maxTapPoints: 1,
    },
  };
  const engine = createGameEngine({
    config,
    progress: { tutorialCompleted: true, bestStreak: 0, bestWallHits: 0, bestScore: 0, bestCombo: 0 },
    rng: () => 0.17,
  });

  engine.setBounds(320, 560);
  engine.startGame();

  let snapshot = engine.getSnapshot();
  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });

  for (let index = 0; index < 3200; index += 1) {
    engine.stepFrame(16);
    snapshot = engine.getSnapshot();

    if (
      snapshot.target?.visible &&
      distance(snapshot.ball, snapshot.target) <= snapshot.hitDistanceThreshold
    ) {
      engine.pointerDown({ x: snapshot.target.x, y: snapshot.target.y });
      snapshot = engine.getSnapshot();
    }

    if (snapshot.combo >= 10) {
      break;
    }
  }

  assert.equal(snapshot.combo, 10);
  assert.equal(snapshot.bestCombo, 10);
  assert.equal(snapshot.nextComboThreshold, 11);
  assert.equal(snapshot.score, 35);
  assert.equal(snapshot.scoreAwardValue, 1);
  assert.equal(snapshot.comboBonusValue, 25);
});

test("extra balls start spawning after thirty seconds of successful play", () => {
  const engine = createGameEngine({
    progress: { tutorialCompleted: true, bestStreak: 0, bestWallHits: 0, bestScore: 0 },
    rng: () => 0.17,
  });

  engine.setBounds(320, 560);
  engine.startGame();

  let snapshot = engine.getSnapshot();
  engine.pointerDown({ x: snapshot.ball.x, y: snapshot.ball.y });

  for (let index = 0; index < 2200; index += 1) {
    engine.stepFrame(16);
    snapshot = engine.getSnapshot();

    if (
      snapshot.target?.visible &&
      distance(snapshot.ball, snapshot.target) <= snapshot.hitDistanceThreshold
    ) {
      engine.pointerDown({ x: snapshot.target.x, y: snapshot.target.y });
      snapshot = engine.getSnapshot();
    }

    for (const extraBall of snapshot.extraBalls) {
      if (
        extraBall.target?.visible &&
        distance(extraBall.ball, extraBall.target) <= extraBall.hitDistanceThreshold
      ) {
        engine.pointerDown({ x: extraBall.target.x, y: extraBall.target.y });
        snapshot = engine.getSnapshot();
      }
    }

    if (snapshot.extraBalls.length > 0) {
      break;
    }
  }

  assert.ok(snapshot.extraBalls.length > 0);
});
