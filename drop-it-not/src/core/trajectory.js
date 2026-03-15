import { clamp } from "./math.js";
import {
  applyBounceSpeed,
  createMovementBounds,
  reflectVelocity,
  timeToCollision,
} from "./physics.js";

const EXTRA_SCAN_DISTANCE = 480;
const SAFE_SCAN_STEP = 8;

export function buildTrajectory({
  position,
  velocity,
  speed,
  wallHits,
  width,
  height,
  ballRadius,
  requiredDistance,
  physicsConfig,
}) {
  const bounds = createMovementBounds(width, height, ballRadius);
  const segments = [];
  let totalDistance = 0;
  let x = position.x;
  let y = position.y;
  let vx = velocity.x;
  let vy = velocity.y;
  let currentSpeed = speed;
  let currentWallHits = wallHits;

  while (totalDistance < requiredDistance) {
    const collision = timeToCollision({ x, y, vx, vy }, bounds);

    if (!Number.isFinite(collision.time)) {
      break;
    }

    const endX = x + vx * collision.time;
    const endY = y + vy * collision.time;
    const segmentDistance = currentSpeed * collision.time;

    segments.push({
      start: { x, y },
      end: { x: endX, y: endY },
      direction: { x: vx / currentSpeed, y: vy / currentSpeed },
      speed: currentSpeed,
      length: segmentDistance,
    });

    totalDistance += segmentDistance;

    const reflected = reflectVelocity({ x: vx, y: vy }, collision);
    const reflectedSpeed = applyBounceSpeed(currentSpeed, currentWallHits + 1, physicsConfig);
    const reflectedLength = Math.hypot(reflected.x, reflected.y) || 1;

    currentWallHits += 1;
    currentSpeed = reflectedSpeed;
    vx = (reflected.x / reflectedLength) * currentSpeed;
    vy = (reflected.y / reflectedLength) * currentSpeed;
    x = endX;
    y = endY;
  }

  return {
    segments,
    totalDistance,
  };
}

export function positionAtDistance(trajectory, requestedDistance) {
  if (!trajectory.segments.length) {
    return null;
  }

  let remainingDistance = clamp(requestedDistance, 0, trajectory.totalDistance);

  for (const segment of trajectory.segments) {
    if (remainingDistance <= segment.length) {
      const ratio = segment.length ? remainingDistance / segment.length : 0;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }

    remainingDistance -= segment.length;
  }

  const lastSegment = trajectory.segments[trajectory.segments.length - 1];
  return { ...lastSegment.end };
}

export function createTargetPlan({
  position,
  velocity,
  speed,
  wallHits,
  width,
  height,
  config,
}) {
  const spawnDistance = config.targeting.spawnDelayDistance(wallHits);
  const preferredHitDistance = spawnDistance + config.targeting.leadDistance(wallHits);
  const safeMargin = config.targeting.targetRadius + config.targeting.targetEdgeMargin;
  const requiredDistance = preferredHitDistance + EXTRA_SCAN_DISTANCE;

  const trajectory = buildTrajectory({
    position,
    velocity,
    speed,
    wallHits,
    width,
    height,
    ballRadius: config.input.ballRadius,
    requiredDistance,
    physicsConfig: config.physics,
  });

  let selectedDistance = preferredHitDistance;
  let targetPosition = positionAtDistance(trajectory, selectedDistance);

  while (targetPosition) {
    const isSafe =
      targetPosition.x >= safeMargin &&
      targetPosition.x <= width - safeMargin &&
      targetPosition.y >= safeMargin &&
      targetPosition.y <= height - safeMargin;

    if (isSafe) {
      break;
    }

    selectedDistance += SAFE_SCAN_STEP;
    targetPosition = positionAtDistance(trajectory, selectedDistance);
  }

  if (!targetPosition) {
    selectedDistance = preferredHitDistance;
    targetPosition = positionAtDistance(trajectory, preferredHitDistance);
  }

  return {
    trajectory,
    spawnDistance,
    hitDistance: selectedDistance,
    position: targetPosition,
  };
}
