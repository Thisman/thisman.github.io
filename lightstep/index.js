import { createGame, generateMap, PATTERNS, SHAPES, randomFromSeed, stepGame } from './game.js';
import { createView } from './view.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#game-canvas');
const view = createView(canvas);
const keys = new Set();
const pointerKeys = new Map();
const result = $('#result');
const action = $('#result-action');
const notice = $('#notice');
const stage = $('#stage');
const pauseButton = $('#pause');
let game, level = 1, attempt = 1, paused = false, jumpQueued = false;
let previousTime = 0, transitionAt = 0;
let patternBag = [], shapeBag = [];
const seedBuffer = new Uint32Array(1);
const newSeed = () => crypto.getRandomValues(seedBuffer)[0];
const twoDigits = number => String(number).padStart(2, '0');

function drawFromBag(bag, count) {
    if (!bag.length) {
        const random = randomFromSeed(newSeed());
        bag.push(...Array.from({ length: count }, (_, i) => i));
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
    }
    return bag.pop();
}

function clearInput() {
    keys.clear();
    pointerKeys.clear();
    jumpQueued = false;
    document.querySelectorAll('.pressed').forEach(button => button.classList.remove('pressed'));
}

function showNotice(text) {
    notice.textContent = text;
}

function startMap(retry = false) {
    clearInput();
    if (retry && game) {
        attempt++;
        game = createGame(game.map, game.patternIndex, level);
    } else {
        attempt = 1;
        game = createGame(generateMap(newSeed(), drawFromBag(shapeBag, SHAPES.length)), drawFromBag(patternBag, PATTERNS.length), level);
    }
    view.build(game.map);
    paused = false;
    transitionAt = 0;
    showNotice('');
    result.hidden = true;
    pauseButton.disabled = false;
    pauseButton.setAttribute('aria-label', 'Пауза (Esc)');
    pauseButton.title = 'Пауза · Esc';
    pauseButton.setAttribute('aria-pressed', 'false');
    $('#level').textContent = twoDigits(level);
    $('#attempt').textContent = twoDigits(attempt);
    stage.dataset.state = 'playing';
    previousTime = performance.now();
    view.render(game);
}

function showResult(title, label) {
    $('#result-title').textContent = title;
    action.innerHTML = `${label} <span aria-hidden="true">↗</span>`;
    result.hidden = false;
    action.focus({ preventScroll: true });
}

function togglePause(force) {
    if (game.status !== 'playing') return;
    const next = typeof force === 'boolean' ? force : !paused;
    if (paused === next) return;
    paused = next;
    clearInput();
    stage.dataset.state = paused ? 'paused' : 'playing';
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? 'Продолжить (Esc)' : 'Пауза (Esc)');
    pauseButton.title = paused ? 'Продолжить · Esc' : 'Пауза · Esc';
    if (paused) {
        showResult('Пауза', 'Продолжить');
        showNotice('');
    } else {
        result.hidden = true;
        canvas.focus({ preventScroll: true });
        previousTime = performance.now();
    }
}

function frame(now) {
    const delta = Math.min((now - previousTime) / 1000, 0.1);
    previousTime = now;
    if (!paused && !document.hidden) {
        if (game.status === 'playing') {
            const previousStatus = game.status;
            const activeKeys = new Set([...keys, ...pointerKeys.values()]);
            stepGame(game, {
                x: Number(activeKeys.has('d')) - Number(activeKeys.has('a')),
                z: Number(activeKeys.has('s')) - Number(activeKeys.has('w')),
                jump: jumpQueued,
            }, delta);
            jumpQueued = false;
            if (game.status !== previousStatus) {
                clearInput();
                stage.dataset.state = game.status;
                pauseButton.disabled = true;
                if (game.status === 'dead') {
                    showNotice('');
                    showResult(game.reason === 'fall' ? 'Падение' : 'Проигрыш', 'Повторить');
                } else {
                    transitionAt = now + 950;
                    showNotice('Уровень пройден');
                }
            }
        } else if (game.status === 'won' && now >= transitionAt) {
            level++;
            startMap();
        }
    }
    view.render(game);
    requestAnimationFrame(frame);
}

const movementCodes = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd' };
window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Tab') return;
    const move = movementCodes[event.code];
    if (move) {
        event.preventDefault();
        if (!paused && game.status === 'playing') keys.add(move);
    } else if (event.code === 'Space') {
        // Preserve native keyboard activation when a UI button has focus.
        if (event.target.closest('button, a')) return;
        event.preventDefault();
        if (!event.repeat && !paused && game.status === 'playing') jumpQueued = true;
    } else if (!event.repeat && (event.code === 'Escape' || event.code === 'KeyP')) togglePause();
    else if (!event.repeat && event.code === 'KeyR') { startMap(true); canvas.focus(); }
    else if (!event.repeat && event.code === 'KeyN') { startMap(); canvas.focus(); }
});
window.addEventListener('keyup', event => { if (movementCodes[event.code]) keys.delete(movementCodes[event.code]); });
window.addEventListener('blur', () => togglePause(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) togglePause(true); });
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    togglePause(true);
    showResult('Ошибка 3D', 'Обновить');
    action.onclick = () => window.location.reload();
});
$('#retry').addEventListener('click', () => { startMap(true); canvas.focus(); });
$('#new-map').addEventListener('click', () => { startMap(); canvas.focus(); });
pauseButton.addEventListener('click', () => togglePause());
action.addEventListener('click', () => { if (paused) togglePause(false); else startMap(true); canvas.focus(); });

document.querySelectorAll('[data-move], #touch-jump').forEach(button => {
    button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (paused || game.status !== 'playing') return;
        button.setPointerCapture(event.pointerId);
        button.classList.add('pressed');
        if (button.dataset.move) pointerKeys.set(event.pointerId, button.dataset.move);
        else jumpQueued = true;
    });
    const release = event => {
        pointerKeys.delete(event.pointerId);
        button.classList.remove('pressed');
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
});
new ResizeObserver(() => view.resize()).observe(stage);
startMap();
requestAnimationFrame(frame);
