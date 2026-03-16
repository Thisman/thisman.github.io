export function createBall(bounds, config) {
  let currentBounds = bounds;
  let side = "left";
  let targetSide = "left";
  let startX = 0;
  let x = 0;
  let transitionMs = config.laneSwitchDurationMs;
  let transitionProgress = 1;

  const getLaneCenter = (laneSide) =>
    laneSide === "left"
      ? currentBounds.leftLaneCenterX
      : currentBounds.rightLaneCenterX;

  const reset = () => {
    side = "left";
    targetSide = "left";
    x = getLaneCenter("left");
    startX = x;
    transitionMs = config.laneSwitchDurationMs;
    transitionProgress = 1;
  };

  reset();

  return {
    resize(nextBounds) {
      const widthRatio =
        currentBounds.width > 0 ? nextBounds.width / currentBounds.width : 1;

      startX *= widthRatio;
      x *= widthRatio;
      currentBounds = nextBounds;

      if (transitionProgress >= 1) {
        x = getLaneCenter(targetSide);
        startX = x;
      }
    },
    switchSide() {
      side = targetSide;
      targetSide = targetSide === "left" ? "right" : "left";
      startX = x;
      transitionMs = config.laneSwitchDurationMs;
      transitionProgress = 0;
    },
    update(dt) {
      const targetX = getLaneCenter(targetSide);
      if (transitionProgress >= 1) {
        x = targetX;
        side = targetSide;
        startX = x;
        return;
      }

      transitionProgress = Math.min(
        transitionProgress + (dt * 1000) / transitionMs,
        1,
      );
      x = startX + (targetX - startX) * transitionProgress;

      if (transitionProgress >= 1) {
        x = targetX;
        side = targetSide;
        startX = x;
      }
    },
    draw(ctx) {
      const { x: positionX, y } = this.getCollisionCircle();

      ctx.save();
      ctx.shadowColor = "rgba(80, 81, 79, 0.22)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#50514f";
      ctx.beginPath();
      ctx.arc(positionX, y, config.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    getCollisionCircle() {
      return {
        x,
        y: currentBounds.height - config.ballBottomOffset,
        radius: config.ballRadius,
      };
    },
    reset,
  };
}
