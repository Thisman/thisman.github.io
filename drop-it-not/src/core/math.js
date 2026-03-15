const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function length(vector) {
  return Math.hypot(vector.x, vector.y);
}

export function normalize(vector) {
  const vectorLength = length(vector);
  if (!vectorLength) {
    return { x: 1, y: 0 };
  }
  return {
    x: vector.x / vectorLength,
    y: vector.y / vectorLength,
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function pointInCircle(point, circle, radius = circle.radius) {
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  return dx * dx + dy * dy <= radius * radius;
}

export function randomDirection(rng = Math.random) {
  let direction = null;

  while (!direction) {
    const angle = rng() * TAU;
    const candidate = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };

    if (Math.abs(candidate.x) >= 0.34 && Math.abs(candidate.y) >= 0.24) {
      direction = normalize(candidate);
    }
  }

  return direction;
}

export function segmentCircleFirstIntersection(start, end, center, radius) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fx = start.x - center.x;
  const fy = start.y - center.y;

  const a = dx * dx + dy * dy;
  if (!a) {
    return null;
  }

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  const validT = [t1, t2].find((value) => value >= 0 && value <= 1);

  if (validT === undefined) {
    return null;
  }

  return lerpPoint(start, end, validT);
}
