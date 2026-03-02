const ROTATION_VALUES = [0, 90, 180, 270];
const ACTION_ORDER = ["U", "R", "D", "L"];

export function isValidRotation(value) {
  return Number.isInteger(value) && ROTATION_VALUES.includes(value);
}

export function normalizeRotation(value) {
  return isValidRotation(value) ? value : 0;
}

export function rotateAction(action, rotation) {
  const index = ACTION_ORDER.indexOf(action);
  if (index === -1) {
    return action;
  }
  const steps = normalizeRotation(rotation) / 90;
  return ACTION_ORDER[(index + steps) % ACTION_ORDER.length];
}

export function rotationToRadians(rotation) {
  return (normalizeRotation(rotation) * Math.PI) / 180;
}

export function rotateVector(x, y, rotation) {
  const rot = normalizeRotation(rotation);
  if (rot === 0) {
    return { x, y };
  }
  if (rot === 90) {
    return { x: y, y: -x };
  }
  if (rot === 180) {
    return { x: -x, y: -y };
  }
  return { x: -y, y: x };
}

export function getRotatedSize(map) {
  const rotation = normalizeRotation(map.rotation);
  const swapped = rotation === 90 || rotation === 270;
  return {
    w: swapped ? map.h : map.w,
    h: swapped ? map.w : map.h,
  };
}
