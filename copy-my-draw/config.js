export const GAME_CONFIG = {
  timings: {
    memorizeSeconds: 5,
    drawSeconds: 60,
    lineRevealMs: 900,
    scoreRevealMs: 1600
  },
  shapes: {
    enabled: ["square", "diamond", "star", "circle"],
    minViewportScale: 0.35,
    maxViewportScale: 0.8,
    rotationMinDegrees: 0,
    rotationMaxDegrees: 360,
    circleSegments: 96
  },
  drawing: {
    lineWidth: 8,
    centerDotRadius: 4,
    maxDpr: 2,
    minPointDistance: 0.0025
  },
  scoring: {
    gridSize: 512,
    alphaThreshold: 24,
    tolerancePx: 2,
    formula: "f1"
  },
  theme: {
    defaultMode: "system"
  },
  language: {
    default: "ru"
  }
};
