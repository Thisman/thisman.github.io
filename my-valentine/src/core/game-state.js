import { CONFIG, HEART_PATTERN } from './config.js';

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function createPaddle(width, height) {
    return {
        width: CONFIG.paddleWidth,
        height: CONFIG.paddleHeight,
        x: (width - CONFIG.paddleWidth) / 2,
        y: height - 28,
        speed: CONFIG.paddleSpeed
    };
}

export function createBall(width, height) {
    return {
        x: width / 2,
        y: height - 60,
        radius: CONFIG.ballRadius,
        vx: 0,
        vy: 0
    };
}

export function createBricks(width) {
    const rows = HEART_PATTERN.length;
    const cols = HEART_PATTERN[0].length;
    const totalWidth = cols * CONFIG.brickSize + (cols - 1) * CONFIG.brickGap;
    const startX = (width - totalWidth) / 2;
    const startY = CONFIG.brickTopOffset;
    const bricks = [];

    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            if (!HEART_PATTERN[row][col]) {
                continue;
            }

            bricks.push({
                x: startX + col * (CONFIG.brickSize + CONFIG.brickGap),
                y: startY + row * (CONFIG.brickSize + CONFIG.brickGap),
                width: CONFIG.brickSize,
                height: CONFIG.brickSize,
                alive: true
            });
        }
    }

    return bricks;
}

export function circleRectCollision(circle, rect) {
    const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
}

export function bounceFromBrick(ball, brick) {
    const centerX = brick.x + brick.width / 2;
    const centerY = brick.y + brick.height / 2;
    const diffX = ball.x - centerX;
    const diffY = ball.y - centerY;
    const overlapX = brick.width / 2 + ball.radius - Math.abs(diffX);
    const overlapY = brick.height / 2 + ball.radius - Math.abs(diffY);

    if (overlapX < overlapY) {
        ball.vx *= -1;
    } else {
        ball.vy *= -1;
    }
}

export function createInitialState(width, height) {
    const bricks = createBricks(width);
    return {
        width,
        height,
        paddle: createPaddle(width, height),
        ball: createBall(width, height),
        bricks,
        remainingBricks: bricks.length,
        totalBricks: bricks.length,
        lives: CONFIG.lives,
        gameState: 'playing',
        ballLaunched: false
    };
}
