export const CONFIG = {
    paddleWidth: 150,
    paddleHeight: 16,
    paddleSpeed: 620,
    ballRadius: 10,
    ballSpeed: 420,
    lives: 3,
    brickSize: 44,
    brickGap: 8,
    brickTopOffset: 36,
    maxBounceAngle: Math.PI / 3
};

export const HEART_PATTERN = [
    [0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]
];
