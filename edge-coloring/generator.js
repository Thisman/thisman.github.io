import { choosePalette } from './game.js';
import { gridVertices } from './layout.js';
import { ALL_COLORS, GRID_EDGES, countSolutions, searchDomains, seededRandom, shuffle } from './solver.js';
import { evaluateHumanDifficulty } from './human-solver.js';
import { getDifficulty, matchesDifficulty } from './difficulty.js';
import { PREPARED_PUZZLES } from './prepared-puzzles.js';
import { revealedSquares } from './grid-squares.js';
import { getGrid, gridForEdgeCount } from './grid.js';

const SEARCH_BUDGET = 50000;
const REMOVAL_ATTEMPTS = 20;
const SOLUTION_ATTEMPTS = 20;
const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join(':');
const edgeIndices = new Map(GRID_EDGES.map((edge, index) => [pairKey(+edge.a.slice(1), +edge.b.slice(1)), index]));

export function clueQuality(clues) {
    const { size, edges, incident } = gridForEdgeCount(clues.length);
    const colors = [0, 0, 0, 0], regions = Array(9).fill(0);
    clues.forEach((color, index) => {
        if (color === null) return;
        colors[color]++;
        const edge = edges[index], a = +edge.a.slice(1), b = +edge.b.slice(1);
        const row = Math.floor((Math.floor(a / size) + Math.floor(b / size)) * 3 / (2 * size));
        const column = Math.floor((a % size + b % size) * 3 / (2 * size));
        regions[row * 3 + column]++;
    });
    const count = colors.reduce((sum, value) => sum + value, 0);
    const fullyRevealed = incident.filter(group => group.length === 4 && group.every(edge => clues[edge] !== null)).length;
    const balanced = colors.every(value => value >= Math.floor(count / 4 * 0.75) && value <= Math.ceil(count / 4 * 1.25));
    const fullLimit = Math.ceil((size - 2) ** 2 * (count / edges.length) ** 4) + 2;
    const squares = revealedSquares(clues).length;
    return { colors, regions, fullyRevealed, squares, valid: balanced && regions.every(value => value > 0) && fullyRevealed <= fullLimit && squares === 0 };
}

export function generateSolution(random, size = 9) {
    const result = searchDomains(new Uint8Array(getGrid(size).edges.length).fill(ALL_COLORS), { limit: 1, random, nodeLimit: SEARCH_BUDGET });
    return result.complete ? result.solution : null;
}

export function removeClues(solution, target, random) {
    const edgeCount = solution.length;
    const clues = [...solution];
    let count = edgeCount;
    // First break closed clue squares. Prefer edges shared by more remaining
    // perimeters so Intro can still retain its exact, relatively high count.
    let squares = revealedSquares(clues);
    while (squares.length) {
        if (count <= target) return null;
        const coverage = Array(edgeCount).fill(0);
        for (const square of squares) for (const edge of square) coverage[edge]++;
        const order = shuffle(coverage.map((value, i) => i).filter(i => coverage[i]), random).sort((a, b) => coverage[b] - coverage[a]);
        let removed = false;
        for (const edge of order) {
            const color = clues[edge]; clues[edge] = null;
            const result = countSolutions(clues, 2, SEARCH_BUDGET);
            if (result.complete && result.solutions === 1) { count--; removed = true; break; }
            clues[edge] = color;
        }
        if (!removed) return null;
        squares = revealedSquares(clues);
    }
    if (count === target) return clues;
    for (const edge of shuffle(Array.from({ length: edgeCount }, (_, i) => i), random)) {
        if (clues[edge] === null) continue;
        const color = clues[edge]; clues[edge] = null;
        const result = countSolutions(clues, 2, SEARCH_BUDGET);
        if (result.complete && result.solutions === 1) count--;
        else clues[edge] = color;
        if (count === target) return clues;
    }
    return null;
}

function transformPrepared(prepared, random, target) {
    const colors = shuffle([0, 1, 2, 3], random), symmetry = Math.floor(random() * 8);
    const vertex = id => {
        let row = Math.floor(id / 9), column = id % 9;
        if (symmetry >= 4) column = 8 - column;
        for (let turn = 0; turn < symmetry % 4; turn++) [row, column] = [column, 8 - row];
        return row * 9 + column;
    };
    const solution = Array(GRID_EDGES.length), clues = Array(GRID_EDGES.length).fill(null);
    GRID_EDGES.forEach((edge, index) => {
        const next = edgeIndices.get(pairKey(vertex(+edge.a.slice(1)), vertex(+edge.b.slice(1))));
        solution[next] = colors[Number(prepared.solution[index])];
        if (prepared.clues[index] !== '.') clues[next] = solution[next];
    });
    // Adding clues to a certified unique puzzle preserves uniqueness. Every
    // transformed candidate is still independently checked before publication.
    let count = clues.filter(color => color !== null).length;
    for (const edge of shuffle(clues.map((color, i) => color === null ? i : -1).filter(i => i >= 0), random)) {
        if (count >= target) break;
        clues[edge] = solution[edge]; count++;
    }
    return { solution, clues };
}

export function generatePuzzle({ difficulty = 'intro', seed, previousPalette = null } = {}) {
    const config = getDifficulty(difficulty);
    if (!config || typeof seed !== 'string' || !seed.length) throw new Error('Invalid puzzle request');
    const random = seededRandom(seed);
    const grid = getGrid(config.gridSize);
    const accept = (solution, clues) => {
        if (!clues || clues.filter(color => color !== null).length !== config.clues || !clueQuality(clues).valid) return null;
        const metrics = evaluateHumanDifficulty(clues);
        if (!matchesDifficulty(difficulty, metrics)) return null;
        const result = countSolutions(clues, 2, SEARCH_BUDGET);
        if (!result.complete || result.solutions !== 1) return null;
        return {
            seed, difficulty, gridSize: config.gridSize, clueCount: config.clues, solverMetrics: { solutions: 1, ...metrics },
            paletteIndex: choosePalette(previousPalette, random), vertices: gridVertices(config.gridSize),
            edges: grid.edges.map((edge, i) => ({ ...edge, solutionColor: solution[i], paintedColor: clues[i], locked: clues[i] !== null })),
            startedAt: null, finishedAt: null
        };
    };
    if (config.gridSize === 9 && config.clues <= 40) {
        const candidates = PREPARED_PUZZLES.filter(item => item.clues.replaceAll('.', '').length <= config.clues);
        for (let attempt = 0; attempt < 2000; attempt++) {
            const prepared = candidates[Math.floor(random() * candidates.length)];
            const { solution, clues } = transformPrepared(prepared, random, config.clues);
            const puzzle = accept(solution, clues);
            if (puzzle) return puzzle;
        }
    } else {
        for (let full = 0; full < SOLUTION_ATTEMPTS; full++) {
            const solution = generateSolution(random, config.gridSize);
            if (!solution) continue;
            for (let attempt = 0; attempt < REMOVAL_ATTEMPTS; attempt++) {
                const puzzle = accept(solution, removeClues(solution, config.clues, random));
                if (puzzle) return puzzle;
            }
        }
    }
    throw new Error('No puzzle passed the uniqueness and difficulty checks');
}
