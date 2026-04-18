import test from 'node:test';
import assert from 'node:assert/strict';

import { bounceFromBrick, circleRectCollision, createBricks, createInitialState } from '../src/core/game-state.js';

test('createBricks creates full heart layout', () => {
    assert.equal(createBricks(900).length, 48);
});

test('circleRectCollision detects overlaps', () => {
    assert.equal(circleRectCollision(
        { x: 10, y: 10, radius: 4 },
        { x: 8, y: 8, width: 8, height: 8 }
    ), true);
});

test('bounceFromBrick flips one of ball axes', () => {
    const ball = { x: 10, y: 10, radius: 4, vx: 30, vy: -40 };
    const brick = { x: 8, y: 8, width: 8, height: 8 };
    bounceFromBrick(ball, brick);
    assert.equal(ball.vx === -30 || ball.vy === 40, true);
});

test('createInitialState initializes lives and brick counters', () => {
    const state = createInitialState(900, 600);
    assert.equal(state.lives, 3);
    assert.equal(state.totalBricks, state.remainingBricks);
});
