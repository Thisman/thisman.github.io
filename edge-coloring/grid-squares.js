import { getGrid, gridForEdgeCount } from './grid.js';

// Include square perimeters of every size, not only elementary cells.
export const GRID_SQUARES = getGrid(9).squares;
export const revealedSquares = clues => gridForEdgeCount(clues.length).squares.filter(square => square.every(edge => clues[edge] !== null));
