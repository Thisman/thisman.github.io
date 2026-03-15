import { gameConfig } from "../config.js";
import { segmentCircleFirstIntersection, distance, clamp, normalize } from "../core/math.js";
import { createMovementBounds, advanceBall } from "../core/physics.js";
import { createTargetPlan } from "../core/trajectory.js";

const MENU_DIRECTIONS = [
  { x: 0.48, y: 0.88 },
  { x: -0.9, y: 0.43 },
  { x: -0.63, y: -0.78 },
  { x: 0.74, y: -0.67 },
];
const MENU_EDGE_PADDING = 10;
const MENU_WALL_STICK_EPSILON = 1.5;
const MENU_MIN_SIDE_EXIT_COMPONENT = 0.24;
const MENU_SIDE_RELEASE_COMPONENT = 0.42;
const MENU_INTERNAL_PUSH = 6;
let menuDirectionIndex = 0;

export function createRenderer(canvas, config = gameConfig) {
  const context = canvas.getContext("2d");
  const sceneCanvas = document.createElement("canvas");
  const sceneContext = sceneCanvas.getContext("2d");
  const blurCanvas = document.createElement("canvas");
  const blurContext = blurCanvas.getContext("2d");

  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;
  let menuState = createMenuState(config);
  let backdropAccentMix = 0;
  let lastBackdropTimestamp = null;

  function resize(width, height, nextDpr) {
    cssWidth = width;
    cssHeight = height;
    dpr = nextDpr;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    sceneCanvas.width = canvas.width;
    sceneCanvas.height = canvas.height;
    sceneContext.setTransform(dpr, 0, 0, dpr, 0, 0);

    blurCanvas.width = Math.max(1, Math.round(canvas.width * config.ui.menuBlurScale));
    blurCanvas.height = Math.max(1, Math.round(canvas.height * config.ui.menuBlurScale));

    menuState = createMenuState(config, width, height);
  }

  function render(snapshot, timestampMs) {
    if (!cssWidth || !cssHeight) {
      return;
    }

    updateBackdropAccent(snapshot, timestampMs);

    if (snapshot.mode === "menu") {
      renderMenuScene(
        {
          ctx: context,
          sceneCanvas,
          sceneContext,
          blurCanvas,
          blurContext,
        },
        menuState,
        backdropAccentMix,
        timestampMs,
        cssWidth,
        cssHeight,
        config
      );
      return;
    }

    if (
      snapshot.tutorialStage === "tutorial_step_1" ||
      snapshot.tutorialStage === "tutorial_step_2_pause"
    ) {
      renderTutorialScene(snapshot, timestampMs);
      return;
    }

    renderFullScene(context, snapshot, timestampMs, cssWidth, cssHeight, config);
  }

  function renderTutorialScene(snapshot, timestampMs) {
    sceneContext.clearRect(0, 0, cssWidth, cssHeight);
    renderFullScene(sceneContext, snapshot, timestampMs, cssWidth, cssHeight, config, {
      backdropAccentMix,
    });

    blurContext.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
    blurContext.drawImage(sceneCanvas, 0, 0, blurCanvas.width, blurCanvas.height);

    context.clearRect(0, 0, cssWidth, cssHeight);
    context.save();
    context.filter = `blur(${config.ui.menuBlurPx}px)`;
    context.drawImage(blurCanvas, 0, 0, cssWidth, cssHeight);
    context.restore();

    context.fillStyle = "rgba(255, 248, 238, 0.35)";
    context.fillRect(0, 0, cssWidth, cssHeight);

    if (snapshot.target) {
      drawTarget(context, snapshot.target, timestampMs, config, true);
    }
    drawBall(context, clampBall(snapshot.ball, cssWidth, cssHeight), true);
  }

  return {
    resize,
    render,
  };

  function updateBackdropAccent(snapshot, timestampMs) {
    const targetMix = snapshot.mode === "game" && (snapshot.extraBalls?.length || 0) > 0 ? 1 : 0;

    if (lastBackdropTimestamp == null) {
      lastBackdropTimestamp = timestampMs;
      backdropAccentMix = targetMix;
      return;
    }

    const deltaMs = Math.min(32, Math.max(0, timestampMs - lastBackdropTimestamp));
    const mixStep = deltaMs / 600;
    lastBackdropTimestamp = timestampMs;

    if (targetMix > backdropAccentMix) {
      backdropAccentMix = Math.min(targetMix, backdropAccentMix + mixStep);
      return;
    }

    backdropAccentMix = Math.max(targetMix, backdropAccentMix - mixStep);
  }
}

function renderMenuScene(renderTargets, menuState, backdropAccentMix, timestampMs, width, height, config) {
  const {
    ctx,
    sceneCanvas,
    sceneContext,
    blurCanvas,
    blurContext,
  } = renderTargets;

  const menuSnapshot = stepMenuState(menuState, timestampMs, width, height, config);

  sceneContext.clearRect(0, 0, width, height);
  renderFullScene(sceneContext, menuSnapshot, timestampMs, width, height, config, {
    blurArena: true,
    backdropAccentMix,
    scale: 1.035,
  });

  blurContext.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
  blurContext.drawImage(sceneCanvas, 0, 0, blurCanvas.width, blurCanvas.height);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.filter = `blur(${config.ui.menuBlurPx}px)`;
  ctx.drawImage(blurCanvas, 0, 0, width, height);
  ctx.restore();
  ctx.fillStyle = "rgba(255, 248, 238, 0.14)";
  ctx.fillRect(0, 0, width, height);
}

function renderFullScene(ctx, snapshot, timestampMs, width, height, config, options = {}) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  if (options.scale) {
    ctx.translate(width / 2, height / 2);
    ctx.scale(options.scale, options.scale);
    ctx.translate(-width / 2, -height / 2);
  }

  drawBackdrop(ctx, width, height, options.blurArena, options.backdropAccentMix || 0);

  if (snapshot.target?.visible || snapshot.mode === "menu") {
    drawTarget(ctx, snapshot.target, timestampMs, config, false);
  }

  for (const extraActor of snapshot.extraBalls || []) {
    if (extraActor.target?.visible) {
      drawTarget(ctx, extraActor.target, timestampMs, config, false);
    }
  }

  drawBall(ctx, clampBall(snapshot.ball, width, height), false);
  for (const extraActor of snapshot.extraBalls || []) {
    drawBall(ctx, clampBall(extraActor.ball, width, height), false);
  }
  ctx.restore();
}

function drawBackdrop(ctx, width, height, withSoftGlow, accentMix) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fcf7ef");
  gradient.addColorStop(0.52, "#f4ebdd");
  gradient.addColorStop(1, "#eadfce");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const halo = ctx.createRadialGradient(width * 0.18, height * 0.14, 0, width * 0.18, height * 0.14, width * 0.84);
  halo.addColorStop(0, "rgba(255, 255, 255, 0.62)");
  halo.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  if (withSoftGlow) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(0, 0, width, height);
  }

  if (accentMix > 0) {
    const accentGradient = ctx.createLinearGradient(0, 0, width, height);
    accentGradient.addColorStop(0, withAlpha("#a8c5db", 0.22 * accentMix));
    accentGradient.addColorStop(0.56, withAlpha("#669bbc", 0.34 * accentMix));
    accentGradient.addColorStop(1, withAlpha("#4f88ab", 0.28 * accentMix));
    ctx.fillStyle = accentGradient;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawBall(ctx, ball, emphasized) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(Math.round(ball.x), Math.round(ball.y), ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = emphasized ? ball.color || "#ba5f3c" : ball.color || "#c56f4f";
  ctx.fill();
  ctx.restore();
}

function drawTarget(ctx, target, timestampMs, config, emphasized) {
  const pulse = (Math.sin(timestampMs / config.ui.targetPulseMs * Math.PI * 2) + 1) / 2;
  const radius = target.radius + pulse * 8;

  ctx.save();
  ctx.strokeStyle = emphasized ? "rgba(21, 33, 43, 0.82)" : "rgba(21, 33, 43, 0.62)";
  ctx.lineWidth = emphasized ? 3 : 2;
  ctx.beginPath();
  ctx.arc(Math.round(target.x), Math.round(target.y), radius, 0, Math.PI * 2);
  ctx.stroke();

  const accentColor = target.color || "rgba(184, 92, 56, 0.9)";
  ctx.strokeStyle = emphasized ? accentColor : accentColor;
  ctx.beginPath();
  ctx.arc(Math.round(target.x), Math.round(target.y), target.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function clampBall(ball, width, height) {
  return {
    ...ball,
    x: clamp(ball.x, ball.radius, width - ball.radius),
    y: clamp(ball.y, ball.radius, height - ball.radius),
  };
}

function createMenuState(config, width = config.ui.desktopViewportMaxWidth, height = config.ui.desktopViewportMaxHeight) {
  const ball = {
    x: width / 2,
    y: height / 2,
    vx: 0,
    vy: 0,
    speed: config.physics.baseSpeed,
    wallHits: 0,
    radius: config.input.ballRadius,
    color: "#c56f4f",
  };
  const direction = nextMenuDirection();

  ball.vx = direction.x * ball.speed;
  ball.vy = direction.y * ball.speed;

  const target = createMenuTarget(ball, width, height, config);

  return {
    width,
    height,
    bounds: createMovementBounds(width, height, config.input.ballRadius + MENU_EDGE_PADDING),
    ball,
    target,
    phase: "moving_no_target",
    runDistance: 0,
    wasInsideWindow: false,
    lastTimestamp: null,
  };
}

function stepMenuState(menuState, timestampMs, width, height, config) {
  if (menuState.width !== width || menuState.height !== height) {
    const nextState = createMenuState(config, width, height);
    Object.assign(menuState, nextState);
  }

  if (menuState.lastTimestamp == null) {
    menuState.lastTimestamp = timestampMs;
  }

  let remainingMs = Math.min(32, Math.max(0, timestampMs - menuState.lastTimestamp));
  menuState.lastTimestamp = timestampMs;

  while (remainingMs > 0) {
    const stepMs = Math.min(16, remainingMs);
    advanceMenuState(menuState, stepMs, config);
    remainingMs -= stepMs;
  }

  return {
    mode: "menu",
    ball: {
      ...menuState.ball,
      radius: config.input.ballRadius,
      color: menuState.ball.color,
    },
    target: menuState.target ? { ...menuState.target } : null,
    extraBalls: [],
  };
}

function advanceMenuState(menuState, deltaMs, config) {
  const previousPosition = { x: menuState.ball.x, y: menuState.ball.y };
  const movement = advanceBall(menuState.ball, deltaMs, menuState.bounds, config.physics);

  menuState.ball.x = movement.currentPosition.x;
  menuState.ball.y = movement.currentPosition.y;
  menuState.ball.vx = movement.vx;
  menuState.ball.vy = movement.vy;
  menuState.ball.speed = movement.speed;
  menuState.ball.wallHits = movement.wallHits;
  stabilizeMenuBallNearSideWalls(menuState.ball, menuState.bounds, movement.collisions);
  menuState.runDistance += movement.travelledDistance;

  if (
    menuState.phase === "moving_no_target" &&
    menuState.target &&
    menuState.runDistance >= menuState.target.spawnDistance
  ) {
    menuState.phase = "moving_target";
    menuState.target.visible = true;
  }

  if (menuState.phase !== "moving_target" || !menuState.target?.visible) {
    return;
  }

  const hitEntryPoint = segmentCircleFirstIntersection(
    previousPosition,
    { x: menuState.ball.x, y: menuState.ball.y },
    menuState.target,
    getMenuHitThreshold(menuState.ball.wallHits, config)
  );
  const insideNow =
    distance(menuState.ball, menuState.target) <= getMenuHitThreshold(menuState.ball.wallHits, config);

  if (hitEntryPoint || insideNow) {
    menuState.wasInsideWindow = true;
    return;
  }

  if (menuState.wasInsideWindow) {
    menuState.target = createMenuTarget(menuState.ball, menuState.width, menuState.height, config);
    menuState.phase = "moving_no_target";
    menuState.runDistance = 0;
    menuState.wasInsideWindow = false;
  }
}

function createMenuTarget(ball, width, height, config) {
  const directionLength = Math.hypot(ball.vx, ball.vy) || 1;
  const plan = createTargetPlan({
    position: { x: ball.x, y: ball.y },
    velocity: {
      x: (ball.vx / directionLength) * ball.speed,
      y: (ball.vy / directionLength) * ball.speed,
    },
    speed: ball.speed,
    wallHits: ball.wallHits,
    width,
    height,
    config,
  });

  return {
    x: plan.position.x,
    y: plan.position.y,
    radius: Math.max(
      config.targeting.targetRadius,
      ball.radius * config.targeting.minRelativeSizeToBall
    ),
    visible: false,
    spawnDistance: plan.spawnDistance,
    hitDistance: plan.hitDistance,
  };
}

function nextMenuDirection() {
  const direction = MENU_DIRECTIONS[menuDirectionIndex % MENU_DIRECTIONS.length];
  menuDirectionIndex += 1;
  return normalize(direction);
}

function getMenuHitThreshold(wallHits, config) {
  const { startHitDistance, maxShrinkFactor, shrinkUntilWallHits } = config.input.tapWindow;
  const minHitDistance = Math.max(
    startHitDistance / maxShrinkFactor,
    config.input.ballRadius * config.targeting.minRelativeSizeToBall
  );
  const shrinkProgress = clamp(wallHits / shrinkUntilWallHits, 0, 1);

  return startHitDistance - (startHitDistance - minHitDistance) * shrinkProgress;
}

function withAlpha(hexColor, alpha) {
  const normalized = hexColor.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function stabilizeMenuBallNearSideWalls(ball, bounds, collisions = []) {
  if (ball.speed <= 0) {
    return;
  }

  const latestSideCollision = [...collisions].reverse().find((collision) => collision.hitX);
  const direction = normalize({
    x: ball.vx / ball.speed,
    y: ball.vy / ball.speed,
  });

  const nearLeftWall = ball.x <= bounds.minX + MENU_WALL_STICK_EPSILON;
  const nearRightWall = ball.x >= bounds.maxX - MENU_WALL_STICK_EPSILON;
  const weakHorizontal = Math.abs(direction.x) < MENU_MIN_SIDE_EXIT_COMPONENT;

  if (!latestSideCollision && (!weakHorizontal || (!nearLeftWall && !nearRightWall))) {
    return;
  }

  const awayFromWall = latestSideCollision
    ? Math.sign(ball.vx || (nearLeftWall ? 1 : -1))
    : (nearLeftWall ? 1 : -1);
  const stabilizedDirection = normalize({
    x: awayFromWall * MENU_SIDE_RELEASE_COMPONENT,
    y: direction.y || 1,
  });

  ball.vx = stabilizedDirection.x * ball.speed;
  ball.vy = stabilizedDirection.y * ball.speed;
  ball.x = clamp(
    ball.x + awayFromWall * MENU_WALL_STICK_EPSILON,
    bounds.minX + MENU_INTERNAL_PUSH,
    bounds.maxX - MENU_INTERNAL_PUSH
  );
}
