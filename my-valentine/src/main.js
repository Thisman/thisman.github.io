import { handleError } from '../../shared/browser/errors.js';
import { createValentineGame } from './app/valentine-game.js';
import { createCanvasView } from './ui/canvas-view.js';

function resolveDirectionKey(event) {
    const key = event.key.toLowerCase();
    const isLeft = event.code === 'ArrowLeft' || event.code === 'KeyA' || key === 'a' || key === 'ф';
    const isRight = event.code === 'ArrowRight' || event.code === 'KeyD' || key === 'd' || key === 'в';

    if (isLeft) {
        return 'left';
    }

    if (isRight) {
        return 'right';
    }

    return null;
}

function init() {
    const canvas = document.getElementById('gameCanvas');
    const messageEl = document.getElementById('valentineMessage');
    const winImageEl = document.getElementById('winImage');
    const livesEl = document.getElementById('livesCount');
    const restartBtn = document.getElementById('restartBtn');

    const game = createValentineGame({
        width: canvas.width,
        height: canvas.height
    });
    const view = createCanvasView({
        canvas,
        messageEl,
        winImageEl,
        livesEl
    });

    let lastTime = performance.now();

    function render() {
        view.render(game.getState(), game.getProgressOpacity());
    }

    function loop(timestamp) {
        const delta = Math.min((timestamp - lastTime) / 1000, 0.032);
        lastTime = timestamp;
        game.update(delta);
        render();
        window.requestAnimationFrame(loop);
    }

    function reset() {
        game.reset();
        render();
    }

    window.addEventListener('keydown', (event) => {
        const direction = resolveDirectionKey(event);
        if (direction) {
            game.setKey(direction, true);
            event.preventDefault();
        }

        if (event.code === 'Space') {
            if (game.getState().gameState !== 'playing') {
                game.reset();
            } else {
                game.launchBall();
            }
            render();
            event.preventDefault();
        }
    });

    window.addEventListener('keyup', (event) => {
        const direction = resolveDirectionKey(event);
        if (direction) {
            game.setKey(direction, false);
        }
    });

    window.addEventListener('blur', () => {
        game.clearInput();
    });

    restartBtn?.addEventListener('click', reset);

    render();
    window.requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            init();
        } catch (error) {
            handleError(error, 'my-valentine');
        }
    }, { once: true });
} else {
    try {
        init();
    } catch (error) {
        handleError(error, 'my-valentine');
    }
}
