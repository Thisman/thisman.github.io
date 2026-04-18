function readThemePaints() {
    const styles = getComputedStyle(document.documentElement);
    return {
        brick: styles.getPropertyValue('--arcade-brick').trim() || '#d71921',
        brickStroke: styles.getPropertyValue('--arcade-brick-stroke').trim() || 'rgba(0, 0, 0, 0.08)',
        paddle: styles.getPropertyValue('--arcade-paddle').trim() || '#1a1a1a',
        ball: styles.getPropertyValue('--arcade-ball').trim() || '#000000'
    };
}

export function createCanvasView({ canvas, messageEl, winImageEl, livesEl }) {
    const ctx = canvas.getContext('2d');

    function drawBricks(state, theme) {
        for (const brick of state.bricks) {
            if (!brick.alive) {
                continue;
            }
            ctx.fillStyle = theme.brick;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.strokeStyle = theme.brickStroke;
            ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        }
    }

    function drawPaddle(state, theme) {
        ctx.fillStyle = theme.paddle;
        ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height);
    }

    function drawBall(state, theme) {
        ctx.beginPath();
        ctx.fillStyle = theme.ball;
        ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    function render(state, progressOpacity) {
        const theme = readThemePaints();
        ctx.clearRect(0, 0, state.width, state.height);
        drawBricks(state, theme);
        drawPaddle(state, theme);
        drawBall(state, theme);

        livesEl.textContent = String(state.lives);
        messageEl.style.opacity = progressOpacity.toFixed(2);
        messageEl.classList.toggle('is-winning', state.remainingBricks === 0);
        winImageEl.classList.toggle('is-active', state.gameState === 'won');
    }

    return {
        render
    };
}
