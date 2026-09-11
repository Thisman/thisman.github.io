import { analyse, COLOR_COUNT, elapsedMs, eraseEdge, formatTime, paintEdge, PALETTES, resetPuzzle } from './game.js';
import { loadProgress, saveProgress } from './storage.js';
import { sectorPath, vertexSectors, VERTEX_RADIUS } from './geometry.js';
import { animatePaint } from './paint-animation.js';
import { DIFFICULTIES } from './difficulty.js';
import { PuzzleGeneration } from './generation.js';

const graph = document.querySelector('#graph');
const palette = document.querySelector('#palette');
const swatches = [...palette.querySelectorAll('button')];
const timer = document.querySelector('#timer');
const completion = document.querySelector('#completion');
const finalTime = document.querySelector('#final-time');
const nextButton = document.querySelector('#new-puzzle');
const helpButton = document.querySelector('#show-help');
const resetButton = document.querySelector('#show-reset');
const helpDialog = document.querySelector('#help-dialog');
const resetDialog = document.querySelector('#reset-dialog');
const popups = [helpDialog, resetDialog];
const tabs = document.querySelector('#difficulties');
const stage = document.querySelector('#graph-stage');
const loader = document.querySelector('#loader');
const generationStatus = document.querySelector('#generation-status');
const retryButton = document.querySelector('#retry-generation');
const generation = new PuzzleGeneration();
let storage;
try { storage = window.localStorage; } catch { /* The game also works without storage. */ }
const saved = loadProgress(storage);
let puzzle = saved?.puzzle ?? null;
let difficulty = puzzle?.difficulty ?? 'intro';
let generating = false;
let selectedColor = saved?.selectedColor ?? 0;
let conflicts = { vertices: new Set(), edges: new Set() };
const edgeElements = new Map();
const vertexElements = new Map();
const edgeSectors = new Map();
const paintWaves = new Map();
const conflictTimers = new WeakMap();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function svgElement(tag, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
}

function persist() { if (puzzle && !generating) saveProgress(storage, puzzle, selectedColor); }
function isDialogOpen() { return completion.open || popups.some(dialog => dialog.open); }

function renderTimer() {
    const elapsed = puzzle && !generating ? elapsedMs(puzzle) : 0;
    const time = formatTime(elapsed);
    timer.textContent = time;
    timer.dateTime = `PT${Math.floor(elapsed / 1000)}S`;
    if (puzzle?.finishedAt != null) finalTime.textContent = time;
}

function selectColor(color) {
    if (generating || !puzzle || puzzle.finishedAt !== null || isDialogOpen()) return;
    selectedColor = color;
    swatches.forEach((button, index) => button.setAttribute('aria-pressed', String(index === color)));
    persist();
}

function updateConflict(element, active, appeared) {
    element.classList.toggle('is-conflict', active);
    if (appeared) {
        clearTimeout(conflictTimers.get(element));
        element.classList.remove('is-new-conflict');
        // Restart only when a new conflict appears, never on timer ticks or
        // recoloring another edge while this conflict remains.
        void element.getBoundingClientRect();
        element.classList.add('is-new-conflict');
        conflictTimers.set(element, setTimeout(() => element.classList.remove('is-new-conflict'), 200));
    } else if (!active) {
        clearTimeout(conflictTimers.get(element));
        element.classList.remove('is-new-conflict');
    }
}

function updateGraph(animate = true) {
    const next = analyse(puzzle);
    for (const edge of puzzle.edges) {
        const element = edgeElements.get(edge.id);
        if (!paintWaves.has(edge.id)) renderEdgeColor(edge);
        element.setAttribute('aria-label', `Ребро ${Number(edge.id.slice(1)) + 1}: ${edge.paintedColor === null ? 'не окрашено' : `цвет ${edge.paintedColor + 1}`}${edge.locked ? ', заданный цвет, нельзя изменить' : ''}${next.edges.has(edge.id) ? ', конфликт' : ''}`);
        element.setAttribute('aria-pressed', String(edge.paintedColor !== null));
        updateConflict(element, next.edges.has(edge.id), animate && next.edges.has(edge.id) && !conflicts.edges.has(edge.id));
    }
    for (const vertex of puzzle.vertices) updateConflict(vertexElements.get(vertex.id), next.vertices.has(vertex.id), animate && next.vertices.has(vertex.id) && !conflicts.vertices.has(vertex.id));
    conflicts = next;
    renderTimer();
    showCompletion();
}

function showCompletion() {
    if (!generating && puzzle?.finishedAt != null && !paintWaves.size && !isDialogOpen()) completion.showModal();
}

function edgeColor(edge) {
    return edge.paintedColor === null ? 'var(--edge)' : PALETTES[puzzle.paletteIndex][edge.paintedColor];
}

function renderEdgeColor(edge) {
    const color = edgeColor(edge);
    edgeElements.get(edge.id).querySelector('.edge-line').style.stroke = color;
    for (const sector of edgeSectors.get(edge.id)) sector.style.fill = color;
}

function paint(id, event, erase = false) {
    if (generating || !puzzle || puzzle.finishedAt !== null || isDialogOpen()) return;
    paintWaves.get(id)?.finish();
    if (!(erase ? eraseEdge(puzzle, id) : paintEdge(puzzle, id, selectedColor))) return;
    if (!reducedMotion.matches) {
        const edge = puzzle.edges.find(edge => edge.id === id);
        const wave = animatePaint(graph, edgeElements.get(id).querySelector('.edge-line'), edgeSectors.get(id), event, edgeColor(edge), () => {
            paintWaves.delete(id);
            renderEdgeColor(edge);
            showCompletion();
        });
        paintWaves.set(id, wave);
    }
    persist();
    updateGraph();
}

function renderPuzzle() {
    for (const wave of paintWaves.values()) wave.cancel();
    paintWaves.clear(); edgeSectors.clear();
    graph.replaceChildren();
    graph.setAttribute('aria-label', `Сетка графа ${puzzle.gridSize} на ${puzzle.gridSize}`);
    graph.append(svgElement('defs'));
    edgeElements.clear(); vertexElements.clear();
    conflicts = { vertices: new Set(), edges: new Set() };
    swatches.forEach((button, index) => {
        button.style.setProperty('--swatch', PALETTES[puzzle.paletteIndex][index]);
        button.setAttribute('aria-pressed', String(index === selectedColor));
    });
    const vertices = new Map(puzzle.vertices.map(vertex => [vertex.id, vertex]));
    for (const edge of puzzle.edges) {
        const a = vertices.get(edge.a), b = vertices.get(edge.b);
        const element = svgElement('g', { class: edge.locked ? 'edge is-locked' : 'edge', 'data-edge-id': edge.id, tabindex: edge.locked ? -1 : 0, role: 'button', 'aria-disabled': String(edge.locked) });
        for (const className of ['edge-gap', 'edge-halo', 'edge-line', 'edge-hit']) {
            element.append(svgElement('line', { class: className, x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'aria-hidden': true }));
        }
        if (edge.locked) {
            const marker = svgElement('g', { class: 'edge-lock', transform: `translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`, 'aria-hidden': true });
            marker.append(svgElement('circle', { r: 9 }));
            marker.append(svgElement('path', { d: 'M -3 -1 V -3 A 3 3 0 0 1 3 -3 V -1', class: 'lock-shackle' }));
            marker.append(svgElement('rect', { x: -4.5, y: -1.5, width: 9, height: 7, rx: 1.5 }));
            element.append(marker);
        }
        edgeSectors.set(edge.id, []);
        element.addEventListener('click', event => paint(edge.id, event, event.shiftKey && event.button === 0));
        element.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (!event.repeat) paint(edge.id);
        });
        edgeElements.set(edge.id, element);
        graph.append(element);
    }
    for (const vertex of puzzle.vertices) {
        const element = svgElement('g', { class: 'vertex', 'data-vertex-id': vertex.id, 'aria-hidden': true });
        element.append(svgElement('circle', { class: 'vertex-ring', cx: vertex.x, cy: vertex.y, r: 23 }));
        const body = svgElement('g', { class: 'vertex-body' });
        body.append(svgElement('circle', { class: 'vertex-dot', cx: vertex.x, cy: vertex.y, r: VERTEX_RADIUS }));
        for (const { edgeId, start, span } of vertexSectors(vertex, vertices, puzzle.edges)) {
            const sector = svgElement('path', { class: 'vertex-sector', 'data-sector-edge': edgeId, d: sectorPath(vertex, start, span) });
            body.append(sector);
            edgeSectors.get(edgeId).push(sector);
        }
        element.append(body);
        vertexElements.set(vertex.id, element);
        graph.append(element);
    }
    updateGraph(false);
}

swatches.forEach((button, index) => button.addEventListener('click', () => selectColor(index)));
document.addEventListener('contextmenu', event => {
    if (event.button !== 2) return;
    event.preventDefault();
    if (generating || !puzzle || puzzle.finishedAt !== null || isDialogOpen()) return;
    selectColor((selectedColor + 1) % COLOR_COUNT);
    const target = event.target.closest('.edge');
    const edge = puzzle.edges.find(edge => edge.id === target?.dataset.edgeId);
    // Right-click always applies the next color; an edge already in that color
    // stays painted instead of invoking the left-click erase toggle.
    if (edge && edge.paintedColor !== selectedColor) paint(edge.id, event);
});

function updateTabs() {
    for (const button of tabs.children) {
        const active = button.dataset.difficulty === difficulty;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
    }
    stage.setAttribute('aria-labelledby', `difficulty-${difficulty}`);
}

function setGenerating(active) {
    generating = active;
    stage.classList.toggle('is-generating', active);
    stage.setAttribute('aria-busy', String(active));
    graph.setAttribute('aria-hidden', String(active));
    graph.inert = active;
    loader.hidden = !active;
    swatches.forEach(button => { button.disabled = active; });
    resetButton.disabled = active || !puzzle;
    renderTimer();
}

function generate(difficultyId) {
    generation.cancel();
    for (const wave of paintWaves.values()) wave.cancel();
    paintWaves.clear();
    completion.close();
    difficulty = difficultyId;
    updateTabs();
    loader.classList.remove('is-error');
    retryButton.hidden = true;
    generationStatus.textContent = 'Создаём пазл…';
    setGenerating(true);
    const seed = crypto.randomUUID();
    generation.start({ difficulty, seed, previousPalette: puzzle?.paletteIndex ?? null }, result => {
        puzzle = result;
        selectedColor = 0;
        renderPuzzle();
        setGenerating(false);
        persist();
    }, () => {
        loader.classList.add('is-error');
        generationStatus.textContent = 'Не удалось создать пазл';
        retryButton.hidden = false;
        stage.setAttribute('aria-busy', 'false');
    });
}

for (const config of DIFFICULTIES) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'difficulty';
    button.id = `difficulty-${config.id}`;
    button.dataset.difficulty = config.id;
    button.textContent = config.label;
    button.title = `${config.gridSize} × ${config.gridSize}, ${config.clues} подсказок`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'graph-stage');
    button.addEventListener('click', () => generate(config.id));
    tabs.append(button);
}
tabs.addEventListener('keydown', event => {
    const index = DIFFICULTIES.findIndex(item => `difficulty-${item.id}` === event.target.id);
    if (index < 0) return;
    const keys = { ArrowRight: (index + 1) % DIFFICULTIES.length, ArrowLeft: (index + DIFFICULTIES.length - 1) % DIFFICULTIES.length, Home: 0, End: DIFFICULTIES.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const button = tabs.children[keys[event.key]];
    button.focus({ preventScroll: true });
    button.click();
});
retryButton.addEventListener('click', () => generate(difficulty));
helpButton.addEventListener('click', () => {
    if (!isDialogOpen()) helpDialog.showModal();
});
resetButton.addEventListener('click', () => {
    if (!generating && puzzle && !isDialogOpen()) resetDialog.showModal();
});
for (const dialog of popups) {
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    // Native Escape dismissal and the close buttons change no game state.
    dialog.addEventListener('close', showCompletion);
}
document.querySelector('#confirm-reset').addEventListener('click', () => {
    if (!resetDialog.open || generating || !puzzle) return;
    resetDialog.close();
    resetPuzzle(puzzle);
    renderPuzzle();
    persist();
});
document.addEventListener('keydown', event => {
    if (!event.altKey && !event.ctrlKey && !event.metaKey && /^[1234]$/.test(event.key) && !isDialogOpen()) {
        event.preventDefault();
        selectColor(Number(event.key) - 1);
    }
});
completion.addEventListener('cancel', event => event.preventDefault());
nextButton.addEventListener('click', () => {
    if (generating || puzzle?.finishedAt == null) return;
    generate(difficulty);
    document.querySelector(`#difficulty-${difficulty}`).focus({ preventScroll: true });
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const wave of paintWaves.values()) wave.finish();
    renderTimer();
});
reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) for (const wave of paintWaves.values()) wave.finish();
});
setInterval(renderTimer, 200);
swatches.forEach((button, index) => button.style.setProperty('--swatch', PALETTES[puzzle?.paletteIndex ?? 0][index]));
updateTabs();
if (puzzle) {
    setGenerating(false);
    renderPuzzle();
    persist();
} else generate(difficulty);
