export const gameConfig = {
  physics: {
    baseSpeed: 238,
    bounceSpeedMultiplier: 1.012,
    accelerationStartsAtWallHit: 7,
    speedClampMultiplier: 2.3,
    speedClampMin: 220,
    speedClampMax: 547.4,
    speedTriggers: [
      { wallHits: 10, addSpeed: 8 },
      { wallHits: 16, multiply: 1.018 },
    ],
  },
  targeting: {
    targetRadius: 34,
    minRelativeSizeToBall: 1.2,
    targetEdgeMargin: 12,
    spawnDelayDistance(wallHits) {
      return Math.min(210, wallHits * 20);
    },
    leadDistance(wallHits) {
      return Math.max(126, 300 - wallHits * 14);
    },
  },
  input: {
    ballRadius: 20,
    tapWindow: {
      startHitDistance: 42,
      maxShrinkFactor: 1.5,
      shrinkUntilWallHits: 6,
    },
  },
  scoring: {
    minTapPoints: 1,
    maxTapPoints: 5,
  },
  extraBalls: {
    firstSpawnAfterMs: 30000,
    spawnIntervalMs: 30000,
    baseRadius: 13,
    radiusStep: 2,
    baseSpeed: 178,
    speedStep: 14,
    baseBoundsInset: 28,
    boundsInsetStep: 10,
    primeBounceLimits: [2, 3, 5, 7, 11, 13, 17, 19],
    baseScoreGoal: 6,
    scoreGoalStep: 2,
    exitSpeedMultiplier: 1.65,
    colors: ["#477998", "#5f8f6e", "#7d6ca8", "#c98a4a"],
  },
  tutorial: {
    version: 1,
    step1Enabled: true,
    step2Enabled: true,
    handAnimationMs: 1200,
  },
  ui: {
    desktopViewportMaxWidth: 430,
    desktopViewportMaxHeight: 932,
    menuBlurScale: 0.5,
    menuBlurPx: 6,
    lossDelayMs: 720,
    targetPulseMs: 1120,
  },
};
