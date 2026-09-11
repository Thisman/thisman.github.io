import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, choosePalette, elapsedMs, formatTime, paintEdge, PALETTES, resetPuzzle } from '../game.js';
import { generatePuzzle, generateSolution, clueQuality } from '../generator.js';
import { DIFFICULTIES, matchesDifficulty } from '../difficulty.js';
import { ALL_COLORS, GRID_EDGES, INCIDENT, countSolutions, searchDomains, seededRandom } from '../solver.js';
import { evaluateHumanDifficulty } from '../human-solver.js';
import { PuzzleGeneration } from '../generation.js';
import { PREPARED_PUZZLES } from '../prepared-puzzles.js';
import { getGrid, gridForEdgeCount } from '../grid.js';
import { GRID_SQUARES, revealedSquares } from '../grid-squares.js';
const createPuzzle = (previousPalette = null, random = () => 0.42) => generatePuzzle({ difficulty: 'expert', previousPalette, seed: String(random()) });
import { isValidPuzzle, loadProgress, saveProgress, STORAGE_KEY } from '../storage.js';
import { projectOnEdge, sectorPath, vertexSectors } from '../geometry.js';

function seeded(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function checkGrid(graph, givens = 40) {
    const size = graph.gridSize;
    assert.equal(graph.vertices.length, size ** 2);
    assert.equal(graph.edges.length, 2 * size * (size - 1));
    assert.equal(new Set(graph.vertices.map(vertex => vertex.x)).size, size);
    assert.equal(new Set(graph.vertices.map(vertex => vertex.y)).size, size);
    const vertices = new Map(graph.vertices.map(vertex => [vertex.id, vertex]));
    const incident = new Map(graph.vertices.map(vertex => [vertex.id, []]));
    const pairs = new Set(), ids = new Set();
    for (const edge of graph.edges) {
        assert.ok(!ids.has(edge.id)); ids.add(edge.id);
        const a = vertices.get(edge.a), b = vertices.get(edge.b);
        assert.ok(a && b);
        assert.equal(Math.abs(a.row - b.row) + Math.abs(a.column - b.column), 1, 'only orthogonal immediate neighbors');
        assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 616 / (size - 1)) < 1e-9, 'uniform square spacing');
        const pair = [edge.a, edge.b].sort().join(':');
        assert.ok(!pairs.has(pair)); pairs.add(pair);
        assert.ok([0, 1, 2, 3].includes(edge.solutionColor));
        assert.equal(typeof edge.locked, 'boolean');
        assert.equal(edge.paintedColor, edge.locked ? edge.solutionColor : null);
        incident.get(edge.a).push(edge); incident.get(edge.b).push(edge);
    }
    const degrees = { 2: 0, 3: 0, 4: 0 };
    for (const vertex of graph.vertices) {
        const edges = incident.get(vertex.id);
        const expected = 4 - Number(vertex.row === 0 || vertex.row === size - 1) - Number(vertex.column === 0 || vertex.column === size - 1);
        assert.equal(edges.length, expected);
        assert.equal(new Set(edges.map(edge => edge.solutionColor)).size, expected, 'proper hidden four-color solution');
        degrees[edges.length]++;
    }
    assert.deepEqual(degrees, { 2: 4, 3: 4 * (size - 2), 4: (size - 2) ** 2 });
    assert.equal(graph.edges.filter(edge => edge.locked).length, givens);
    const reached = new Set(['v0']);
    for (let pass = 0; pass < size ** 2; pass++) for (const edge of graph.edges) {
        if (reached.has(edge.a) || reached.has(edge.b)) { reached.add(edge.a); reached.add(edge.b); }
    }
    assert.equal(reached.size, size ** 2, 'connected');
}

test('difficulty table exactly matches the requested sizes, totals, clues and remaining edges', () => {
    const expected = [
        ['intro', 5, 40, 24, 16], ['easy', 6, 60, 42, 18],
        ['normal', 7, 84, 50, 34], ['hard', 8, 112, 56, 56],
        ['expert', 9, 144, 40, 104], ['extreme', 9, 144, 32, 112]
    ];
    assert.deepEqual(DIFFICULTIES.map(({ id, gridSize, clues }) => {
        const total = getGrid(gridSize).edges.length;
        return [id, gridSize, total, clues, total - clues];
    }), expected);
});

test('each solver grid has its own adjacency and square perimeters', () => {
    for (const size of [5, 9, 6, 8, 7, 5]) {
        const grid = getGrid(size);
        assert.equal(grid.incident.length, size ** 2);
        assert.equal(grid.squares.length, (size - 1) * size * (2 * size - 1) / 6);
        assert.equal(gridForEdgeCount(grid.edges.length), grid);
        for (let i = 0; i < grid.edges.length; i++) {
            const edge = grid.edges[i];
            const expected = grid.edges.flatMap((other, index) => index !== i && [other.a, other.b].some(vertex => vertex === edge.a || vertex === edge.b) ? [index] : []);
            assert.deepEqual([...grid.peers[i]].sort((a,b) => a-b), expected);
        }
        for (const square of [grid.squares[0], grid.squares.at(-1)]) {
            const colors = Array(grid.edges.length).fill(null);
            for (const edge of square) colors[edge] = 0;
            assert.equal(revealedSquares(colors).length, 1);
            colors[square[0]] = null;
            assert.equal(revealedSquares(colors).length, 0);
        }
        const solution = generateSolution(seededRandom('mixed-' + size), size);
        assert.equal(countSolutions(solution).solutions, 1);
        assert.equal(countSolutions(Array(solution.length).fill(null)).solutions, 2);
    }
    assert.throws(() => gridForEdgeCount(41));
});

for (const difficulty of DIFFICULTIES) test(difficulty.label + ': exact clues, unique solution, strategy and quality across 30 seeds', () => {
    const signatures = new Set();
    for (let seed = 0; seed < 30; seed++) {
        const request = { difficulty: difficulty.id, seed: 'validation-' + seed };
        const puzzle = generatePuzzle(request);
        checkGrid(puzzle, difficulty.clues);
        assert.ok(isValidPuzzle(puzzle));
        assert.equal(puzzle.startedAt, null);
        assert.equal(analyse(puzzle).edges.size, 0);
        assert.equal(analyse(puzzle).solved, false);
        assert.ok(!('index' in puzzle) && !('level' in puzzle));
        const clues = puzzle.edges.map(edge => edge.paintedColor);
        assert.ok(clueQuality(clues).valid);
        assert.equal(revealedSquares(clues).length, 0, 'no completely revealed square of any size');
        const result = countSolutions(clues);
        assert.equal(result.solutions, 1); assert.ok(result.complete);
        assert.deepEqual(result.solution, puzzle.edges.map(edge => edge.solutionColor));
        assert.ok(matchesDifficulty(difficulty.id, evaluateHumanDifficulty(clues)));
        signatures.add(clues.join(','));
        if (seed < 3) assert.deepEqual(puzzle, generatePuzzle(request), 'seed reproduces puzzle and metrics');
    }
    assert.ok(signatures.size >= 15, 'varied clue positions and colorings');
});

test('solver distinguishes zero, one and multiple solutions, and bounded search never certifies an unfinished proof', () => {
    const solution = generateSolution(seededRandom('solver'));
    assert.equal(countSolutions(solution).solutions, 1);
    const contradictory = [...solution]; contradictory[1] = contradictory[0];
    assert.equal(countSolutions(contradictory).solutions, 0);
    const empty = Array(144).fill(null);
    assert.equal(countSolutions(empty).solutions, 2);
    const bounded = searchDomains(new Uint8Array(144).fill(ALL_COLORS), { nodeLimit: 1 });
    assert.equal(bounded.complete, false);
    // A bichromatic component without clues has at least its two color swaps.
    const missing = solution.map(color => color < 2 ? null : color);
    assert.equal(countSolutions(missing).solutions, 2);
    assert.throws(() => generatePuzzle({ difficulty: 'missing', seed: 'x' }));
});

test('square detection requires every perimeter edge and includes larger squares', () => {
    assert.equal(GRID_SQUARES.length, 204);
    for (const index of [0, 64, 203]) {
        const clues = Array(144).fill(null);
        for (const edge of GRID_SQUARES[index]) clues[edge] = 0;
        assert.equal(revealedSquares(clues).length, 1);
        clues[GRID_SQUARES[index][0]] = null;
        assert.equal(revealedSquares(clues).length, 0);
    }
});

test('loader minimum duration is cancellable even after the old worker has finished', async () => {
    const workers = [], results = [];
    const generation = new PuzzleGeneration(() => {
        const worker = { terminate() {}, postMessage() {} };
        workers.push(worker); return worker;
    }, 60);
    const start = value => generation.start({}, () => results.push(value), () => assert.fail());
    start('old'); workers[0].onmessage({ data: { puzzle: {} } });
    assert.deepEqual(results, []);
    await new Promise(resolve => setTimeout(resolve, 15));
    start('new'); workers[1].onmessage({ data: { puzzle: {} } });
    assert.deepEqual(results, []);
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.deepEqual(results, ['new']);
});

test('full random solutions mix all four colors in both directions rather than repeating two-color stripes', () => {
    for (let seed = 0; seed < 10; seed++) {
        const colors = generateSolution(seededRandom(seed));
        for (const horizontal of [true, false]) {
            const used = new Set(GRID_EDGES.flatMap((edge, i) => ((+edge.b.slice(1) - +edge.a.slice(1) === 1) === horizontal) ? [colors[i]] : []));
            assert.equal(used.size, 4);
        }
        for (const incident of INCIDENT) assert.equal(new Set(incident.map(edge => colors[edge])).size, incident.length);
    }
});

test('prepared candidates have proper full solutions and certified unique clues, including contradiction strategies', () => {
    let contradictions = false;
    for (const prepared of PREPARED_PUZZLES) {
        const clues = [...prepared.clues].map(color => color === '.' ? null : Number(color));
        const result = countSolutions(clues);
        assert.ok(result.complete); assert.equal(result.solutions, 1);
        assert.deepEqual(result.solution, [...prepared.solution].map(Number));
        if (evaluateHumanDifficulty(clues).contradictionEliminations > 0) contradictions = true;
    }
    assert.ok(contradictions);
});

test('generation cancels workers, ignores late successes and errors, and recovers after failure', () => {
    const workers = [];
    const generator = new PuzzleGeneration(() => {
        const worker = { terminated: false, terminate() { this.terminated = true; }, postMessage(data) { this.request = data; } };
        workers.push(worker); return worker;
    }, 0);
    const results = []; let failures = 0;
    const start = difficulty => generator.start({ difficulty }, result => results.push(result), () => failures++);
    start('extreme'); start('easy');
    assert.ok(workers[0].terminated);
    workers[0].onmessage({ data: { puzzle: 'stale' } });
    workers[0].onerror({ preventDefault() {} });
    workers[1].onmessage({ data: { puzzle: 'easy' } });
    assert.deepEqual(results, ['easy']); assert.equal(failures, 0);
    assert.ok(workers[1].terminated);
    start('normal'); workers[2].onmessage({ data: { error: true } });
    assert.equal(failures, 1); assert.ok(workers[2].terminated);
    start('intro'); workers[3].onmessage({ data: { puzzle: 'intro' } });
    assert.deepEqual(results, ['easy', 'intro']);
    const broken = new PuzzleGeneration(() => { throw new Error('Unavailable'); });
    broken.start({}, () => assert.fail(), () => failures++);
    assert.equal(failures, 2);
});

test('all six four-color palettes are available and a new puzzle switches palette without changing size', () => {
    assert.equal(PALETTES.length, 6);
    assert.ok(PALETTES.every(palette => palette.length === 4 && new Set(palette).size === 4 && palette.every(color => /^#[A-F0-9]{6}$/.test(color))));
    for (let previous = 0; previous < 6; previous++) {
        const selected = new Set(Array.from({ length: 5 }, (_, slot) => choosePalette(previous, () => (slot + 0.5) / 5)));
        assert.equal(selected.size, 5);
        assert.ok(!selected.has(previous));
        const puzzle = createPuzzle(previous, seeded(71 + previous));
        assert.notEqual(puzzle.paletteIndex, previous);
        checkGrid(puzzle);
    }
});

test('equal sectors cover the circle and four-way junctions align exactly with grid edges', () => {
    const vertex = { id: 'center', x: 300, y: 300 };
    for (const angles of [[0.7], [-2.1, 0.1], [-2.8, -1, 1.3], [-Math.PI / 2, 0, Math.PI / 2, Math.PI]]) {
        const others = angles.map((angle, i) => ({ id: `v${i}`, x: 300 + Math.cos(angle) * 100, y: 300 + Math.sin(angle) * 100 }));
        const vertices = new Map([vertex, ...others].map(point => [point.id, point]));
        const edges = others.map((other, i) => ({ id: `e${i}`, a: vertex.id, b: other.id }));
        const sectors = vertexSectors(vertex, vertices, edges), span = Math.PI * 2 / angles.length;
        assert.equal(sectors.length, angles.length);
        sectors.forEach((sector, i) => {
            assert.equal(sector.span, span);
            assert.equal(sector.edgeId, `e${i}`);
            if (i) assert.ok(Math.abs(sectors[i - 1].start + span - sector.start) < 1e-9);
            if (angles.length === 4) assert.ok(Math.abs(Math.sin(sector.start + span / 2 - angles[i])) < 1e-9);
            assert.ok(!/NaN|Infinity/.test(sectorPath(vertex, sector.start, sector.span)));
        });
        const cost = rotation => sectors.reduce((sum, sector, i) => sum + 1 - Math.cos(sector.start + span / 2 + rotation - angles[i]), 0);
        for (let offset = -Math.PI; offset < Math.PI; offset += 0.05) assert.ok(cost(0) <= cost(offset) + 1e-9);
        assert.ok(Math.abs(sectors.at(-1).start + span - sectors[0].start - Math.PI * 2) < 1e-9);
    }
});

test('paint origins project onto edges, clamp endpoints and default to the midpoint', () => {
    const a = { x: 100, y: 200 }, b = { x: 400, y: 200 };
    assert.deepEqual(projectOnEdge({ x: 175, y: 210 }, a, b), { x: 175, y: 200 });
    assert.deepEqual(projectOnEdge({ x: 20, y: 201 }, a, b), a);
    assert.deepEqual(projectOnEdge({ x: 500, y: 205 }, a, b), b);
    assert.deepEqual(projectOnEdge(null, a, b), { x: 250, y: 200 });
});

test('painting supports the fourth color, toggling and recoloring without resetting the timer', () => {
    const puzzle = createPuzzle(null, seeded(4));
    const target = puzzle.edges.find(edge => !edge.locked);
    assert.equal(elapsedMs(puzzle, 9999), 0);
    assert.equal(paintEdge(puzzle, 'missing', 0, 500), false);
    for (const color of [-1, 4, 0.5, '3', null]) assert.equal(paintEdge(puzzle, target.id, color, 500), false);
    assert.equal(puzzle.startedAt, null);
    assert.ok(paintEdge(puzzle, target.id, 3, 1000));
    assert.equal(puzzle.startedAt, 1000);
    assert.equal(target.paintedColor, 3);
    paintEdge(puzzle, target.id, 3, 2000);
    assert.equal(target.paintedColor, null);
    paintEdge(puzzle, target.id, 2, 3000);
    paintEdge(puzzle, target.id, 1, 4000);
    assert.equal(target.paintedColor, 1);
    assert.equal(elapsedMs(puzzle, 5000), 4000);
});

test('conflicts at a four-way junction mark only repeated colors, including the fourth color', () => {
    const puzzle = createPuzzle(null, seeded(2));
    for (const edge of puzzle.edges) { edge.locked = false; edge.paintedColor = null; }
    const edges = puzzle.edges.filter(edge => edge.a === 'v40' || edge.b === 'v40');
    [3, 3, 1, 2].forEach((color, i) => paintEdge(puzzle, edges[i].id, color, 1000 + i));
    const conflict = analyse(puzzle);
    assert.deepEqual([...conflict.vertices], ['v40']);
    assert.deepEqual([...conflict.edges].sort(), [edges[0].id, edges[1].id].sort());
    paintEdge(puzzle, edges[1].id, 0, 2000);
    assert.equal(analyse(puzzle).edges.size, 0);
    assert.equal(analyse(puzzle).solved, false);
});

test('clues reject recoloring and erasing in every color without starting the timer', () => {
    const puzzle = createPuzzle(null, seeded(91)), before = JSON.stringify(puzzle);
    for (const edge of puzzle.edges.filter(edge => edge.locked)) {
        for (let color = 0; color < 4; color++) assert.equal(paintEdge(puzzle, edge.id, color, 1000), false);
    }
    assert.equal(JSON.stringify(puzzle), before);
    assert.equal(puzzle.startedAt, null);
});

test('completing the grid freezes time and prevents further editing', () => {
    const puzzle = createPuzzle();
    const editable = puzzle.edges.filter(edge => !edge.locked);
    editable.forEach((edge, i) => paintEdge(puzzle, edge.id, edge.solutionColor, 1000 + i * 2000));
    assert.ok(analyse(puzzle).solved);
    assert.equal(puzzle.finishedAt, 1000 + (editable.length - 1) * 2000);
    assert.equal(elapsedMs(puzzle, 999999), (editable.length - 1) * 2000);
    const before = JSON.stringify(puzzle);
    assert.equal(paintEdge(puzzle, editable[0].id, 2, 999999), false);
    assert.equal(JSON.stringify(puzzle), before);
    assert.ok(isValidPuzzle(puzzle));
});

test('timer preserves mm:ss formatting, long sessions and backward-clock protection', () => {
    assert.equal(formatTime(0), '00:00');
    assert.equal(formatTime(18999), '00:18');
    assert.equal(formatTime(60000), '01:00');
    assert.equal(formatTime(3661000), '61:01');
    assert.equal(formatTime(-1), '00:00');
    assert.equal(elapsedMs({ startedAt: 1000, finishedAt: null }, 500), 0);
});

test('reset restores the same initial puzzle and clues after partial play or completion on every difficulty', () => {
    for (const { id } of DIFFICULTIES) {
        const puzzle = generatePuzzle({ difficulty: id, seed: 'reset-' + id });
        const initial = structuredClone(puzzle);
        const editable = puzzle.edges.filter(edge => !edge.locked);
        paintEdge(puzzle, editable[0].id, 2, 1000);
        paintEdge(puzzle, editable[1].id, 2, 2000);
        resetPuzzle(puzzle);
        assert.deepEqual(puzzle, initial, 'partial reset preserves seed, geometry, palette, solution, clues and metrics');
        assert.ok(isValidPuzzle(puzzle));
        for (const edge of editable) paintEdge(puzzle, edge.id, edge.solutionColor, 3000);
        assert.ok(analyse(puzzle).solved);
        resetPuzzle(puzzle);
        assert.deepEqual(puzzle, initial, 'completed puzzle can be reset without generation');
        assert.equal(elapsedMs(puzzle, 10000), 0);
        paintEdge(puzzle, editable[0].id, 1, 11000);
        assert.equal(puzzle.startedAt, 11000, 'timer restarts on the first new move');
    }
});

test('storage restores exact grid, colors, selection and timestamps including completed puzzles', () => {
    let data;
    const storage = { getItem: key => key === STORAGE_KEY ? data : null, setItem: (_, value) => { data = value; } };
    const puzzle = createPuzzle(null, seeded(34));
    paintEdge(puzzle, puzzle.edges.find(edge => !edge.locked).id, 3, 2000);
    assert.equal(saveProgress(storage, puzzle, 3), true);
    assert.deepEqual(loadProgress(storage), { version: 6, puzzle, selectedColor: 3 });
    assert.equal(elapsedMs(loadProgress(storage).puzzle, 9000), 7000);
    for (const edge of puzzle.edges) if (edge.paintedColor !== edge.solutionColor) paintEdge(puzzle, edge.id, edge.solutionColor, 10000);
    saveProgress(storage, puzzle, 0);
    assert.ok(loadProgress(storage).puzzle.finishedAt !== null);
});

test('old non-unique saves are rejected for asynchronous generation of a new Intro puzzle', () => {
    for (const version of [1, 2, 3, 4]) {
        const saved = { version, puzzle: createPuzzle(), selectedColor: 2 };
        assert.equal(loadProgress({ getItem: () => JSON.stringify(saved) }), null);
    }
});

test('damaged, non-grid and unavailable saves fall back safely', () => {
    for (const data of ['bad json', 'null', '{}', '{"version":9}']) assert.equal(loadProgress({ getItem: () => data }), null);
    assert.equal(loadProgress(undefined), null);
    assert.equal(saveProgress({ setItem: () => { throw new Error('quota'); } }, createPuzzle(), 0), false);
    const original = createPuzzle(null, seeded(91));
    const corruptions = [
        puzzle => { puzzle.difficulty = 'missing'; },
        puzzle => { puzzle.seed = null; },
        puzzle => { puzzle.gridSize = 5; },
        puzzle => { puzzle.gridSize = null; },
        puzzle => { puzzle.clueCount = 24; },
        puzzle => { puzzle.solverMetrics.solutions = 2; },
        puzzle => { puzzle.solverMetrics.unknownEdges = 0; },
        puzzle => { puzzle.solverMetrics.branchCount = -1; },
        puzzle => { puzzle.vertices.pop(); },
        puzzle => { puzzle.vertices[0].x = Infinity; },
        puzzle => { puzzle.vertices[0].row = 9; },
        puzzle => { puzzle.vertices[1].id = puzzle.vertices[0].id; },
        puzzle => { puzzle.edges[0].a = 'absent'; },
        puzzle => { puzzle.edges[0].b = 'v10'; },
        puzzle => { puzzle.edges[0].b = 'v2'; },
        puzzle => { puzzle.edges[0].paintedColor = 4; },
        puzzle => { puzzle.edges[0].solutionColor = 4; },
        puzzle => { puzzle.edges[1].solutionColor = puzzle.edges[0].solutionColor; },
        puzzle => { puzzle.edges[1] = { ...puzzle.edges[0], id: 'duplicate' }; },
        puzzle => { puzzle.edges.pop(); },
        puzzle => { puzzle.startedAt = -1; },
        puzzle => { puzzle.finishedAt = 3000; },
        puzzle => { puzzle.edges.find(edge => !edge.locked).paintedColor = 1; },
        puzzle => { puzzle.edges.find(edge => edge.locked).locked = false; },
        puzzle => { puzzle.edges.find(edge => edge.locked).paintedColor = null; },
        puzzle => { const edge = puzzle.edges.find(edge => edge.locked); edge.paintedColor = (edge.solutionColor + 1) % 4; }
    ];
    for (const corrupt of corruptions) {
        const puzzle = structuredClone(original);
        corrupt(puzzle);
        assert.equal(isValidPuzzle(puzzle), false);
    }
});

test('compatible version 5 Extreme progress migrates intact; incompatible old counts reset', () => {
    const puzzle = generatePuzzle({ difficulty: 'extreme', seed: 'legacy' });
    paintEdge(puzzle, puzzle.edges.find(edge => !edge.locked).id, 2, 1000);
    delete puzzle.gridSize;
    const saved = { version: 5, puzzle, selectedColor: 2 };
    const restored = loadProgress({ getItem: () => JSON.stringify(saved) });
    assert.deepEqual(restored, { version: 6, puzzle: { ...puzzle, gridSize: 9 }, selectedColor: 2 });
    for (const difficulty of ['intro', 'easy', 'normal', 'hard', 'expert']) {
        saved.puzzle.difficulty = difficulty;
        assert.equal(loadProgress({ getItem: () => JSON.stringify(saved) }), null);
    }
});
