import {
  getRotatedSize,
  normalizeRotation,
  rotateAction,
  rotationToRadians,
} from "./rotation.js";

const ACTION_DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

const PLAYER_COLORS = ["#4f5d73"];
const START_COLOR = "#b7c9e4";
const GOAL_COLOR = "#b9d6c5";
const TELEPORT_IN_COLOR = "#cbb9e6";
const TELEPORT_OUT_COLOR = "#b5a4dc";
const WALL_COLOR = "#d1b9aa";
const HIGHLIGHT_COLOR = "rgba(170, 160, 150, 0.25)";
const ROTATION_ICON_CLASSES = "fa-solid fa-arrow-rotate-right";
const ROTATION_ICON_COLOR = "#6b655d";
const ROTATION_ICON_SIZE = 16;
const ROTATION_ICON_OFFSET_X = 12;
const ROTATION_ICON_OFFSET_Y = -14;
let rotationIcon = null;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function parseIconContent(content) {
  if (!content || content === "none") {
    return null;
  }
  const trimmed = content.replace(/^["']|["']$/g, "");
  if (trimmed.startsWith("\\") && trimmed.length > 1) {
    const hex = trimmed.slice(1);
    const code = Number.parseInt(hex, 16);
    if (Number.isFinite(code)) {
      return String.fromCodePoint(code);
    }
  }
  return trimmed;
}

function resolveRotationIcon() {
  if (rotationIcon !== null || typeof document === "undefined") {
    return rotationIcon;
  }
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  container.style.visibility = "hidden";
  container.style.pointerEvents = "none";
  const el = document.createElement("i");
  el.className = ROTATION_ICON_CLASSES;
  container.append(el);
  document.body.append(container);
  const style = window.getComputedStyle(el, "::before");
  const glyph = parseIconContent(style.content);
  rotationIcon = glyph
    ? {
        glyph,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
      }
    : null;
  container.remove();
  return rotationIcon;
}

function getBaseBlockSize(mapCount) {
  if (mapCount === 1) {
    return 400;
  }
  if (mapCount === 2) {
    return 350;
  }
  if (mapCount === 3) {
    return 300;
  }
  return 250;
}

function computeLayout(maps, viewportWidth, viewportHeight) {
  const padding = 16;
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const mapCount = maps.length;

  const sizes = maps.map((map) => getRotatedSize(map));

  const baseBlockSize = getBaseBlockSize(mapCount);
  const baseGap = 24;
  let totalWidthPx = 0;
  let totalHeightPx = 0;

  if (mapCount === 1) {
    totalWidthPx = baseBlockSize;
    totalHeightPx = baseBlockSize;
  } else if (mapCount === 2) {
    totalWidthPx = baseBlockSize * 2 + baseGap;
    totalHeightPx = baseBlockSize;
  } else if (mapCount === 3) {
    totalWidthPx = baseBlockSize * 2 + baseGap;
    totalHeightPx = baseBlockSize * 2 + baseGap;
  } else {
    totalWidthPx = baseBlockSize * 2 + baseGap;
    totalHeightPx = baseBlockSize * 2 + baseGap;
  }

  const scale = Math.min(
    1,
    availableWidth / totalWidthPx,
    availableHeight / totalHeightPx
  );
  const blockSize = baseBlockSize * scale;
  const gapPx = baseGap * scale;
  totalWidthPx *= scale;
  totalHeightPx *= scale;

  const originX = (viewportWidth - totalWidthPx) / 2;
  const originY = (viewportHeight - totalHeightPx) / 2;

  const viewports = [];

  const blocks = [];
  if (mapCount === 1) {
    blocks.push({ x: originX, y: originY });
  } else if (mapCount === 2) {
    const rowX = (viewportWidth - (blockSize * 2 + gapPx)) / 2;
    const rowY = originY + (totalHeightPx - blockSize) / 2;
    blocks.push({ x: rowX, y: rowY });
    blocks.push({ x: rowX + blockSize + gapPx, y: rowY });
  } else if (mapCount === 3) {
    const topX = (viewportWidth - blockSize) / 2;
    const topY = originY;
    const bottomX = (viewportWidth - (blockSize * 2 + gapPx)) / 2;
    const bottomY = topY + blockSize + gapPx;
    blocks.push({ x: bottomX, y: bottomY });
    blocks.push({ x: bottomX + blockSize + gapPx, y: bottomY });
    blocks.push({ x: topX, y: topY });
  } else {
    const topX = (viewportWidth - (blockSize * 2 + gapPx)) / 2;
    const topY = originY;
    const bottomY = topY + blockSize + gapPx;
    blocks.push({ x: topX, y: topY });
    blocks.push({ x: topX + blockSize + gapPx, y: topY });
    blocks.push({ x: topX, y: bottomY });
    blocks.push({ x: topX + blockSize + gapPx, y: bottomY });
  }

  for (let i = 0; i < mapCount; i += 1) {
    const map = sizes[i];
    const tileSize = Math.max(
      2,
      Math.floor(Math.min(blockSize / map.w, blockSize / map.h))
    );
    const mapWidth = map.w * tileSize;
    const mapHeight = map.h * tileSize;
    const offsetX = (blockSize - mapWidth) / 2;
    const offsetY = (blockSize - mapHeight) / 2;
    viewports.push({
      x: blocks[i].x + offsetX,
      y: blocks[i].y + offsetY,
      width: mapWidth,
      height: mapHeight,
      tileSize,
    });
  }

  return { viewports };
}

function withMapTransform(ctx, viewport, map, draw) {
  const rotation = normalizeRotation(map.rotation);
  const tileSize = viewport.tileSize;
  if (rotation === 0) {
    draw({ x: viewport.x, y: viewport.y, tileSize });
    return;
  }
  const mapWidth = map.w * tileSize;
  const mapHeight = map.h * tileSize;
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotationToRadians(rotation));
  ctx.translate(-mapWidth / 2, -mapHeight / 2);
  draw({ x: 0, y: 0, tileSize });
  ctx.restore();
}

function drawRotationBadge(ctx, viewport) {
  const centerX = viewport.x + ROTATION_ICON_OFFSET_X;
  const centerY = viewport.y + ROTATION_ICON_OFFSET_Y;
  const icon = resolveRotationIcon();
  if (icon && icon.glyph) {
    ctx.save();
    ctx.fillStyle = ROTATION_ICON_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${icon.fontStyle} ${icon.fontWeight} ${ROTATION_ICON_SIZE}px ${icon.fontFamily}`;
    ctx.fillText(icon.glyph, centerX, centerY);
    ctx.restore();
    return;
  }
  const radius = 10;
  const startAngle = Math.PI * 0.2;
  const endAngle = Math.PI * 1.6;
  ctx.save();
  ctx.strokeStyle = "rgba(120, 110, 100, 0.75)";
  ctx.fillStyle = "rgba(120, 110, 100, 0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.stroke();
  const arrowX = centerX + Math.cos(endAngle) * radius;
  const arrowY = centerY + Math.sin(endAngle) * radius;
  const arrowSize = 4;
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(
    arrowX - arrowSize * Math.cos(endAngle - Math.PI / 6),
    arrowY - arrowSize * Math.sin(endAngle - Math.PI / 6)
  );
  ctx.lineTo(
    arrowX - arrowSize * Math.cos(endAngle + Math.PI / 6),
    arrowY - arrowSize * Math.sin(endAngle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGrid(ctx, viewport, map, tileSize) {
  ctx.strokeStyle = "rgba(140, 130, 120, 0.25)";
  ctx.lineWidth = 1;

  for (let y = 0; y < map.h; y += 1) {
    for (let x = 0; x < map.w; x += 1) {
      ctx.strokeRect(
        viewport.x + x * tileSize,
        viewport.y + y * tileSize,
        tileSize,
        tileSize
      );
    }
  }
}

function drawHighlights(ctx, viewport, map, tileSize, hoverCell) {
  if (!hoverCell) {
    return;
  }
  if (hoverCell.mapIndex !== map.index) {
    return;
  }
  ctx.save();
  ctx.fillStyle = HIGHLIGHT_COLOR;
  ctx.fillRect(
    viewport.x + hoverCell.x * tileSize,
    viewport.y + hoverCell.y * tileSize,
    tileSize,
    tileSize
  );
  ctx.restore();
}
function drawWalls(ctx, viewport, map, tileSize) {
  ctx.fillStyle = WALL_COLOR;
  for (let y = 0; y < map.h; y += 1) {
    const row = map.walls[y];
    for (let x = 0; x < map.w; x += 1) {
      if (row[x] === "#") {
        ctx.fillRect(
          viewport.x + x * tileSize,
          viewport.y + y * tileSize,
          tileSize,
          tileSize
        );
      }
    }
  }
}

function drawTeleport(ctx, viewport, map, tileSize) {
  if (!map.teleport) {
    return;
  }
  const entry = map.teleport.in;
  const exit = map.teleport.out;
  if (Array.isArray(entry)) {
    ctx.fillStyle = TELEPORT_IN_COLOR;
    ctx.fillRect(
      viewport.x + entry[0] * tileSize,
      viewport.y + entry[1] * tileSize,
      tileSize,
      tileSize
    );
  }
  if (Array.isArray(exit)) {
    ctx.fillStyle = TELEPORT_OUT_COLOR;
    ctx.fillRect(
      viewport.x + exit[0] * tileSize,
      viewport.y + exit[1] * tileSize,
      tileSize,
      tileSize
    );
  }
}
function drawGoal(ctx, viewport, map, tileSize, color) {
  if (!Array.isArray(map.B) || map.B.length !== 2) {
    return;
  }
  ctx.fillStyle = color;
  const gx = map.B[0];
  const gy = map.B[1];
  ctx.fillRect(
    viewport.x + gx * tileSize,
    viewport.y + gy * tileSize,
    tileSize,
    tileSize
  );
}

function drawStart(ctx, viewport, map, tileSize, color) {
  if (!Array.isArray(map.A) || map.A.length !== 2) {
    return;
  }
  ctx.fillStyle = color;
  const sx = map.A[0];
  const sy = map.A[1];
  ctx.fillRect(
    viewport.x + sx * tileSize,
    viewport.y + sy * tileSize,
    tileSize,
    tileSize
  );
}
function drawPlayer(
  ctx,
  viewport,
  position,
  tileSize,
  color,
  offset = { x: 0, y: 0 },
  scale = 1
) {
  if (scale <= 0) {
    return;
  }
  const baseSize = tileSize * 0.8;
  const size = baseSize * scale;
  const centerOffset = (baseSize - size) / 2;
  ctx.fillStyle = color;
  ctx.fillRect(
    viewport.x +
      position.x * tileSize +
      tileSize * 0.1 +
      offset.x +
      centerOffset,
    viewport.y +
      position.y * tileSize +
      tileSize * 0.1 +
      offset.y +
      centerOffset,
    size,
    size
  );
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let lastLayout = null;

  function resizeIfNeeded(maps) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const desiredWidth = Math.floor(width * dpr);
    const desiredHeight = Math.floor(height * dpr);

    if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastLayout = computeLayout(maps, width, height);
  }

  function render(level, positions, anim, options = {}) {
    const maps = level.maps;
    const showRotationBadge = Boolean(options.showRotationBadge);
    const hoverCell = options.hoverCell || null;
    resizeIfNeeded(maps);
    const { viewports } = lastLayout;
    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f6f2ea";
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < maps.length; i += 1) {
      const viewport = viewports[i];
      const map = { ...maps[i], index: i };
      withMapTransform(ctx, viewport, map, (localViewport) => {
        drawWalls(ctx, localViewport, map, localViewport.tileSize);
        drawTeleport(ctx, localViewport, map, localViewport.tileSize);
        drawStart(ctx, localViewport, map, localViewport.tileSize, START_COLOR);
        drawGoal(ctx, localViewport, map, localViewport.tileSize, GOAL_COLOR);
        drawGrid(ctx, localViewport, map, localViewport.tileSize);
        drawHighlights(ctx, localViewport, map, localViewport.tileSize, hoverCell);
      });
      if (showRotationBadge && normalizeRotation(map.rotation) !== 0) {
        drawRotationBadge(ctx, viewport);
      }
    }

    const animProgress = anim ? anim.progress : 1;
    for (let i = 0; i < maps.length; i += 1) {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const viewport = viewports[i];
      const map = maps[i];
      const tileSize = viewport.tileSize;
      withMapTransform(ctx, viewport, map, (localViewport) => {
        if (anim) {
          const prev = anim.prevPositions[i];
          const next = anim.nextPositions[i];
          if (anim.teleports && anim.teleports[i]) {
            const phase =
              animProgress < 0.5 ? animProgress * 2 : (animProgress - 0.5) * 2;
            if (animProgress < 0.5) {
              const entry =
                anim.teleportEntries && anim.teleportEntries[i]
                  ? anim.teleportEntries[i]
                  : prev;
              const scale = 1 - easeOutQuad(phase);
              drawPlayer(
                ctx,
                localViewport,
                entry,
                tileSize,
                color,
                { x: 0, y: 0 },
                scale
              );
            } else {
              const scale = easeOutQuad(phase);
              drawPlayer(
                ctx,
                localViewport,
                next,
                tileSize,
                color,
                { x: 0, y: 0 },
                scale
              );
            }
          } else if (anim.bumps[i]) {
            const bumpAction = rotateAction(anim.action, map.rotation);
            const dir = ACTION_DIRS[bumpAction];
            const bumpPhase =
              animProgress < 0.5 ? animProgress * 2 : (1 - animProgress) * 2;
            const bumpAmount = tileSize * 0.22 * easeOutQuad(bumpPhase);
            drawPlayer(ctx, localViewport, prev, tileSize, color, {
              x: dir.x * bumpAmount,
              y: dir.y * bumpAmount,
            });
          } else {
            const t = easeOutQuad(animProgress);
            const interp = {
              x: lerp(prev.x, next.x, t),
              y: lerp(prev.y, next.y, t),
            };
            drawPlayer(ctx, localViewport, interp, tileSize, color);
          }
        } else {
          drawPlayer(ctx, localViewport, positions[i], tileSize, color);
        }
      });
    }
  }

  return {
    render,
    getLayout() {
      return lastLayout;
    },
  };
}
