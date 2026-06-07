const SHAPE_BUILDERS = Object.freeze({
  square: () => closePath([
    { x: -0.5, y: -0.5 },
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0.5 },
    { x: -0.5, y: 0.5 }
  ]),
  diamond: () => closePath([
    { x: 0, y: -0.5 },
    { x: 0.5, y: 0 },
    { x: 0, y: 0.5 },
    { x: -0.5, y: 0 }
  ]),
  star: () => {
    const points = [];
    const total = 10;
    const outer = 0.5;
    const inner = 0.225;

    for (let index = 0; index < total; index += 1) {
      const radius = index % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }

    return closePath(normalizePathToUnitBounds(points));
  },
  circle: (segments = 96) => {
    const points = [];
    const safeSegments = Math.max(24, Math.floor(segments));

    for (let index = 0; index < safeSegments; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / safeSegments;
      points.push({
        x: Math.cos(angle) * 0.5,
        y: Math.sin(angle) * 0.5
      });
    }

    return closePath(points);
  }
});

export function createShapePath(name, config) {
  const builder = SHAPE_BUILDERS[name];
  if (!builder) {
    throw new Error(`Unknown shape: ${name}`);
  }
  return builder(config?.shapes?.circleSegments);
}

export function selectRandomRound(config, random = Math.random) {
  const enabled = config.shapes.enabled;
  const shapeIndex = Math.floor(random() * enabled.length) % enabled.length;
  const minScale = config.shapes.minViewportScale;
  const maxScale = config.shapes.maxViewportScale;
  const scale = minScale + random() * (maxScale - minScale);
  const minRotation = degreesToRadians(config.shapes.rotationMinDegrees);
  const maxRotation = degreesToRadians(config.shapes.rotationMaxDegrees);
  const rotation = minRotation + random() * (maxRotation - minRotation);
  const shapeName = enabled[shapeIndex];

  return {
    id: `${Date.now()}-${shapeName}-${Math.round(scale * 1000)}-${Math.round(rotation * 1000)}`,
    shapeName,
    path: createShapePath(shapeName, config),
    viewportScale: scale,
    rotation
  };
}

export function getPathBounds(path) {
  return path.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    maxX: Math.max(bounds.maxX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxY: Math.max(bounds.maxY, point.y)
  }), {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  });
}

export function transformShapePath(path, viewport, viewportScale, rotation = 0) {
  const size = Math.min(viewport.width, viewport.height) * viewportScale;
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const rotatedPath = rotatePath(path, rotation);
  const bounds = getPathBounds(rotatedPath);
  const boundsSize = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY
  );
  const fitScale = boundsSize === 0 ? size : size / boundsSize;

  return rotatedPath.map((point) => ({
    x: centerX + point.x * fitScale,
    y: centerY + point.y * fitScale
  }));
}

export function toNormalizedViewportPath(path, viewport, viewportScale, rotation = 0) {
  return transformShapePath(path, viewport, viewportScale, rotation).map((point) => ({
    x: point.x / viewport.width,
    y: point.y / viewport.height
  }));
}

function rotatePath(path, rotation) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);

  return path.map((point) => ({
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine
  }));
}

function closePath(points) {
  if (points.length === 0) {
    return points;
  }

  return [
    ...points,
    { x: points[0].x, y: points[0].y }
  ];
}

function normalizePathToUnitBounds(points) {
  const bounds = getPathBounds(points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const scale = Math.max(width, height);

  return points.map((point) => ({
    x: (point.x - centerX) / scale,
    y: (point.y - centerY) / scale
  }));
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}
