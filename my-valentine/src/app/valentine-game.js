import { CONFIG } from '../core/config.js';
import {
    bounceFromBrick,
    clamp,
    circleRectCollision,
    createBall,
    createInitialState,
    createPaddle
} from '../core/game-state.js';

export function createValentineGame({ width, height }) {
    let state = createInitialState(width, height);
    const keys = {
        left: false,
        right: false
    };

    function reset() {
        state = createInitialState(width, height);
    }

    function launchBall() {
        if (state.ballLaunched) {
            return;
        }

        const angle = (Math.random() * 0.6 + 0.2) * Math.PI;
        state.ball.vx = CONFIG.ballSpeed * Math.cos(angle);
        state.ball.vy = -CONFIG.ballSpeed * Math.sin(angle);
        state.ballLaunched = true;
    }

    function setKey(key, pressed) {
        if (key in keys) {
            keys[key] = pressed;
        }
    }

    function clearInput() {
        keys.left = false;
        keys.right = false;
    }

    function updatePaddle(dt) {
        let direction = 0;
        if (keys.left) {
            direction -= 1;
        }
        if (keys.right) {
            direction += 1;
        }

        if (direction !== 0) {
            state.paddle.x += direction * state.paddle.speed * dt;
            state.paddle.x = clamp(state.paddle.x, 0, state.width - state.paddle.width);
        }
    }

    function handleBrickCollisions() {
        for (const brick of state.bricks) {
            if (!brick.alive || !circleRectCollision(state.ball, brick)) {
                continue;
            }

            brick.alive = false;
            state.remainingBricks -= 1;
            bounceFromBrick(state.ball, brick);

            if (state.remainingBricks === 0) {
                state.gameState = 'won';
            }
            break;
        }
    }

    function handlePaddleCollision() {
        const { ball, paddle } = state;
        if (
            ball.vy > 0 &&
            ball.y + ball.radius >= paddle.y &&
            ball.y + ball.radius <= paddle.y + paddle.height &&
            ball.x >= paddle.x &&
            ball.x <= paddle.x + paddle.width
        ) {
            const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
            const bounceAngle = hitPoint * CONFIG.maxBounceAngle;
            ball.vx = CONFIG.ballSpeed * Math.sin(bounceAngle);
            ball.vy = -CONFIG.ballSpeed * Math.cos(bounceAngle);
            ball.y = paddle.y - ball.radius - 1;
        }
    }

    function handleMiss() {
        if (state.ball.y - state.ball.radius <= state.height) {
            return;
        }

        state.lives -= 1;
        if (state.lives > 0) {
            state.paddle = createPaddle(width, height);
            state.ball = createBall(width, height);
            state.ballLaunched = false;
        } else {
            state.gameState = 'lost';
        }
    }

    function updateBall(dt) {
        const { ball, paddle } = state;
        if (!state.ballLaunched) {
            ball.x = paddle.x + paddle.width / 2;
            ball.y = paddle.y - ball.radius - 2;
            return;
        }

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx);
        }
        if (ball.x + ball.radius >= state.width) {
            ball.x = state.width - ball.radius;
            ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
        }

        handleBrickCollisions();
        handlePaddleCollision();
        handleMiss();
    }

    function update(dt) {
        if (state.gameState !== 'playing') {
            return state;
        }

        updatePaddle(dt);
        updateBall(dt);
        return state;
    }

    function getProgressOpacity() {
        if (state.totalBricks === 0) {
            return 1;
        }

        return clamp(1 - state.remainingBricks / state.totalBricks, 0, 1);
    }

    function getState() {
        return state;
    }

    return {
        reset,
        launchBall,
        setKey,
        clearInput,
        update,
        getProgressOpacity,
        getState
    };
}
