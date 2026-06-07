import { GAME_PHASES } from "./gameState.js";
import { transformShapePath } from "./shapes.js";
import { VISUAL_CLASSES } from "./scoring.js";

export class CanvasRenderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.config = config;
    this.viewport = { width: 1, height: 1, dpr: 1 };
    this.resultCache = new WeakMap();
    this.resize();
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.config.drawing.maxDpr);

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewport = { width, height, dpr };
    return this.viewport;
  }

  render(state) {
    const context = this.context;
    const { width, height } = this.viewport;
    context.clearRect(0, 0, width, height);

    if (state.phase === GAME_PHASES.MEMORIZE && state.round) {
      const path = transformShapePath(
        state.round.path,
        this.viewport,
        state.round.viewportScale,
        state.round.rotation
      );
      drawPolylinePartial(context, path, state.revealProgress, this.getPalette().line, this.config.drawing.lineWidth);
    }

    if (state.phase === GAME_PHASES.DRAW && state.stroke.length > 0) {
      drawNormalizedStroke(context, state.stroke, this.viewport, this.getPalette().line, this.config.drawing.lineWidth);
    }

    if (state.phase === GAME_PHASES.RESULT && state.result) {
      this.drawResultOverlay(state.result);
    }

    if (state.phase !== GAME_PHASES.HOME) {
      this.drawCenterDot();
    }
  }

  getPalette() {
    const styles = getComputedStyle(document.documentElement);
    return {
      line: styles.getPropertyValue("--canvas-line").trim() || "#49454f",
      centerDot: styles.getPropertyValue("--center-dot").trim() || "#b3261e",
      match: styles.getPropertyValue("--match").trim() || "#386a20",
      miss: styles.getPropertyValue("--miss").trim() || "#ba1a1a"
    };
  }

  drawCenterDot() {
    const context = this.context;
    const { width, height } = this.viewport;
    const radius = this.config.drawing.centerDotRadius;

    context.save();
    context.fillStyle = this.getPalette().centerDot;
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  drawResultOverlay(result) {
    let overlayCanvas = this.resultCache.get(result);
    if (!overlayCanvas) {
      overlayCanvas = createResultCanvas(result, this.getPalette());
      this.resultCache.set(result, overlayCanvas);
    }

    const drawRect = getResultDrawRect(result, this.viewport);
    this.context.save();
    this.context.imageSmoothingEnabled = false;
    this.context.drawImage(
      overlayCanvas,
      drawRect.x,
      drawRect.y,
      drawRect.width,
      drawRect.height
    );
    this.context.restore();
  }
}

export function getResultDrawRect(result, viewport) {
  const source = result.sourceViewport;
  if (!source) {
    return {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    };
  }

  const sourceMinSide = Math.min(source.width, source.height);
  const scale = sourceMinSide === 0
    ? 1
    : Math.min(viewport.width / source.width, viewport.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height
  };
}

function createResultCanvas(result, palette) {
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;

  const context = canvas.getContext("2d");
  const imageData = context.createImageData(result.width, result.height);
  const match = parseCssColor(palette.match, 230);
  const miss = parseCssColor(palette.miss, 225);

  for (let index = 0; index < result.visualMask.length; index += 1) {
    const target = result.visualMask[index];
    if (target === VISUAL_CLASSES.EMPTY) {
      continue;
    }

    const color = target === VISUAL_CLASSES.MATCH ? match : miss;
    const offset = index * 4;
    imageData.data[offset] = color.r;
    imageData.data[offset + 1] = color.g;
    imageData.data[offset + 2] = color.b;
    imageData.data[offset + 3] = color.a;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function drawNormalizedStroke(context, path, viewport, color, lineWidth) {
  const points = path.map((point) => ({
    x: point.x * viewport.width,
    y: point.y * viewport.height
  }));

  drawPolyline(context, points, color, lineWidth);
}

function drawPolylinePartial(context, points, progress, color, lineWidth) {
  if (points.length < 2) {
    return;
  }

  const total = getPathLength(points);
  const targetLength = total * Math.max(0, Math.min(1, progress));
  let consumed = 0;

  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segment = distance(previous, current);

    if (consumed + segment <= targetLength) {
      context.lineTo(current.x, current.y);
      consumed += segment;
      continue;
    }

    const remaining = Math.max(0, targetLength - consumed);
    const ratio = segment === 0 ? 0 : remaining / segment;
    context.lineTo(
      previous.x + (current.x - previous.x) * ratio,
      previous.y + (current.y - previous.y) * ratio
    );
    break;
  }

  context.stroke();
  context.restore();
}

function drawPolyline(context, points, color, lineWidth) {
  if (points.length === 0) {
    return;
  }

  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x, points[0].y, lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }

  context.stroke();
  context.restore();
}

function getPathLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }
  return length;
}

function distance(first, second) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return Math.hypot(dx, dy);
}

function parseCssColor(color, alpha) {
  const canvas = parseCssColor.canvas ?? document.createElement("canvas");
  parseCssColor.canvas = canvas;
  const context = parseCssColor.context ?? canvas.getContext("2d");
  parseCssColor.context = context;
  context.fillStyle = color;
  const normalized = context.fillStyle;

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: alpha
    };
  }

  const match = normalized.match(/\d+/g)?.map(Number);
  return {
    r: match?.[0] ?? 22,
    g: match?.[1] ?? 163,
    b: match?.[2] ?? 74,
    a: alpha
  };
}
