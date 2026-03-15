import { clamp, normalize } from "./math.js";

const EPSILON = 1e-4;
const MAX_COLLISIONS_PER_STEP = 16;
const MIN_WALL_EXIT_COMPONENT = 0.18;
const MIN_PARALLEL_ESCAPE_ANGLE = Math.asin(MIN_WALL_EXIT_COMPONENT);

export function createMovementBounds(width, height, ballRadius) {
  return {
    minX: ballRadius,
    maxX: Math.max(ballRadius, width - ballRadius),
    minY: ballRadius,
    maxY: Math.max(ballRadius, height - ballRadius),
  };
}

export function applyBounceSpeed(speed, wallHits, physicsConfig) {
  let nextSpeed = speed;

  if (wallHits >= (physicsConfig.accelerationStartsAtWallHit ?? 1)) {
    nextSpeed *= physicsConfig.bounceSpeedMultiplier;
  }

  for (const trigger of physicsConfig.speedTriggers) {
    if (trigger.wallHits !== wallHits) {
      continue;
    }

    if (typeof trigger.addSpeed === "number") {
      nextSpeed += trigger.addSpeed;
    }

    if (typeof trigger.multiply === "number") {
      nextSpeed *= trigger.multiply;
    }
  }

  return clamp(nextSpeed, physicsConfig.speedClampMin, physicsConfig.speedClampMax);
}

export function reflectVelocity(velocity, collision) {
  return {
    x: collision.hitX ? -velocity.x : velocity.x,
    y: collision.hitY ? -velocity.y : velocity.y,
  };
}

function stabilizeBounceDirection(incomingDirection, outgoingDirection, collision) {
  let stabilized = { ...outgoingDirection };

  if (collision.hitX && Math.abs(outgoingDirection.x) < MIN_WALL_EXIT_COMPONENT) {
    const incomingAngleToWall = Math.atan2(
      Math.abs(incomingDirection.x),
      Math.max(Math.abs(incomingDirection.y), EPSILON)
    );
    const releaseAngle = Math.max(MIN_PARALLEL_ESCAPE_ANGLE, incomingAngleToWall);

    stabilized = {
      x: Math.sign(outgoingDirection.x || 1) * Math.sin(releaseAngle),
      y: Math.sign(outgoingDirection.y || incomingDirection.y || 1) * Math.cos(releaseAngle),
    };
  }

  if (collision.hitY && Math.abs(outgoingDirection.y) < MIN_WALL_EXIT_COMPONENT) {
    const incomingAngleToWall = Math.atan2(
      Math.abs(incomingDirection.y),
      Math.max(Math.abs(incomingDirection.x), EPSILON)
    );
    const releaseAngle = Math.max(MIN_PARALLEL_ESCAPE_ANGLE, incomingAngleToWall);

    stabilized = {
      x: Math.sign(outgoingDirection.x || incomingDirection.x || 1) * Math.cos(releaseAngle),
      y: Math.sign(outgoingDirection.y || 1) * Math.sin(releaseAngle),
    };
  }

  return normalize(stabilized);
}

export function timeToCollision(ball, bounds) {
  const { x, y, vx, vy } = ball;

  const tx = Math.abs(vx) < EPSILON
    ? Number.POSITIVE_INFINITY
    : (vx > 0 ? (bounds.maxX - x) / vx : (bounds.minX - x) / vx);
  const ty = Math.abs(vy) < EPSILON
    ? Number.POSITIVE_INFINITY
    : (vy > 0 ? (bounds.maxY - y) / vy : (bounds.minY - y) / vy);

  const validTx = tx > EPSILON ? tx : Number.POSITIVE_INFINITY;
  const validTy = ty > EPSILON ? ty : Number.POSITIVE_INFINITY;
  const time = Math.min(validTx, validTy);

  if (!Number.isFinite(time)) {
    return {
      time: Number.POSITIVE_INFINITY,
      hitX: false,
      hitY: false,
    };
  }

  return {
    time,
    hitX: Math.abs(validTx - time) <= EPSILON,
    hitY: Math.abs(validTy - time) <= EPSILON,
  };
}

export function advanceBall(ball, deltaMs, bounds, physicsConfig) {
  let remainingSeconds = deltaMs / 1000;
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  let speed = ball.speed;
  let wallHits = ball.wallHits;
  let travelledDistance = 0;
  const previousPosition = { x, y };
  const collisions = [];

  for (
    let index = 0;
    index < MAX_COLLISIONS_PER_STEP && remainingSeconds > EPSILON;
    index += 1
  ) {
    const collision = timeToCollision({ x, y, vx, vy }, bounds);

    if (!Number.isFinite(collision.time) || collision.time > remainingSeconds) {
      x += vx * remainingSeconds;
      y += vy * remainingSeconds;
      travelledDistance += speed * remainingSeconds;
      remainingSeconds = 0;
      break;
    }

    x += vx * collision.time;
    y += vy * collision.time;
    travelledDistance += speed * collision.time;
    remainingSeconds -= collision.time;

    const incomingDirection = normalize({ x: vx, y: vy });
    const reflectedVelocity = reflectVelocity({ x: vx, y: vy }, collision);
    const nextDirection = stabilizeBounceDirection(
      incomingDirection,
      normalize(reflectedVelocity),
      collision
    );

    wallHits += 1;
    speed = applyBounceSpeed(speed, wallHits, physicsConfig);
    vx = nextDirection.x * speed;
    vy = nextDirection.y * speed;

    x = clamp(x, bounds.minX, bounds.maxX);
    y = clamp(y, bounds.minY, bounds.maxY);

    if (collision.hitX) {
      x = clamp(x + Math.sign(vx || nextDirection.x || 1) * EPSILON, bounds.minX + EPSILON, bounds.maxX - EPSILON);
    }

    if (collision.hitY) {
      y = clamp(y + Math.sign(vy || nextDirection.y || 1) * EPSILON, bounds.minY + EPSILON, bounds.maxY - EPSILON);
    }

    collisions.push({
      x,
      y,
      hitX: collision.hitX,
      hitY: collision.hitY,
      wallHits,
      speed,
    });
  }

  return {
    previousPosition,
    currentPosition: { x, y },
    vx,
    vy,
    speed,
    wallHits,
    travelledDistance,
    collisions,
  };
}
