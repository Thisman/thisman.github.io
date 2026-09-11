import { analyse, isColor, PALETTES } from './game.js';
import { gridVertex } from './layout.js';
import { getDifficulty, matchesDifficulty } from './difficulty.js';
import { getGrid } from './grid.js';
import { revealedSquares } from './grid-squares.js';

export const STORAGE_KEY = 'edge-coloring:current:v1';
export const STORAGE_VERSION = 6;
const isTime = value => value === null || (Number.isFinite(value) && value >= 0);
const isPalette = value => Number.isInteger(value) && Boolean(PALETTES[value]);

export function isValidPuzzle(puzzle) {
    if (!puzzle || !isPalette(puzzle.paletteIndex) || !Array.isArray(puzzle.vertices) || !Array.isArray(puzzle.edges)) return false;
    const difficulty = getDifficulty(puzzle.difficulty);
    if (!difficulty || puzzle.gridSize !== difficulty.gridSize || puzzle.clueCount !== difficulty.clues || typeof puzzle.seed !== 'string' || !puzzle.seed.length) return false;
    const grid = getGrid(puzzle.gridSize), size = grid.size;
    const metrics = puzzle.solverMetrics;
    if (!metrics || metrics.solutions !== 1 || !matchesDifficulty(puzzle.difficulty, metrics)) return false;
    if (metrics.unknownEdges !== grid.edges.length - difficulty.clues) return false;
    for (const key of ['forcedMoves', 'pairOrTripleDeductions', 'contradictionChecks', 'contradictionEliminations', 'branchCount', 'maxBranchDepth', 'longestDependencyChain']) {
        if (!Number.isInteger(metrics[key]) || metrics[key] < 0) return false;
    }
    if (puzzle.vertices.length !== size ** 2 || puzzle.edges.length !== grid.edges.length) return false;
    if (!isTime(puzzle.startedAt) || !isTime(puzzle.finishedAt)) return false;
    const vertices = new Map();
    for (const vertex of puzzle.vertices) {
        if (!vertex || !Number.isInteger(vertex.row) || !Number.isInteger(vertex.column) || vertex.row < 0 || vertex.row >= size || vertex.column < 0 || vertex.column >= size) return false;
        const expected = gridVertex(vertex.row, vertex.column, size);
        if (vertex.id !== expected.id || vertices.has(vertex.id) || vertex.x !== expected.x || vertex.y !== expected.y) return false;
        vertices.set(vertex.id, { ...vertex, neighbors: new Set(), colors: new Set() });
    }
    const ids = new Set();
    for (const [index, edge] of puzzle.edges.entries()) {
        if (!edge || typeof edge.id !== 'string' || ids.has(edge.id) || !vertices.has(edge.a) || !vertices.has(edge.b) || !isColor(edge.solutionColor) || (edge.paintedColor !== null && !isColor(edge.paintedColor)) || typeof edge.locked !== 'boolean') return false;
        const expected = grid.edges[index];
        if (edge.id !== expected.id || edge.a !== expected.a || edge.b !== expected.b) return false;
        if (edge.locked && edge.paintedColor !== edge.solutionColor) return false;
        ids.add(edge.id);
        const a = vertices.get(edge.a), b = vertices.get(edge.b);
        if (Math.abs(a.row - b.row) + Math.abs(a.column - b.column) !== 1) return false;
        for (const [vertex, neighbor] of [[a, b], [b, a]]) {
            if (vertex.neighbors.has(neighbor.id) || vertex.colors.has(edge.solutionColor)) return false;
            vertex.neighbors.add(neighbor.id); vertex.colors.add(edge.solutionColor);
        }
    }
    // Canonical vertices and edges must match this difficulty's grid exactly.
    if (puzzle.edges.filter(edge => edge.locked).length !== difficulty.clues) return false;
    if (revealedSquares(puzzle.edges.map(edge => edge.locked ? edge.solutionColor : null)).length) return false;
    if (puzzle.startedAt === null && puzzle.edges.some(edge => !edge.locked && edge.paintedColor !== null)) return false;
    if (puzzle.finishedAt !== null && (puzzle.startedAt === null || puzzle.finishedAt < puzzle.startedAt)) return false;
    return analyse(puzzle).solved === (puzzle.finishedAt !== null);
}

export function loadProgress(storage) {
    try {
        const saved = JSON.parse(storage.getItem(STORAGE_KEY));
        if (!isColor(saved?.selectedColor)) return null;
        if (saved.version === STORAGE_VERSION && isValidPuzzle(saved.puzzle)) return saved;
        if (saved.version === 5) {
            const puzzle = { ...saved.puzzle, gridSize: Math.sqrt(saved.puzzle?.vertices?.length) };
            if (isValidPuzzle(puzzle)) return { version: STORAGE_VERSION, puzzle, selectedColor: saved.selectedColor };
        }
        // Incompatible old dimensions/counts start a new Intro asynchronously.
    } catch { /* Missing, damaged or unavailable storage must not prevent play. */ }
    return null;
}

export function saveProgress(storage, puzzle, selectedColor) {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, puzzle, selectedColor }));
        return true;
    } catch { return false; }
}
