import { GAME_COLORS, GAME_CONFIG } from "./config.js";

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function circleIntersectsRect(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;

  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function getBlockX(side, bounds) {
  const width = getBlockWidth();
  return side === "left" ? 0 : bounds.width - width;
}

function getBlockWidth() {
  return GAME_CONFIG.wallWidth * GAME_CONFIG.blockWidthMultiplier;
}

function getRandomBlockLength() {
  return randomBetween(GAME_CONFIG.blockMinLength, GAME_CONFIG.blockMaxLength);
}

function createRedBlock(side, y, bounds) {
  const height = getRandomBlockLength();

  return {
    side,
    type: "red",
    x: getBlockX(side, bounds),
    y,
    width: getBlockWidth(),
    height,
    color: BLOCK_TYPES.red.color,
  };
}

function createEmptyState(bounds, ballRadius) {
  return {
    bounds,
    ballRadius,
    blocks: [],
    nextSide: "left",
  };
}

export const BLOCK_TYPES = {
  red: {
    id: "red",
    color: GAME_COLORS.vibrantCoral,
    onCollision() {
      return "lose";
    },
  },
};

export function createBlocks(bounds, ballRadius) {
  const state = createEmptyState(bounds, ballRadius);

  function getMinimumClearance() {
    return state.ballRadius * GAME_CONFIG.blockSafeGapMultiplier;
  }

  function updateBlockPositions(nextBounds) {
    for (const block of state.blocks) {
      block.x = getBlockX(block.side, nextBounds);
      block.width = getBlockWidth();
    }
  }

  function spawnAbove(referenceY) {
    const clearance = getMinimumClearance();
    const gap = Math.max(
      clearance,
      randomBetween(GAME_CONFIG.blockMinGap, GAME_CONFIG.blockMaxGap),
    );
    const previewBlock = createRedBlock(state.nextSide, 0, state.bounds);
    const y = referenceY - previewBlock.height - gap;
    previewBlock.y = y;
    state.blocks.push(previewBlock);
    state.nextSide = state.nextSide === "left" ? "right" : "left";
  }

  function fillInitial(ballY) {
    state.blocks.length = 0;
    state.nextSide = "left";

    let cursor = ballY - GAME_CONFIG.initialEmptyZone;
    const topLimit = -GAME_CONFIG.topSpawnPadding;

    while (cursor > topLimit) {
      const block = createRedBlock(state.nextSide, 0, state.bounds);
      block.y = cursor - block.height;
      state.blocks.push(block);
      state.nextSide = state.nextSide === "left" ? "right" : "left";

      const gap = Math.max(
        getMinimumClearance(),
        randomBetween(GAME_CONFIG.blockMinGap, GAME_CONFIG.blockMaxGap),
      );
      cursor = block.y - gap;
    }
  }

  return {
    resize(nextBounds) {
      const prevHeight = state.bounds.height || nextBounds.height;
      state.bounds = nextBounds;

      for (const block of state.blocks) {
        block.y = (block.y / prevHeight) * nextBounds.height;
      }

      updateBlockPositions(nextBounds);
    },
    reset(ballY) {
      fillInitial(ballY);
    },
    update(dt, speed) {
      for (const block of state.blocks) {
        block.y += speed * dt;
      }

      state.blocks = state.blocks.filter((block) => block.y < state.bounds.height + block.height + 12);

      const topMostY = state.blocks.reduce(
        (minY, block) => Math.min(minY, block.y),
        Number.POSITIVE_INFINITY,
      );

      if (!Number.isFinite(topMostY)) {
        spawnAbove(-GAME_CONFIG.topSpawnPadding);
        return;
      }

      if (topMostY > -GAME_CONFIG.topSpawnPadding) {
        spawnAbove(topMostY);
      }
    },
    draw(ctx) {
      for (const block of state.blocks) {
        ctx.save();
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.width, block.height);
        ctx.restore();
      }
    },
    collides(circle) {
      return state.blocks.some((block) => circleIntersectsRect(circle, block));
    },
  };
}
