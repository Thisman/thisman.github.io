import { gameConfig } from "../config.js";
import {
  clamp,
  distance,
  pointInCircle,
  randomDirection,
  segmentCircleFirstIntersection,
} from "../core/math.js";
import { advanceBall } from "../core/physics.js";
import { createTargetPlan } from "../core/trajectory.js";

export function createGameEngine({
  config = gameConfig,
  rng = Math.random,
  progress = {
    tutorialCompleted: false,
    bestStreak: 0,
    bestWallHits: 0,
    bestScore: 0,
    bestCombo: 0,
  },
  onTutorialComplete = () => {},
  onRecordsChange = () => {},
} = {}) {
  let width = config.ui.desktopViewportMaxWidth;
  let height = config.ui.desktopViewportMaxHeight;

  const state = {
    mode: "menu",
    tutorialStage: progress.tutorialCompleted ? "inactive" : "pending",
    tutorialCompleted: progress.tutorialCompleted,
    primary: createPrimaryActor(width, height, config),
    extraActors: [],
    streak: 0,
    bestStreak: progress.bestStreak || 0,
    bestWallHits: progress.bestWallHits || 0,
    score: 0,
    bestScore: progress.bestScore || 0,
    combo: 0,
    bestCombo: progress.bestCombo || 0,
    scoreAwardValue: 0,
    scoreAwardToken: 0,
    scoreAwardPosition: null,
    comboBonusValue: 0,
    comboBonusToken: 0,
    toast: "",
    toastTtl: 0,
    lossTimer: 0,
    elapsedGameplayMs: 0,
    nextExtraSpawnAtMs: config.extraBalls.firstSpawnAfterMs,
    extraSpawnCount: 0,
  };

  resetPrimaryToIdle();
  state.tutorialStage = state.tutorialCompleted ? "inactive" : "pending";

  function emitRecordsIfChanged(previousBestStreak, previousBestWallHits, previousBestScore, previousBestCombo) {
    if (
      previousBestStreak !== state.bestStreak ||
      previousBestWallHits !== state.bestWallHits ||
      previousBestScore !== state.bestScore ||
      previousBestCombo !== state.bestCombo
    ) {
      onRecordsChange({
        bestStreak: state.bestStreak,
        bestWallHits: state.bestWallHits,
        bestScore: state.bestScore,
        bestCombo: state.bestCombo,
      });
    }
  }

  function commitScoreAward(points, position) {
    state.scoreAwardValue = points;
    state.scoreAwardToken += 1;
    state.scoreAwardPosition = position ? { ...position } : null;
  }

  function commitComboBonus(points) {
    state.comboBonusValue = points;
    state.comboBonusToken += 1;
  }

  function clearAwardValues() {
    state.scoreAwardValue = 0;
    state.scoreAwardPosition = null;
    state.comboBonusValue = 0;
  }

  function createTarget(position, visible, radius, spawnDistance = 0, hitDistance = 0) {
    return {
      x: position.x,
      y: position.y,
      radius,
      visible,
      spawnDistance,
      hitDistance,
    };
  }

  function resetPrimaryToIdle() {
    resetActorPosition(state.primary, { x: width / 2, y: height / 2 });
    state.primary.phase = "idle";
    state.primary.target = createTarget(
      { x: state.primary.ball.x, y: state.primary.ball.y },
      true,
      state.primary.targetRadius
    );
    state.tutorialStage =
      !state.tutorialCompleted && config.tutorial.step1Enabled
        ? "tutorial_step_1"
        : "inactive";
  }

  function resetActorPosition(actor, position) {
    actor.ball.x = position.x;
    actor.ball.y = position.y;
    actor.ball.vx = 0;
    actor.ball.vy = 0;
    actor.ball.speed = actor.baseSpeed;
    actor.ball.wallHits = 0;
    actor.phase = "idle";
    actor.target = null;
    actor.runDistance = 0;
    actor.wasInsideWindow = false;
    actor.pointsCollected = 0;
  }

  function recalculateActorBounds(actor) {
    actor.bounds = createActorBounds(width, height, actor.ball.radius, actor.boundsInset);
  }

  function openMenu() {
    state.mode = "menu";
    state.tutorialStage = state.tutorialCompleted ? "inactive" : "pending";
    state.elapsedGameplayMs = 0;
    state.nextExtraSpawnAtMs = config.extraBalls.firstSpawnAfterMs;
    state.extraSpawnCount = 0;
    state.extraActors = [];
    state.score = 0;
    state.combo = 0;
    clearAwardValues();
    state.toast = "";
    state.toastTtl = 0;
    state.lossTimer = 0;
    resetPrimaryToIdle();
  }

  function startActorMotion(actor) {
    const direction = randomDirection(rng);

    actor.ball.vx = direction.x * actor.ball.speed;
    actor.ball.vy = direction.y * actor.ball.speed;
    actor.phase = "moving_no_target";
    actor.runDistance = 0;
    actor.wasInsideWindow = false;
    actor.target = createRunTarget(actor, direction);
  }

  function createRunTarget(actor, direction) {
    const inset = actor.boundsInset;
    const localWidth = width - inset * 2;
    const localHeight = height - inset * 2;
    const plan = createTargetPlan({
      position: {
        x: actor.ball.x - inset,
        y: actor.ball.y - inset,
      },
      velocity: {
        x: direction.x * actor.ball.speed,
        y: direction.y * actor.ball.speed,
      },
      speed: actor.ball.speed,
      wallHits: actor.ball.wallHits,
      width: localWidth,
      height: localHeight,
      config,
    });

    return createTarget(
      {
        x: plan.position.x + inset,
        y: plan.position.y + inset,
      },
      false,
      actor.targetRadius,
      plan.spawnDistance,
      plan.hitDistance
    );
  }

  function startGame() {
    state.mode = "game";
    state.elapsedGameplayMs = 0;
    state.nextExtraSpawnAtMs = config.extraBalls.firstSpawnAfterMs;
    state.extraSpawnCount = 0;
    state.extraActors = [];
    state.score = 0;
    state.streak = 0;
    state.combo = 0;
    clearAwardValues();
    resetPrimaryToIdle();
  }

  function markTutorialCompleted() {
    if (!state.tutorialCompleted) {
      state.tutorialCompleted = true;
      state.tutorialStage = "inactive";
      onTutorialComplete();
    }
  }

  function getHitThreshold(actor) {
    const { startHitDistance, maxShrinkFactor, shrinkUntilWallHits } = config.input.tapWindow;
    const minHitDistance = Math.max(
      startHitDistance / maxShrinkFactor,
      actor.ball.radius * config.targeting.minRelativeSizeToBall
    );
    const shrinkProgress = clamp(actor.ball.wallHits / shrinkUntilWallHits, 0, 1);

    return startHitDistance - (startHitDistance - minHitDistance) * shrinkProgress;
  }

  function calculateTapPoints(actor) {
    if (!actor.target) {
      return config.scoring.minTapPoints;
    }

    const hitThreshold = getHitThreshold(actor);
    const ratio = clamp(distance(actor.ball, actor.target) / hitThreshold, 0, 0.999999);
    const bandSize = config.scoring.maxTapPoints - config.scoring.minTapPoints + 1;

    return config.scoring.maxTapPoints - Math.floor(ratio * bandSize);
  }

  function updateBestWallHits(candidate) {
    const previousBestStreak = state.bestStreak;
    const previousBestWallHits = state.bestWallHits;
    const previousBestScore = state.bestScore;
    const previousBestCombo = state.bestCombo;

    state.bestWallHits = Math.max(state.bestWallHits, candidate);
    emitRecordsIfChanged(previousBestStreak, previousBestWallHits, previousBestScore, previousBestCombo);
  }

  function applySuccess(actor, options = {}) {
    const baseAwardedPoints = options.forcedPoints ?? calculateTapPoints(actor);
    const previousBestStreak = state.bestStreak;
    const previousBestWallHits = state.bestWallHits;
    const previousBestScore = state.bestScore;
    const previousBestCombo = state.bestCombo;
    const scoreAwardPosition = actor.target
      ? { x: actor.target.x, y: actor.target.y }
      : null;
    let comboBonusPoints = 0;
    let awardedPoints = baseAwardedPoints;
    state.comboBonusValue = 0;

    state.streak += 1;
    if (baseAwardedPoints === config.scoring.maxTapPoints) {
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      if (isComboThreshold(state.combo)) {
        comboBonusPoints = 25;
        awardedPoints += comboBonusPoints;
      }
    } else {
      state.combo = 0;
    }
    state.score += awardedPoints;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.bestScore = Math.max(state.bestScore, state.score);
    commitScoreAward(baseAwardedPoints, scoreAwardPosition);
    if (comboBonusPoints > 0) {
      commitComboBonus(comboBonusPoints);
    }
    emitRecordsIfChanged(previousBestStreak, previousBestWallHits, previousBestScore, previousBestCombo);

    if (options.completeTutorial) {
      markTutorialCompleted();
    }

    if (actor.role === "extra") {
      actor.pointsCollected += awardedPoints;
      if (actor.pointsCollected >= actor.scoreGoal) {
        startActorExit(actor);
        return;
      }
    }

    actor.target = null;
    actor.wasInsideWindow = false;
    startActorMotion(actor);
  }

  function applyLoss(message) {
    const previousBestStreak = state.bestStreak;
    const previousBestWallHits = state.bestWallHits;
    const previousBestScore = state.bestScore;
    const previousBestCombo = state.bestCombo;

    state.bestWallHits = Math.max(
      state.bestWallHits,
      state.primary.ball.wallHits,
      ...state.extraActors.map((actor) => actor.ball.wallHits)
    );
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.bestScore = Math.max(state.bestScore, state.score);
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    emitRecordsIfChanged(previousBestStreak, previousBestWallHits, previousBestScore, previousBestCombo);

    state.streak = 0;
    state.score = 0;
    state.combo = 0;
    clearAwardValues();
    state.lossTimer = config.ui.lossDelayMs;
    state.toast = message;
    state.toastTtl = config.ui.lossDelayMs;
    state.elapsedGameplayMs = 0;
    state.nextExtraSpawnAtMs = config.extraBalls.firstSpawnAfterMs;
    state.extraSpawnCount = 0;
    state.extraActors = [];
    state.primary.phase = "lost";
    resetPrimaryToIdle();
    state.primary.phase = "lost";
  }

  function isActorInsideHitWindow(actor) {
    return Boolean(
      actor.target &&
      actor.target.visible &&
      distance(actor.ball, actor.target) <= getHitThreshold(actor)
    );
  }

  function isPointerOnActor(point, actor) {
    const onBall = pointInCircle(point, actor.ball, actor.ball.radius);
    const onTarget =
      actor.target &&
      actor.target.visible &&
      pointInCircle(point, actor.target, actor.target.radius);

    return onBall || onTarget;
  }

  function handleTutorialTap(point) {
    if (state.tutorialStage === "tutorial_step_1") {
      if (isPointerOnActor(point, state.primary)) {
        state.tutorialStage = config.tutorial.step2Enabled ? "armed_step2" : "inactive";
        state.primary.target = null;
        startActorMotion(state.primary);
      }
      return;
    }

    if (state.tutorialStage === "tutorial_step_2_pause" && isPointerOnActor(point, state.primary)) {
      applySuccess(state.primary, {
        completeTutorial: true,
        forcedPoints: config.scoring.maxTapPoints,
      });
    }
  }

  function findSuccessfulTapActor(point) {
    const actors = [state.primary, ...state.extraActors];
    const successfulActors = actors.filter(
      (actor) =>
        actor.phase === "moving_target" &&
        actor.target?.visible &&
        isPointerOnActor(point, actor) &&
        isActorInsideHitWindow(actor)
    );

    if (!successfulActors.length) {
      return null;
    }

    return successfulActors.sort(
      (left, right) =>
        distance(point, left.target || left.ball) - distance(point, right.target || right.ball)
    )[0];
  }

  function handleGameplayTap(point) {
    const successfulActor = findSuccessfulTapActor(point);
    if (successfulActor) {
      applySuccess(successfulActor);
      return;
    }

    if (state.primary.phase === "idle") {
      if (pointInCircle(point, state.primary.ball, state.primary.ball.radius)) {
        startActorMotion(state.primary);
      }
      return;
    }

    const visibleTargetExists = [state.primary, ...state.extraActors].some(
      (actor) => actor.phase === "moving_target" && actor.target?.visible
    );

    if (!visibleTargetExists && state.primary.phase === "moving_no_target") {
      applyLoss("Слишком рано");
      return;
    }

    applyLoss("Промах");
  }

  function pointerDown(point) {
    if (state.mode !== "game") {
      return;
    }

    if (
      state.tutorialStage === "tutorial_step_1" ||
      state.tutorialStage === "tutorial_step_2_pause"
    ) {
      handleTutorialTap(point);
      return;
    }

    if (state.tutorialStage === "armed_step2") {
      return;
    }

    handleGameplayTap(point);
  }

  function setBounds(nextWidth, nextHeight) {
    width = nextWidth;
    height = nextHeight;

    recalculateActorBounds(state.primary);
    for (const actor of state.extraActors) {
      recalculateActorBounds(actor);
    }

    if (state.mode === "game") {
      state.extraActors = [];
      state.elapsedGameplayMs = 0;
      state.nextExtraSpawnAtMs = config.extraBalls.firstSpawnAfterMs;
      state.extraSpawnCount = 0;
      resetPrimaryToIdle();
    } else {
      resetPrimaryToIdle();
    }
  }

  function spawnExtraActor() {
    const index = state.extraSpawnCount;
    const actor = createExtraActor(index, width, height, config);
    actor.ball.x = actor.spawnPosition.x;
    actor.ball.y = actor.spawnPosition.y;
    startActorMotion(actor);
    state.extraActors.push(actor);
    state.extraSpawnCount += 1;
    state.nextExtraSpawnAtMs += config.extraBalls.spawnIntervalMs;
  }

  function startActorExit(actor) {
    const exitDirection = createExitDirection(actor.ball, width, height);
    actor.phase = "exiting";
    actor.target = null;
    actor.wasInsideWindow = false;
    actor.ball.vx = exitDirection.x * actor.ball.speed * config.extraBalls.exitSpeedMultiplier;
    actor.ball.vy = exitDirection.y * actor.ball.speed * config.extraBalls.exitSpeedMultiplier;
  }

  function stepActor(actor, deltaMs) {
    if (actor.phase === "idle" || actor.phase === "lost") {
      return;
    }

    if (actor.phase === "exiting") {
      actor.ball.x += actor.ball.vx * (deltaMs / 1000);
      actor.ball.y += actor.ball.vy * (deltaMs / 1000);
      return;
    }

    const previousPosition = { x: actor.ball.x, y: actor.ball.y };
    const movement = advanceBall(actor.ball, deltaMs, actor.bounds, config.physics);

    actor.ball.x = movement.currentPosition.x;
    actor.ball.y = movement.currentPosition.y;
    actor.ball.vx = movement.vx;
    actor.ball.vy = movement.vy;
    actor.ball.speed = movement.speed;
    actor.ball.wallHits = movement.wallHits;
    actor.runDistance += movement.travelledDistance;

    updateBestWallHits(actor.ball.wallHits);

    if (
      actor.phase === "moving_no_target" &&
      actor.target &&
      actor.runDistance >= actor.target.spawnDistance
    ) {
      actor.phase = "moving_target";
      actor.target.visible = true;
    }

    if (
      actor.role === "main" &&
      state.tutorialStage === "armed_step2" &&
      actor.target &&
      actor.runDistance >= actor.target.hitDistance
    ) {
      actor.ball.x = actor.target.x;
      actor.ball.y = actor.target.y;
      state.tutorialStage = "tutorial_step_2_pause";
      actor.phase = "moving_target";
      actor.wasInsideWindow = true;
      return;
    }

    if (actor.role === "extra" && actor.ball.wallHits >= actor.bounceLimit) {
      startActorExit(actor);
      return;
    }

    if (actor.phase !== "moving_target" || !actor.target?.visible) {
      return;
    }

    const hitThreshold = getHitThreshold(actor);
    const hitEntryPoint = segmentCircleFirstIntersection(
      previousPosition,
      { x: actor.ball.x, y: actor.ball.y },
      actor.target,
      hitThreshold
    );
    const insideNow = isActorInsideHitWindow(actor);

    if (hitEntryPoint || insideNow) {
      actor.wasInsideWindow = true;
      return;
    }

    if (actor.wasInsideWindow) {
      applyLoss("Слишком поздно");
    }
  }

  function stepFrame(deltaMs) {
    if (state.toastTtl > 0) {
      state.toastTtl = Math.max(0, state.toastTtl - deltaMs);
      if (state.toastTtl === 0) {
        state.toast = "";
      }
    }

    if (state.mode !== "game") {
      return;
    }

    if (state.primary.phase === "lost") {
      state.lossTimer = Math.max(0, state.lossTimer - deltaMs);
      if (state.lossTimer === 0) {
        resetPrimaryToIdle();
      }
      return;
    }

    if (
      state.primary.phase !== "idle" &&
      state.tutorialStage === "inactive"
    ) {
      state.elapsedGameplayMs += deltaMs;
      if (state.elapsedGameplayMs >= state.nextExtraSpawnAtMs) {
        spawnExtraActor();
      }
    }

    if (
      state.tutorialStage === "tutorial_step_1" ||
      state.tutorialStage === "tutorial_step_2_pause"
    ) {
      return;
    }

    stepActor(state.primary, deltaMs);
    if (state.primary.phase === "lost") {
      return;
    }
    for (const actor of state.extraActors) {
      stepActor(actor, deltaMs);
      if (state.primary.phase === "lost") {
        return;
      }
    }

    state.extraActors = state.extraActors.filter(
      (actor) => !isActorOutsideScene(actor.ball, width, height)
    );
  }

  function getSnapshot() {
    return {
      mode: state.mode,
      phase: state.primary.phase,
      tutorialStage: state.tutorialStage,
      tutorialCompleted: state.tutorialCompleted,
      bounds: { width, height },
      ball: {
        ...state.primary.ball,
      },
      target: state.primary.target
        ? { ...state.primary.target, color: state.primary.ball.accentColor }
        : null,
      extraBalls: state.extraActors.map((actor) => ({
        id: actor.id,
        ball: { ...actor.ball },
        target: actor.target ? { ...actor.target, color: actor.ball.accentColor } : null,
        hitDistanceThreshold: getHitThreshold(actor),
      })),
      wallHits: state.primary.ball.wallHits,
      bestWallHits: state.bestWallHits,
      streak: state.streak,
      bestStreak: state.bestStreak,
      score: state.score,
      bestScore: state.bestScore,
      combo: state.combo,
      bestCombo: state.bestCombo,
      nextComboThreshold: getNextComboThreshold(state.combo),
      scoreAwardValue: state.scoreAwardValue,
      scoreAwardToken: state.scoreAwardToken,
      scoreAwardPosition: state.scoreAwardPosition ? { ...state.scoreAwardPosition } : null,
      comboBonusValue: state.comboBonusValue,
      comboBonusToken: state.comboBonusToken,
      toast: state.toast,
      targetPulseMs: config.ui.targetPulseMs,
      hitDistanceThreshold: getHitThreshold(state.primary),
    };
  }

  return {
    openMenu,
    startGame,
    pointerDown,
    setBounds,
    stepFrame,
    getSnapshot,
  };
}

function createPrimaryActor(width, height, config) {
  return {
    id: "primary",
    role: "main",
    phase: "menu",
    baseSpeed: config.physics.baseSpeed,
    boundsInset: 0,
    bounceLimit: Number.POSITIVE_INFINITY,
    scoreGoal: Number.POSITIVE_INFINITY,
    targetRadius: Math.max(
      config.targeting.targetRadius,
      config.input.ballRadius * config.targeting.minRelativeSizeToBall
    ),
    ball: {
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      speed: config.physics.baseSpeed,
      wallHits: 0,
      radius: config.input.ballRadius,
      color: "#c56f4f",
      accentColor: "#b85c38",
    },
    target: null,
    runDistance: 0,
    wasInsideWindow: false,
    pointsCollected: 0,
    bounds: createActorBounds(width, height, config.input.ballRadius, 0),
  };
}

function createExtraActor(index, width, height, config) {
  const radius = config.extraBalls.baseRadius + index * config.extraBalls.radiusStep;
  const speed = config.extraBalls.baseSpeed + index * config.extraBalls.speedStep;
  const boundsInset = config.extraBalls.baseBoundsInset + index * config.extraBalls.boundsInsetStep;
  const color = config.extraBalls.colors[index % config.extraBalls.colors.length];
  const spawnPosition = getExtraSpawnPosition(index, width, height, boundsInset, radius);

  return {
    id: `extra-${index}`,
    role: "extra",
    phase: "idle",
    baseSpeed: speed,
    boundsInset,
    bounceLimit: getPrimeBounceLimit(index, config.extraBalls.primeBounceLimits),
    scoreGoal: config.extraBalls.baseScoreGoal + index * config.extraBalls.scoreGoalStep,
    targetRadius: Math.max(
      config.targeting.targetRadius - 6,
      radius * config.targeting.minRelativeSizeToBall
    ),
    spawnPosition,
    ball: {
      x: spawnPosition.x,
      y: spawnPosition.y,
      vx: 0,
      vy: 0,
      speed,
      wallHits: 0,
      radius,
      color,
      accentColor: color,
    },
    target: null,
    runDistance: 0,
    wasInsideWindow: false,
    pointsCollected: 0,
    bounds: createActorBounds(width, height, radius, boundsInset),
  };
}

function createActorBounds(width, height, radius, inset) {
  return {
    minX: radius + inset,
    maxX: Math.max(radius + inset, width - radius - inset),
    minY: radius + inset,
    maxY: Math.max(radius + inset, height - radius - inset),
  };
}

function getExtraSpawnPosition(index, width, height, inset, radius) {
  const positions = [
    { x: 0.3, y: 0.32 },
    { x: 0.7, y: 0.34 },
    { x: 0.68, y: 0.7 },
    { x: 0.28, y: 0.68 },
  ];
  const selected = positions[index % positions.length];
  const minX = radius + inset;
  const maxX = width - radius - inset;
  const minY = radius + inset;
  const maxY = height - radius - inset;

  return {
    x: minX + (maxX - minX) * selected.x,
    y: minY + (maxY - minY) * selected.y,
  };
}

function createExitDirection(ball, width, height) {
  const dx = ball.x - width / 2;
  const dy = ball.y - height / 2;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: dx / length,
    y: dy / length,
  };
}

function isActorOutsideScene(ball, width, height) {
  const margin = ball.radius * 3;

  return (
    ball.x < -margin ||
    ball.x > width + margin ||
    ball.y < -margin ||
    ball.y > height + margin
  );
}

function getPrimeBounceLimit(index, primeBounceLimits) {
  if (index < primeBounceLimits.length) {
    return primeBounceLimits[index];
  }

  let candidate = primeBounceLimits[primeBounceLimits.length - 1] + 1;
  let found = primeBounceLimits.length - 1;

  while (found < index) {
    if (isPrime(candidate)) {
      found += 1;
      if (found === index) {
        return candidate;
      }
    }
    candidate += 1;
  }

  return primeBounceLimits[primeBounceLimits.length - 1];
}

function isPrime(value) {
  if (value < 2) {
    return false;
  }

  for (let divider = 2; divider * divider <= value; divider += 1) {
    if (value % divider === 0) {
      return false;
    }
  }

  return true;
}

function getNextComboThreshold(value) {
  if (value < 10) {
    return 10;
  }

  let candidate = value + 1;
  while (!isComboThreshold(candidate)) {
    candidate += 1;
  }

  return candidate;
}

function isComboThreshold(value) {
  return value === 10 || (value >= 11 && isPrime(value));
}
