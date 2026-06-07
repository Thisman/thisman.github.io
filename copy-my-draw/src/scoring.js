import { toNormalizedViewportPath } from "./shapes.js";

const VISUAL_EMPTY = 0;
const VISUAL_MATCH = 1;
const VISUAL_MISS = 2;

export const VISUAL_CLASSES = Object.freeze({
  EMPTY: VISUAL_EMPTY,
  MATCH: VISUAL_MATCH,
  MISS: VISUAL_MISS
});

export function calculateMaskScore(targetMask, userMask, width, height, tolerancePx) {
  const targetDilated = dilateMask(targetMask, width, height, tolerancePx);
  const userDilated = dilateMask(userMask, width, height, tolerancePx);
  const visualMask = new Uint8Array(width * height);

  let targetPixels = 0;
  let userPixels = 0;
  let targetMatched = 0;
  let userMatched = 0;

  for (let index = 0; index < targetMask.length; index += 1) {
    const target = targetMask[index] === 1;
    const user = userMask[index] === 1;

    if (target) {
      targetPixels += 1;
      if (userDilated[index] === 1) {
        targetMatched += 1;
        visualMask[index] = VISUAL_MATCH;
      } else {
        visualMask[index] = VISUAL_MISS;
      }
    }

    if (user) {
      userPixels += 1;
      if (targetDilated[index] === 1) {
        userMatched += 1;
        visualMask[index] = VISUAL_MATCH;
      } else if (visualMask[index] === VISUAL_EMPTY) {
        visualMask[index] = VISUAL_MISS;
      }
    }
  }

  if (targetPixels === 0 || userPixels === 0) {
    return {
      score: 0,
      percent: 0,
      precision: 0,
      recall: 0,
      visualMask,
      width,
      height
    };
  }

  const precision = userMatched / userPixels;
  const recall = targetMatched / targetPixels;
  const score = precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);

  return {
    score,
    percent: Math.round(score * 100),
    precision,
    recall,
    visualMask,
    width,
    height
  };
}

export function dilateMask(mask, width, height, radius) {
  const safeRadius = Math.max(0, Math.floor(radius));
  if (safeRadius === 0) {
    return new Uint8Array(mask);
  }

  const output = new Uint8Array(mask.length);
  const offsets = buildCircleOffsets(safeRadius);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) {
        continue;
      }

      for (const offset of offsets) {
        const nx = x + offset.x;
        const ny = y + offset.y;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          output[ny * width + nx] = 1;
        }
      }
    }
  }

  return output;
}

export function binaryMaskFromAlpha(imageData, alphaThreshold) {
  const mask = new Uint8Array(imageData.width * imageData.height);
  const data = imageData.data;

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    mask[pixel] = data[pixel * 4 + 3] >= alphaThreshold ? 1 : 0;
  }

  return mask;
}

export function scoreDrawing(round, userStroke, viewport, config) {
  const maskSize = createMaskSize(viewport, config.scoring.gridSize);
  const lineWidth = config.drawing.lineWidth * maskSize.scale;
  const targetPath = toNormalizedViewportPath(
    round.path,
    viewport,
    round.viewportScale,
    round.rotation
  );

  const targetMask = renderPathMask(
    targetPath,
    maskSize.width,
    maskSize.height,
    lineWidth,
    config.scoring.alphaThreshold
  );
  const userMask = renderPathMask(
    userStroke,
    maskSize.width,
    maskSize.height,
    lineWidth,
    config.scoring.alphaThreshold
  );

  const result = calculateMaskScore(
    targetMask,
    userMask,
    maskSize.width,
    maskSize.height,
    config.scoring.tolerancePx
  );

  return {
    ...result,
    sourceViewport: {
      width: viewport.width,
      height: viewport.height
    }
  };
}

export function createMaskSize(viewport, maxSize) {
  const longSide = Math.max(viewport.width, viewport.height);
  const scale = maxSize / longSide;

  return {
    width: Math.max(1, Math.round(viewport.width * scale)),
    height: Math.max(1, Math.round(viewport.height * scale)),
    scale
  };
}

function renderPathMask(path, width, height, lineWidth, alphaThreshold) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#000";
  context.fillStyle = "#000";
  context.lineWidth = Math.max(1, lineWidth);
  context.lineCap = "round";
  context.lineJoin = "round";

  drawNormalizedPath(context, path, width, height, context.lineWidth);

  return binaryMaskFromAlpha(
    context.getImageData(0, 0, width, height),
    alphaThreshold
  );
}

function drawNormalizedPath(context, path, width, height, lineWidth) {
  if (path.length === 0) {
    return;
  }

  if (path.length === 1) {
    context.beginPath();
    context.arc(path[0].x * width, path[0].y * height, lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(path[0].x * width, path[0].y * height);

  for (let index = 1; index < path.length; index += 1) {
    context.lineTo(path[index].x * width, path[index].y * height);
  }

  context.stroke();
}

function buildCircleOffsets(radius) {
  const offsets = [];
  const radiusSquared = radius * radius;

  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radiusSquared) {
        offsets.push({ x, y });
      }
    }
  }

  return offsets;
}
